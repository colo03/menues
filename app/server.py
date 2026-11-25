"""Servidor web de SaleListo: API transaccional, QR cortos 4G/5G y tiempo real por rol.

Funciona tanto en computadora local (`python app/server.py` o `--tunnel` con
Cloudflare Tunnel HTTPS integrado) como publicado en cloud HTTPS (`Render`,
`Fly.io`, `Railway`, VPS o dominio propio) para que los clientes escaneen el QR
con sus propios datos moviles 4G/5G sin conectarse al Wi-Fi del restaurante.
"""
from __future__ import annotations

import atexit
import csv
import gzip
import hashlib
import hmac
import io
import ipaddress
import json
import mimetypes
import os
import queue
import re
import secrets
import signal
import socket
import sys
import threading
import time
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse
import urllib.request

from db import (
    AR_TZ,
    SHIFT_CUTOFF_HOUR,
    ActionError,
    AuthError,
    Database,
    gastronomic_day_bounds_ms,
    start_of_today_ms,
)
from qrgen import qr_svg
from tunnel import TunnelError, TunnelManager
from webpush import (
    b64url_decode,
    decode_p256_public,
    dispatch_webpush_async,
    ensure_vapid_keys,
    validate_push_endpoint,
)

mimetypes.add_type('application/javascript; charset=utf-8', '.js')
mimetypes.add_type('application/manifest+json; charset=utf-8', '.webmanifest')
mimetypes.add_type('application/json; charset=utf-8', '.json')
mimetypes.add_type('application/xml; charset=utf-8', '.xml')
mimetypes.add_type('text/plain; charset=utf-8', '.txt')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('text/css; charset=utf-8', '.css')
mimetypes.add_type('video/mp4', '.mp4')
mimetypes.add_type('video/webm', '.webm')
mimetypes.add_type('image/webp', '.webp')

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
MEDIA_DIR = PUBLIC / 'media'
DATA_DIR = Path(os.environ.get('DATA_DIR') or (ROOT / 'data')).resolve()
DB_PATH = DATA_DIR / 'salelisto.db'
UPLOADS_DIR = DATA_DIR / 'uploads'


def _parse_initial_port(argv: list[str]) -> int:
    for idx, arg in enumerate(argv[1:], start=1):
        if arg == '--port' and idx + 1 < len(argv) and argv[idx + 1].isdigit():
            return int(argv[idx + 1])
        if arg.startswith('--port=') and arg.split('=', 1)[1].isdigit():
            return int(arg.split('=', 1)[1])
    if len(argv) > 1 and argv[1].isdigit():
        return int(argv[1])
    try:
        return int(os.environ.get('PORT') or 8123)
    except ValueError:
        return 8123


PORT = _parse_initial_port(sys.argv)

SAFE_HOST_RE = re.compile(r'^[A-Za-z0-9.\[\]:-]{1,253}$')
SHORT_QR_PATH_RE = re.compile(r'^/q/([A-Za-z0-9_-]{1,64})/?$')
GZIP_MIN_BYTES = 512
SSE_KEEPALIVE_S = 15

# Cotización USD -> ARS en vivo (Dólar oficial venta) con caché de 30 min y respaldo automático
FX_DEFAULT_RATE = 1615.0
FX_DEFAULT_BUY = 1565.0
FX_CACHE_TTL_S = 1800
FX_RETRY_TTL_S = 300
_fx_lock = threading.Lock()
_fx_cache: dict[str, Any] = {
    'fetchedAt': 0.0,
    'ttl': 0.0,
    'payload': {
        'ok': True,
        'pair': 'USD-ARS',
        'rate': FX_DEFAULT_RATE,
        'buy': FX_DEFAULT_BUY,
        'source': 'Dólar oficial venta (referencia)',
        'updatedAt': '',
        'live': False,
    },
}


def _fetch_live_usd_ars() -> dict[str, Any] | None:
    """Consulta la cotización oficial venta USD/ARS en vivo con dos proveedores públicos."""
    # 1. DolarAPI oficial
    try:
        req = urllib.request.Request(
            'https://dolarapi.com/v1/dolares/oficial',
            headers={'User-Agent': 'SaleListo/1.0', 'Accept': 'application/json'},
        )
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode('utf-8'))
                venta = float(data.get('venta') or 0)
                compra = float(data.get('compra') or 0)
                if 100.0 <= venta <= 100000.0:
                    return {
                        'ok': True,
                        'pair': 'USD-ARS',
                        'rate': round(venta, 2),
                        'buy': round(compra, 2) if compra > 0 else round(venta, 2),
                        'source': 'Dólar oficial venta',
                        'updatedAt': str(data.get('fechaActualizacion') or ''),
                        'live': True,
                    }
    except Exception:
        pass

    # 2. Respaldo Bluelytics oficial
    try:
        req = urllib.request.Request(
            'https://api.bluelytics.com.ar/v2/latest',
            headers={'User-Agent': 'SaleListo/1.0', 'Accept': 'application/json'},
        )
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode('utf-8'))
                of = data.get('oficial') or {}
                venta = float(of.get('value_sell') or 0)
                compra = float(of.get('value_buy') or 0)
                if 100.0 <= venta <= 100000.0:
                    return {
                        'ok': True,
                        'pair': 'USD-ARS',
                        'rate': round(venta, 2),
                        'buy': round(compra, 2) if compra > 0 else round(venta, 2),
                        'source': 'Dólar oficial venta',
                        'updatedAt': str(data.get('last_update') or ''),
                        'live': True,
                    }
    except Exception:
        pass

    return None


def get_usd_ars_rate(force: bool = False) -> dict[str, Any]:
    now = time.time()
    offline = (os.environ.get('SALELISTO_OFFLINE_FX') or '').strip().lower() in ('1', 'true', 'yes')
    with _fx_lock:
        age = now - float(_fx_cache['fetchedAt'])
        if not force and _fx_cache['fetchedAt'] > 0 and age < float(_fx_cache['ttl']):
            return dict(_fx_cache['payload'])
        if offline:
            _fx_cache['fetchedAt'] = now
            _fx_cache['ttl'] = FX_CACHE_TTL_S
            return dict(_fx_cache['payload'])

    fresh = _fetch_live_usd_ars()
    with _fx_lock:
        _fx_cache['fetchedAt'] = time.time()
        if fresh:
            _fx_cache['payload'] = fresh
            _fx_cache['ttl'] = FX_CACHE_TTL_S
        else:
            prev = dict(_fx_cache['payload'])
            prev['live'] = False
            _fx_cache['payload'] = prev
            _fx_cache['ttl'] = FX_RETRY_TTL_S
        return dict(_fx_cache['payload'])

COMPRESSIBLE_MIME_TYPES = {
    'application/json',
    'application/javascript',
    'application/xml',
    'text/javascript',
    'text/html',
    'text/css',
    'text/xml',
    'image/svg+xml',
    'application/manifest+json',
    'text/csv',
    'text/plain',
}


def ensure_server_secret(data_dir: Path) -> bytes:
    """Carga o crea de forma atómica el secreto de 32 bytes en DATA_DIR/server_secret.key."""
    data_dir.mkdir(parents=True, exist_ok=True)
    secret_file = data_dir / 'server_secret.key'
    if secret_file.is_file():
        try:
            raw_bytes = secret_file.read_bytes().strip()
            try:
                as_text = raw_bytes.decode('ascii').strip()
                if len(as_text) == 64:
                    return bytes.fromhex(as_text)
            except (UnicodeDecodeError, ValueError):
                pass
            if len(raw_bytes) >= 32:
                return raw_bytes[:32]
        except OSError:
            pass

    fresh = secrets.token_bytes(32)
    tmp_file = data_dir / f'server_secret.{secrets.token_hex(4)}.tmp'
    tmp_file.write_text(fresh.hex() + '\n', encoding='ascii')
    tmp_file.replace(secret_file)
    try:
        os.chmod(secret_file, 0o600)
    except OSError:
        pass
    return fresh


SERVER_SECRET = ensure_server_secret(DATA_DIR)
db = Database(DB_PATH, UPLOADS_DIR)
VAPID_KEYS = ensure_vapid_keys(DATA_DIR)

STAFF_ROLES = ('admin', 'demo_admin', 'waiter', 'kitchen')

# Anti-spam liviano para el formulario público de la Landing (por IP real)
LEAD_WINDOW_S = 600
LEAD_MAX_PER_WINDOW = 6
leads_rate: dict[str, list[float]] = {}
leads_rate_lock = threading.Lock()

# Anti fuerza bruta para endpoints /api/auth/* (por IP real)
AUTH_WINDOW_S = 300
AUTH_MAX_FAILURES = 10
auth_failures: dict[str, list[float]] = {}
auth_rate_lock = threading.Lock()


