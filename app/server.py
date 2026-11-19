"""Servidor web de SaleListo: API transaccional, QR locales y tiempo real por rol.

Funciona tanto en computadora local (`python server.py`) como publicado en un
servidor cloud con HTTPS (usando la variable de entorno `PORT`) para que los
clientes escaneen con sus propios datos 4G/5G sin pedir Wi-Fi.
"""
from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import mimetypes
import os
import queue
import secrets
import socket
import sys
import threading
import time
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

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
mimetypes.add_type('image/svg+xml', '.svg')
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
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT') or 8123)


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

# Anti-spam liviano para el formulario público de la Landing (por IP)
LEAD_WINDOW_S = 600
LEAD_MAX_PER_WINDOW = 6
leads_rate: dict[str, list[float]] = {}
leads_rate_lock = threading.Lock()

# Anti fuerza bruta para endpoints /api/auth/* (por client_address[0])
AUTH_WINDOW_S = 300
AUTH_MAX_FAILURES = 10
auth_failures: dict[str, list[float]] = {}
auth_rate_lock = threading.Lock()


def make_admin_token() -> str:
    # Vinculado al PIN actual y a SERVER_SECRET persistido: sobrevive reinicios y se invalida si cambia el PIN
    with db.lock:
        conn = db._connect()
        try:
            pin = conn.execute('SELECT admin_pin FROM restaurant WHERE id = 1').fetchone()['admin_pin']
        finally:
            conn.close()
    return 'adm_' + hmac.new(SERVER_SECRET, str(pin).encode('utf-8'), hashlib.sha256).hexdigest()


def resolve_role(token: str) -> str:
    tok = str(token or '').strip()
    if not tok:
        return 'client'
    if hmac.compare_digest(tok, make_admin_token()):
        return 'admin'
    sess = db.get_staff_session(tok)
    if sess:
        return str(sess['role'])
    return 'client'


def create_staff_token(role: str = 'waiter', waiter_id: str = '') -> str:
    return db.create_staff_session(role=role, waiter_id=waiter_id)


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


def broadcast_updates() -> None:
    with subs_lock:
        current_subs = list(subscribers)
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
                    demo_on = db.is_demo_mode()
                if not demo_on:
                    eff_scope = 'staff'
            if eff_scope not in staff_cache:
                staff_cache[eff_scope] = json.dumps(
                    db.get_staff_state(role=eff_scope),
                    ensure_ascii=False,
                )
            sub.enqueue(staff_cache[eff_scope])
        else:
            key = (sub.qr_token, sub.legacy_code)
            if key not in client_cache:
                client_cache[key] = json.dumps(
                    db.get_client_state(sub.qr_token, sub.legacy_code),
                    ensure_ascii=False,
                )
            sub.enqueue(client_cache[key])


