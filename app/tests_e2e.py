"""Suite permanente de pruebas E2E de SaleListo (100% biblioteca estandar de Python).

Ejecucion:
    python app/tests_e2e.py

Levanta el servidor real en un puerto efimero (0) apuntando DATA_DIR a un
directorio temporal aislado (nunca lee ni modifica app/data/) y verifica:
  1. Criptografia Web Push RFC 8291 / VAPID RFC 8292 (webpush.self_test + endpoint VAPID).
  2. Escaneo QR valido vs bloqueo de tokens falsos, modo produccion y anti-spoofing de precios.
  3. Separacion automatica de pedidos mixtos en 2 comandas simultaneas (Cocina + Barra).
  4. Balanceo de carga entre mozos y reasignacion automatica al pausar un mozo en turno.
  5. Calculo exacto de cuenta + propina, proteccion de cierre, KPIs y exportacion CSV con BOM UTF-8.
  6. Alta publica, validacion, permisos, cambio de estado y antispam de POST /api/leads.
  7. Streaming HTTP 206 Partial Content, ETag/304, sufijos y seguridad de /media/hero-salon-loop.mp4.
"""
from __future__ import annotations

import atexit
import csv
import io
import json
import os
import shutil
import sys
import tempfile
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

sys.dont_write_bytecode = True

APP_DIR = Path(__file__).resolve().parent
DATA_DIR_REAL = APP_DIR / 'data'
REAL_DB_EXISTED_BEFORE = (DATA_DIR_REAL / 'salelisto.db').exists()
REAL_VAPID_EXISTED_BEFORE = (DATA_DIR_REAL / 'vapid_keys.json').exists()


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

import server  # noqa: E402
import webpush  # noqa: E402


class QuietHandler(server.Handler):
    """Silencia logs HTTP esperados durante las pruebas negativas (400/401/404/416/429)."""

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


