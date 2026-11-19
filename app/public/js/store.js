// Conexión reactiva con el servidor de SaleListo.
// Soporta alcance separado para Clientes (solo su mesa + menú) y Personal (salón completo),
// control de versión monotónica (con recuperación limpia ante reinicios) y tokens de sesión.

const ORDER_STATUSES = [
  { id: 'nuevo', label: 'Recibido' },
  { id: 'cocina', label: 'En preparación' },
  { id: 'listo', label: 'Listo para llevar' },
  { id: 'entregado', label: 'Entregado' },
];

const STATIONS_META = {
  cocina: { id: 'cocina', label: '🍳 Cocina', short: 'Cocina', chipCls: 'est-cocina', icon: '🍳' },
  barra: { id: 'barra', label: '🍸 Barra', short: 'Barra', chipCls: 'barra', icon: '🍸' },
  mostrador: { id: 'mostrador', label: '🍣 Mostrador', short: 'Mostrador', chipCls: 'est-mostrador', icon: '🍣' },
};

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

function applyIncomingState(s, opts = {}) {
  if (!s) return;
  const fromSSE = Boolean(opts.fromSSE);
  const reconnected = Boolean(opts.reconnected);
  if (!fromSSE && typeof s.version === 'number' && s.version < currentVersion) {
    return;
  }
  const versionReset = fromSSE && (reconnected || (typeof s.version === 'number' && s.version < currentVersion));
  const changed = !currentState
    || versionReset
    || s.version !== currentVersion
    || JSON.stringify(s) !== JSON.stringify(currentState);
  if (typeof s.version === 'number') {
    currentVersion = s.version;
  }
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
    let hadDisconnect = false;
    let authChecking = false;
    const es = new EventSource(`api/events?${params.toString()}`);

    es.onmessage = (e) => {
      let s;
      try {
        s = JSON.parse(e.data);
      } catch (_) {
        return;
      }
      onConnection?.(true);
      if (!resolved) {
        resolved = true;
        hadDisconnect = false;
        currentVersion = typeof s.version === 'number' ? s.version : 0;
        currentState = s;
        resolve({ state: s, close: () => es.close() });
      } else {
        const wasDisconnected = hadDisconnect;
        hadDisconnect = false;
        applyIncomingState(s, { fromSSE: true, reconnected: wasDisconnected });
      }
    };

    es.onerror = async () => {
      hadDisconnect = true;
      onConnection?.(false);
      if (scope === 'staff' && !authChecking) {
        authChecking = true;
        try {
          const r = await fetch('api/staff-state', {
            headers: authToken ? { 'X-Auth-Token': authToken } : {},
          });
          if (r.status === 401) {
            es.close();
            onConnection?.(true);
            if (!resolved) {
              resolved = true;
              reject(new Error('AUTH_REQUIRED'));
            } else {
              opts.onAuthExpired?.();
              window.dispatchEvent(new CustomEvent('salelisto:auth-expired'));
            }
          }
        } catch (_) {
          // Error transitorio de red: EventSource reintentará solo
        } finally {
          authChecking = false;
        }
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || 'Ocurrió un error');
    err.status = res.status;
    throw err;
  }
  return data;
}

async function dispatch(type, payload = {}) {
  const data = await apiPost('api/action', { type, payload });
  if (data.state) applyIncomingState(data.state, { fromSSE: false });
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

function normalizeSearch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function stationInfo(station) {
  return STATIONS_META[station] || STATIONS_META.cocina;
}

function stationLabel(station) {
  return stationInfo(station).label;
}

function stationChipClass(station) {
  return stationInfo(station).chipCls;
}