class Handler(SimpleHTTPRequestHandler):
    timeout = 30

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def end_headers(self) -> None:
        req_path = self.path.split('?', 1)[0]
        if req_path == '/sw.js':
            self.send_header('Service-Worker-Allowed', '/')
        # /uploads/ y /media/ gestionan su propio Cache-Control (caché pública de 24 h)
        if not (req_path.startswith('/uploads/') or req_path.startswith('/media/')):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        if '/api/' in self.path and 'events' not in self.path:
            sys.stderr.write(f"{self.command} {self.path} {args[1] if len(args) > 1 else ''}\n")

    def _effective_base_url(self) -> str:
        staff = db.get_staff_state(role='staff')
        configured = staff['restaurant'].get('publicUrl') or ''
        if configured:
            return configured.rstrip('/')

        host = (self.headers.get('X-Forwarded-Host') or self.headers.get('Host') or '').strip()
        proto = (self.headers.get('X-Forwarded-Proto') or 'http').split(',')[0].strip()
        if host and not host.startswith('localhost') and not host.startswith('127.0.0.1'):
            return f'{proto}://{host}'
        return f'http://{lan_ip()}:{PORT}'

    def send_json(self, code: int, body) -> None:
        raw = (
            body.encode('utf-8')
            if isinstance(body, str)
            else json.dumps(body, ensure_ascii=False).encode('utf-8')
        )
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _serve_upload(self, rel_path: str) -> None:
        fname = Path(rel_path).name
        target = (UPLOADS_DIR / fname).resolve()
        if target.parent != UPLOADS_DIR.resolve() or not target.is_file():
            self.send_error(404, 'Imagen no encontrada')
            return
        mime, _ = mimetypes.guess_type(str(target))
        raw = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mime or 'image/jpeg')
        self.send_header('Cache-Control', 'public, max-age=86400')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

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
        if path.startswith('/media/'):
            return self._serve_media(path[len('/media/'):], head_only=True)
        return super().do_HEAD()

    # ---------- Autorización y Rate-Limiting ----------

    def _request_role(self, qs: dict[str, list[str]] | None = None) -> str:
        auth = self.headers.get('X-Auth-Token') or ((qs or {}).get('token') or [''])[0]
        return resolve_role(auth)

    def _admin_or_demo(self, qs: dict[str, list[str]] | None = None) -> bool:
        return self._request_role(qs) in ('admin', 'demo_admin') or db.is_demo_mode()

    def _auth_rate_limited(self) -> bool:
        ip = str(self.client_address[0] if self.client_address else 'unknown')
        now = time.time()
        with auth_rate_lock:
            hits = [t for t in auth_failures.get(ip, []) if now - t < AUTH_WINDOW_S]
            auth_failures[ip] = hits
            return len(hits) >= AUTH_MAX_FAILURES

    def _record_auth_failure(self) -> None:
        ip = str(self.client_address[0] if self.client_address else 'unknown')
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
    def _csv_safe(value) -> str:
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

        def fmt(ts) -> tuple[str, str]:
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
        self.send_response(200)
        self.send_header('Content-Type', 'text/csv; charset=utf-8')
        self.send_header('Content-Disposition', f'attachment; filename="{fname}"')
        self.send_header('X-Rows', str(len(rows)))
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _lead_rate_limited(self) -> bool:
        ip = (self.headers.get('X-Forwarded-For') or self.client_address[0] or '').split(',')[0].strip()
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

        if path == '/api/health':
            with subs_lock:
                sub_cnt = len(subscribers)
            return self.send_json(
                200,
                {
                    'ok': True,
                    'version': db.version,
                    'subscribers': sub_cnt,
                },
            )

        if path == '/api/leads':
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

        if path == '/api/info':
            return self.send_json(
                200,
                {
                    'baseUrl': self._effective_base_url(),
                    'lanUrl': f'http://{lan_ip()}:{PORT}',
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
            self.send_response(200)
            self.send_header('Content-Type', 'image/svg+xml; charset=utf-8')
            self.send_header('Content-Length', str(len(svg)))
            self.end_headers()
            self.wfile.write(svg)
            return

        if path == '/api/qrs':
            role = self._request_role(qs)
            if not db.is_demo_mode() and role not in STAFF_ROLES:
                return self.send_json(
                    401,
                    {'ok': False, 'error': 'Sesión de personal requerida para ver los códigos QR'},
                )
            base = self._effective_base_url()
            st = db.get_staff_state(role='staff')
            blocks_out = []
            try:
                for b in st['blocks']:
                    b_tables = [t for t in st['tables'] if t['blockId'] == b['id'] and t['active']]
                    cards = []
                    for t in b_tables:
                        url = f"{base}/cliente.html?t={t['qrToken']}"
                        cards.append(
                            {
                                'id': t['id'],
                                'code': t['code'],
                                'seats': t['seats'],
                                'qrToken': t['qrToken'],
                                'url': url,
                                'svg': qr_svg(url),
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
                    'baseUrl': base,
                    'isLocalOnly': '127.0.0.1' in base,
                    'blocks': blocks_out,
                },
            )

        if path == '/api/client-state':
            tok = (qs.get('t') or [''])[0]
            mesa = (qs.get('mesa') or [''])[0]
            return self.send_json(200, db.get_client_state(tok, mesa))

        if path == '/api/staff-state':
            role = self._request_role(qs)
            if role == 'client' and not db.is_demo_mode():
                return self.send_json(401, {'ok': False, 'error': 'Sesión requerida'})
            return self.send_json(200, db.get_staff_state(role=_staff_scope_for_role(role)))

        if path == '/api/waiters-public':
            # Lista mínima de mozos para la pantalla de ingreso del celular del mozo
            st = db.get_staff_state(role='staff')
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
            scope = (qs.get('scope') or ['client'])[0]
            if scope in ('staff', 'admin', 'demo_admin'):
                role = self._request_role(qs)
                if role == 'client' and not db.is_demo_mode():
                    return self.send_json(401, {'ok': False, 'error': 'No autorizado'})
                return self._stream_events(Subscriber(_staff_scope_for_role(role)))
            qr_tok = (qs.get('t') or [''])[0]
            mesa = (qs.get('mesa') or [''])[0]
            return self._stream_events(Subscriber('client', qr_tok, mesa))

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

        if path in ('/api/auth/admin', '/api/auth/waiter', '/api/auth/kitchen'):
            if self._auth_rate_limited():
                return self.send_json(
                    429,
                    {'ok': False, 'error': 'Demasiados intentos fallidos. Esperá 5 minutos antes de volver a probar.'},
                )

        if path == '/api/auth/admin':
            if body.get('demo'):
                if db.is_demo_mode():
                    return self.send_json(
                        200,
                        {'ok': True, 'token': create_staff_token('demo_admin'), 'role': 'demo_admin'},
                    )
                self._record_auth_failure()
                return self.send_json(
                    401,
                    {'ok': False, 'error': 'El Modo Demostración está desactivado; ingresá el PIN del encargado'},
                )
            pin = str(body.get('pin') or '')
            if db.verify_admin_pin(pin):
                return self.send_json(200, {'ok': True, 'token': make_admin_token(), 'role': 'admin'})
            self._record_auth_failure()
            return self.send_json(401, {'ok': False, 'error': 'PIN de encargado incorrecto'})

        if path == '/api/auth/waiter':
            try:
                w = db.verify_waiter_login(str(body.get('waiterId') or ''), str(body.get('pin') or ''))
                return self.send_json(
                    200,
                    {'ok': True, 'waiter': w, 'token': create_staff_token('waiter', waiter_id=w['id']), 'role': 'waiter'},
                )
            except ActionError as e:
                self._record_auth_failure()
                return self.send_json(401, {'ok': False, 'error': str(e)})

        if path == '/api/auth/kitchen':
            if body.get('pin'):
                if not db.verify_admin_pin(str(body.get('pin'))):
                    self._record_auth_failure()
                    return self.send_json(401, {'ok': False, 'error': 'PIN incorrecto'})
            elif not db.is_demo_mode():
                self._record_auth_failure()
                return self.send_json(401, {'ok': False, 'error': 'Ingresá el PIN del local para abrir Cocina/Barra'})
            return self.send_json(200, {'ok': True, 'token': create_staff_token('kitchen'), 'role': 'kitchen'})

        auth_header = self.headers.get('X-Auth-Token') or ''
        role = resolve_role(auth_header)

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
                payload = raw_payload
            else:
                payload = {k: v for k, v in body.items() if k not in ('type', 'action')}
            result = db.execute(action_type, payload, role=role)
            flush_pending_webpush()
            broadcast_updates()
            if role in STAFF_ROLES or (
                db.is_demo_mode() and action_type not in ('order.create', 'call.create')
            ):
                state_out = db.get_staff_state(role=_staff_scope_for_role(role))
            else:
                state_out = db.get_client_state(
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

    def _stream_events(self, sub: Subscriber) -> None:
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('Connection', 'keep-alive')
        self.send_header('X-Accel-Buffering', 'no')
        self.end_headers()

        initial = (
            db.get_staff_state(role=sub.scope)
            if sub.scope in ('admin', 'demo_admin', 'staff')
            else db.get_client_state(sub.qr_token, sub.legacy_code)
        )
        sub.enqueue(json.dumps(initial, ensure_ascii=False))

        with subs_lock:
            subscribers.add(sub)
        try:
            while True:
                try:
                    msg = sub.q.get(timeout=15)
                    self.wfile.write(f'data: {msg}\n\n'.encode('utf-8'))
                except queue.Empty:
                    self.wfile.write(b': ping\n\n')
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, TimeoutError, OSError):
            pass
        finally:
            self.close_connection = True
            with subs_lock:
                subscribers.discard(sub)


class SaleListoHTTPServer(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address) -> None:
        exc = sys.exc_info()[1]
        if isinstance(exc, (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors='replace', line_buffering=True)
        except Exception:
            pass
    server = SaleListoHTTPServer(('0.0.0.0', PORT), Handler)
    base = f'http://{lan_ip()}:{PORT}'
    print('\n  SaleListo está corriendo\n')
    print(f'  Inicio / Portada:       {base}/')
    print(f'  Tablero operativo:      {base}/operacion.html')
    print(f'  Demo 4 pantallas:       {base}/demo.html')
    print(f'  Panel Encargado (PIN):  {base}/restaurante.html   (PIN inicial: 1234)')
    print(f'  Estación de Mozos:      {base}/pase.html')
    print(f'  Celular del Mozo:       {base}/mozo.html')
    print(f'  Pantalla Cocina/Barra:  {base}/cocina.html')
    print(f'  QRs fijos imprimibles:  {base}/qr.html')
    print('\n  Ctrl+C para detener.\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  Servidor detenido.')


if __name__ == '__main__':
    main()
