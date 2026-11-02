// Conexión con el servidor de Pedio.
// El servidor es la fuente de verdad: los cambios se mandan como acciones y
// el estado actualizado llega a todos los dispositivos por Server-Sent Events.
const ORDER_STATUSES = [
  { id: 'nuevo', label: 'Recibido' },
  { id: 'cocina', label: 'En preparación' },
  { id: 'listo', label: 'Listo para servir' },
  { id: 'entregado', label: 'Entregado' },
];

let currentState = null;
const listeners = new Set();

function load() {
  return currentState;
}

function setState(s) {
  currentState = s;
  listeners.forEach((fn) => fn(s));
}

function subscribe(fn) {
  listeners.add(fn);
}

// Resuelve con el primer estado recibido; después sigue escuchando cambios.
function connect(onConnection) {
  return new Promise((resolve) => {
    let first = true;
    const es = new EventSource('api/events');
    es.onmessage = (e) => {
      const s = JSON.parse(e.data);
      onConnection?.(true);
      if (first) { first = false; currentState = s; resolve(s); }
      else setState(s);
    };
    es.onerror = () => onConnection?.(false); // EventSource reintenta solo
  });
}

// Envía una acción al servidor. Devuelve { result, state } o lanza un Error con el mensaje.
async function dispatch(type, payload = {}) {
  let res;
  try {
    res = await fetch('api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
  } catch (e) {
    throw new Error('Sin conexión con el restaurante');
  }
  const body = await res.json();
  if (!body.ok) throw new Error(body.error || 'Algo salió mal');
  setState(body.state);
  return body;
}

const money = (n) => '$' + Math.round(n).toLocaleString('es-AR');

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'recién';
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.floor(m / 60)} h`;
}

const orderTotal = (o) => o.items.reduce((t, i) => t + i.price * i.qty, 0);

// Pedidos de la sesión actual de una mesa (desde que se cerró por última vez).
function tableOrders(state, table) {
  const since = state.closedTables[table] || 0;
  return state.orders.filter((o) => o.table === table && o.createdAt > since);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