def run_suite() -> None:
    print('=== SaleListo · Suite E2E Permanente ===\n')

    # 1. Auto-test criptografico NIST + P-256 + VAPID + RFC 8291
    webpush.self_test()

    httpd = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
    httpd.daemon_threads = True
    port = httpd.server_address[1]
    srv_thread = threading.Thread(target=httpd.serve_forever, name='salelisto-e2e-http', daemon=True)
    srv_thread.start()

    api = ApiClient(f'http://127.0.0.1:{port}')

    try:
        # Verificar clave publica VAPID expuesta por HTTP
        code, vapid_res = api.get_json('/api/push/vapid-public-key')
        assert code == 200 and vapid_res.get('ok') is True, 'Fallo GET /api/push/vapid-public-key'
        pub_key = vapid_res['publicKey']
        assert len(pub_key) == 87 and pub_key.startswith('B'), f'Clave VAPID invalida: {pub_key}'
        pub_point = webpush.decode_p256_public(webpush.b64url_decode(pub_key))
        assert webpush.point_is_on_curve(pub_point), 'Clave VAPID publica no pertenece a NIST P-256'
        print('OK [1/7] Web Push RFC 8291/8292 y endpoint VAPID verificados.')

        # Autenticar sesion de encargado (PIN inicial 1234)
        code, auth_res = api.post_json('/api/auth/admin', {'pin': '1234'})
        assert code == 200 and auth_res.get('ok') is True, 'Fallo login admin con PIN inicial'
        admin_token = auth_res['token']

        code, staff = api.get_json('/api/staff-state', token=admin_token)
        assert code == 200 and len(staff['tables']) >= 10, 'Estado inicial de staff incompleto'
        tables_by_code = {t['code']: t for t in staff['tables']}
        items_by_name = {i['name']: i for i in staff['items']}

        # 2. Escaneo QR valido vs tokens falsos y anti-spoofing de precios
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

        # En modo produccion (demoMode=False), ?mesa=1 sin qrToken no permite entrar
        code, _ = api.action('restaurant.save', {'demoMode': False}, token=admin_token)
        assert code == 200
        code, cs_legacy_blocked = api.get_json('/api/client-state?mesa=1')
        assert cs_legacy_blocked['validTable'] is False, 'Acceso sin token ?mesa=1 debe bloquearse cuando demoMode=False'
        code, cs_qr_prod = api.get_json(f"/api/client-state?t={mesa_1['qrToken']}")
        assert cs_qr_prod['validTable'] is True, 'Token QR real debe seguir funcionando en modo produccion'
        api.action('restaurant.save', {'demoMode': True}, token=admin_token)
        api.action('data.clear_orders', {}, token=admin_token)
        print('OK [2/7] Seguridad QR, modo produccion y bloqueo anti-spoofing de precios verificados.')

        # 3. Separacion automatica de pedido mixto en Cocina + Barra
        mesa_t1 = tables_by_code['T1']
        gyozas = items_by_name['Gyozas de cerdo']
        gin = items_by_name['Gin Tonic de Yuzu']

        code, mix_res = api.action(
            'order.create',
            {
                'qrToken': mesa_t1['qrToken'],
                'items': [
                    {'itemId': ramen['id'], 'qty': 2, 'note': 'Sin verdeo'},
                    {'itemId': gyozas['id'], 'qty': 1, 'note': ''},
                    {'itemId': gin['id'], 'qty': 2, 'note': 'Poco hielo'},
                ],
            },
        )
        assert code == 200 and mix_res['ok'] is True, 'Fallo creacion de pedido mixto'
        order_ids = mix_res['result']['orderIds']
        assert len(order_ids) == 2, f'El pedido mixto debia separarse en 2 comandas, genero {len(order_ids)}'
        assert set(mix_res['result']['stations']) == {'Barra', 'Cocina'}
        assert mix_res['result']['waiterName'] == 'Sofía', 'Terraza debia asignarse a Sofia por bloque pre-asignado'

        _, st_after_mix = api.get_json('/api/staff-state', token=admin_token)
        t1_orders = [o for o in st_after_mix['orders'] if o['id'] in order_ids]
        assert len({o['batchId'] for o in t1_orders}) == 1, 'Ambas comandas deben compartir batchId'
        by_st = {o['station']: o for o in t1_orders}
        expected_kitchen = ramen['price'] * 2 + gyozas['price']
        expected_bar = gin['price'] * 2
        assert by_st['cocina']['total'] == expected_kitchen, 'Subtotal de comanda Cocina incorrecto'
        assert by_st['barra']['total'] == expected_bar, 'Subtotal de comanda Barra incorrecto'
        assert by_st['barra']['items'][0]['note'] == 'Poco hielo', 'Se perdio la nota del item de Barra'
        print('OK [3/7] Ruteo simultaneo y separado Cocina + Barra verificado.')

        # 4. Balanceo de carga de mozos y reasignacion automatica al pausar un mozo
        mesa_2 = tables_by_code['2']
        mesa_b1 = tables_by_code['B1']
        api.action('order.create', {'qrToken': mesa_1['qrToken'], 'items': [{'itemId': gyozas['id'], 'qty': 1}]})
        api.action('order.create', {'qrToken': mesa_2['qrToken'], 'items': [{'itemId': gyozas['id'], 'qty': 1}]})
        api.action('order.create', {'qrToken': mesa_b1['qrToken'], 'items': [{'itemId': gin['id'], 'qty': 1}]})

        _, st_load = api.get_json('/api/staff-state', token=admin_token)
        open_tbls = {t['code']: t for t in st_load['tables'] if t['sessionId']}
        interior_waiters = {open_tbls['1']['waiterId'], open_tbls['2']['waiterId']}
        assert interior_waiters == {'w1', 'w2'}, f'Balanceo en Interior esperaba w1 y w2, dio {interior_waiters}'
        assert open_tbls['B1']['waiterId'] in {'w1', 'w2', 'w3'}, 'Barra en modo auto no asigno mozo'

        # Llamado pendiente en T1 (atendida por w3 Sofia) antes de pausarla
        api.action('call.create', {'qrToken': mesa_t1['qrToken'], 'type': 'mozo', 'reason': 'Servilletas'})
        code, toggle_res = api.action('waiter.toggle', {'id': 'w3', 'available': False}, token=admin_token)
        assert code == 200 and len(toggle_res['result']['reassigned']) >= 1, 'No reasigno las mesas abiertas de Sofia'

        st_reassigned = toggle_res['state']
        w3_still_open = [t for t in st_reassigned['tables'] if t['sessionId'] and t['waiterId'] == 'w3']
        assert not w3_still_open, 'Quedaron sesiones abiertas asignadas a un mozo fuera de turno'
        t1_now = next(t for t in st_reassigned['tables'] if t['code'] == 'T1')
        assert t1_now['waiterId'] in {'w1', 'w2'}, 'T1 debio pasar automaticamente a un mozo activo'
        t1_call = next(c for c in st_reassigned['calls'] if c['tableCode'] == 'T1')
        assert t1_call['waiterId'] == t1_now['waiterId'], 'El llamado activo no acompano la reasignacion de mozo'

        # Reactivar a Sofia para el resto de pruebas
        api.action('waiter.toggle', {'id': 'w3', 'available': True}, token=admin_token)
        print('OK [4/7] Balanceo por carga y reasignacion automatica de mozos verificados.')

        # 5. Cuenta exacta + propina, proteccion de cierre y exportacion CSV con BOM UTF-8
        expected_sub = expected_kitchen + expected_bar  # 35.500 + 13.600 = 49.100
        expected_tip = round(expected_sub * 10 / 100)   # 4.910
        expected_total = expected_sub + expected_tip    # 54.010

        code, bill_res = api.action(
            'call.create',
            {'qrToken': mesa_t1['qrToken'], 'type': 'cuenta', 'payment': 'Tarjeta', 'tip': 10},
        )
        assert code == 200 and bill_res['ok'] is True
        _, st_bill = api.get_json('/api/staff-state', token=admin_token)
        bill_call = next(c for c in st_bill['calls'] if c['tableCode'] == 'T1' and c['type'] == 'cuenta')
        assert bill_call['subtotal'] == expected_sub, f"Subtotal cuenta {bill_call['subtotal']} != {expected_sub}"
        assert bill_call['tipAmount'] == expected_tip, f"Propina {bill_call['tipAmount']} != {expected_tip}"
        assert bill_call['total'] == expected_total, f"Total cuenta {bill_call['total']} != {expected_total}"

        # No debe dejar cerrar sin force mientras haya pedidos pendientes de entrega
        code, premature_close = api.action('table.close', {'tableId': mesa_t1['id']}, token=admin_token)
        assert code == 400 and premature_close.get('ok') is False, 'Debio proteger cierre con comandas sin entregar'

        # Avanzar las 2 comandas de T1 hasta entregado (verificando textos compactos de pulsera en listo)
        for oid in order_ids:
            api.action('order.advance', {'id': oid}, token=admin_token)  # nuevo -> cocina
            _, r_listo = api.action('order.advance', {'id': oid}, token=admin_token)  # cocina -> listo
            latest_notif = r_listo['state']['notifications'][0]
            assert len(latest_notif['shortTitle']) <= 26 and len(latest_notif['shortBody']) <= 48, (
                'Notificacion excede largo compacto de Xiaomi Smart Band'
            )
            api.action('order.advance', {'id': oid}, token=admin_token)  # listo -> entregado

        code, close_res = api.action(
            'table.close',
            {'tableId': mesa_t1['id'], 'payment': 'Tarjeta', 'tip': 10},
            token=admin_token,
        )
        assert code == 200 and close_res['result']['total'] == expected_total, 'Total cerrado incorrecto'
        kpis = close_res['state']['kpis']
        assert kpis['closedSalesToday'] == expected_sub
        assert kpis['closedTipsToday'] == expected_tip
        assert kpis['byPayment'].get('Tarjeta') == expected_total

        csv_code, csv_hdrs, csv_raw = api.request(
            'GET',
            '/api/export/sessions.csv',
            headers={'X-Auth-Token': admin_token},
        )
        assert csv_code == 200, f'GET /api/export/sessions.csv devolvio {csv_code}'
        assert csv_raw.startswith(b'\xef\xbb\xbf'), 'El CSV contable debe iniciar con UTF-8 BOM (EF BB BF)'
        assert 'attachment' in csv_hdrs.get('content-disposition', ''), 'Falta Content-Disposition attachment'
        csv_rows = list(csv.reader(io.StringIO(csv_raw.decode('utf-8-sig')), delimiter=';'))
        assert len(csv_rows) == 2, f'Esperaba cabecera + 1 sesion cerrada, obtuvo {len(csv_rows)} filas'
        row_t1 = csv_rows[1]
        assert row_t1[4] == 'T1' and row_t1[5] == 'Terraza' and row_t1[7] == 'Tarjeta'
        assert int(row_t1[8]) == expected_sub and int(row_t1[9]) == 10
        assert int(row_t1[10]) == expected_tip and int(row_t1[11]) == expected_total
        print('OK [5/7] Cuenta exacta, cierre protegido, KPIs y arqueo CSV con BOM UTF-8 verificados.')

        # 6. Leads comerciales: validacion, permisos en produccion, cambio de estado y antispam
        server.leads_rate.clear()
        code, _ = api.post_json('/api/leads', {'name': '', 'restaurantName': '', 'contact': 'ventas@salelisto.com'})
        assert code == 400, 'Lead sin nombre ni restaurante debe devolver 400'
        code, _ = api.post_json('/api/leads', {'name': 'Valeria', 'contact': '   '})
        assert code == 400, 'Lead sin contacto debe devolver 400'

        # Con demoMode desactivado: POST /api/leads sigue siendo publico, pero GET /api/leads exige token admin
        api.action('restaurant.save', {'demoMode': False}, token=admin_token)
        code, lead_created = api.post_json(
            '/api/leads',
            {
                'name': 'Martín Gómez',
                'restaurantName': 'Bistró del Parque',
                'zone': 'Palermo',
                'tablesCount': 24,
                'contact': 'ventas@salelisto.com',
                'planInterest': 'Salón / Bistró',
                'message': 'Queremos piloto de 14 días en terraza.',
            },
        )
        assert code == 200 and lead_created.get('ok') is True, 'Alta publica de lead fallo en modo produccion'
        lead_id = lead_created['lead']['id']
        assert lead_created['lead']['status'] == 'nuevo' and lead_created['lead']['tablesCount'] == '24'

        code_unauth_leads, _ = api.get_json('/api/leads')
        assert code_unauth_leads == 401, 'GET /api/leads sin token debe devolver 401 fuera de modo demo'
        code_unauth_csv, _, _ = api.request('GET', '/api/export/sessions.csv')
        assert code_unauth_csv == 401, 'CSV sin token debe devolver 401 fuera de modo demo'
        code_unauth_status, _ = api.action('lead.status', {'leadId': lead_id, 'status': 'piloto'})
        assert code_unauth_status == 400, 'lead.status sin token debe rechazarse fuera de modo demo'

        code_auth_leads, leads_list = api.get_json('/api/leads', token=admin_token)
        assert code_auth_leads == 200 and leads_list['leads'][0]['id'] == lead_id

        code, upd_lead = api.action('lead.status', {'leadId': lead_id, 'status': 'piloto'}, token=admin_token)
        assert code == 200 and upd_lead['state']['leads'][0]['status'] == 'piloto'
        code, _ = api.action('lead.status', {'leadId': lead_id, 'status': 'estado_inexistente'}, token=admin_token)
        assert code == 400

        # Antispam por IP: 1 ya enviado arriba; enviamos hasta superar LEAD_MAX_PER_WINDOW (6)
        statuses = []
        for idx in range(server.LEAD_MAX_PER_WINDOW + 1):
            st_code, _ = api.post_json(
                '/api/leads',
                {'name': f'Prospecto {idx}', 'contact': 'ventas@salelisto.com'},
            )
            statuses.append(st_code)
        assert 429 in statuses, f'El limitador antispam debia responder 429 tras {server.LEAD_MAX_PER_WINDOW} envios: {statuses}'
        api.action('restaurant.save', {'demoMode': True}, token=admin_token)
        print('OK [6/7] API de leads comerciales, permisos y antispam verificados.')

        # 7. Entrega multimedia HTTP 206 Partial Content (/media/hero-salon-loop.mp4) y vistas clave
        hero_file = APP_DIR / 'public' / 'media' / 'hero-salon-loop.mp4'
        assert hero_file.is_file(), f'No existe {hero_file}'
        total_size = hero_file.stat().st_size

        m_code, m_hdrs, m_chunk = api.request(
            'GET',
            '/media/hero-salon-loop.mp4',
            headers={'Range': 'bytes=0-1023'},
        )
        assert m_code == 206 and len(m_chunk) == 1024, f'Range 0-1023 esperaba 206 y 1024 B, dio {m_code} y {len(m_chunk)} B'
        assert m_hdrs.get('content-range') == f'bytes 0-1023/{total_size}'
        assert m_hdrs.get('accept-ranges') == 'bytes'
        assert m_hdrs.get('cache-control') == 'public, max-age=86400'
        etag = m_hdrs.get('etag', '')
        assert etag, 'Falta cabecera ETag en /media/'

        nm_code, _, nm_body = api.request(
            'GET',
            '/media/hero-salon-loop.mp4',
            headers={'If-None-Match': etag},
        )
        assert nm_code == 304 and len(nm_body) == 0, 'If-None-Match debio responder 304 Not Modified'

        suf_code, _, suf_chunk = api.request(
            'GET',
            '/media/hero-salon-loop.mp4',
            headers={'Range': 'bytes=-512'},
        )
        assert suf_code == 206 and len(suf_chunk) == 512, 'Range por sufijo fallo'

        oob_code, _, _ = api.request(
            'GET',
            '/media/hero-salon-loop.mp4',
            headers={'Range': f'bytes={total_size + 100}-{total_size + 200}'},
        )
        assert oob_code == 416, f'Range fuera de rango debio devolver 416, dio {oob_code}'

        trav_code, _, _ = api.request('GET', '/media/../server.py')
        assert trav_code == 404, 'Path traversal en /media/ debe bloquearse con 404'

        for route in ('/qr.html', '/demo.html', '/operacion.html', '/api/qrs'):
            r_code, _, _ = api.request('GET', route)
            assert r_code == 200, f'Ruta {route} devolvio {r_code}'
        print('OK [7/7] Streaming HTTP 206 de /media/hero-salon-loop.mp4 y vistas clave verificados.')

    finally:
        httpd.shutdown()
        httpd.server_close()
        _TMP_CTX.cleanup()

    # Confirmar que app/data/ no fue tocado por la suite
    if not REAL_DB_EXISTED_BEFORE:
        assert not (DATA_DIR_REAL / 'salelisto.db').exists(), 'La suite creo salelisto.db en app/data/'
    if not REAL_VAPID_EXISTED_BEFORE:
        assert not (DATA_DIR_REAL / 'vapid_keys.json').exists(), 'La suite creo vapid_keys.json en app/data/'

    print('\nRESULTADO FINAL: 100% TESTS E2E APROBADOS.')


if __name__ == '__main__':
    run_suite()
