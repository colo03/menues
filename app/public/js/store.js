// Conexión reactiva con el servidor de SaleListo.
// Soporta alcance separado para Clientes (solo su mesa + menú) y Personal (salón completo),
// control de versión monotónica (evita condiciones de carrera POST vs SSE) y tokens de sesión.

const ORDER_STATUSES = [
  { id: 'nuevo', label: 'Recibido' },
  { id: 'cocina', label: 'En preparación' },
  { id: 'listo', label: 'Listo para llevar' },
  { id: 'entregado', label: 'Entregado' },
];

let currentState = null;
let currentVersion = 0;
let authToken = '';
const listeners = new Set();

function setAuthToken(tok) {
  authToken = tok || '';
}

function getAuthToken() {
  return authToken;
}

function load() {
  return currentState;
}

function applyIncomingState(s) {
  if (!s) return;
  if (typeof s.version === 'number' && s.version < currentVersion) return;
  const changed = !currentState || s.version !== currentVersion || JSON.stringify(s) !== JSON.stringify(currentState);
  currentVersion = typeof s.version === 'number' ? s.version : currentVersion;
  currentState = s;
  if (changed) listeners.forEach((fn) => fn(s));
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Conecta el stream SSE según el rol ('client' o 'staff').
function connectStream(opts = {}, onConnection) {
  const scope = opts.scope || 'client';
  const params = new URLSearchParams({ scope });
  if (scope === 'client') {
    if (opts.qrToken) params.set('t', opts.qrToken);
    if (opts.mesa) params.set('mesa', opts.mesa);
  } else if (authToken) {
    params.set('token', authToken);
  }

  return new Promise((resolve, reject) => {
    let resolved = false;
    const es = new EventSource(`api/events?${params.toString()}`);
    es.onmessage = (e) => {
      const s = JSON.parse(e.data);
      onConnection?.(true);
      if (!resolved) {
        resolved = true;
        currentVersion = s.version || 0;
        currentState = s;
        resolve({ state: s, close: () => es.close() });
      } else {
        applyIncomingState(s);
      }
    };
    es.onerror = async () => {
      onConnection?.(false);
      if (!resolved && scope === 'staff') {
        try {
          const r = await fetch('api/staff-state', {
            headers: authToken ? { 'X-Auth-Token': authToken } : {},
          });
          if (r.status === 401) {
            es.close();
            resolved = true;
            reject(new Error('AUTH_REQUIRED'));
          }
        } catch (_) {}
      }
    };
  });
}

async function apiPost(url, body = {}) {
  let res;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Auth-Token'] = authToken;
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (_) {
    throw new Error('Sin conexión con el servidor');
  }
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || 'Ocurrió un error');
    err.status = res.status;
    throw err;
  }
  return data;
}

async function dispatch(type, payload = {}) {
  const data = await apiPost('api/action', { type, payload });
  if (data.state) applyIncomingState(data.state);
  return data;
}

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 50) return 'recién';
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return `hace ${h} h`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function stationLabel(station) {
  return station === 'barra' ? '🍸 Barra' : '🍳 Cocina';
}
