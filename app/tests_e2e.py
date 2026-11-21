"""Suite permanente de pruebas E2E de SaleListo (100% biblioteca estandar de Python).

Ejecucion:
    python -B app/tests_e2e.py

Levanta el servidor real en un puerto efimero (0) apuntando DATA_DIR a un
directorio temporal aislado (nunca lee ni modifica app/data/) y verifica:
  1. Criptografia Web Push RFC 8291/8292, VAPID por entorno, Anti-SSRF y auth en unsubscribe.
  2. Seguridad QR (/api/qrs 401 en produccion), QR largos hasta V10 (271 B), anti-spoofing y /api/health.
  3. Ruteo simultaneo a 3 estaciones (Cocina + Barra + Mostrador), 86 en Cocina (item.toggle) y price.undo.
  4. Balanceo/reasignacion de mozos, preservacion de PIN, login seguro en produccion y anti fuerza bruta.
  5. Cuenta con efectivo + vuelto + division (cashAmount/splitWays), integridad contable al archivar mesas/bloques,
     data.clear_open_turn, zona horaria ART (UTC-3, corte 06:00 AM) y exportacion CSV con BOM UTF-8.
  6. Aislamiento total de Leads PII ante demo_admin/waiter/kitchen (REST + SSE), HTTP 401 en /api/action
     y persistencia tras reinicio (state_ver monotonico, server_secret.key y staff_sessions).
  7. Streaming HTTP 206 Partial Content, ETag/304, sufijos y seguridad de /media/hero-salon-loop.mp4.
  8. Arquitectura 4G/5G sin Wi-Fi: rutas cortas /q/<qr_token>, compresion Gzip (sin tocar SSE ni 206),
     _client_ip() detras de CF-Connecting-IP/X-Forwarded-For vs LAN directa, idempotencia clientRequestId
     en POST /api/orders, precedencia PUBLIC_URL/tunel y endpoints /api/tunnel/*.
"""
from __future__ import annotations

import atexit
import csv
import gzip
import http.client
import io
import json
import os
import shutil
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.message import Message
from http.server import ThreadingHTTPServer
from pathlib import Path

sys.dont_write_bytecode = True

APP_DIR = Path(__file__).resolve().parent
DATA_DIR_REAL = APP_DIR / 'data'
REAL_DB_EXISTED_BEFORE = (DATA_DIR_REAL / 'salelisto.db').exists()
REAL_VAPID_EXISTED_BEFORE = (DATA_DIR_REAL / 'vapid_keys.json').exists()
REAL_SECRET_EXISTED_BEFORE = (DATA_DIR_REAL / 'server_secret.key').exists()


def _cleanup_pycache() -> None:
    pycache = APP_DIR / '__pycache__'
    if pycache.exists():
        shutil.rmtree(pycache, ignore_errors=True)


atexit.register(_cleanup_pycache)

# Aislar DATA_DIR ANTES de importar server.py para no tocar jamas app/data/
_TMP_CTX = tempfile.TemporaryDirectory(prefix='salelisto_e2e_')
os.environ['DATA_DIR'] = _TMP_CTX.name

if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

import db as db_mod  # noqa: E402
import qrgen  # noqa: E402
import server  # noqa: E402
import webpush  # noqa: E402


class QuietHandler(server.Handler):
    """Silencia logs HTTP esperados durante las pruebas negativas (400/401/403/404/416/429)."""

    def log_message(self, fmt: str, *args) -> None:
        return