def is_cloud_env() -> bool:
    return any(
        bool((os.environ.get(var) or '').strip())
        for var in ('RENDER', 'FLY_APP_NAME', 'RAILWAY_ENVIRONMENT')
    )


def _explicit_trust_proxy() -> bool | None:
    raw = (os.environ.get('TRUST_PROXY') or '').strip().lower()
    if raw in ('1', 'true', 'yes', 'on'):
        return True
    if raw in ('0', 'false', 'no', 'off'):
        return False
    return None


def trust_proxy_enabled() -> bool:
    explicit = _explicit_trust_proxy()
    if explicit is not None:
        return explicit
    return is_cloud_env()


def sanitize_ip(raw: str) -> str:
    txt = str(raw or '').strip()
    if not txt:
        return ''
    if txt.startswith('[') and ']' in txt:
        txt = txt[1 : txt.index(']')]
    elif txt.count(':') == 1 and '.' in txt:
        # IPv4 con puerto (ej. 181.45.10.2:52310)
        txt = txt.split(':', 1)[0]
    try:
        ip = ipaddress.ip_address(txt)
    except ValueError:
        return ''
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        return str(ip.ipv4_mapped)
    return str(ip)


def is_loopback_ip(ip_str: str) -> bool:
    clean = sanitize_ip(ip_str)
    if not clean:
        return False
    try:
        return ipaddress.ip_address(clean).is_loopback
    except ValueError:
        return False


INTERNAL_PROXY_NETWORKS = (
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('169.254.0.0/16'),
    ipaddress.ip_network('0.0.0.0/8'),
    ipaddress.ip_network('::1/128'),
    ipaddress.ip_network('fc00::/7'),
    ipaddress.ip_network('fe80::/10'),
    ipaddress.ip_network('::/128'),
)


def is_internal_proxy_ip(ip_str: str) -> bool:
    """Devuelve True para saltos de proxy/LAN internos (RFC1918, loopback, link-local, ULA)."""
    clean = sanitize_ip(ip_str)
    if not clean:
        return False
    try:
        ip = ipaddress.ip_address(clean)
        return any(ip in net for net in INTERNAL_PROXY_NETWORKS)
    except ValueError:
        return False


def _header_get_all(headers: Any, name: str) -> list[str]:
    if headers is None:
        return []
    if hasattr(headers, 'get_all'):
        vals = headers.get_all(name)
        return [str(v) for v in (vals or []) if v is not None]
    if hasattr(headers, 'items'):
        target = name.lower()
        out = [str(v) for k, v in headers.items() if str(k).lower() == target and v is not None]
        if out:
            return out
    val = headers.get(name) if hasattr(headers, 'get') else None
    return [str(val)] if val else []


def _header_get_one(headers: Any, name: str) -> str:
    vals = _header_get_all(headers, name)
    return vals[0] if vals else ''


def _etag_matches(inm_header: str, etag: str) -> bool:
    raw = str(inm_header or '').strip()
    if not raw or not etag:
        return False
    if raw == '*':
        return True
    target = etag.removeprefix('W/').strip()
    for part in raw.split(','):
        cand = part.strip().removeprefix('W/').strip()
        if cand == target:
            return True
    return False


def is_public_4g_url(url: str) -> bool:
    """Devuelve True si la URL usa HTTPS sobre un host público accesible desde 4G/5G."""
    try:
        parsed = urlparse(str(url or '').strip())
    except ValueError:
        return False
    if parsed.scheme != 'https':
        return False
    host = (parsed.hostname or '').strip().lower().rstrip('.')
    if not host:
        return False
    if host in ('localhost', '0.0.0.0') or host.endswith(('.local', '.localhost', '.lan', '.internal')):
        return False
    try:
        ip = ipaddress.ip_address(host)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return False
    except ValueError:
        # Nombre de dominio público (debe contener al menos un punto)
        if '.' not in host:
            return False
    return True


def _host_is_loopback(host_header: str) -> bool:
    h = str(host_header or '').strip().lower()
    if not h:
        return True
    parsed = urlparse(f'http://{h}')
    hn = (parsed.hostname or '').lower()
    return hn in ('localhost', '127.0.0.1', '::1', '0.0.0.0') or is_loopback_ip(hn)


def make_admin_token() -> str:
    # Vinculado al PIN actual y a SERVER_SECRET persistido: sobrevive reinicios y se invalida si cambia el PIN
    with db.lock:
        conn = db._connect()
        try:
            pin = conn.execute('SELECT admin_pin FROM restaurant WHERE id = 1').fetchone()['admin_pin']
        finally:
            conn.close()
    return 'adm_' + hmac.new(SERVER_SECRET, str(pin).encode('utf-8'), hashlib.sha256).hexdigest()


def resolve_role(token: str, target_db: Database | None = None) -> str:
    use_db = target_db or db
    tok = str(token or '').strip()
    if not tok:
        return 'client'
    if use_db is db and hmac.compare_digest(tok, make_admin_token()):
        return 'admin'
    sess = use_db.get_staff_session(tok)
    if sess:
        return str(sess['role'])
    return 'client'


def create_staff_token(role: str = 'waiter', waiter_id: str = '', target_db: Database | None = None) -> str:
    use_db = target_db or db
    return use_db.create_staff_session(role=role, waiter_id=waiter_id)


def lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sk:
            sk.connect(('10.255.255.255', 1))
            return sk.getsockname()[0]
    except OSError:
        return '127.0.0.1'


# ---------- Suscriptores Server-Sent Events (filtrados por rol y acotados) ----------

class Subscriber:
    def __init__(self, scope: str, qr_token: str = '', legacy_code: str = ''):
        self.scope = scope  # 'admin' | 'demo_admin' | 'staff' | 'client'
        self.qr_token = qr_token
        self.legacy_code = legacy_code
        self.q: queue.Queue[str] = queue.Queue(maxsize=24)

    def enqueue(self, payload: str) -> None:
        while True:
            try:
                self.q.put_nowait(payload)
                return
            except queue.Full:
                try:
                    self.q.get_nowait()
                except queue.Empty:
                    pass


subscribers: set[Subscriber] = set()
subs_lock = threading.Lock()

# ---------- Sandboxes efímeros en memoria por visita para /demo (sin persistencia) ----------

DEMO_SID_RE = re.compile(r'^[A-Za-z0-9_-]{8,48}$')
DEMO_SANDBOX_TTL_S = 1200
DEMO_SANDBOX_MAX = 60


class DemoSandbox:
    def __init__(self, sid: str):
        self.sid = sid
        self.db = Database(None, UPLOADS_DIR, memory_name=f'{sid}_{secrets.token_hex(3)}')
        self.subscribers: set[Subscriber] = set()
        self.subs_lock = threading.Lock()
        self.last_access = time.time()

    def close(self) -> None:
        self.db.close()


_demo_sandboxes: dict[str, DemoSandbox] = {}
_demo_sandboxes_lock = threading.Lock()


def _prune_demo_sandboxes_locked(now: float) -> None:
    expired = [
        k
        for k, sb in _demo_sandboxes.items()
        if (now - sb.last_access) > DEMO_SANDBOX_TTL_S and not sb.subscribers
    ]
    for k in expired:
        sb = _demo_sandboxes.pop(k, None)
        if sb:
            sb.close()
    while len(_demo_sandboxes) >= DEMO_SANDBOX_MAX:
        # Descartar primero los sandboxes inactivos más antiguos
        idle = [k for k, sb in _demo_sandboxes.items() if not sb.subscribers]
        pool = idle if idle else list(_demo_sandboxes.keys())
        oldest = min(pool, key=lambda k: _demo_sandboxes[k].last_access)
        sb = _demo_sandboxes.pop(oldest, None)
        if sb:
            sb.close()


def get_demo_sandbox(sid: str) -> DemoSandbox | None:
    clean = str(sid or '').strip()
    if not clean or not DEMO_SID_RE.match(clean):
        return None
    if not db.is_demo_mode():
        return None
    now = time.time()
    with _demo_sandboxes_lock:
        sb = _demo_sandboxes.get(clean)
        if sb is not None:
            sb.last_access = now
            return sb
        _prune_demo_sandboxes_locked(now)
        sb = DemoSandbox(clean)
        _demo_sandboxes[clean] = sb
        return sb


def discard_demo_sandbox(sid: str) -> bool:
    clean = str(sid or '').strip()
    if not clean:
        return False
    with _demo_sandboxes_lock:
        sb = _demo_sandboxes.pop(clean, None)
    if sb:
        sb.close()
        return True
    return False


