"""Servidor de Pedio: sirve el front, guarda el estado y avisa cambios en tiempo real.

Solo usa la biblioteca estándar de Python. Uso:
    python server.py [puerto]
"""
import copy
import json
import os
import queue
import socket
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
DATA_FILE = ROOT / 'data' / 'state.json'
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123

SEED = {
    'restaurant': {'name': 'Kaiten Bar', 'tables': 12},
    'categories': [
        {'id': 'entradas', 'name': 'Entradas', 'icon': '🥟'},
        {'id': 'principales', 'name': 'Principales', 'icon': '🍜'},
        {'id': 'sushi', 'name': 'Sushi', 'icon': '🍣'},
        {'id': 'postres', 'name': 'Postres', 'icon': '🍡'},
        {'id': 'bebidas', 'name': 'Bebidas', 'icon': '🍵'},
    ],
    'items': [
        {'id': 'i1', 'cat': 'entradas', 'name': 'Gyozas de cerdo', 'desc': '6 unidades, salsa ponzu.', 'price': 6500, 'emoji': '🥟', 'available': True, 'popular': True},
        {'id': 'i2', 'cat': 'entradas', 'name': 'Edamame', 'desc': 'Con sal marina y limón.', 'price': 4200, 'emoji': '🫛', 'available': True},
        {'id': 'i3', 'cat': 'entradas', 'name': 'Karaage', 'desc': 'Pollo frito estilo japonés con mayo de yuzu.', 'price': 7800, 'emoji': '🍗', 'available': True},
        {'id': 'i4', 'cat': 'principales', 'name': 'Ramen Tonkotsu', 'desc': 'Caldo de cerdo 12 h, chashu, huevo marinado.', 'price': 14500, 'emoji': '🍜', 'available': True, 'popular': True},
        {'id': 'i5', 'cat': 'principales', 'name': 'Ramen Miso Veggie', 'desc': 'Caldo de miso, tofu, maíz y hongos.', 'price': 13200, 'emoji': '🥢', 'available': True},
        {'id': 'i6', 'cat': 'principales', 'name': 'Katsudon', 'desc': 'Milanesa de cerdo, huevo y cebolla sobre arroz.', 'price': 12800, 'emoji': '🍛', 'available': True},
        {'id': 'i7', 'cat': 'principales', 'name': 'Okonomiyaki', 'desc': 'Panqueque de repollo con salsa okonomi.', 'price': 11500, 'emoji': '🥞', 'available': False},
        {'id': 'i8', 'cat': 'sushi', 'name': 'Combinado 12 piezas', 'desc': 'Nigiris y rolls del día.', 'price': 18900, 'emoji': '🍣', 'available': True, 'popular': True},
        {'id': 'i9', 'cat': 'sushi', 'name': 'Roll Philadelphia', 'desc': '8 piezas de salmón y queso crema.', 'price': 10500, 'emoji': '🍙', 'available': True},
        {'id': 'i10', 'cat': 'sushi', 'name': 'Temaki de salmón', 'desc': 'Cono de alga con salmón y palta.', 'price': 7900, 'emoji': '🌯', 'available': True},
        {'id': 'i11', 'cat': 'postres', 'name': 'Mochi helado', 'desc': '3 unidades: matcha, sésamo, frutilla.', 'price': 5600, 'emoji': '🍡', 'available': True},
        {'id': 'i12', 'cat': 'postres', 'name': 'Cheesecake de matcha', 'desc': 'Porción individual.', 'price': 6200, 'emoji': '🍰', 'available': True},
        {'id': 'i13', 'cat': 'bebidas', 'name': 'Té verde', 'desc': 'Sencha caliente, libre.', 'price': 2500, 'emoji': '🍵', 'available': True},
        {'id': 'i14', 'cat': 'bebidas', 'name': 'Ramune', 'desc': 'Gaseosa japonesa, sabor original.', 'price': 3800, 'emoji': '🧃', 'available': True},
        {'id': 'i15', 'cat': 'bebidas', 'name': 'Cerveza Asahi', 'desc': 'Lata 500 ml.', 'price': 5200, 'emoji': '🍺', 'available': True},
    ],
    'orders': [],        # {id, table, items:[{itemId,name,emoji,price,qty,note}], status, createdAt, updatedAt}
    'calls': [],         # {id, table, type:'mozo'|'cuenta', reason|payment+tip+total, status, createdAt}
    'closedTables': {},  # "mesa" -> timestamp del último cierre
    'seqs': {},
}

ORDER_FLOW = ['nuevo', 'cocina', 'listo', 'entregado']
PAYMENTS = {'Efectivo', 'Tarjeta', 'QR'}
TIPS = {0, 10, 15}


class ActionError(Exception):
    pass


