"""Servidor web de SaleListo: API transaccional, QR locales y tiempo real por rol.

Funciona tanto en computadora local (`python server.py`) como publicado en un
servidor cloud con HTTPS (usando la variable de entorno `PORT`) para que los
clientes escaneen con sus propios datos 4G/5G sin pedir Wi-Fi.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import os
import queue
import secrets
import socket
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from db import ActionError, Database
from qrgen import qr_svg

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
DATA_DIR = Path(os.environ.get('DATA_DIR') or (ROOT / 'data')).resolve()
DB_PATH = DATA_DIR / 'salelisto.db'
UPLOADS_DIR = DATA_DIR / 'uploads'
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT') or 8123)

SERVER_SECRET = secrets.token_bytes(32)
db = Database(DB_PATH, UPLOADS_DIR)

# Sesiones ligeras en memoria para mozos y cocina
staff_tokens: dict[str, str] = {}
tokens_lock = threading.Lock()


def make_admin_token() -> str:
    # Vinculado al PIN actual para invalidarse apenas el encargado cambie su PIN
    with db.lock:
        conn = db._connect()
        try:
            pin = conn.execute('SELECT admin_pin FROM restaurant WHERE id = 1').fetchone()['admin_pin']
        finally:
            conn.close()
    return 'adm_' + hmac.new(SERVER_SECRET, pin.encode('utf-8'), hashlib.sha256).hexdigest()


def resolve_role(token: str) -> str:
    if not token:
        return 'client'
    if hmac.compare_digest(token, make_admin_token()):
        return 'admin'
    with tokens_lock:
        if token in staff_tokens:
            return staff_tokens[token]
    return 'client'


def create_staff_token(role: str = 'waiter') -> str:
    tok = f'{role[:3]}_' + secrets.token_urlsafe(18)
    with tokens_lock:
        staff_tokens[tok] = role
    return tok


def lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sk:
            sk.connect(('10.255.255.255', 1))
            return sk.getsockname()[0]
    except OSError:
        return '127.0.0.1'


# ---------- Suscriptores Server-Sent Events (filtrados por rol) ----------

class Subscriber:
    def __init__(self, scope: str, qr_token: str = '', legacy_code: str = ''):
        self.scope = scope  # 'staff' | 'client'
        self.qr_token = qr_token
        self.legacy_code = legacy_code
        self.q: queue.Queue[str] = queue.Queue()


subscribers: set[Subscriber] = set()
subs_lock = threading.Lock()


def broadcast_updates() -> None:
    with subs_lock:
        current_subs = list(subscribers)
    if not current_subs:
        return

    staff_json: str | None = None
    client_cache: dict[tuple[str, str], str] = {}

    for sub in current_subs:
        if sub.scope == 'staff':
            if staff_json is None:
                staff_json = json.dumps(db.get_staff_state(), ensure_ascii=False)
            sub.q.put(staff_json)
        else:
            key = (sub.qr_token, sub.legacy_code)
            if key not in client_cache:
                client_cache[key] = json.dumps(
                    db.get_client_state(sub.qr_token, sub.legacy_code),
                    ensure_ascii=False,
                )
            sub.q.put(client_cache[key])


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def end_headers(self) -> None:
        if not self.path.startswith('/uploads/'):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        if '/api/' in self.path and 'events' not in self.path:
            sys.stderr.write(f"{self.command} {self.path} {args[1] if len(args) > 1 else ''}\n")

    def _effective_base_url(self) -> str:
        staff = db.get_staff_state()
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

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path.startswith('/uploads/'):
            return self._serve_upload(path[len('/uploads/'):])

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
            base = self._effective_base_url()
            st = db.get_staff_state()
            blocks_out = []
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
            auth = self.headers.get('X-Auth-Token') or (qs.get('token') or [''])[0]
            role = resolve_role(auth)
            if role == 'client' and not db.is_demo_mode():
                return self.send_json(401, {'ok': False, 'error': 'Sesión requerida'})
            return self.send_json(200, db.get_staff_state())

        if path == '/api/waiters-public':
            # Lista mínima de mozos para la pantalla de ingreso del celular del mozo
            st = db.get_staff_state()
            return self.send_json(
                200,
                {
                    'restaurant': st['restaurant']['name'],
                    'demoMode': st['restaurant']['demoMode'],
                    'waiters': [
                        {
                            'id': w['id'],
                            'name': w['name'],
                            'color': w['color'],
                            'available': w['available'],
                            'hasPin': w['hasPin'],
                        }
                        for w in st['waiters']
                    ],
                },
            )

        if path == '/api/events':
            scope = (qs.get('scope') or ['client'])[0]
            if scope == 'staff':
                tok = (qs.get('token') or [''])[0]
                if resolve_role(tok) == 'client' and not db.is_demo_mode():
                    return self.send_json(401, {'ok': False, 'error': 'No autorizado'})
                return self._stream_events(Subscriber('staff'))
            qr_tok = (qs.get('t') or [''])[0]
            mesa = (qs.get('mesa') or [''])[0]
            return self._stream_events(Subscriber('client', qr_tok, mesa))

        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            length = int(self.headers.get('Content-Length') or 0)
            if length > 4_000_000:
                raise ActionError('Datos demasiado grandes (máx. 4 MB)')
            body = json.loads(self.rfile.read(length) or b'{}')
        except ActionError as e:
            return self.send_json(400, {'ok': False, 'error': str(e)})
        except (ValueError, TypeError):
            return self.send_json(400, {'ok': False, 'error': 'JSON inválido'})

        if path == '/api/auth/admin':
            if body.get('demo') and db.is_demo_mode():
                return self.send_json(200, {'ok': True, 'token': make_admin_token(), 'role': 'admin'})
            pin = str(body.get('pin') or '')
            if db.verify_admin_pin(pin):
                return self.send_json(200, {'ok': True, 'token': make_admin_token(), 'role': 'admin'})
            return self.send_json(401, {'ok': False, 'error': 'PIN de encargado incorrecto'})

        if path == '/api/auth/waiter':
            try:
                w = db.verify_waiter_login(str(body.get('waiterId') or ''), str(body.get('pin') or ''))
                return self.send_json(200, {'ok': True, 'waiter': w, 'token': create_staff_token('waiter')})
            except ActionError as e:
                return self.send_json(401, {'ok': False, 'error': str(e)})

        if path == '/api/auth/kitchen':
            if body.get('pin'):
                if not db.verify_admin_pin(str(body.get('pin'))):
                    return self.send_json(401, {'ok': False, 'error': 'PIN incorrecto'})
            elif not db.is_demo_mode():
                return self.send_json(401, {'ok': False, 'error': 'Ingresá el PIN del local para abrir Cocina/Barra'})
            return self.send_json(200, {'ok': True, 'token': create_staff_token('kitchen')})

        if path != '/api/action':
            return self.send_json(404, {'ok': False, 'error': 'Ruta no encontrada'})

        auth_header = self.headers.get('X-Auth-Token') or ''
        role = resolve_role(auth_header)

        try:
            action_type = str(body.get('type') or '')
            payload = body.get('payload') or {}
            result = db.execute(action_type, payload, role=role)
            broadcast_updates()
            if role in ('admin', 'waiter', 'kitchen'):
                state_out = db.get_staff_state()
            else:
                state_out = db.get_client_state(
                    str(payload.get('qrToken') or ''),
                    str(payload.get('mesa') or ''),
                )
            return self.send_json(200, {'ok': True, 'result': result, 'state': state_out})
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
            db.get_staff_state()
            if sub.scope == 'staff'
            else db.get_client_state(sub.qr_token, sub.legacy_code)
        )
        sub.q.put(json.dumps(initial, ensure_ascii=False))

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
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass
        finally:
            with subs_lock:
                subscribers.discard(sub)


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors='replace', line_buffering=True)
        except Exception:
            pass
    server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    server.daemon_threads = True
    base = f'http://{lan_ip()}:{PORT}'
    print('\n  SaleListo está corriendo\n')
    print(f'  Inicio / Portada:       {base}/')
    print(f'  Demo 4 pantallas:       {base}/demo.html')
    print(f'  Panel Encargado (PIN):  {base}/restaurante.html   (PIN inicial: 1234)')
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