class ApiClient:
    def __init__(self, base_url: str):
        self.base_url = base_url

    def request(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        raw_body = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
        req_headers: dict[str, str] = {}
        if raw_body is not None:
            req_headers['Content-Type'] = 'application/json; charset=utf-8'
        if headers:
            req_headers.update(headers)

        req = urllib.request.Request(
            f'{self.base_url}{path}',
            data=raw_body,
            headers=req_headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                norm_headers = {k.lower(): v for k, v in resp.headers.items()}
                return int(resp.status), norm_headers, resp.read()
        except urllib.error.HTTPError as err:
            norm_headers = {k.lower(): v for k, v in err.headers.items()}
            return int(err.code), norm_headers, err.read()

    def get_json(self, path: str, token: str = '') -> tuple[int, dict]:
        hdrs = {'X-Auth-Token': token} if token else None
        code, _, raw = self.request('GET', path, headers=hdrs)
        return code, json.loads(raw.decode('utf-8'))

    def post_json(self, path: str, body: dict, token: str = '') -> tuple[int, dict]:
        hdrs = {'X-Auth-Token': token} if token else None
        code, _, raw = self.request('POST', path, body=body, headers=hdrs)
        return code, json.loads(raw.decode('utf-8'))

    def action(self, action_type: str, payload: dict | None = None, token: str = '') -> tuple[int, dict]:
        return self.post_json(
            '/api/action',
            {'type': action_type, 'payload': payload or {}},
            token=token,
        )


def read_first_sse_event(
    port: int,
    path: str,
    headers: dict[str, str] | None = None,
) -> tuple[int, dict[str, str], dict | None]:
    conn = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
    try:
        conn.request('GET', path, headers=headers or {})
        resp = conn.getresponse()
        status = int(resp.status)
        resp_hdrs = {k.lower(): v for k, v in resp.getheaders()}
        if status != 200:
            resp.read()
            return status, resp_hdrs, None
        while True:
            line = resp.fp.readline().decode('utf-8')
            if not line:
                return status, resp_hdrs, None
            if line.startswith('data: '):
                return status, resp_hdrs, json.loads(line[6:].strip())
    finally:
        conn.close()


class _FakeCloudflaredProc:
    """Simula un proceso cloudflared emitiendo una URL Quick Tunnel sin usar red."""

    def __init__(self, lines: list[str], pid: int = 42420):
        self.pid = pid
        self.returncode: int | None = None
        self._stop_evt = threading.Event()
        self._r_fd, self._w_fd = os.pipe()
        self.stdout = os.fdopen(self._r_fd, 'r', encoding='utf-8', buffering=1)
        self._writer = os.fdopen(self._w_fd, 'w', encoding='utf-8', buffering=1)
        self._emitter = threading.Thread(target=self._run, args=(lines,), daemon=True)
        self._emitter.start()

    def _run(self, lines: list[str]) -> None:
        try:
            for ln in lines:
                self._writer.write(ln + '\n')
                self._writer.flush()
                time.sleep(0.02)
            self._stop_evt.wait(timeout=30)
        except OSError:
            pass
        finally:
            try:
                self._writer.close()
            except OSError:
                pass
            if self.returncode is None:
                self.returncode = 0

    def poll(self) -> int | None:
        return self.returncode

    def terminate(self) -> None:
        self.returncode = 0
        self._stop_evt.set()

    def kill(self) -> None:
        self.returncode = -9
        self._stop_evt.set()

    def wait(self, timeout: float | None = None) -> int:
        self._emitter.join(timeout=timeout or 2)
        if self.returncode is None:
            self.returncode = 0
        return self.returncode


def run_suite() -> None:
    print('=== SaleListo · Suite E2E Permanente ===\n')

    # 1. Auto-test criptografico NIST + P-256 + VAPID + RFC 8291 + Anti-SSRF
    webpush.self_test()

    # Verificar prioridad de VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY por entorno
    env_priv_int, env_pub_pt = webpush.generate_p256_keypair()
    env_priv_b64 = webpush.b64url_encode(env_priv_int.to_bytes(32, 'big'))
    env_pub_b64 = webpush.b64url_encode(webpush.encode_p256_public(env_pub_pt))
    with tempfile.TemporaryDirectory(prefix='salelisto_vapid_env_') as vdir:
        os.environ['VAPID_PRIVATE_KEY'] = env_priv_b64
        os.environ['VAPID_PUBLIC_KEY'] = env_pub_b64
        try:
            loaded_vapid = webpush.ensure_vapid_keys(Path(vdir))
            assert loaded_vapid['publicKey'] == env_pub_b64, 'ensure_vapid_keys no priorizo variables de entorno'
            assert not (Path(vdir) / 'vapid_keys.json').exists(), 'No debio escribir vapid_keys.json con env vars validas'
        finally:
            os.environ.pop('VAPID_PRIVATE_KEY', None)
            os.environ.pop('VAPID_PUBLIC_KEY', None)

    httpd = server.SaleListoHTTPServer(('127.0.0.1', 0), QuietHandler)
    port = httpd.server_address[1]
    srv_thread = threading.Thread(target=httpd.serve_forever, name='salelisto-e2e-http', daemon=True)
    srv_thread.start()

    api = ApiClient(f'http://127.0.0.1:{port}')

    try:
        # Verificar /api/health y clave publica VAPID expuesta por HTTP
        code, health = api.get_json('/api/health')
        assert code == 200 and health.get('ok') is True and health['version'] >= 1, 'Fallo GET /api/health'
        assert isinstance(health.get('subscribers'), int), 'Falta conteo subscribers en /api/health'

        code, vapid_res = api.get_json('/api/push/vapid-public-key')
        assert code == 200 and vapid_res.get('ok') is True, 'Fallo GET /api/push/vapid-public-key'
        pub_key = vapid_res['publicKey']
        assert len(pub_key) == 87 and pub_key.startswith('B'), f'Clave VAPID invalida: {pub_key}'
        pub_point = webpush.decode_p256_public(webpush.b64url_decode(pub_key))
        assert webpush.point_is_on_curve(pub_point), 'Clave VAPID publica no pertenece a NIST P-256'

        # Rechazo de Content-Length negativo en POST
        neg_conn = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
        try:
            neg_conn.putrequest('POST', '/api/action')
            neg_conn.putheader('Content-Type', 'application/json')
            neg_conn.putheader('Content-Length', '-5')
            neg_conn.endheaders()
            neg_resp = neg_conn.getresponse()
            neg_resp.read()
            assert neg_resp.status == 400, f'Content-Length negativo debio dar 400, dio {neg_resp.status}'
        finally:
            neg_conn.close()

        # Rechazo de endpoint SSRF interno en /api/push/subscribe
        _, sub_pub = webpush.generate_p256_keypair()
        valid_p256dh = webpush.b64url_encode(webpush.encode_p256_public(sub_pub))
        valid_auth_sec = webpush.b64url_encode(b'0123456789abcdef')
        code_ssrf, _ = api.post_json(
            '/api/push/subscribe',
            {
                'waiterId': 'w1',
                'subscription': {
                    'endpoint': 'http://127.0.0.1:9999/internal',
                    'keys': {'p256dh': valid_p256dh, 'auth': valid_auth_sec},
                },
            },
        )
        assert code_ssrf == 400, 'Suscripcion Push con endpoint local HTTP debio rechazarse con 400'
        print('OK [1/8] Web Push RFC 8291/8292, VAPID env, Anti-SSRF y /api/health verificados.')

        # Autenticar sesion de encargado real (PIN inicial 1234)
        code, auth_res = api.post_json('/api/auth/admin', {'pin': '1234'})
        assert code == 200 and auth_res.get('ok') is True and auth_res.get('role') == 'admin', 'Fallo login admin real'
        admin_token = auth_res['token']

        code, staff = api.get_json('/api/staff-state', token=admin_token)
        assert code == 200 and len(staff['tables']) >= 10, 'Estado inicial de staff incompleto'
        tables_by_code = {t['code']: t for t in staff['tables']}
        items_by_name = {i['name']: i for i in staff['items']}

        # 2. QR largos hasta Version 10 (271 B), escaneo QR valido, anti-spoofing y /api/qrs protegido en produccion
        for qr_len in (25, 140, 200, 271):
            svg_long = qrgen.qr_svg('https://menu.salelisto.com/cliente.html?t=' + ('a' * (qr_len - 42)))
            assert svg_long.startswith('<svg') and svg_long.endswith('</svg>')
        try:
            qrgen.qr_svg('x' * 272)
            raise AssertionError('QR de 272 bytes debio lanzar ValueError')
        except ValueError:
            pass
        code_qr_long, _, _ = api.request('GET', '/api/qr.svg?text=' + ('x' * 271))
        assert code_qr_long == 200, 'GET /api/qr.svg con 271 bytes debio responder 200'
        code_qr_over, _ = api.get_json('/api/qr.svg?text=' + ('x' * 272))
        assert code_qr_over == 400, 'GET /api/qr.svg con 272 bytes debio responder 400 limpio'

        mesa_1 = tables_by_code['1']
        code, cs_valid = api.get_json(f"/api/client-state?t={mesa_1['qrToken']}")
        assert code == 200 and cs_valid['validTable'] is True, 'Token QR valido rechazado'
        assert cs_valid['table']['code'] == '1', 'Mesa devuelta no coincide con token QR'
        assert any('sin_tacc' in i.get('tags', []) for i in cs_valid['items']), 'Faltan tags dietarios en client-state'

        code, cs_fake = api.get_json('/api/client-state?t=token_inexistente_999')
        assert code == 200 and cs_fake['validTable'] is False, 'Token QR falso no fue bloqueado'
        assert 'orders' not in cs_fake, 'Token QR falso no debe exponer pedidos'

        code, bad_ord = api.action(
            'order.create',
            {'qrToken': 'token_inexistente_999', 'items': [{'itemId': items_by_name['Ramen Tonkotsu']['id'], 'qty': 1}]},
        )
        assert code == 400 and bad_ord.get('ok') is False, 'Pedido con QR falso debio rechazarse con 400'

        # Intento de adulterar el precio desde el cliente (envia price=1 sobre un plato de $14.500)
        ramen = items_by_name['Ramen Tonkotsu']
        code, spoof_res = api.action(
            'order.create',
            {
                'qrToken': mesa_1['qrToken'],
                'items': [{'itemId': ramen['id'], 'qty': 2, 'price': 1, 'unitPrice': 1, 'unit_price': 1}],
            },
        )
        assert code == 200 and spoof_res['ok'] is True, 'Pedido legitimo con campos extra fallo'
        expected_ramen_sub = ramen['price'] * 2
        assert spoof_res['state']['subtotal'] == expected_ramen_sub, (
            f"Anti-spoofing fallo: esperaba {expected_ramen_sub}, obtuvo {spoof_res['state']['subtotal']}"
        )

        # Cantidades fuera de rango rechazadas
        for bad_qty in (0, -3, 99):
            code, _ = api.action(
                'order.create',
                {'qrToken': mesa_1['qrToken'], 'items': [{'itemId': ramen['id'], 'qty': bad_qty}]},
            )
            assert code == 400, f'Cantidad invalida {bad_qty} debio rechazarse con 400'

        # Modo produccion (demoMode=False): ?mesa=1 bloqueado, /api/qrs exige rol staff y /api/push/unsubscribe exige auth
        code, _ = api.action('restaurant.save', {'demoMode': False}, token=admin_token)
        assert code == 200
        code, cs_legacy_blocked = api.get_json('/api/client-state?mesa=1')
        assert cs_legacy_blocked['validTable'] is False, 'Acceso sin token ?mesa=1 debe bloquearse cuando demoMode=False'
        code, cs_qr_prod = api.get_json(f"/api/client-state?t={mesa_1['qrToken']}")
        assert cs_qr_prod['validTable'] is True, 'Token QR real debe seguir funcionando en modo produccion'

        code_qrs_anon, _ = api.get_json('/api/qrs')
        assert code_qrs_anon == 401, 'GET /api/qrs sin token en produccion debe devolver 401 (B1)'
        code_qrs_adm, qrs_adm = api.get_json('/api/qrs', token=admin_token)
        assert code_qrs_adm == 200 and len(qrs_adm['blocks']) >= 3, 'GET /api/qrs con token admin fallo en produccion'

        code_unsub_anon, _ = api.post_json('/api/push/unsubscribe', {'endpoint': 'https://8.8.8.8/push/demo'})
        assert code_unsub_anon == 401, 'POST /api/push/unsubscribe sin auth debe devolver 401 en produccion'

        api.action('restaurant.save', {'demoMode': True}, token=admin_token)
        api.action('data.clear_orders', {}, token=admin_token)
        print('OK [2/8] Seguridad /api/qrs en produccion, QR V10 (271 B) y anti-spoofing verificados.')

        # 3. Ruteo simultaneo a 3 estaciones (Cocina + Barra + Mostrador), 86 por kitchen y price.undo
        mesa_t1 = tables_by_code['T1']
        gyozas = items_by_name['Gyozas de cerdo']
        gin = items_by_name['Gin Tonic de Yuzu']
        sushi = items_by_name['Roll Philadelphia']

        # Reconfigurar categoria Sushi ('c3') a la 3ra estacion 'mostrador'
        code, _ = api.action(
            'category.save',
            {'id': 'c3', 'name': 'Sushi', 'icon': '🍣', 'station': 'mostrador'},
            token=admin_token,
        )
        assert code == 200, 'No se pudo asignar estacion mostrador a categoria Sushi'

        code, mix_res = api.action(
            'order.create',
            {
                'qrToken': mesa_t1['qrToken'],
                'items': [
                    {'itemId': ramen['id'], 'qty': 2, 'note': 'Sin verdeo'},
                    {'itemId': gyozas['id'], 'qty': 1, 'note': ''},
                    {'itemId': gin['id'], 'qty': 2, 'note': 'Poco hielo'},
                    {'itemId': sushi['id'], 'qty': 1, 'note': 'Extra jengibre'},
                ],
            },
        )
        assert code == 200 and mix_res['ok'] is True, 'Fallo creacion de pedido triple'
        order_ids = mix_res['result']['orderIds']
        assert len(order_ids) == 3, f'El pedido triple debia separarse en 3 comandas, genero {len(order_ids)}'
        assert set(mix_res['result']['stations']) == {'Barra', 'Mostrador', 'Cocina'}
        assert mix_res['result']['waiterName'] == 'Sofía', 'Terraza debia asignarse a Sofia por bloque pre-asignado'

        _, st_after_mix = api.get_json('/api/staff-state', token=admin_token)
        t1_orders = [o for o in st_after_mix['orders'] if o['id'] in order_ids]
        assert len({o['batchId'] for o in t1_orders}) == 1, 'Las 3 comandas deben compartir batchId'
        by_st = {o['station']: o for o in t1_orders}
        expected_kitchen = ramen['price'] * 2 + gyozas['price']
        expected_bar = gin['price'] * 2
        expected_counter = sushi['price'] * 1
        assert by_st['cocina']['total'] == expected_kitchen, 'Subtotal de comanda Cocina incorrecto'
        assert by_st['barra']['total'] == expected_bar, 'Subtotal de comanda Barra incorrecto'
        assert by_st['mostrador']['total'] == expected_counter, 'Subtotal de comanda Mostrador incorrecto'
        assert by_st['mostrador']['items'][0]['note'] == 'Extra jengibre'

        # Permiso 86 en Cocina: rol 'kitchen' puede ejecutar item.toggle pero nunca borrar ni cambiar precios
        code, k_auth = api.post_json('/api/auth/kitchen', {'pin': '1234'})
        assert code == 200 and k_auth.get('role') == 'kitchen'
        kitchen_token = k_auth['token']

        edamame = items_by_name['Edamame al wok']
        code_86_off, r_86_off = api.action('item.toggle', {'itemId': edamame['id']}, token=kitchen_token)
        assert code_86_off == 200 and r_86_off['result']['available'] is False, 'Kitchen no pudo marcar agotado (86)'
        code_86_on, r_86_on = api.action(
            'item.toggle',
            {'id': edamame['id'], 'itemId': edamame['id'], 'available': True},
            token=kitchen_token,
        )
        assert code_86_on == 200 and r_86_on['result']['available'] is True, 'Kitchen no pudo reactivar plato'
        code_k_del, _ = api.action('item.delete', {'id': edamame['id']}, token=kitchen_token)
        assert code_k_del == 403, 'Kitchen jamas debe poder borrar platos (403)'
        code_k_adj, _ = api.action('menu.adjust_prices', {'percent': 10, 'roundTo': 100}, token=kitchen_token)
        assert code_k_adj == 403, 'Kitchen jamas debe poder ajustar precios (403)'

        # Ajuste masivo de precios + deshacer (price.undo)
        orig_ramen_price = ramen['price']
        code_adj, r_adj = api.action('menu.adjust_prices', {'percent': 10, 'roundTo': 100}, token=admin_token)
        assert code_adj == 200 and r_adj['state']['restaurant']['canUndoPrices'] is True
        adj_ramen = next(i for i in r_adj['state']['items'] if i['id'] == ramen['id'])
        assert adj_ramen['price'] != orig_ramen_price
        code_undo, r_undo = api.action('price.undo', {}, token=admin_token)
        assert code_undo == 200 and r_undo['state']['restaurant']['canUndoPrices'] is False
        restored_ramen = next(i for i in r_undo['state']['items'] if i['id'] == ramen['id'])
        assert restored_ramen['price'] == orig_ramen_price, 'price.undo no restauro el precio exacto original'
        print('OK [3/8] 3 Estaciones (Cocina + Barra + Mostrador), 86 en Cocina y price.undo verificados.')

        # 4. Balanceo, desasignacion limpia, preservacion de PIN de mozo, login en prod y anti fuerza bruta
        mesa_2 = tables_by_code['2']
        mesa_b1 = tables_by_code['B1']
        api.action('order.create', {'qrToken': mesa_1['qrToken'], 'items': [{'itemId': gyozas['id'], 'qty': 1}]})
        api.action('order.create', {'qrToken': mesa_2['qrToken'], 'items': [{'itemId': gyozas['id'], 'qty': 1}]})
        api.action('order.create', {'qrToken': mesa_b1['qrToken'], 'items': [{'itemId': gin['id'], 'qty': 1}]})

        _, st_load = api.get_json('/api/staff-state', token=admin_token)
        open_tbls = {t['code']: t for t in st_load['tables'] if t['sessionId']}
        interior_waiters = {open_tbls['1']['waiterId'], open_tbls['2']['waiterId']}
        assert interior_waiters == {'w1', 'w2'}, f'Balanceo en Interior esperaba w1 y w2, dio {interior_waiters}'

        # Desasignar mozo manualmente con waiterId="" y volver a asignarlo
        code_unassign, r_unassign = api.action(
            'session.reassign',
            {'tableId': mesa_b1['id'], 'waiterId': ''},
            token=admin_token,
        )
        assert code_unassign == 200 and r_unassign['result']['waiterId'] is None
        api.action('session.reassign', {'tableId': mesa_b1['id'], 'waiterId': 'w1'}, token=admin_token)

        # Llamado pendiente en T1 (atendida por w3 Sofia) antes de pausarla
        api.action('call.create', {'qrToken': mesa_t1['qrToken'], 'type': 'mozo', 'reason': 'Servilletas'})
        code, toggle_res = api.action('waiter.toggle', {'id': 'w3', 'available': False}, token=admin_token)
        assert code == 200 and len(toggle_res['result']['reassigned']) >= 1, 'No reasigno las mesas abiertas de Sofia'
        st_reassigned = toggle_res['state']
        assert not [t for t in st_reassigned['tables'] if t['sessionId'] and t['waiterId'] == 'w3']
        t1_now = next(t for t in st_reassigned['tables'] if t['code'] == 'T1')
        t1_call = next(c for c in st_reassigned['calls'] if c['tableCode'] == 'T1')
        assert t1_call['waiterId'] == t1_now['waiterId'], 'El llamado activo no acompano la reasignacion de mozo'
        api.action('waiter.toggle', {'id': 'w3', 'available': True}, token=admin_token)

        # [B3] Preservacion de PIN de mozo al editar con pin="" y revocacion de sesion al cambiar PIN
        code, _ = api.action(
            'waiter.save',
            {'id': 'w1', 'name': 'Lucía', 'color': '#d9412b', 'pin': '4821', 'available': True, 'blockIds': ['b1']},
            token=admin_token,
        )
        assert code == 200
        # Editar color/nombre enviando pin="" sin clearPin -> debe conservar PIN '4821'
        code, r_preserve = api.action(
            'waiter.save',
            {'id': 'w1', 'name': 'Lucía G.', 'color': '#0d9488', 'pin': '', 'available': True, 'blockIds': ['b1']},
            token=admin_token,
        )
        assert code == 200 and r_preserve['result']['hasPin'] is True, 'act_waiter_save borro el PIN con pin="" (B3)'
        code_bad_wpin, _ = api.post_json('/api/auth/waiter', {'waiterId': 'w1', 'pin': ''})
        assert code_bad_wpin == 401, 'El PIN preservado 4821 debio exigirse al loguearse'
        code_ok_wpin, w1_login = api.post_json('/api/auth/waiter', {'waiterId': 'w1', 'pin': '4821'})
        assert code_ok_wpin == 200
        w1_old_token = w1_login['token']

        # Cambiar PIN de w1 revoca automaticamente su sesion activa en staff_sessions (B6)
        api.action(
            'waiter.save',
            {'id': 'w1', 'name': 'Lucía', 'color': '#d9412b', 'pin': '7391', 'available': True, 'blockIds': ['b1']},
            token=admin_token,
        )
        api.action('restaurant.save', {'demoMode': False}, token=admin_token)
        code_revoked, _ = api.get_json('/api/staff-state', token=w1_old_token)
        assert code_revoked == 401, 'Cambiar el PIN de un mozo debe revocar sus staff_sessions previas (B6)'

        # Mozo sin PIN individual (w2 Mateo) en modo produccion: rechaza pin="" y acepta admin_pin ('1234') (B3)
        code_w2_empty, _ = api.post_json('/api/auth/waiter', {'waiterId': 'w2', 'pin': ''})
        assert code_w2_empty == 401, 'En produccion un mozo sin PIN propio no puede entrar con pin vacio (B3)'
        code_w2_wrong, _ = api.post_json('/api/auth/waiter', {'waiterId': 'w2', 'pin': '9999'})
        assert code_w2_wrong == 401
        code_w2_local, w2_login = api.post_json('/api/auth/waiter', {'waiterId': 'w2', 'pin': '1234'})
        assert code_w2_local == 200 and w2_login['waiter']['id'] == 'w2', 'Mozo sin PIN propio debe aceptar PIN del local'

        # Limpiar PIN de w1 explicitamente con clearPin=True y volver a demoMode=True
        api.action('restaurant.save', {'demoMode': True}, token=admin_token)
        code_clear_pin, r_clear_pin = api.action(
            'waiter.save',
            {'id': 'w1', 'name': 'Lucía', 'color': '#d9412b', 'pin': '', 'clearPin': True, 'available': True, 'blockIds': ['b1']},
            token=admin_token,
        )
        assert code_clear_pin == 200 and r_clear_pin['result']['hasPin'] is False

        # Rate-limit anti fuerza bruta en /api/auth/* (max 10 fallos / 5 min)
        server.auth_failures.clear()
        for _ in range(server.AUTH_MAX_FAILURES):
            c_fail, _ = api.post_json('/api/auth/admin', {'pin': '0000'})
            assert c_fail == 401
        c_locked, _ = api.post_json('/api/auth/admin', {'pin': '1234'})
        assert c_locked == 429, f'Tras {server.AUTH_MAX_FAILURES} fallos /api/auth/admin debio responder 429, dio {c_locked}'
        server.auth_failures.clear()
        print('OK [4/8] Preservacion de PIN, login seguro en produccion, revocacion y rate-limit verificados.')

        # 5. Cuenta con vuelto y division (cashAmount/splitWays), cierre, integridad al borrar mesa/bloque (B5) y ART 06:00 (B7)
        expected_sub = expected_kitchen + expected_bar + expected_counter  # 35.500 + 13.600 + 10.500 = 59.600
        expected_tip = round(expected_sub * 10 / 100)                      # 5.960
        expected_total = expected_sub + expected_tip                       # 65.560
        declared_cash = 80000
        expected_change = declared_cash - expected_total                   # 14.440

        code, bill_res = api.action(
            'call.create',
            {
                'qrToken': mesa_t1['qrToken'],
                'type': 'cuenta',
                'payment': 'Efectivo',
                'tip': 10,
                'cashAmount': declared_cash,
                'splitWays': 4,
            },
        )
        assert code == 200 and bill_res['ok'] is True
        cs_bill = bill_res['state']
        client_bill_call = next(c for c in cs_bill['calls'] if c['type'] == 'cuenta')
        assert client_bill_call['cashAmount'] == declared_cash and client_bill_call['splitWays'] == 4

        _, st_bill = api.get_json('/api/staff-state', token=admin_token)
        bill_call = next(c for c in st_bill['calls'] if c['tableCode'] == 'T1' and c['type'] == 'cuenta')
        assert bill_call['subtotal'] == expected_sub
        assert bill_call['tipAmount'] == expected_tip
        assert bill_call['total'] == expected_total
        assert bill_call['cashAmount'] == declared_cash
        assert bill_call['splitWays'] == 4
        assert bill_call['changeAmount'] == expected_change
        bill_notif = st_bill['notifications'][0]
        assert '80.000' in bill_notif['shortTitle'] and '14.440' in bill_notif['shortBody'], (
            f"Notificacion corta de pulsera no incluyo efectivo/vuelto: {bill_notif}"
        )
        assert len(bill_notif['shortTitle']) <= 26 and len(bill_notif['shortBody']) <= 48

        # Proteccion de cierre con comandas sin entregar
        code, premature_close = api.action('table.close', {'tableId': mesa_t1['id']}, token=admin_token)
        assert code == 400 and premature_close.get('ok') is False

        for oid in order_ids:
            api.action('order.advance', {'id': oid}, token=admin_token)  # nuevo -> cocina
            _, r_listo = api.action('order.advance', {'id': oid}, token=admin_token)  # cocina -> listo
            latest_notif = r_listo['state']['notifications'][0]
            assert len(latest_notif['shortTitle']) <= 26 and len(latest_notif['shortBody']) <= 48
            api.action('order.advance', {'id': oid}, token=admin_token)  # listo -> entregado

        code, close_res = api.action(
            'table.close',
            {'tableId': mesa_t1['id'], 'payment': 'Efectivo', 'tip': 10},
            token=admin_token,
        )
        assert code == 200 and close_res['result']['total'] == expected_total
        assert close_res['state']['kpis']['closedSalesToday'] == expected_sub

        # data.clear_open_turn limpia sesiones abiertas (1, 2, B1) preservando intacta la sesion cerrada de T1
        code_cot, r_cot = api.action('data.clear_open_turn', {}, token=admin_token)
        assert code_cot == 200 and r_cot['result']['clearedOpenSessions'] >= 3
        assert r_cot['state']['kpis']['closedSalesToday'] == expected_sub
        assert r_cot['state']['kpis']['openConsumption'] == 0

        # [B5] Borrar mesa T1 (con historial cerrado) y bloque Terraza ('b2') hace baja logica sin perder arqueo CSV
        code_del_t1, r_del_t1 = api.action('table.delete', {'id': mesa_t1['id']}, token=admin_token)
        assert code_del_t1 == 200 and r_del_t1['result']['archived'] is True
        assert all(t['id'] != mesa_t1['id'] for t in r_del_t1['state']['tables']), 'Mesa archivada no debe listarse activa'
        assert r_del_t1['state']['kpis']['closedSalesToday'] == expected_sub, 'Borrar mesa con historial perdio KPIs (B5)'

        code_del_b2, r_del_b2 = api.action('block.delete', {'id': 'b2'}, token=admin_token)
        assert code_del_b2 == 200 and r_del_b2['result']['archived'] is True
        assert all(b['id'] != 'b2' for b in r_del_b2['state']['blocks']), 'Bloque archivado no debe listarse activo'

        # Se puede volver a crear una mesa con codigo 'T1' sin colisionar con la archivada
        code_recreate_t1, _ = api.action(
            'table.save',
            {'blockId': 'b1', 'code': 'T1', 'seats': 4, 'active': True},
            token=admin_token,
        )
        assert code_recreate_t1 == 200, 'Una mesa archivada no debe bloquear reutilizar su codigo T1'

        csv_code, csv_hdrs, csv_raw = api.request(
            'GET',
            '/api/export/sessions.csv?turno=hoy',
            headers={'X-Auth-Token': admin_token},
        )
        assert csv_code == 200 and csv_raw.startswith(b'\xef\xbb\xbf')
        assert 'attachment' in csv_hdrs.get('content-disposition', '')
        csv_rows = list(csv.reader(io.StringIO(csv_raw.decode('utf-8-sig')), delimiter=';'))
        assert len(csv_rows) == 2, f'El arqueo CSV debia preservar la sesion de T1 archivada, obtuvo {len(csv_rows)} filas'
        row_t1 = csv_rows[1]
        assert row_t1[4] == 'T1' and row_t1[5] == 'Terraza' and row_t1[7] == 'Efectivo'
        assert int(row_t1[8]) == expected_sub and int(row_t1[11]) == expected_total

        # [B7] Corte operativo gastronomico 06:00 AM ART (UTC-3, sin depender de tzdata)
        late_night_utc = datetime(2026, 11, 20, 5, 30, 0, tzinfo=timezone.utc)  # 02:30 ART del 20/11 -> turno del 19/11 06:00 ART
        expected_shift_19 = int(datetime(2026, 11, 19, 6, 0, 0, tzinfo=db_mod.AR_TZ).timestamp() * 1000)
        assert db_mod.start_of_today_ms(late_night_utc) == expected_shift_19, 'Fallo corte 06:00 ART en madrugada (02:30 ART)'

        evening_utc_next_day = datetime(2026, 11, 21, 1, 30, 0, tzinfo=timezone.utc)  # 22:30 ART del 20/11 -> turno del 20/11 06:00 ART
        expected_shift_20 = int(datetime(2026, 11, 20, 6, 0, 0, tzinfo=db_mod.AR_TZ).timestamp() * 1000)
        assert db_mod.start_of_today_ms(evening_utc_next_day) == expected_shift_20, 'Fallo corte ART a las 22:30 ART (01:30 UTC)'
        print('OK [5/8] Efectivo/vuelto/vaquita, archivo contable sin perdida (B5) y corte 06:00 ART (B7) verificados.')

        # 6. Aislamiento total de Leads PII ante demo_admin (B2), HTTP 401 en /api/action y persistencia tras reinicio (B6)
        server.leads_rate.clear()
        code, _ = api.post_json('/api/leads', {'name': '', 'restaurantName': '', 'contact': 'ventas@salelisto.com'})
        assert code == 400
        code, _ = api.post_json('/api/leads', {'name': 'Valeria', 'contact': '   '})
        assert code == 400

        code, lead_created = api.post_json(
            '/api/leads',
            {
                'name': 'Martín Gómez Privado',
                'restaurantName': 'Bistró Confidencial Real',
                'zone': 'Palermo',
                'tablesCount': 24,
                'contact': 'ventas@salelisto.com',
                'planInterest': 'Salón / Bistró',
                'message': 'Dato comercial real que jamas debe ver demo_admin.',
            },
        )
        assert code == 200 and lead_created.get('ok') is True
        real_lead_id = lead_created['lead']['id']

        # Login demo_admin con {"demo": true} cuando demoMode=True
        code_dm, dm_auth = api.post_json('/api/auth/admin', {'demo': True})
        assert code_dm == 200 and dm_auth.get('role') == 'demo_admin', f'Esperaba rol demo_admin, dio {dm_auth}'
        demo_admin_token = dm_auth['token']
        assert demo_admin_token != admin_token, 'demo_admin NO debe recibir make_admin_token() real (B2)'

        # demo_admin solo ve los 2 leads ficticios en /api/staff-state, /api/leads y SSE /api/events
        _, st_dm = api.get_json('/api/staff-state', token=demo_admin_token)
        dm_lead_ids = {l['id'] for l in st_dm['leads']}
        assert dm_lead_ids == {'DEMO-L1', 'DEMO-L2'} and real_lead_id not in dm_lead_ids, (
            'FUGA PII: demo_admin vio leads reales en /api/staff-state'
        )
        _, api_dm_leads = api.get_json('/api/leads', token=demo_admin_token)
        assert {l['id'] for l in api_dm_leads['leads']} == {'DEMO-L1', 'DEMO-L2'}

        sse_code_dm, _, sse_dm = read_first_sse_event(port, f'/api/events?scope=staff&token={demo_admin_token}')
        assert sse_code_dm == 200 and sse_dm is not None
        assert {l['id'] for l in sse_dm['leads']} == {'DEMO-L1', 'DEMO-L2'}, 'FUGA PII en SSE demo_admin'

        sse_code_adm, sse_adm_hdrs, sse_adm = read_first_sse_event(
            port,
            f'/api/events?scope=staff&token={admin_token}',
            headers={'Accept-Encoding': 'gzip'},
        )
        assert sse_code_adm == 200 and sse_adm is not None
        assert any(l['id'] == real_lead_id for l in sse_adm['leads']), 'Admin real no recibio leads reales en SSE'
        assert 'content-encoding' not in sse_adm_hdrs, 'SSE /api/events jamas debe comprimirse con gzip'
        assert 'no-transform' in sse_adm_hdrs.get('cache-control', ''), 'SSE debe incluir Cache-Control: no-cache, no-transform'
        assert sse_adm_hdrs.get('x-accel-buffering') == 'no', 'SSE debe incluir X-Accel-Buffering: no'

        # Kitchen y Waiter reciben leads=[] vacio
        _, st_kitchen = api.get_json('/api/staff-state', token=kitchen_token)
        assert st_kitchen['leads'] == [], 'Kitchen no debe recibir leads en staff-state'

        # demo_admin NO puede desactivar demoMode, cambiar adminPin, alterar publicUrl ni mutar leads reales
        code_dm_off, _ = api.action('restaurant.save', {'demoMode': False}, token=demo_admin_token)
        assert code_dm_off == 400, 'demo_admin no debe poder desactivar demoMode'
        code_dm_pin, _ = api.action('restaurant.save', {'adminPin': '9999'}, token=demo_admin_token)
        assert code_dm_pin == 400, 'demo_admin no debe poder cambiar adminPin'
        code_dm_url, r_dm_url = api.action(
            'restaurant.save',
            {'name': 'Kaiten Bar', 'publicUrl': 'http://127.0.0.1:9999'},
            token=demo_admin_token,
        )
        assert code_dm_url == 200 and r_dm_url['state']['restaurant']['publicUrl'] == '', (
            'demo_admin no debe poder modificar publicUrl'
        )
        code_dm_lead_mut, _ = api.action(
            'lead.status',
            {'leadId': real_lead_id, 'status': 'descartado'},
            token=demo_admin_token,
        )
        assert code_dm_lead_mut == 200
        _, real_leads_check = api.get_json('/api/leads', token=admin_token)
        real_lead_now = next(l for l in real_leads_check['leads'] if l['id'] == real_lead_id)
        assert real_lead_now['status'] == 'nuevo', 'demo_admin jamas debe mutar un lead real en SQLite'

        # Fuera de modo demo: /api/action sin sesion devuelve HTTP 401 (no 400)
        api.action('restaurant.save', {'demoMode': False}, token=admin_token)
        code_unauth_leads, _ = api.get_json('/api/leads')
        assert code_unauth_leads == 401
        code_unauth_csv, _, _ = api.request('GET', '/api/export/sessions.csv')
        assert code_unauth_csv == 401
        code_unauth_act, _ = api.action('lead.status', {'leadId': real_lead_id, 'status': 'piloto'})
        assert code_unauth_act == 401, f'Accion staff sin token debio responder 401 (B6), dio {code_unauth_act}'
        code_unauth_adv, _ = api.action('order.advance', {'id': 'P1'})
        assert code_unauth_adv == 401, f'order.advance sin token en prod debio responder 401, dio {code_unauth_adv}'

        code, upd_lead = api.action('lead.status', {'leadId': real_lead_id, 'status': 'piloto'}, token=admin_token)
        assert code == 200 and upd_lead['state']['leads'][0]['status'] == 'piloto'

        # Antispam de POST /api/leads
        statuses = []
        for idx in range(server.LEAD_MAX_PER_WINDOW + 1):
            st_code, _ = api.post_json(
                '/api/leads',
                {'name': f'Prospecto {idx}', 'contact': 'ventas@salelisto.com'},
            )
            statuses.append(st_code)
        assert 429 in statuses, f'El limitador antispam debia responder 429: {statuses}'
        api.action('restaurant.save', {'demoMode': True}, token=admin_token)

        # [B6] Simulacion de reinicio de proceso sobre el mismo DATA_DIR: version monotonica, secret y staff_sessions
        ver_before_restart = server.db.version
        assert ver_before_restart > 10
        secret_reloaded = server.ensure_server_secret(Path(_TMP_CTX.name))
        assert secret_reloaded == server.SERVER_SECRET and len(secret_reloaded) == 32

        restarted_db = db_mod.Database(server.DB_PATH, server.UPLOADS_DIR)
        assert restarted_db.version == ver_before_restart, (
            f'state_ver no persistio tras reinicio: {restarted_db.version} != {ver_before_restart}'
        )
        persisted_w2 = restarted_db.get_staff_session(w2_login['token'])
        assert persisted_w2 is not None and persisted_w2['role'] == 'waiter', 'staff_sessions no persistio en SQLite'
        restarted_db.execute('notifications.read', {}, role='admin')
        assert restarted_db.version == ver_before_restart + 1, 'La version no crecio monotonicamente tras reinicio'
        print('OK [6/8] Aislamiento PII demo_admin, HTTP 401 y persistencia tras reinicio (B6) verificados.')

        # 7. Entrega multimedia HTTP 206 Partial Content (/media/hero-salon-loop.mp4) y vistas clave
        hero_file = APP_DIR / 'public' / 'media' / 'hero-salon-loop.mp4'
        assert hero_file.is_file(), f'No existe {hero_file}'
        total_size = hero_file.stat().st_size

        m_code, m_hdrs, m_chunk = api.request(
            'GET',
            '/media/hero-salon-loop.mp4',
            headers={'Range': 'bytes=0-1023'},
        )
        assert m_code == 206 and len(m_chunk) == 1024
        assert m_hdrs.get('content-range') == f'bytes 0-1023/{total_size}'
        assert m_hdrs.get('accept-ranges') == 'bytes'
        assert m_hdrs.get('cache-control') == 'public, max-age=86400'
        etag = m_hdrs.get('etag', '')
        assert etag

        nm_code, _, nm_body = api.request(
            'GET',
            '/media/hero-salon-loop.mp4',
            headers={'If-None-Match': etag},
        )
        assert nm_code == 304 and len(nm_body) == 0

        suf_code, _, suf_chunk = api.request(
            'GET',
            '/media/hero-salon-loop.mp4',
            headers={'Range': 'bytes=-512'},
        )
        assert suf_code == 206 and len(suf_chunk) == 512

        oob_code, _, _ = api.request(
            'GET',
            '/media/hero-salon-loop.mp4',
            headers={'Range': f'bytes={total_size + 100}-{total_size + 200}'},
        )
        assert oob_code == 416

        trav_code, _, _ = api.request('GET', '/media/../server.py')
        assert trav_code == 404

        for route in ('/qr.html', '/demo.html', '/operacion.html', '/api/qrs', '/api/health'):
            r_code, _, _ = api.request('GET', route)
            assert r_code == 200, f'Ruta {route} devolvio {r_code}'
        print('OK [7/8] Streaming HTTP 206 de /media/hero-salon-loop.mp4 y vistas clave verificados.')

        # 8. Arquitectura 4G/5G sin Wi-Fi: /q/<token>, Gzip, _client_ip(), idempotencia POST /api/orders y /api/tunnel/*
        api.action('data.clear_orders', {}, token=admin_token)
        api.action('restaurant.save', {'publicUrl': '', 'demoMode': True}, token=admin_token)

        # 8a. Rutas cortas /q/<qr_token> (sirve cliente.html directo con <base href="/">) y compatibilidad /cliente.html?t=
        q_code, q_hdrs, q_raw = api.request('GET', f"/q/{mesa_1['qrToken']}")
        assert q_code == 200, f'GET /q/<token> debio responder 200, dio {q_code}'
        assert 'text/html' in q_hdrs.get('content-type', '')
        q_html = q_raw.decode('utf-8')
        assert '<base href="/">' in q_html and 'js/cliente.js' in q_html, 'GET /q/<token> no sirvio cliente.html con base href'

        qh_code, _, qh_raw = api.request('HEAD', f"/q/{mesa_1['qrToken']}")
        assert qh_code == 200 and len(qh_raw) == 0, 'HEAD /q/<token> fallo'

        qt_code, _, _ = api.request('GET', '/q/../../server.py')
        assert qt_code == 404, f'Path traversal en /q/ debio responder 404, dio {qt_code}'

        # Verificar que /api/qrs emite URLs cortas /q/<qrToken>
        _, qrs_short = api.get_json('/api/qrs', token=admin_token)
        m1_card = next(
            card
            for blk in qrs_short['blocks']
            for card in blk['tables']
            if card['qrToken'] == mesa_1['qrToken']
        )
        assert m1_card['url'].endswith(f"/q/{mesa_1['qrToken']}"), f"QR no uso ruta corta /q/: {m1_card['url']}"
        assert m1_card['legacyUrl'].endswith(f"/cliente.html?t={mesa_1['qrToken']}")
        assert qrs_short['isPublic4g'] is False and qrs_short['isLocalOnly'] is True

        # 8b. Compresion HTTP Gzip (>= 512 B) con Vary: Accept-Encoding sin tocar SSE ni /media/ 206
        for gz_path, gz_hdrs_in in (
            ('/api/staff-state', {'Accept-Encoding': 'gzip', 'X-Auth-Token': admin_token}),
            (f"/q/{mesa_1['qrToken']}", {'Accept-Encoding': 'gzip, deflate'}),
            ('/js/cliente.js', {'Accept-Encoding': 'gzip'}),
            ('/css/cliente.css', {'Accept-Encoding': 'gzip'}),
            (f"/api/qr.svg?text=https://tu-local.trycloudflare.com/q/{mesa_1['qrToken']}", {'Accept-Encoding': 'gzip'}),
        ):
            c_gz, h_gz, raw_gz = api.request('GET', gz_path, headers=gz_hdrs_in)
            assert c_gz == 200, f'Gzip GET {gz_path} fallo con {c_gz}'
            assert h_gz.get('content-encoding') == 'gzip', f'{gz_path} no devolvio Content-Encoding: gzip ({h_gz})'
            assert 'accept-encoding' in h_gz.get('vary', '').lower(), f'{gz_path} no incluyo Vary: Accept-Encoding'
            dec = gzip.decompress(raw_gz)
            assert len(raw_gz) < len(dec), f'{gz_path} comprimido ({len(raw_gz)}) no redujo tamano ({len(dec)})'

        # Accept-Encoding: gzip; q = 0 (con espacios) NO debe comprimir
        _, h_nogz, raw_nogz = api.request(
            'GET',
            '/api/staff-state',
            headers={'Accept-Encoding': 'gzip; q = 0', 'X-Auth-Token': admin_token},
        )
        assert 'content-encoding' not in h_nogz and json.loads(raw_nogz.decode('utf-8'))['version'] >= 1

        # ETag diferenciado (-gz vs -id), 304 Not Modified y HEAD sin body en estaticos y /q/<token>
        c_js_gz, h_js_gz, _ = api.request('GET', '/js/cliente.js', headers={'Accept-Encoding': 'gzip'})
        c_js_id, h_js_id, _ = api.request('GET', '/js/cliente.js')
        etag_js_gz = h_js_gz.get('etag', '')
        etag_js_id = h_js_id.get('etag', '')
        assert c_js_gz == 200 and c_js_id == 200
        assert etag_js_gz.endswith('-gz"') and etag_js_id.endswith('-id"') and etag_js_gz != etag_js_id
        assert h_js_gz.get('last-modified'), 'Falta Last-Modified en estatico comprimido'

        c_304_gz, h_304_gz, b_304_gz = api.request(
            'GET',
            '/js/cliente.js',
            headers={'Accept-Encoding': 'gzip', 'If-None-Match': etag_js_gz},
        )
        assert c_304_gz == 304 and len(b_304_gz) == 0 and 'content-encoding' not in h_304_gz

        c_304_id, _, b_304_id = api.request(
            'GET',
            '/js/cliente.js',
            headers={'If-None-Match': etag_js_id},
        )
        assert c_304_id == 304 and len(b_304_id) == 0

        c_q304_1, h_q304_1, _ = api.request('GET', f"/q/{mesa_1['qrToken']}", headers={'Accept-Encoding': 'gzip'})
        assert c_q304_1 == 200 and h_q304_1.get('etag', '').endswith('-gz"')
        c_q304_2, _, b_q304_2 = api.request(
            'GET',
            f"/q/{mesa_1['qrToken']}",
            headers={'Accept-Encoding': 'gzip', 'If-None-Match': h_q304_1['etag']},
        )
        assert c_q304_2 == 304 and len(b_q304_2) == 0

        c_head_gz, h_head_gz, b_head_gz = api.request('HEAD', '/js/cliente.js', headers={'Accept-Encoding': 'gzip'})
        assert c_head_gz == 200 and h_head_gz.get('content-encoding') == 'gzip' and len(b_head_gz) == 0

        # HEAD /uploads/<archivo> devuelve 200 sin body
        up_test = server.UPLOADS_DIR / 'e2e_probe.jpg'
        up_test.write_bytes(b'\xff\xd8\xff\xe0salelisto-upload-probe')
        try:
            c_up_h, h_up_h, b_up_h = api.request('HEAD', '/uploads/e2e_probe.jpg')
            assert c_up_h == 200 and len(b_up_h) == 0 and int(h_up_h.get('content-length', '0')) == up_test.stat().st_size
        finally:
            up_test.unlink(missing_ok=True)

        # /media/ 206 con Accept-Encoding: gzip NO debe comprimirse
        c_m206, h_m206, ch_m206 = api.request(
            'GET',
            '/media/hero-salon-loop.mp4',
            headers={'Range': 'bytes=0-1023', 'Accept-Encoding': 'gzip'},
        )
        assert c_m206 == 206 and len(ch_m206) == 1024 and 'content-encoding' not in h_m206

        # 8c. _client_ip(): derecha-a-izquierda en XFF, cabeceras duplicadas, Fly/CF-Ray y anti-spoofing LAN/cloud
        def _make_dummy_handler(peer: str, hdrs: dict[str, str] | Message):
            h = server.Handler.__new__(server.Handler)
            h.client_address = (peer, 54321)
            h.headers = hdrs
            return h

        lan_spoof = _make_dummy_handler(
            '192.168.1.50',
            {'CF-Connecting-IP': '203.0.113.99', 'X-Forwarded-For': '198.51.100.77, 10.0.0.1'},
        )
        saved_env = {k: os.environ.pop(k, None) for k in ('TRUST_PROXY', 'RENDER', 'FLY_APP_NAME', 'RAILWAY_ENVIRONMENT')}
        try:
            assert lan_spoof._client_ip() == '192.168.1.50', (
                'Conexion LAN directa sin TRUST_PROXY no debe confiar en CF-Connecting-IP ni X-Forwarded-For'
            )
            os.environ['TRUST_PROXY'] = '1'
            assert lan_spoof._client_ip() == '203.0.113.99', (
                'Con TRUST_PROXY=1 debe priorizar CF-Connecting-IP'
            )
            # X-Forwarded-For con prefijo falsificado por atacante + IP real + salto interno -> derecha a izquierda
            lan_xff = _make_dummy_handler('192.168.1.50', {'X-Forwarded-For': '1.2.3.4, 198.51.100.77, 10.0.0.1'})
            assert lan_xff._client_ip() == '198.51.100.77', (
                f'X-Forwarded-For debio elegir primera IP publica de derecha a izquierda, dio {lan_xff._client_ip()}'
            )
            # Cabeceras X-Forwarded-For duplicadas (HTTPMessage.get_all)
            dup_msg = Message()
            dup_msg['X-Forwarded-For'] = '1.2.3.4'
            dup_msg['X-Forwarded-For'] = '198.51.100.88, 10.0.0.2'
            lan_dup = _make_dummy_handler('192.168.1.50', dup_msg)
            assert lan_dup._client_ip() == '198.51.100.88', (
                f'X-Forwarded-For duplicado debio resolver 198.51.100.88, dio {lan_dup._client_ip()}'
            )

            # En FLY_APP_NAME sin TRUST_PROXY explicito: ignora CF-Connecting-IP sin CF-Ray y prioriza Fly-Client-IP
            os.environ.pop('TRUST_PROXY', None)
            os.environ['FLY_APP_NAME'] = 'salelisto-prod'
            fly_req = _make_dummy_handler(
                '172.19.0.1',
                {'CF-Connecting-IP': '1.1.1.1', 'Fly-Client-IP': '181.45.99.1', 'X-Forwarded-For': '1.2.3.4, 181.45.99.1'},
            )
            assert fly_req._client_ip() == '181.45.99.1', 'En Fly debe priorizar Fly-Client-IP sobre CF-Connecting-IP falsificado'

            fly_no_hdr = _make_dummy_handler(
                '172.19.0.1',
                {'CF-Connecting-IP': '1.1.1.1', 'X-Forwarded-For': '1.2.3.4, 181.45.99.2, 172.19.0.2'},
            )
            assert fly_no_hdr._client_ip() == '181.45.99.2', 'Sin CF-Ray ni TRUST_PROXY no debe aceptar CF-Connecting-IP en Fly'

            fly_cf_ray = _make_dummy_handler(
                '172.19.0.1',
                {'CF-Ray': 'abc123-EZE', 'CF-Connecting-IP': '181.45.99.3', 'X-Forwarded-For': '1.2.3.4, 181.45.99.3'},
            )
            assert fly_cf_ray._client_ip() == '181.45.99.3', 'Con CF-Ray presente debe aceptar CF-Connecting-IP'

            # En cloud (RENDER=true), un peer con IP publica global directa NO es proxy confiable
            os.environ.pop('FLY_APP_NAME', None)
            os.environ['RENDER'] = 'true'
            direct_pub_peer = _make_dummy_handler(
                '203.0.113.55',
                {'X-Forwarded-For': '198.51.100.1', 'CF-Connecting-IP': '198.51.100.2'},
            )
            assert direct_pub_peer._client_ip() == '203.0.113.55', (
                'Un peer con IP publica directa en entorno cloud no debe poder falsificar XFF/CF-Connecting-IP'
            )
        finally:
            for k, v in saved_env.items():
                os.environ.pop(k, None)
                if v is not None:
                    os.environ[k] = v

        # Verificar por HTTP real que cabeceras X-Forwarded-For duplicadas no evaden el rate-limit
        server.auth_failures.clear()
        for idx in range(server.AUTH_MAX_FAILURES):
            c_xff = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
            try:
                payload_bad = json.dumps({'pin': '0000'}).encode('utf-8')
                c_xff.putrequest('POST', '/api/auth/admin')
                c_xff.putheader('Content-Type', 'application/json')
                c_xff.putheader('Content-Length', str(len(payload_bad)))
                # Atacante rota la primera cabecera XFF en cada intento; la segunda es la del proxy
                c_xff.putheader('X-Forwarded-For', f'198.51.101.{idx + 1}')
                c_xff.putheader('X-Forwarded-For', '181.45.30.9, 10.0.0.5')
                c_xff.endheaders()
                c_xff.send(payload_bad)
                resp_xff = c_xff.getresponse()
                resp_xff.read()
                assert resp_xff.status == 401
            finally:
                c_xff.close()
        c_xff_blk = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
        try:
            payload_ok = json.dumps({'pin': '1234'}).encode('utf-8')
            c_xff_blk.putrequest('POST', '/api/auth/admin')
            c_xff_blk.putheader('Content-Type', 'application/json')
            c_xff_blk.putheader('Content-Length', str(len(payload_ok)))
            c_xff_blk.putheader('X-Forwarded-For', '198.51.101.250')
            c_xff_blk.putheader('X-Forwarded-For', '181.45.30.9, 10.0.0.5')
            c_xff_blk.endheaders()
            c_xff_blk.send(payload_ok)
            resp_blk = c_xff_blk.getresponse()
            resp_blk.read()
            assert resp_blk.status == 429, f'Rotar el primer XFF no debe evadir el rate-limit (dio {resp_blk.status})'
        finally:
            c_xff_blk.close()
        server.auth_failures.clear()

        # Desde loopback (como cloudflared local), dos clientes 4G distintos NO comparten rate-limit
        server.auth_failures.clear()
        for _ in range(server.AUTH_MAX_FAILURES):
            c_cf1, _, _ = api.request(
                'POST',
                '/api/auth/admin',
                body={'pin': '0000'},
                headers={'CF-Connecting-IP': '181.45.10.1'},
            )
            assert c_cf1 == 401
        c_cf1_blk, _, _ = api.request(
            'POST',
            '/api/auth/admin',
            body={'pin': '1234'},
            headers={'CF-Connecting-IP': '181.45.10.1'},
        )
        assert c_cf1_blk == 429, 'La IP 4G abusiva debio recibir 429'
        c_cf2_ok, _, _ = api.request(
            'POST',
            '/api/auth/admin',
            body={'pin': '1234'},
            headers={'CF-Connecting-IP': '181.45.10.2'},
        )
        assert c_cf2_ok == 200, 'Otra IP 4G detras de cloudflared no debe quedar bloqueada por 127.0.0.1'
        server.auth_failures.clear()

        # Misma verificacion de aislamiento por IP 4G en POST /api/leads
        server.leads_rate.clear()
        for idx in range(server.LEAD_MAX_PER_WINDOW):
            c_ld1, _, _ = api.request(
                'POST',
                '/api/leads',
                body={'name': f'Lead A {idx}', 'contact': 'ventas@salelisto.com'},
                headers={'CF-Connecting-IP': '181.45.20.1'},
            )
            assert c_ld1 == 200
        c_ld1_blk, _, _ = api.request(
            'POST',
            '/api/leads',
            body={'name': 'Lead A extra', 'contact': 'ventas@salelisto.com'},
            headers={'CF-Connecting-IP': '181.45.20.1'},
        )
        assert c_ld1_blk == 429
        c_ld2_ok, _, _ = api.request(
            'POST',
            '/api/leads',
            body={'name': 'Lead B', 'contact': 'ventas@salelisto.com'},
            headers={'CF-Connecting-IP': '181.45.20.2'},
        )
        assert c_ld2_ok == 200, 'Lead desde otra IP 4G no debe quedar limitado por la primera IP'
        server.leads_rate.clear()

        # 8d. Idempotencia de pedidos ante microcortes 4G (clientRequestId en POST /api/orders)
        ver_before_idem = server.db.version
        c_o1, _, raw_o1 = api.request(
            'POST',
            '/api/orders',
            body={
                'qrToken': mesa_1['qrToken'],
                'clientRequestId': 'ord-4g-microcut-001',
                'items': [
                    {'itemId': ramen['id'], 'qty': 1, 'note': 'Sin verdeo'},
                    {'itemId': gin['id'], 'qty': 2, 'note': 'Poco hielo'},
                ],
            },
        )
        assert c_o1 == 200
        o1 = json.loads(raw_o1.decode('utf-8'))
        assert o1['ok'] is True and o1['deduplicated'] is False and len(o1['orderIds']) == 2
        ver_after_o1 = server.db.version
        assert ver_after_o1 == ver_before_idem + 1

        # Simular reintento tras microcorte 4G con el mismo clientRequestId (incluso si un plato se agota en el medio!)
        api.action('item.toggle', {'itemId': ramen['id'], 'available': False}, token=admin_token)
        ver_before_retry = server.db.version
        c_o2, _, raw_o2 = api.request(
            'POST',
            '/api/orders',
            body={
                'qrToken': mesa_1['qrToken'],
                'clientRequestId': 'ord-4g-microcut-001',
                'items': [
                    {'itemId': ramen['id'], 'qty': 1, 'note': 'Sin verdeo'},
                    {'itemId': gin['id'], 'qty': 2, 'note': 'Poco hielo'},
                ],
            },
        )
        assert c_o2 == 200
        o2 = json.loads(raw_o2.decode('utf-8'))
        assert o2['ok'] is True and o2['deduplicated'] is True, 'Reintento con mismo clientRequestId debe deduplicarse'
        assert o2['orderIds'] == o1['orderIds'] and o2['batchId'] == o1['batchId'], 'Debe devolver exactamente las mismas comandas'
        assert server.db.version == ver_before_retry, 'Reintento deduplicado no debe mutar state_ver'
        _, st_idem = api.get_json('/api/staff-state', token=admin_token)
        assert len(st_idem['orders']) == 2, f'No debio duplicar comandas en Cocina/Barra, hay {len(st_idem["orders"])}'
        api.action('item.toggle', {'itemId': ramen['id'], 'available': True}, token=admin_token)

        # Un clientRequestId distinto (o por cabecera Idempotency-Key) si crea nueva comanda
        c_o3, _, raw_o3 = api.request(
            'POST',
            '/api/orders',
            body={'qrToken': mesa_1['qrToken'], 'items': [{'itemId': gyozas['id'], 'qty': 1}]},
            headers={'Idempotency-Key': 'ord-4g-hdr-002'},
        )
        assert c_o3 == 200
        o3 = json.loads(raw_o3.decode('utf-8'))
        assert o3['deduplicated'] is False and o3['orderIds'] != o1['orderIds']
        c_o3_dup, _, raw_o3_dup = api.request(
            'POST',
            '/api/orders',
            body={'qrToken': mesa_1['qrToken'], 'items': [{'itemId': gyozas['id'], 'qty': 1}]},
            headers={'Idempotency-Key': 'ord-4g-hdr-002'},
        )
        assert c_o3_dup == 200 and json.loads(raw_o3_dup.decode('utf-8'))['deduplicated'] is True

        # Aislamiento por mesa: dos mesas distintas con el mismo clientRequestId crean pedidos independientes
        c_m2_same, _, raw_m2_same = api.request(
            'POST',
            '/api/orders',
            body={
                'qrToken': mesa_2['qrToken'],
                'clientRequestId': 'ord-4g-microcut-001',
                'items': [{'itemId': gyozas['id'], 'qty': 1}],
            },
        )
        assert c_m2_same == 200
        o_m2 = json.loads(raw_m2_same.decode('utf-8'))
        assert o_m2['deduplicated'] is False, 'clientRequestId de Mesa 1 no debe colisionar con Mesa 2'
        assert set(o_m2['orderIds']).isdisjoint(set(o1['orderIds'])), 'Mesa 2 recibio orderIds de Mesa 1'

        # Reutilizacion de clientRequestId tras cerrar la mesa debe crear un pedido nuevo en la nueva sesion
        for oid in o1['orderIds'] + o3['orderIds']:
            api.action('order.status', {'id': oid, 'status': 'entregado'}, token=admin_token)
        c_close_m1, _ = api.action('table.close', {'tableId': mesa_1['id'], 'payment': 'Tarjeta', 'tip': 0}, token=admin_token)
        assert c_close_m1 == 200
        c_m1_reopen, _, raw_m1_reopen = api.request(
            'POST',
            '/api/orders',
            body={
                'qrToken': mesa_1['qrToken'],
                'clientRequestId': 'ord-4g-microcut-001',
                'items': [{'itemId': gyozas['id'], 'qty': 1}],
            },
        )
        assert c_m1_reopen == 200
        o_m1_new = json.loads(raw_m1_reopen.decode('utf-8'))
        assert o_m1_new['deduplicated'] is False, 'Tras cerrar mesa, reutilizar clientRequestId debe crear pedido nuevo'
        assert set(o_m1_new['orderIds']).isdisjoint(set(o1['orderIds']))

        # 8e. Endpoints /api/tunnel/* + RBAC estricto + tunel simulado + precedencia estricta de _effective_base_url()
        c_dm8, dm8_auth = api.post_json('/api/auth/admin', {'demo': True})
        assert c_dm8 == 200 and dm8_auth.get('role') == 'demo_admin'
        demo_admin_tok8 = dm8_auth['token']
        waiter_tok8 = w2_login['token']

        c_tun_anon, _ = api.get_json('/api/tunnel/status')
        assert c_tun_anon == 401, 'GET /api/tunnel/status anonimo debio dar 401'
        c_tun_kit, _ = api.get_json('/api/tunnel/status', token=kitchen_token)
        assert c_tun_kit == 403, 'GET /api/tunnel/status como kitchen debio dar 403'
        c_tun_wait, _ = api.get_json('/api/tunnel/status', token=waiter_tok8)
        assert c_tun_wait == 403, 'GET /api/tunnel/status como waiter debio dar 403'

        c_tun_dm_st, r_tun_dm_st = api.get_json('/api/tunnel/status', token=demo_admin_tok8)
        assert c_tun_dm_st == 200 and r_tun_dm_st['network']['canManageTunnel'] is False
        assert 'pid' not in r_tun_dm_st['tunnel'] and 'lastError' not in r_tun_dm_st['tunnel'], (
            'demo_admin no debe recibir detalles internos (pid/lastError) del tunel'
        )
        _, qrs_dm8 = api.get_json('/api/qrs', token=demo_admin_tok8)
        assert qrs_dm8['canManageTunnel'] is False and qrs_dm8['canAutoInstallTunnel'] is False

        # Solo role == 'admin' puede iniciar o detener el tunel (403 para demo_admin, waiter y kitchen; 401 para anon)
        c_start_anon, _ = api.post_json('/api/tunnel/start', {'mode': 'quick'})
        c_stop_anon, _ = api.post_json('/api/tunnel/stop', {})
        assert c_start_anon == 401 and c_stop_anon == 401
        for bad_role_name, bad_tok in (('demo_admin', demo_admin_tok8), ('waiter', waiter_tok8), ('kitchen', kitchen_token)):
            c_st_bad, _ = api.post_json('/api/tunnel/start', {'mode': 'quick'}, token=bad_tok)
            c_sp_bad, _ = api.post_json('/api/tunnel/stop', {}, token=bad_tok)
            assert c_st_bad == 403, f'{bad_role_name} no debe poder iniciar tunel (dio {c_st_bad})'
            assert c_sp_bad == 403, f'{bad_role_name} no debe poder detener tunel (dio {c_sp_bad})'
        c_tun_dm_inst, _ = api.post_json('/api/tunnel/start', {'autoInstall': True}, token=demo_admin_tok8)
        assert c_tun_dm_inst == 403
        c_tun_dm_tok, _ = api.post_json('/api/tunnel/start', {'token': 'fake-token'}, token=demo_admin_tok8)
        assert c_tun_dm_tok == 403

        # Rechazo limpio de caracteres de control / bytes nulos en token de tunel
        c_ctrl_tok, _ = api.post_json('/api/tunnel/start', {'mode': 'token', 'token': 'tok\x00evil'}, token=admin_token)
        assert c_ctrl_tok == 400 and server.tunnel_manager.status()['state'] == 'stopped'

        orig_factory = server.tunnel_manager._process_factory
        old_pub_env = os.environ.pop('PUBLIC_URL', None)
        try:
            def _fake_factory(cmd, env=None):
                return _FakeCloudflaredProc(
                    [
                        'INF Thank you for trying Cloudflare Tunnel.',
                        'INF +----------------------------------------------------------------+',
                        'INF |  https://demo-bistro-4g.trycloudflare.com                      |',
                        'INF +----------------------------------------------------------------+',
                    ]
                )

            server.tunnel_manager._process_factory = _fake_factory

            c_tstart, r_tstart = api.post_json('/api/tunnel/start', {'mode': 'quick'}, token=admin_token)
            assert c_tstart == 200 and r_tstart['ok'] is True
            assert r_tstart['tunnel']['active'] is True
            assert r_tstart['tunnel']['publicUrl'] == 'https://demo-bistro-4g.trycloudflare.com'
            assert r_tstart['network']['isPublic4g'] is True
            assert r_tstart['network']['isTemporaryTunnel'] is True
            assert r_tstart['network']['urlSource'] == 'tunnel'

            # /api/qrs debe reflejar automaticamente la URL HTTPS corta del tunel activo
            _, qrs_tun = api.get_json('/api/qrs', token=admin_token)
            assert qrs_tun['baseUrl'] == 'https://demo-bistro-4g.trycloudflare.com'
            assert qrs_tun['isPublic4g'] is True and qrs_tun['isLocalOnly'] is False
            t1_tun = next(c for b in qrs_tun['blocks'] for c in b['tables'] if c['qrToken'] == mesa_1['qrToken'])
            assert t1_tun['url'] == f"https://demo-bistro-4g.trycloudflare.com/q/{mesa_1['qrToken']}"

            # SSE de staff debe exponer el snapshot network.baseUrl con el tunel activo
            sse_t_code, _, sse_t_state = read_first_sse_event(
                port,
                f'/api/events?scope=staff&token={admin_token}',
            )
            assert sse_t_code == 200 and sse_t_state is not None
            assert sse_t_state['network']['baseUrl'] == 'https://demo-bistro-4g.trycloudflare.com'
            assert sse_t_state['network']['isPublic4g'] is True

            # Precedencia 2: PUBLIC_URL supera al tunel rapido
            os.environ['PUBLIC_URL'] = 'https://menu-env.example.com'
            _, info_env = api.get_json('/api/info')
            assert info_env['baseUrl'] == 'https://menu-env.example.com'
            assert info_env['urlSource'] == 'env_public_url' and info_env['isPublic4g'] is True

            # Precedencia 1: restaurant.public_url supera a PUBLIC_URL y al tunel
            c_save_pub, _ = api.action(
                'restaurant.save',
                {'publicUrl': 'https://menu-fijo.example.com/'},
                token=admin_token,
            )
            assert c_save_pub == 200
            _, info_rest = api.get_json('/api/info')
            assert info_rest['baseUrl'] == 'https://menu-fijo.example.com'
            assert info_rest['urlSource'] == 'restaurant_public_url'

            # Limpiar restaurant.public_url y PUBLIC_URL -> vuelve al tunel activo
            api.action('restaurant.save', {'publicUrl': ''}, token=admin_token)
            os.environ.pop('PUBLIC_URL', None)
            _, info_back = api.get_json('/api/info')
            assert info_back['baseUrl'] == 'https://demo-bistro-4g.trycloudflare.com'
            assert info_back['urlSource'] == 'tunnel'

            # Detener tunel via POST /api/tunnel/stop
            c_tstop, r_tstop = api.post_json('/api/tunnel/stop', {}, token=admin_token)
            assert c_tstop == 200 and r_tstop['tunnel']['active'] is False
            assert r_tstop['network']['isPublic4g'] is False

            # Tunel permanente con token (TUNNEL_TOKEN pasado por entorno, nunca por argv)
            captured_cmd_env: dict[str, object] = {}

            def _fake_token_factory(cmd, env=None):
                captured_cmd_env['cmd'] = list(cmd)
                captured_cmd_env['token_env'] = (env or {}).get('TUNNEL_TOKEN')
                return _FakeCloudflaredProc(['INF Registered tunnel connection connIndex=0'])

            server.tunnel_manager._process_factory = _fake_token_factory
            c_ttok, r_ttok = api.post_json(
                '/api/tunnel/start',
                {'mode': 'token', 'token': 'cf-secret-token-e2e'},
                token=admin_token,
            )
            assert c_ttok == 200 and r_ttok['tunnel']['active'] is True and r_ttok['tunnel']['mode'] == 'token'
            assert 'cf-secret-token-e2e' not in ' '.join(captured_cmd_env['cmd']), 'El token no debe ir en argv'
            assert captured_cmd_env['token_env'] == 'cf-secret-token-e2e'
            api.post_json('/api/tunnel/stop', {}, token=admin_token)

            # Parseo de flags CLI (--tunnel, --port, puerto posicional)
            cli_pos = server.parse_cli_flags(['server.py', '9100', '--tunnel'])
            assert cli_pos['port'] == 9100 and cli_pos['tunnel'] is True
            cli_flag = server.parse_cli_flags(['server.py', '--port', '9200', '--auto-install-tunnel'])
            assert cli_flag['port'] == 9200 and cli_flag['tunnel'] is True and cli_flag['auto_install'] is True

            # Precedencia 4: X-Forwarded-Proto/Host solo con proxy confiable (loopback), ignorado en LAN directa
            c_fwd, _, raw_fwd = api.request(
                'GET',
                '/api/info',
                headers={'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'bistro-proxy.example.com'},
            )
            assert c_fwd == 200
            info_fwd = json.loads(raw_fwd.decode('utf-8'))
            assert info_fwd['baseUrl'] == 'https://bistro-proxy.example.com'
            assert info_fwd['urlSource'] == 'forwarded_proxy' and info_fwd['isPublic4g'] is True

            untrusted_base, untrusted_src = server.resolve_base_url_info(
                headers={'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'evil.example.com', 'Host': '127.0.0.1:8123'},
                trusted_proxy=False,
                port=port,
            )
            assert 'evil.example.com' not in untrusted_base and untrusted_src == 'lan'
        finally:
            server.tunnel_manager.stop()
            server.tunnel_manager._process_factory = orig_factory
            os.environ.pop('PUBLIC_URL', None)
            if old_pub_env is not None:
                os.environ['PUBLIC_URL'] = old_pub_env

        print('OK [8/8] 4G/5G: /q/<token>, Gzip, _client_ip(), idempotencia /api/orders, precedencia y /api/tunnel/* verificados.')

    finally:
        httpd.shutdown()
        httpd.server_close()
        _TMP_CTX.cleanup()

    # Confirmar que app/data/ no fue tocado por la suite
    if not REAL_DB_EXISTED_BEFORE:
        assert not (DATA_DIR_REAL / 'salelisto.db').exists(), 'La suite creo salelisto.db en app/data/'
    if not REAL_VAPID_EXISTED_BEFORE:
        assert not (DATA_DIR_REAL / 'vapid_keys.json').exists(), 'La suite creo vapid_keys.json en app/data/'
    if not REAL_SECRET_EXISTED_BEFORE:
        assert not (DATA_DIR_REAL / 'server_secret.key').exists(), 'La suite creo server_secret.key en app/data/'

    print('\nRESULTADO FINAL: 100% TESTS E2E APROBADOS.')


if __name__ == '__main__':
    run_suite()