def _on_push_expired(endpoint: str) -> None:
    if db.delete_push_subscription(endpoint):
        broadcast_updates()


def flush_pending_webpush() -> None:
    deliveries = db.drain_push_deliveries()
    if deliveries:
        dispatch_webpush_async(deliveries, VAPID_KEYS, on_expired=_on_push_expired)


def _staff_scope_for_role(role: str) -> str:
    if role == 'admin':
        return 'admin'
    if role == 'demo_admin':
        return 'demo_admin'
    return 'staff'


def resolve_base_url_info(
    headers: Any = None,
    trusted_proxy: bool = False,
    port: int | None = None,
) -> tuple[str, str]:
    """Determina la URL pública efectiva respetando la precedencia 4G/5G.

    Precedencia:
      1. `restaurant.public_url` configurado manualmente en SQLite
      2. Variable de entorno `PUBLIC_URL`
      3. URL activa del túnel `cloudflared` (`tunnel_manager.active_url()`)
      4. Cabeceras `X-Forwarded-Proto`/`X-Forwarded-Host` (solo si el proxy es confiable)
      5. URL externa cloud (`RENDER_EXTERNAL_URL` / `FLY_APP_NAME`)
      6. `http://<lan_ip>:<PORT>` (o `Host` directo si no es loopback)
    """
    configured = db.get_public_url()
    if configured:
        return configured, 'restaurant_public_url'

    env_public = (os.environ.get('PUBLIC_URL') or '').strip().rstrip('/')
    if env_public:
        return env_public, 'env_public_url'

    tunnel_url = tunnel_manager.active_url()
    if tunnel_url:
        return tunnel_url, 'tunnel'

    if trusted_proxy and headers is not None:
        xf_host = (headers.get('X-Forwarded-Host') or '').split(',')[0].strip()
        raw_host = xf_host or (headers.get('Host') or '').strip()
        xf_proto = (headers.get('X-Forwarded-Proto') or '').split(',')[0].strip().lower()
        proto = xf_proto if xf_proto in ('http', 'https') else ('https' if is_cloud_env() else 'http')
        if raw_host and SAFE_HOST_RE.match(raw_host) and not _host_is_loopback(raw_host):
            return f'{proto}://{raw_host}', 'forwarded_proxy'

    render_url = (os.environ.get('RENDER_EXTERNAL_URL') or '').strip().rstrip('/')
    if render_url:
        return render_url, 'cloud_env'
    fly_app = (os.environ.get('FLY_APP_NAME') or '').strip()
    if fly_app:
        return f'https://{fly_app}.fly.dev', 'cloud_env'

    if headers is not None:
        direct_host = (headers.get('Host') or '').strip()
        if direct_host and SAFE_HOST_RE.match(direct_host) and not _host_is_loopback(direct_host):
            return f'http://{direct_host}', 'lan_host'

    use_port = int(port or PORT)
    return f'http://{lan_ip()}:{use_port}', 'lan'


def build_network_snapshot(
    role: str = 'client',
    headers: Any = None,
    trusted_proxy: bool = False,
    port: int | None = None,
) -> dict[str, Any]:
    base, source = resolve_base_url_info(headers=headers, trusted_proxy=trusted_proxy, port=port)
    use_port = int(port or PORT)
    pub4g = is_public_4g_url(base)
    is_real_admin = role == 'admin'
    return {
        'baseUrl': base,
        'urlSource': source,
        'lanUrl': f'http://{lan_ip()}:{use_port}',
        'isHttps': base.startswith('https://'),
        'isPublic': pub4g,
        'isPublic4g': pub4g,
        'isLocalOnly': not pub4g,
        'isTemporaryTunnel': '.trycloudflare.com' in base.lower(),
        'cloudEnv': is_cloud_env(),
        'canManageTunnel': is_real_admin,
        'canAutoInstallTunnel': is_real_admin,
        'tunnel': tunnel_manager.status(include_details=is_real_admin),
    }


def get_enriched_staff_state(
    role: str = 'staff',
    headers: Any = None,
    trusted_proxy: bool = False,
    port: int | None = None,
    target_db: Database | None = None,
) -> dict[str, Any]:
    use_db = target_db or db
    st = use_db.get_staff_state(role=role)
    st['network'] = build_network_snapshot(
        role=role,
        headers=headers,
        trusted_proxy=trusted_proxy,
        port=port,
    )
    return st


def broadcast_updates(
    target_db: Database | None = None,
    target_subs: set[Subscriber] | None = None,
    target_lock: threading.Lock | None = None,
) -> None:
    use_db = target_db or db
    use_subs = target_subs if target_subs is not None else subscribers
    use_lock = target_lock if target_lock is not None else subs_lock
    with use_lock:
        current_subs = list(use_subs)
    if not current_subs:
        return

    staff_cache: dict[str, str] = {}
    client_cache: dict[tuple[str, str], str] = {}
    demo_on: bool | None = None

    for sub in current_subs:
        if sub.scope in ('admin', 'demo_admin', 'staff'):
            eff_scope = sub.scope
            if eff_scope == 'demo_admin':
                if demo_on is None:
                    demo_on = use_db.is_demo_mode()
                if not demo_on:
                    eff_scope = 'staff'
            if eff_scope not in staff_cache:
                staff_cache[eff_scope] = json.dumps(
                    get_enriched_staff_state(role=eff_scope, target_db=use_db),
                    ensure_ascii=False,
                )
            sub.enqueue(staff_cache[eff_scope])
        else:
            key = (sub.qr_token, sub.legacy_code)
            if key not in client_cache:
                client_cache[key] = json.dumps(
                    use_db.get_client_state(sub.qr_token, sub.legacy_code),
                    ensure_ascii=False,
                )
            sub.enqueue(client_cache[key])


tunnel_manager = TunnelManager(DATA_DIR, default_port=PORT, on_change=broadcast_updates)
atexit.register(tunnel_manager.stop)