def now_ms():
    return int(time.time() * 1000)


# ---------- Estado ----------
lock = threading.Lock()


def load_state():
    try:
        return json.loads(DATA_FILE.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return copy.deepcopy(SEED)


def save_state(s):
    DATA_FILE.parent.mkdir(exist_ok=True)
    tmp = DATA_FILE.with_suffix('.tmp')
    tmp.write_text(json.dumps(s, ensure_ascii=False), encoding='utf-8')
    os.replace(tmp, DATA_FILE)


state = load_state()


def next_id(s, prefix):
    s['seqs'][prefix] = s['seqs'].get(prefix, 0) + 1
    return f"{prefix}{s['seqs'][prefix]}"


def table_since(s, table):
    return s['closedTables'].get(str(table), 0)


def table_orders(s, table):
    since = table_since(s, table)
    return [o for o in s['orders'] if o['table'] == table and o['createdAt'] > since]


def find(lst, id_, what):
    for x in lst:
        if x['id'] == id_:
            return x
    raise ActionError(f'{what} inexistente')


def valid_table(s, p):
    try:
        t = int(p.get('table'))
    except (TypeError, ValueError):
        raise ActionError('Mesa inválida')
    if not 1 <= t <= s['restaurant']['tables']:
        raise ActionError('Mesa inválida')
    return t


def text(p, key, maxlen):
    return str(p.get(key) or '').strip()[:maxlen]


# ---------- Acciones ----------
# Cada acción valida su entrada, modifica el estado y devuelve un resultado opcional.
# Los precios y totales se calculan acá: nunca se confía en lo que manda el celular.

def a_order_create(s, p):
    table = valid_table(s, p)
    lines = []
    for line in p.get('items') or []:
        item = find(s['items'], line.get('itemId'), 'Plato')
        if not item['available']:
            raise ActionError(f"{item['name']} está agotado")
        qty = int(line.get('qty') or 0)
        if not 1 <= qty <= 20:
            raise ActionError('Cantidad inválida')
        lines.append({'itemId': item['id'], 'name': item['name'], 'emoji': item['emoji'],
                      'price': item['price'], 'qty': qty, 'note': text(line, 'note', 80)})
    if not lines:
        raise ActionError('El pedido está vacío')
    ts = now_ms()
    order = {'id': next_id(s, 'P'), 'table': table, 'items': lines, 'status': 'nuevo',
             'createdAt': ts, 'updatedAt': ts}
    s['orders'].append(order)
    return {'id': order['id']}


def a_order_advance(s, p):
    order = find(s['orders'], p.get('id'), 'Pedido')
    i = ORDER_FLOW.index(order['status'])
    if i < len(ORDER_FLOW) - 1:
        order['status'] = ORDER_FLOW[i + 1]
        order['updatedAt'] = now_ms()


def a_call_create(s, p):
    table = valid_table(s, p)
    kind = p.get('type')
    for c in s['calls']:  # no duplicar llamadas pendientes
        if c['table'] == table and c['type'] == kind and c['status'] == 'pendiente':
            return {'id': c['id']}
    call = {'id': next_id(s, 'L'), 'table': table, 'type': kind, 'status': 'pendiente', 'createdAt': now_ms()}
    if kind == 'mozo':
        call['reason'] = text(p, 'reason', 30) or 'Consulta'
    elif kind == 'cuenta':
        orders = table_orders(s, table)
        if not orders:
            raise ActionError('No hay consumos en esta mesa')
        payment = p.get('payment')
        tip = int(p.get('tip') or 0)
        if payment not in PAYMENTS or tip not in TIPS:
            raise ActionError('Datos de pago inválidos')
        subtotal = sum(i['price'] * i['qty'] for o in orders for i in o['items'])
        call.update(payment=payment, tip=tip, total=round(subtotal * (1 + tip / 100)))
    else:
        raise ActionError('Tipo de llamada inválido')
    s['calls'].append(call)
    return {'id': call['id']}


def a_call_attend(s, p):
    find(s['calls'], p.get('id'), 'Solicitud')['status'] = 'atendida'


def a_table_close(s, p):
    table = valid_table(s, p)
    s['closedTables'][str(table)] = now_ms()
    for c in s['calls']:
        if c['table'] == table and c['status'] == 'pendiente':
            c['status'] = 'atendida'
    for o in s['orders']:
        if o['table'] == table:
            o['status'] = 'entregado'


def a_item_save(s, p):
    name = text(p, 'name', 40)
    if not name:
        raise ActionError('El plato necesita un nombre')
    try:
        price = max(0, int(float(p.get('price'))))
    except (TypeError, ValueError):
        raise ActionError('Precio inválido')
    cat = p.get('cat')
    if not any(c['id'] == cat for c in s['categories']):
        raise ActionError('Categoría inválida')
    data = {'name': name, 'desc': text(p, 'desc', 90), 'price': price, 'cat': cat,
            'emoji': text(p, 'emoji', 8) or '🍽️', 'popular': bool(p.get('popular')),
            'available': bool(p.get('available'))}
    if p.get('id'):
        find(s['items'], p['id'], 'Plato').update(data)
        return {'id': p['id']}
    item = {'id': next_id(s, 'n'), **data}
    s['items'].append(item)
    return {'id': item['id']}


def a_item_toggle(s, p):
    find(s['items'], p.get('id'), 'Plato')['available'] = bool(p.get('available'))


def a_item_delete(s, p):
    item = find(s['items'], p.get('id'), 'Plato')
    s['items'].remove(item)


def a_reset(s, p):
    s.clear()
    s.update(copy.deepcopy(SEED))


ACTIONS = {
    'order.create': a_order_create,
    'order.advance': a_order_advance,
    'call.create': a_call_create,
    'call.attend': a_call_attend,
    'table.close': a_table_close,
    'item.save': a_item_save,
    'item.toggle': a_item_toggle,
    'item.delete': a_item_delete,
    'reset': a_reset,
}


def apply_action(kind, payload):
    fn = ACTIONS.get(kind)
    if not fn:
        raise ActionError('Acción desconocida')
    with lock:
        draft = copy.deepcopy(state)  # si la acción falla, el estado no queda a medias
        result = fn(draft, payload or {})
        state.clear()
        state.update(draft)
        save_state(state)
        snapshot = json.dumps(state, ensure_ascii=False)
    broadcast(snapshot)
    return result, snapshot


# ---------- Tiempo real (Server-Sent Events) ----------
subscribers = set()
subs_lock = threading.Lock()


def broadcast(snapshot):
    with subs_lock:
        for q in subscribers:
            q.put(snapshot)


def lan_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sk:
            sk.connect(('10.255.255.255', 1))  # no envía nada, solo elige la interfaz
            return sk.getsockname()[0]
    except OSError:
        return '127.0.0.1'


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        if '/api/' in self.path and 'events' not in self.path:
            sys.stderr.write(f"{self.command} {self.path} {args[1] if len(args) > 1 else ''}\n")

    def send_json(self, code, body):
        raw = body.encode('utf-8') if isinstance(body, str) else json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/api/state':
            with lock:
                return self.send_json(200, json.dumps(state, ensure_ascii=False))
        if path == '/api/info':
            return self.send_json(200, {'baseUrl': f'http://{lan_ip()}:{PORT}'})
        if path == '/api/events':
            return self.stream_events()
        return super().do_GET()

    def do_POST(self):
        if self.path != '/api/action':
            return self.send_json(404, {'error': 'No encontrado'})
        try:
            length = int(self.headers.get('Content-Length') or 0)
            if length > 64_000:
                raise ActionError('Pedido demasiado grande')
            body = json.loads(self.rfile.read(length) or b'{}')
            result, snapshot = apply_action(body.get('type'), body.get('payload'))
            self.send_json(200, f'{{"ok":true,"result":{json.dumps(result)},"state":{snapshot}}}')
        except ActionError as e:
            self.send_json(400, {'ok': False, 'error': str(e)})
        except (ValueError, TypeError) as e:
            self.send_json(400, {'ok': False, 'error': f'Datos inválidos: {e}'})

    def stream_events(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Connection', 'keep-alive')
        self.end_headers()
        q = queue.Queue()
        with lock:
            q.put(json.dumps(state, ensure_ascii=False))
        with subs_lock:
            subscribers.add(q)
        try:
            while True:
                try:
                    msg = q.get(timeout=15)
                    self.wfile.write(f'data: {msg}\n\n'.encode('utf-8'))
                except queue.Empty:
                    self.wfile.write(b': ping\n\n')  # mantiene viva la conexión
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass
        finally:
            with subs_lock:
                subscribers.discard(q)


def main():
    # La consola de Windows puede no soportar algunos caracteres: mejor reemplazarlos que fallar.
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(errors='replace', line_buffering=True)
    server =ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    server.daemon_threads = True
    base = f'http://{lan_ip()}:{PORT}'
    print('\n  注 Pedio está corriendo\n')
    print(f'  Panel del restaurante:  {base}/restaurante.html')
    print(f'  Demo lado a lado:       {base}/demo.html')
    print(f'  QR para las mesas:      {base}/qr.html')
    print(f'  Celular (mesa 4):       {base}/cliente.html?mesa=4')
    print('\n  Los celulares tienen que estar en la misma red Wi-Fi. Ctrl+C para detener.\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  Servidor detenido.')


if __name__ == '__main__':
    main()