class Handler(SimpleHTTPRequestHandler):
    timeout = 30

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def _server_port(self) -> int:
        srv = getattr(self, 'server', None)
        if srv is not None and getattr(srv, 'server_port', None):
            return int(srv.server_port)
        return PORT

    def end_headers(self) -> None:
        req_path = self.path.split('?', 1)[0]
        if req_path == '/sw.js':
            self.send_header('Service-Worker-Allowed', '/')
        if req_path == '/api/health':
            self.send_header('Access-Control-Allow-Origin', '*')
        # /uploads/, /media/ y /api/events gestionan su propio Cache-Control
        if not (
            req_path.startswith('/uploads/')
            or req_path.startswith('/media/')
            or req_path == '/api/events'
        ):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        if '/api/' in self.path and 'events' not in self.path:
            sys.stderr.write(f"{self.command} {self.path} {args[1] if len(args) > 1 else ''}\n")

    # ---------- Proxy confiable, IP real y Compresión Gzip ----------

    def _peer_ip(self) -> str:
        raw = str(self.client_address[0]) if self.client_address else ''
        return sanitize_ip(raw) or raw

    def _is_trusted_proxy(self) -> bool:
        peer = self._peer_ip()
        if is_loopback_ip(peer):
            return True
        explicit = _explicit_trust_proxy()
        if explicit is not None:
            return explicit
        if is_cloud_env():
            # En cloud (Render/Fly/Railway), el proxy interno se conecta por red privada/loopback, nunca desde IP publica directa
            return is_internal_proxy_ip(peer)
        return False

    def _client_ip(self) -> str:
        """Devuelve la IP real del cliente 4G/5G cuando entra por cloudflared o proxy confiable.

        - En LAN directa sin TRUST_PROXY ignora por completo CF-Connecting-IP / X-Forwarded-For.
        - En Fly.io prioriza Fly-Client-IP.
        - Acepta CF-Connecting-IP solo cuando el peer es loopback (cloudflared local),
          TRUST_PROXY esta explicito o viene cabecera CF-Ray de Cloudflare Edge.
        - En X-Forwarded-For une todas las cabeceras y elige de derecha a izquierda la
          primera IP publica global (evitando spoofing de prefijos inyectados por el atacante).
        """
        peer = self._peer_ip()
        if not self._is_trusted_proxy():
            return peer or 'unknown'

        if (os.environ.get('FLY_APP_NAME') or '').strip():
            fly_ip = sanitize_ip(_header_get_one(self.headers, 'Fly-Client-IP'))
            if fly_ip:
                return fly_ip

        allow_cf = (
            is_loopback_ip(peer)
            or _explicit_trust_proxy() is True
            or bool(_header_get_one(self.headers, 'CF-Ray').strip())
        )
        if allow_cf:
            cf_ip = sanitize_ip(_header_get_one(self.headers, 'CF-Connecting-IP'))
            if cf_ip:
                return cf_ip

        xff_candidates: list[str] = []
        for hdr_val in _header_get_all(self.headers, 'X-Forwarded-For'):
            for part in hdr_val.split(','):
                candidate = sanitize_ip(part)
                if candidate:
                    xff_candidates.append(candidate)

        if xff_candidates:
            for candidate in reversed(xff_candidates):
                if not is_internal_proxy_ip(candidate):
                    return candidate
            return xff_candidates[-1]

        return peer or 'unknown'

    def _effective_base_url(self) -> str:
        base, _ = resolve_base_url_info(
            headers=self.headers,
            trusted_proxy=self._is_trusted_proxy(),
            port=self._server_port(),
        )
        return base

    def _network_snapshot(self, role: str = 'client') -> dict[str, Any]:
        return build_network_snapshot(
            role=role,
            headers=self.headers,
            trusted_proxy=self._is_trusted_proxy(),
            port=self._server_port(),
        )

    def _accepts_gzip(self) -> bool:
        ae = (self.headers.get('Accept-Encoding') or '').lower()
        if 'gzip' not in ae:
            return False
        for item in ae.split(','):
            parts = [p.strip() for p in item.split(';') if p.strip()]
            if not parts or parts[0] != 'gzip':
                continue
            q = 1.0
            for param in parts[1:]:
                m = re.match(r'^q\s*=\s*(.+)$', param)
                if m:
                    try:
                        q = float(m.group(1).strip())
                    except ValueError:
                        q = 0.0
            return q > 0.0
        return False

    @staticmethod
    def _is_compressible_type(content_type: str) -> bool:
        base_mime = str(content_type or '').split(';', 1)[0].strip().lower()
        return base_mime in COMPRESSIBLE_MIME_TYPES

    def send_bytes(
        self,
        code: int,
        raw: bytes,
        content_type: str,
        *,
        extra_headers: dict[str, str] | None = None,
        head_only: bool = False,
        compressible: bool | None = None,
    ) -> None:
        if code in (204, 304) or 100 <= code < 200:
            self.send_response(code)
            if extra_headers:
                for k, v in extra_headers.items():
                    self.send_header(k, v)
            self.end_headers()
            return

        can_compress = self._is_compressible_type(content_type) if compressible is None else bool(compressible)
        payload = raw
        use_gzip = False
        if can_compress and len(raw) >= GZIP_MIN_BYTES and self._accepts_gzip():
            gz = gzip.compress(raw, compresslevel=6)
            if len(gz) < len(raw):
                payload = gz
                use_gzip = True

        self.send_response(code)
        self.send_header('Content-Type', content_type)
        if can_compress:
            self.send_header('Vary', 'Accept-Encoding')
        if use_gzip:
            self.send_header('Content-Encoding', 'gzip')
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        if not head_only and payload:
            self.wfile.write(payload)

    def send_json(self, code: int, body: Any) -> None:
        raw = (
            body.encode('utf-8')
            if isinstance(body, str)
            else json.dumps(body, ensure_ascii=False).encode('utf-8')
        )
        self.send_bytes(code, raw, 'application/json; charset=utf-8', compressible=True)

    def _serve_static_file_compressed(self, target: Path, content_type: str, head_only: bool = False) -> None:
        st = target.stat()
        last_mod = self.date_time_string(int(st.st_mtime))
        etag_gz = f'"{st.st_size:x}-{int(st.st_mtime):x}-gz"'
        etag_id = f'"{st.st_size:x}-{int(st.st_mtime):x}-id"'
        want_gzip = self._is_compressible_type(content_type) and st.st_size >= GZIP_MIN_BYTES and self._accepts_gzip()
        inm = self.headers.get('If-None-Match') or ''

        # Atajo rapido 304 sin leer disco si la variante solicitada coincide con el ETag
        fast_etag = etag_gz if want_gzip else etag_id
        if _etag_matches(inm, fast_etag):
            self.send_bytes(
                304,
                b'',
                content_type,
                extra_headers={
                    'ETag': fast_etag,
                    'Last-Modified': last_mod,
                    'Vary': 'Accept-Encoding',
                },
                head_only=True,
                compressible=False,
            )
            return

        raw = target.read_bytes()
        payload = raw
        use_gzip = False
        if want_gzip:
            gz = gzip.compress(raw, compresslevel=6)
            if len(gz) < len(raw):
                payload = gz
                use_gzip = True

        actual_etag = etag_gz if use_gzip else etag_id
        if _etag_matches(inm, actual_etag):
            self.send_bytes(
                304,
                b'',
                content_type,
                extra_headers={
                    'ETag': actual_etag,
                    'Last-Modified': last_mod,
                    'Vary': 'Accept-Encoding',
                },
                head_only=True,
                compressible=False,
            )
            return

        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Vary', 'Accept-Encoding')
        if use_gzip:
            self.send_header('Content-Encoding', 'gzip')
        self.send_header('ETag', actual_etag)
        self.send_header('Last-Modified', last_mod)
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        if not head_only and payload:
            self.wfile.write(payload)

    def _serve_short_qr(self, head_only: bool = False) -> None:
        target = (PUBLIC / 'cliente.html').resolve()
        if not target.is_file():
            self.send_error(404, 'Vista de cliente no encontrada')
            return
        self._serve_static_file_compressed(target, 'text/html; charset=utf-8', head_only=head_only)

    def _try_serve_static_compressed(self, req_path: str, head_only: bool = False) -> bool:
        """Sirve archivos estáticos textuales (HTML/CSS/JS/SVG/JSON) con ETag/304 y Gzip para 4G/5G."""
        raw_rel = unquote(req_path).lstrip('/')
        rel = raw_rel + 'index.html' if (not raw_rel or raw_rel.endswith('/')) else raw_rel
        pub_root = PUBLIC.resolve()
        try:
            target = (pub_root / rel).resolve()
        except (OSError, ValueError):
            return False
        if pub_root not in target.parents or not target.is_file():
            # Rutas limpias sin .html: /demo -> demo.html, /producto -> producto.html, /planes -> planes.html
            if raw_rel.endswith('/'):
                slug = raw_rel.rstrip('/')
                if slug and '/' not in slug and '.' not in slug:
                    try:
                        alt = (pub_root / f'{slug}.html').resolve()
                    except (OSError, ValueError):
                        return False
                    if pub_root in alt.parents and alt.is_file():
                        parsed = urlparse(self.path)
                        dest = f'/{slug}' + (f'?{parsed.query}' if parsed.query else '')
                        self.send_response(301)
                        self.send_header('Location', dest)
                        self.send_header('Content-Length', '0')
                        self.end_headers()
                        return True
                return False
            if raw_rel and '/' not in raw_rel and '.' not in raw_rel:
                try:
                    alt = (pub_root / f'{raw_rel}.html').resolve()
                except (OSError, ValueError):
                    return False
                if pub_root not in alt.parents or not alt.is_file():
                    return False
                target = alt
            else:
                return False
        mime, _ = mimetypes.guess_type(str(target))
        if not mime or not self._is_compressible_type(mime):
            return False
        if mime.startswith('text/') and 'charset=' not in mime:
            mime = f'{mime}; charset=utf-8'
        self._serve_static_file_compressed(target, mime, head_only=head_only)
        return True

    def _serve_upload(self, rel_path: str, head_only: bool = False) -> None:
        fname = Path(rel_path).name
        target = (UPLOADS_DIR / fname).resolve()
        if target.parent != UPLOADS_DIR.resolve() or not target.is_file():
            self.send_error(404, 'Imagen no encontrada')
            return
        mime, _ = mimetypes.guess_type(str(target))
        st = target.stat()
        self.send_response(200)
        self.send_header('Content-Type', mime or 'image/jpeg')
        self.send_header('Cache-Control', 'public, max-age=86400')
        self.send_header('Content-Length', str(st.st_size))
        self.end_headers()
        if not head_only:
            self.wfile.write(target.read_bytes())

    # ---------- Multimedia de la Landing (/media/...) con caché y Range ----------

    def _serve_media(self, rel_path: str, head_only: bool = False) -> None:
        media_root = MEDIA_DIR.resolve()
        try:
            target = (media_root / unquote(rel_path)).resolve()
        except (OSError, ValueError):
            self.send_error(404, 'Archivo no encontrado')
            return
        if media_root not in target.parents or not target.is_file():
            self.send_error(404, 'Archivo no encontrado')
            return

        st = target.stat()
        size = st.st_size
        etag = f'"{size:x}-{int(st.st_mtime):x}"'
        mime, _ = mimetypes.guess_type(str(target))
        mime = mime or 'application/octet-stream'

        if self.headers.get('If-None-Match') == etag:
            self.send_response(304)
            self.send_header('ETag', etag)
            self.send_header('Cache-Control', 'public, max-age=86400')
            self.end_headers()
            return

        start, end = 0, size - 1
        status = 200
        range_hdr = (self.headers.get('Range') or '').strip()
        if range_hdr.startswith('bytes=') and ',' not in range_hdr and size > 0:
            spec = range_hdr[len('bytes='):].strip()
            try:
                first, _, last = spec.partition('-')
                if first == '':
                    suffix = int(last)
                    if suffix <= 0:
                        raise ValueError
                    start = max(0, size - suffix)
                else:
                    start = int(first)
                    end = min(int(last), size - 1) if last else size - 1
                if start >= size or start > end:
                    raise ValueError
                status = 206
            except ValueError:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{size}')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return

        length = end - start + 1 if size else 0
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'public, max-age=86400')
        self.send_header('ETag', etag)
        self.send_header('Last-Modified', self.date_time_string(int(st.st_mtime)))
        self.send_header('Content-Length', str(length))
        if status == 206:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        if head_only or length <= 0:
            return
        try:
            with target.open('rb') as fh:
                fh.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = fh.read(min(256 * 1024, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            # El navegador corta el stream de video al buscar otra posición: es normal
            pass

    def do_HEAD(self) -> None:
        path = urlparse(self.path).path
        if path.startswith('/uploads/'):
            return self._serve_upload(path[len('/uploads/'):], head_only=True)
        if path.startswith('/media/'):
            return self._serve_media(path[len('/media/'):], head_only=True)
        if path in ('/q', '/q/'):
            self.send_response(302)
            self.send_header('Location', '/cliente.html')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        if SHORT_QR_PATH_RE.match(path):
            return self._serve_short_qr(head_only=True)
        if path.startswith('/q/'):
            self.send_error(404, 'Código QR inválido')
            return
        if self._try_serve_static_compressed(path, head_only=True):
            return
        return super().do_HEAD()

    # ---------- Autorización y Rate-Limiting ----------

    def _extract_demo_sid(self, qs: dict[str, list[str]] | None = None) -> str:
        raw = (self.headers.get('X-Demo-Session') or ((qs or {}).get('demoSid') or [''])[0] or '').strip()
        return raw if DEMO_SID_RE.match(raw) else ''

    def _ctx(
        self,
        qs: dict[str, list[str]] | None = None,
    ) -> tuple[Database, set[Subscriber], threading.Lock, bool]:
        sid = self._extract_demo_sid(qs)
        if sid:
            sb = get_demo_sandbox(sid)
            if sb is not None:
                return sb.db, sb.subscribers, sb.subs_lock, True
        return db, subscribers, subs_lock, False

    def _request_role(self, qs: dict[str, list[str]] | None = None, target_db: Database | None = None) -> str:
        auth = self.headers.get('X-Auth-Token') or ((qs or {}).get('token') or [''])[0]
        return resolve_role(auth, target_db=target_db)

    def _admin_or_demo(self, qs: dict[str, list[str]] | None = None, target_db: Database | None = None) -> bool:
        use_db = target_db or db
        return self._request_role(qs, target_db=use_db) in ('admin', 'demo_admin') or use_db.is_demo_mode()

    def _auth_rate_limited(self) -> bool:
        ip = self._client_ip()
        now = time.time()
        with auth_rate_lock:
            hits = [t for t in auth_failures.get(ip, []) if now - t < AUTH_WINDOW_S]
            auth_failures[ip] = hits
            return len(hits) >= AUTH_MAX_FAILURES

    def _record_auth_failure(self) -> None:
        ip = self._client_ip()
        now = time.time()
        with auth_rate_lock:
            hits = [t for t in auth_failures.get(ip, []) if now - t < AUTH_WINDOW_S]
            hits.append(now)
            auth_failures[ip] = hits
            if len(auth_failures) > 2000:
                for k in [k for k, v in auth_failures.items() if not v or now - v[-1] > AUTH_WINDOW_S]:
                    auth_failures.pop(k, None)

    # ---------- Exportación contable CSV (arqueo en hora Argentina UTC-3 con corte 06:00) ----------

    @staticmethod
    def _csv_safe(value: Any) -> str:
        txt = str(value if value is not None else '')
        # Evita inyección de fórmulas al abrir el archivo en Excel / Google Sheets
        if txt and txt[0] in ('=', '+', '-', '@', '\t', '\r'):
            txt = "'" + txt
        return txt

    def _send_sessions_csv(self, qs: dict[str, list[str]]) -> None:
        now_ar = datetime.now(AR_TZ)
        raw_desde = (qs.get('desde') or [''])[0].strip()
        raw_hasta = (qs.get('hasta') or [''])[0].strip()
        turno = (qs.get('turno') or [''])[0].strip().lower()

        since: int | None = None
        until: int | None = None

        if turno == 'hoy':
            since = start_of_today_ms(now_ar)
        else:
            cal_today = now_ar.strftime('%Y-%m-%d')
            if now_ar.hour < SHIFT_CUTOFF_HOUR and raw_desde == cal_today and raw_hasta == cal_today:
                shift_ymd = (now_ar - timedelta(days=1)).strftime('%Y-%m-%d')
                raw_desde = shift_ymd
                raw_hasta = shift_ymd

            if raw_desde:
                b_start = gastronomic_day_bounds_ms(raw_desde)
                if b_start is not None:
                    since = b_start[0]
            if raw_hasta:
                b_end = gastronomic_day_bounds_ms(raw_hasta)
                if b_end is not None:
                    until = b_end[1]

        rows = db.get_closed_sessions_export(since_ms=since, until_ms=until)

        def fmt(ts: Any) -> tuple[str, str]:
            if not ts:
                return '', ''
            dt = datetime.fromtimestamp(ts / 1000, tz=AR_TZ)
            return dt.strftime('%d/%m/%Y'), dt.strftime('%H:%M')

        buf = io.StringIO()
        # Punto y coma: separador de listas de Excel en Windows con configuración regional Argentina
        writer = csv.writer(buf, delimiter=';', quoting=csv.QUOTE_MINIMAL, lineterminator='\r\n')
        writer.writerow([
            'Fecha apertura', 'Hora apertura', 'Fecha cierre', 'Hora cierre',
            'Mesa', 'Bloque', 'Mozo', 'Medio de pago',
            'Subtotal', '% Propina', 'Monto propina', 'Total', 'ID sesión',
        ])
        for r in rows:
            d_open, h_open = fmt(r['openedAt'])
            d_close, h_close = fmt(r['closedAt'])
            writer.writerow([
                d_open, h_open, d_close, h_close,
                self._csv_safe(r['tableCode']), self._csv_safe(r['blockName']),
                self._csv_safe(r['waiterName']), self._csv_safe(r['payment']),
                int(r['subtotal'] or 0), int(r['tipPct'] or 0), int(r['tipAmount'] or 0), int(r['total'] or 0),
                r['id'],
            ])
        raw = ('\ufeff' + buf.getvalue()).encode('utf-8')
        fname = f"arqueo_salelisto_{now_ar.strftime('%Y%m%d-%H%M')}.csv"
        self.send_bytes(
            200,
            raw,
            'text/csv; charset=utf-8',
            extra_headers={
                'Content-Disposition': f'attachment; filename="{fname}"',
                'X-Rows': str(len(rows)),
            },
            compressible=True,
        )

    def _lead_rate_limited(self) -> bool:
        ip = self._client_ip()
        now = time.time()
        with leads_rate_lock:
            hits = [t for t in leads_rate.get(ip, []) if now - t < LEAD_WINDOW_S]
            if len(hits) >= LEAD_MAX_PER_WINDOW:
                leads_rate[ip] = hits
                return True
            hits.append(now)
            leads_rate[ip] = hits
            if len(leads_rate) > 2000:
                for k in [k for k, v in leads_rate.items() if not v or now - v[-1] > LEAD_WINDOW_S]:
                    leads_rate.pop(k, None)
        return False

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path.startswith('/uploads/'):
            return self._serve_upload(path[len('/uploads/'):])

        if path.startswith('/media/'):
            return self._serve_media(path[len('/media/'):])

        # Ruta corta 4G/5G para QRs de baja densidad: /q/<qr_token>
        if path in ('/q', '/q/'):
            self.send_response(302)
            self.send_header('Location', '/cliente.html')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        if SHORT_QR_PATH_RE.match(path):
            return self._serve_short_qr(head_only=False)
        if path.startswith('/q/'):
            self.send_error(404, 'Código QR inválido')
            return

        if path == '/api/health':
            with subs_lock:
                sub_cnt = len(subscribers)
            net = self._network_snapshot(role='client')
            return self.send_json(
                200,
                {
                    'ok': True,
                    'version': db.version,
                    'subscribers': sub_cnt,
                    'isPublic': net['isPublic'],
                    'isPublic4g': net['isPublic4g'],
                    'tunnelActive': net['tunnel']['active'],
                },
            )

        if path == '/api/tunnel/status':
            role = self._request_role(qs)
            if role not in ('admin', 'demo_admin'):
                code = 401 if role == 'client' else 403
                return self.send_json(code, {'ok': False, 'error': 'Se requiere acceso de encargado (PIN)'})
            return self.send_json(
                200,
                {
                    'ok': True,
                    'tunnel': tunnel_manager.status(include_details=(role == 'admin')),
                    'network': self._network_snapshot(role=role),
                },
            )

        if path == '/api/leads':
            tdb, _, _, is_sb = self._ctx(qs)
            if is_sb:
                return self.send_json(200, {'ok': True, 'leads': tdb.get_demo_leads()})
            role = self._request_role(qs)
            if role == 'admin':
                try:
                    limit = int((qs.get('limit') or ['50'])[0])
                except ValueError:
                    limit = 50
                return self.send_json(200, {'ok': True, 'leads': db.get_leads(limit)})
            if role == 'demo_admin':
                return self.send_json(200, {'ok': True, 'leads': db.get_demo_leads()})
            return self.send_json(401, {'ok': False, 'error': 'Se requiere acceso de encargado (PIN)'})

        if path == '/api/export/sessions.csv':
            if not self._admin_or_demo(qs):
                return self.send_json(401, {'ok': False, 'error': 'Se requiere acceso de encargado (PIN)'})
            return self._send_sessions_csv(qs)

        if path == '/api/exchange-rate':
            fx = get_usd_ars_rate()
            raw = json.dumps(fx, ensure_ascii=False).encode('utf-8')
            return self.send_bytes(
                200,
                raw,
                'application/json; charset=utf-8',
                extra_headers={'Cache-Control': 'public, max-age=300'},
                compressible=True,
            )

        if path == '/api/info':
            net = self._network_snapshot(role='client')
            return self.send_json(
                200,
                {
                    **net,
                    'demoMode': db.is_demo_mode(),
                },
            )

        if path == '/api/qr.svg':
            text = (qs.get('text') or [''])[0]
            if not text:
                return self.send_json(400, {'error': 'Falta parámetro text'})
            try:
                svg = qr_svg(text).encode('utf-8')
            except ValueError as e:
                return self.send_json(400, {'error': str(e)})
            return self.send_bytes(200, svg, 'image/svg+xml; charset=utf-8', compressible=True)

        if path == '/api/qrs':
            tdb, _, _, is_sb = self._ctx(qs)
            role = self._request_role(qs, target_db=tdb)
            if not tdb.is_demo_mode() and role not in STAFF_ROLES:
                return self.send_json(
                    401,
                    {'ok': False, 'error': 'Sesión de personal requerida para ver los códigos QR'},
                )
            net = self._network_snapshot(role=role)
            base = net['baseUrl']
            st = tdb.get_staff_state(role='staff')
            blocks_out = []
            try:
                for b in st['blocks']:
                    b_tables = [t for t in st['tables'] if t['blockId'] == b['id'] and t['active']]
                    cards = []
                    for t in b_tables:
                        short_url = f"{base}/q/{t['qrToken']}"
                        legacy_url = f"{base}/cliente.html?t={t['qrToken']}"
                        cards.append(
                            {
                                'id': t['id'],
                                'code': t['code'],
                                'seats': t['seats'],
                                'qrToken': t['qrToken'],
                                'url': short_url,
                                'legacyUrl': legacy_url,
                                'svg': qr_svg(short_url),
                            }
                        )
                    blocks_out.append(
                        {
                            'id': b['id'],
                            'name': b['name'],
                            'icon': b['icon'],
                            'tables': cards,
                        }
                    )
            except ValueError as e:
                return self.send_json(400, {'ok': False, 'error': str(e)})
            return self.send_json(
                200,
                {
                    'restaurantName': st['restaurant']['name'],
                    'publicUrlConfigured': st['restaurant'].get('publicUrl') or '',
                    'baseUrl': base,
                    'urlSource': net['urlSource'],
                    'lanUrl': net['lanUrl'],
                    'isHttps': net['isHttps'],
                    'isPublic': net['isPublic'],
                    'isPublic4g': net['isPublic4g'],
                    'isLocalOnly': net['isLocalOnly'],
                    'isTemporaryTunnel': net['isTemporaryTunnel'],
                    'cloudEnv': net['cloudEnv'],
                    'tunnel': net['tunnel'],
                    'canManageTunnel': role == 'admin',
                    'canAutoInstallTunnel': role == 'admin',
                    'blocks': blocks_out,
                },
            )

        if path == '/api/client-state':
            tdb, _, _, _ = self._ctx(qs)
            tok = (qs.get('t') or [''])[0]
            mesa = (qs.get('mesa') or [''])[0]
            return self.send_json(200, tdb.get_client_state(tok, mesa))

        if path == '/api/staff-state':
            tdb, _, _, _ = self._ctx(qs)
            role = self._request_role(qs, target_db=tdb)
            if role == 'client' and not tdb.is_demo_mode():
                return self.send_json(401, {'ok': False, 'error': 'Sesión requerida'})
            eff_role = _staff_scope_for_role(role)
            return self.send_json(
                200,
                get_enriched_staff_state(
                    role=eff_role,
                    headers=self.headers,
                    trusted_proxy=self._is_trusted_proxy(),
                    port=self._server_port(),
                    target_db=tdb,
                ),
            )

        if path == '/api/waiters-public':
            # Lista mínima de mozos para la pantalla de ingreso del celular del mozo
            tdb, _, _, _ = self._ctx(qs)
            st = tdb.get_staff_state(role='staff')
            demo_on = bool(st['restaurant']['demoMode'])
            return self.send_json(
                200,
                {
                    'restaurant': st['restaurant']['name'],
                    'demoMode': demo_on,
                    'waiters': [
                        {
                            'id': w['id'],
                            'name': w['name'],
                            'color': w['color'],
                            'available': w['available'],
                            'hasPin': bool(w['hasPin'] or not demo_on),
                        }
                        for w in st['waiters']
                    ],
                },
            )

        if path == '/api/push/vapid-public-key':
            return self.send_json(200, {'ok': True, 'publicKey': VAPID_KEYS['publicKey']})

        if path == '/api/events':
            tdb, tsubs, tlock, _ = self._ctx(qs)
            scope = (qs.get('scope') or ['client'])[0]
            if scope in ('staff', 'admin', 'demo_admin'):
                role = self._request_role(qs, target_db=tdb)
                if role == 'client' and not tdb.is_demo_mode():
                    return self.send_json(401, {'ok': False, 'error': 'No autorizado'})
                return self._stream_events(
                    Subscriber(_staff_scope_for_role(role)),
                    target_db=tdb,
                    target_subs=tsubs,
                    target_lock=tlock,
                )
            qr_tok = (qs.get('t') or [''])[0]
            mesa = (qs.get('mesa') or [''])[0]
            return self._stream_events(
                Subscriber('client', qr_tok, mesa),
                target_db=tdb,
                target_subs=tsubs,
                target_lock=tlock,
            )

        if self._try_serve_static_compressed(path, head_only=False):
            return

        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            raw_len = self.headers.get('Content-Length')
            length = int(raw_len) if raw_len is not None else 0
            if length < 0:
                return self.send_json(400, {'ok': False, 'error': 'Content-Length inválido'})
            if length > 4_000_000:
                raise ActionError('Datos demasiado grandes (máx. 4 MB)')
            raw_data = self.rfile.read(length) if length > 0 else b'{}'
            body = json.loads(raw_data or b'{}')
        except ActionError as e:
            return self.send_json(400, {'ok': False, 'error': str(e)})
        except (ValueError, TypeError):
            return self.send_json(400, {'ok': False, 'error': 'JSON inválido'})

        if not isinstance(body, dict):
            return self.send_json(400, {'ok': False, 'error': 'JSON inválido'})

        if path == '/api/leads':
            if self._lead_rate_limited():
                return self.send_json(
                    429,
                    {'ok': False, 'error': 'Recibimos varias consultas seguidas. Probá de nuevo en unos minutos.'},
                )
            try:
                lead = db.create_lead(body)
            except ActionError as e:
                return self.send_json(400, {'ok': False, 'error': str(e)})
            broadcast_updates()
            return self.send_json(200, {'ok': True, 'lead': lead})

        if path == '/api/demo/discard':
            sid = self._extract_demo_sid(parse_qs(parsed.query)) or str(body.get('demoSid') or '').strip()
            discarded = discard_demo_sandbox(sid)
            return self.send_json(200, {'ok': True, 'discarded': discarded})

        tdb, tsubs, tlock, is_sb = self._ctx(parse_qs(parsed.query))

        if path in ('/api/auth/admin', '/api/auth/waiter', '/api/auth/kitchen'):
            if self._auth_rate_limited():
                return self.send_json(
                    429,
                    {'ok': False, 'error': 'Demasiados intentos fallidos. Esperá 5 minutos antes de volver a probar.'},
                )

        if path == '/api/auth/admin':
            if body.get('demo'):
                if tdb.is_demo_mode():
                    return self.send_json(
                        200,
                        {'ok': True, 'token': create_staff_token('demo_admin', target_db=tdb), 'role': 'demo_admin'},
                    )
                self._record_auth_failure()
                return self.send_json(
                    401,
                    {'ok': False, 'error': 'El Modo Demostración está desactivado; ingresá el PIN del encargado'},
                )
            pin = str(body.get('pin') or '')
            if not is_sb and db.verify_admin_pin(pin):
                return self.send_json(200, {'ok': True, 'token': make_admin_token(), 'role': 'admin'})
            if is_sb and tdb.verify_admin_pin(pin):
                return self.send_json(200, {'ok': True, 'token': create_staff_token('demo_admin', target_db=tdb), 'role': 'demo_admin'})
            self._record_auth_failure()
            return self.send_json(401, {'ok': False, 'error': 'PIN de encargado incorrecto'})

        if path == '/api/auth/waiter':
            try:
                w = tdb.verify_waiter_login(str(body.get('waiterId') or ''), str(body.get('pin') or ''))
                return self.send_json(
                    200,
                    {'ok': True, 'waiter': w, 'token': create_staff_token('waiter', waiter_id=w['id'], target_db=tdb), 'role': 'waiter'},
                )
            except ActionError as e:
                self._record_auth_failure()
                return self.send_json(401, {'ok': False, 'error': str(e)})

        if path == '/api/auth/kitchen':
            if body.get('pin'):
                if not tdb.verify_admin_pin(str(body.get('pin'))):
                    self._record_auth_failure()
                    return self.send_json(401, {'ok': False, 'error': 'PIN incorrecto'})
            elif not tdb.is_demo_mode():
                self._record_auth_failure()
                return self.send_json(401, {'ok': False, 'error': 'Ingresá el PIN del local para abrir Cocina/Barra'})
            return self.send_json(200, {'ok': True, 'token': create_staff_token('kitchen', target_db=tdb), 'role': 'kitchen'})

        auth_header = self.headers.get('X-Auth-Token') or ''
        role = resolve_role(auth_header, target_db=tdb)

        if path == '/api/tunnel/start':
            if role != 'admin':
                code = 401 if role == 'client' else 403
                msg = (
                    'Se requiere acceso de encargado (PIN)'
                    if role == 'client'
                    else 'Solo el encargado autenticado con el PIN real puede iniciar o configurar el túnel HTTPS'
                )
                return self.send_json(code, {'ok': False, 'error': msg})
            auto_install = bool(body.get('autoInstall'))
            req_token = str(body.get('token') or '').strip()
            mode = str(body.get('mode') or 'auto').strip().lower()
            if mode not in ('auto', 'quick', 'token'):
                mode = 'auto'
            try:
                wait_s = min(25.0, max(1.0, float(body.get('waitSeconds') or 18.0)))
            except (TypeError, ValueError):
                wait_s = 18.0
            try:
                st = tunnel_manager.start(
                    port=self._server_port(),
                    mode=mode,
                    token=req_token,
                    auto_install=auto_install,
                    wait_seconds=wait_s,
                )
                return self.send_json(
                    200,
                    {
                        'ok': True,
                        'tunnel': st,
                        'network': self._network_snapshot(role=role),
                    },
                )
            except TunnelError as err:
                return self.send_json(
                    err.status,
                    {
                        'ok': False,
                        'error': str(err),
                        'needsInstall': err.needs_install,
                        'tunnel': tunnel_manager.status(include_details=True),
                        'network': self._network_snapshot(role=role),
                    },
                )

        if path == '/api/tunnel/stop':
            if role != 'admin':
                code = 401 if role == 'client' else 403
                msg = (
                    'Se requiere acceso de encargado (PIN)'
                    if role == 'client'
                    else 'Solo el encargado autenticado con el PIN real puede detener el túnel HTTPS'
                )
                return self.send_json(code, {'ok': False, 'error': msg})
            st = tunnel_manager.stop()
            return self.send_json(
                200,
                {
                    'ok': True,
                    'tunnel': st,
                    'network': self._network_snapshot(role=role),
                },
            )

        if path == '/api/orders':
            payload = dict(body)
            idem_hdr = (self.headers.get('Idempotency-Key') or '').strip()
            if idem_hdr and not payload.get('clientRequestId') and not payload.get('client_request_id'):
                payload['clientRequestId'] = idem_hdr
            try:
                result = tdb.execute('order.create', payload, role=role)
                dedup = bool(isinstance(result, dict) and result.get('deduplicated'))
                if not dedup:
                    if not is_sb:
                        flush_pending_webpush()
                    broadcast_updates(target_db=tdb, target_subs=tsubs, target_lock=tlock)
                if role in STAFF_ROLES:
                    state_out = get_enriched_staff_state(
                        role=_staff_scope_for_role(role),
                        headers=self.headers,
                        trusted_proxy=self._is_trusted_proxy(),
                        port=self._server_port(),
                        target_db=tdb,
                    )
                else:
                    state_out = tdb.get_client_state(
                        str(payload.get('qrToken') or ''),
                        str(payload.get('mesa') or ''),
                    )
                return self.send_json(
                    200,
                    {
                        'ok': True,
                        'result': result,
                        'orderIds': result.get('orderIds', []),
                        'batchId': result.get('batchId'),
                        'deduplicated': dedup,
                        'state': state_out,
                    },
                )
            except AuthError as e:
                return self.send_json(e.status, {'ok': False, 'error': str(e)})
            except ActionError as e:
                return self.send_json(400, {'ok': False, 'error': str(e)})
            except (ValueError, TypeError) as e:
                return self.send_json(400, {'ok': False, 'error': f'Datos inválidos: {e}'})

        if path == '/api/push/subscribe':
            if role not in STAFF_ROLES and not db.is_demo_mode():
                return self.send_json(401, {'ok': False, 'error': 'Sesión de personal requerida'})
            try:
                waiter_id = str(body.get('waiterId') or '').strip()
                sub = body.get('subscription') or {}
                if not isinstance(sub, dict):
                    raise ActionError('Suscripción Web Push inválida')
                endpoint = str(sub.get('endpoint') or '').strip()
                try:
                    validate_push_endpoint(endpoint, resolve_dns=False)
                except ValueError as err:
                    raise ActionError(str(err)) from err
                keys = sub.get('keys') if isinstance(sub.get('keys'), dict) else {}
                p256dh = str(keys.get('p256dh') or sub.get('p256dh') or '').strip()
                auth_sec = str(keys.get('auth') or sub.get('auth') or '').strip()
                if not p256dh or not auth_sec:
                    raise ActionError('Faltan claves p256dh/auth en la suscripción')
                try:
                    decode_p256_public(b64url_decode(p256dh))
                    if len(b64url_decode(auth_sec)) < 12:
                        raise ValueError('auth corto')
                except Exception:
                    raise ActionError('Claves criptográficas Web Push inválidas')
                wristband_mode = bool(body.get('wristbandMode', True))
                saved = db.save_push_subscription(waiter_id, endpoint, p256dh, auth_sec, wristband_mode)
                broadcast_updates()
                return self.send_json(200, {'ok': True, **saved})
            except ActionError as e:
                return self.send_json(400, {'ok': False, 'error': str(e)})

        if path == '/api/push/unsubscribe':
            if role not in STAFF_ROLES and not db.is_demo_mode():
                return self.send_json(401, {'ok': False, 'error': 'Sesión de personal requerida'})
            sub = body.get('subscription') if isinstance(body.get('subscription'), dict) else {}
            endpoint = str(body.get('endpoint') or sub.get('endpoint') or '').strip()
            removed = db.delete_push_subscription(endpoint)
            if removed:
                broadcast_updates()
            return self.send_json(200, {'ok': True, 'removed': removed})

        if path == '/api/push/test':
            if role not in STAFF_ROLES and not db.is_demo_mode():
                return self.send_json(401, {'ok': False, 'error': 'Sesión de personal requerida'})
            waiter_id = str(body.get('waiterId') or '').strip()
            endpoint = str(body.get('endpoint') or '').strip()
            subs = db.get_waiter_push_subscriptions(waiter_id, endpoint)
            if not subs:
                return self.send_json(
                    400,
                    {'ok': False, 'error': 'Activá primero el Modo Pulsera en este dispositivo'},
                )
            ts = int(time.time() * 1000)
            title = '⌚ Pulsera SaleListo OK'
            text_body = 'Vibración activa con pantalla bloqueada'
            deliveries = [
                (
                    s,
                    {
                        'id': f'test-{ts}',
                        'kind': 'push_test',
                        'waiterId': s['waiter_id'],
                        'title': title,
                        'body': text_body,
                        'shortTitle': title,
                        'shortBody': text_body,
                        'urgent': True,
                        'tag': f'salelisto-test-{ts}',
                        'url': f"/mozo.html?waiter={s['waiter_id']}",
                        'ts': ts,
                    },
                )
                for s in subs
            ]
            dispatch_webpush_async(deliveries, VAPID_KEYS, on_expired=_on_push_expired)
            return self.send_json(200, {'ok': True, 'sent': len(subs), 'title': title, 'body': text_body})

        if path != '/api/action':
            return self.send_json(404, {'ok': False, 'error': 'Ruta no encontrada'})

        try:
            action_type = str(body.get('type') or body.get('action') or '')
            raw_payload = body.get('payload')
            if isinstance(raw_payload, dict):
                payload = dict(raw_payload)
            else:
                payload = {k: v for k, v in body.items() if k not in ('type', 'action')}
            if action_type == 'order.create':
                idem_hdr = (self.headers.get('Idempotency-Key') or '').strip()
                if idem_hdr and not payload.get('clientRequestId') and not payload.get('client_request_id'):
                    payload['clientRequestId'] = idem_hdr
            result = tdb.execute(action_type, payload, role=role)
            dedup = bool(isinstance(result, dict) and result.get('deduplicated'))
            if not dedup:
                if not is_sb:
                    flush_pending_webpush()
                broadcast_updates(target_db=tdb, target_subs=tsubs, target_lock=tlock)
            if role in STAFF_ROLES or (
                tdb.is_demo_mode() and action_type not in ('order.create', 'call.create')
            ):
                state_out = get_enriched_staff_state(
                    role=_staff_scope_for_role(role),
                    headers=self.headers,
                    trusted_proxy=self._is_trusted_proxy(),
                    port=self._server_port(),
                    target_db=tdb,
                )
            else:
                state_out = tdb.get_client_state(
                    str(payload.get('qrToken') or ''),
                    str(payload.get('mesa') or ''),
                )
            return self.send_json(200, {'ok': True, 'result': result, 'state': state_out})
        except AuthError as e:
            return self.send_json(e.status, {'ok': False, 'error': str(e)})
        except ActionError as e:
            return self.send_json(400, {'ok': False, 'error': str(e)})
        except (ValueError, TypeError) as e:
            return self.send_json(400, {'ok': False, 'error': f'Datos inválidos: {e}'})

    def _stream_events(
        self,
        sub: Subscriber,
        target_db: Database | None = None,
        target_subs: set[Subscriber] | None = None,
        target_lock: threading.Lock | None = None,
    ) -> None:
        use_db = target_db or db
        use_subs = target_subs if target_subs is not None else subscribers
        use_lock = target_lock if target_lock is not None else subs_lock

        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('Cache-Control', 'no-cache, no-transform')
        self.send_header('Connection', 'keep-alive')
        self.send_header('X-Accel-Buffering', 'no')
        self.end_headers()

        initial = (
            get_enriched_staff_state(
                role=sub.scope,
                headers=self.headers,
                trusted_proxy=self._is_trusted_proxy(),
                port=self._server_port(),
                target_db=use_db,
            )
            if sub.scope in ('admin', 'demo_admin', 'staff')
            else use_db.get_client_state(sub.qr_token, sub.legacy_code)
        )
        sub.enqueue(json.dumps(initial, ensure_ascii=False))

        with use_lock:
            use_subs.add(sub)
        try:
            self.wfile.write(b'retry: 3000\n\n')
            self.wfile.flush()
            while True:
                try:
                    msg = sub.q.get(timeout=SSE_KEEPALIVE_S)
                    self.wfile.write(f'data: {msg}\n\n'.encode('utf-8'))
                except queue.Empty:
                    self.wfile.write(b': ping\n\n')
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, TimeoutError, OSError):
            pass
        finally:
            self.close_connection = True
            with use_lock:
                use_subs.discard(sub)


class SaleListoHTTPServer(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address) -> None:
        exc = sys.exc_info()[1]
        if isinstance(exc, (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def parse_cli_flags(argv: list[str]) -> dict[str, Any]:
    port = _parse_initial_port(argv)
    want_tunnel = (os.environ.get('SALELISTO_TUNNEL') or '').strip().lower() in ('1', 'true', 'yes', 'on')
    auto_install = (os.environ.get('SALELISTO_TUNNEL_AUTOINSTALL') or '').strip().lower() in ('1', 'true', 'yes', 'on')
    tunnel_token = (os.environ.get('CLOUDFLARE_TUNNEL_TOKEN') or '').strip()

    i = 1
    while i < len(argv):
        arg = argv[i]
        if arg == '--tunnel':
            want_tunnel = True
        elif arg == '--auto-install-tunnel':
            auto_install = True
            want_tunnel = True
        elif arg == '--tunnel-token' and i + 1 < len(argv):
            tunnel_token = argv[i + 1].strip()
            want_tunnel = True
            i += 1
        elif arg.startswith('--tunnel-token='):
            tunnel_token = arg.split('=', 1)[1].strip()
            want_tunnel = True
        elif arg == '--port' and i + 1 < len(argv):
            i += 1
        i += 1

    if tunnel_token and not is_cloud_env():
        want_tunnel = True

    return {
        'port': port,
        'tunnel': want_tunnel,
        'auto_install': auto_install,
        'tunnel_token': tunnel_token,
    }


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors='replace', line_buffering=True)
        except Exception:
            pass

    cfg = parse_cli_flags(sys.argv)
    use_port = int(cfg['port'])
    server = SaleListoHTTPServer(('0.0.0.0', use_port), Handler)
    lan_base = f'http://{lan_ip()}:{use_port}'

    if cfg['tunnel']:
        mode = 'token' if cfg['tunnel_token'] else 'quick'
        print(f'\n  Iniciando tunel HTTPS publico ({mode}) hacia 127.0.0.1:{use_port}...')
        try:
            st = tunnel_manager.start(
                port=use_port,
                mode=mode,
                token=cfg['tunnel_token'],
                auto_install=cfg['auto_install'],
                wait_seconds=20.0,
            )
            if st.get('publicUrl'):
                print(f"  Tunel HTTPS publico:    {st['publicUrl']}")
            elif mode == 'token' and st.get('active'):
                print('  Tunel permanente activo (CLOUDFLARE_TUNNEL_TOKEN).')
        except TunnelError as err:
            print(f'  [AVISO TUNEL] {err}')

    eff_base, eff_source = resolve_base_url_info(port=use_port)
    print('\n  SaleListo esta corriendo\n')
    if is_public_4g_url(eff_base):
        print(f'  Enlace publico activo:  {eff_base}   (origen: {eff_source})')
    else:
        print('  Modo red local:         usa --tunnel o el Panel (> Caja y Ajustes) para enlace publico HTTPS')
    print(f'  Red local (LAN):        {lan_base}')
    print(f'  Inicio / Portada:       {eff_base}/')
    print(f'  Tablero operativo:      {eff_base}/operacion.html')
    print(f'  Demo 4 pantallas:       {eff_base}/demo.html')
    print(f'  Panel Encargado (PIN):  {eff_base}/restaurante.html   (PIN inicial: 1234)')
    print(f'  Estacion de Mozos:      {eff_base}/pase.html')
    print(f'  Celular del Mozo:       {eff_base}/mozo.html')
    print(f'  Pantalla Cocina/Barra:  {eff_base}/cocina.html')
    print(f'  QRs fijos imprimibles:  {eff_base}/qr.html   (ruta corta /q/<token>)')
    print('\n  Ctrl+C para detener.\n')
    def _handle_termination(_signum, _frame) -> None:
        raise KeyboardInterrupt

    for sig_name in ('SIGTERM', 'SIGBREAK'):
        sig = getattr(signal, sig_name, None)
        if sig is not None:
            try:
                signal.signal(sig, _handle_termination)
            except (OSError, ValueError):
                pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  Servidor detenido.')
    finally:
        tunnel_manager.stop()
        server.server_close()


if __name__ == '__main__':
    main()
