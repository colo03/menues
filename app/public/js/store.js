// Conexión reactiva con el servidor de SaleListo.
// Soporta alcance separado para Clientes (solo su mesa + menú) y Personal (salón completo),
// rutas cortas /q/<qr_token>, control de versión monotónica, resincronización ante cortes
// de señal o celular bloqueado (visibilitychange / online) y tokens de sesión.

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

// Sesión efímera de demostración (solo en memoria de esta pestaña, nunca se guarda en storage)
const DEMO_SID = (() => {
  try {
    return (new URLSearchParams(window.location.search || '').get('demoSid') || '').trim();
  } catch (_) {
    return '';
  }
})();

const DEMO_EMBED = (() => {
  try {
    return new URLSearchParams(window.location.search || '').get('embed') === '1';
  } catch (_) {
    return false;
  }
})();

function getDemoSid() {
  return DEMO_SID;
}

function isDemoEmbed() {
  return DEMO_EMBED;
}

if (typeof window !== 'undefined' && DEMO_SID && typeof window.fetch === 'function') {
  const _origFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : (input && input.url) || '';
    const isApi = /^(?:\/?api\/)/.test(rawUrl)
      || (rawUrl.startsWith(window.location.origin + '/api/'));
    if (!isApi) return _origFetch(input, init);
    const hdrs = new Headers((init && init.headers) || (typeof input !== 'string' && input.headers) || {});
    if (!hdrs.has('X-Demo-Session')) hdrs.set('X-Demo-Session', DEMO_SID);
    return _origFetch(input, { ...init, headers: hdrs });
  };
}

function setAuthToken(tok) {
  authToken = tok || '';
}

// Cuenta del local (@salelisto.com): la cookie HttpOnly sl_account vincula el dispositivo por 30 días.
// Devuelve { authenticated, account, stationToken, autoAdminToken? } o null (sandbox /demo, file:// o sin red).
function fetchAccountSession(opts = {}) {
  if (DEMO_SID) return Promise.resolve(null);
  if (typeof window === 'undefined' || window.location.protocol === 'file:') return Promise.resolve(null);
  const url = opts.lite ? '/api/auth/account/me?lite=1' : '/api/auth/account/me';
  return fetch(url, { cache: 'no-store', credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

function getAuthToken() {
  return authToken;
}

function load() {
  return currentState;
}

function normalizeApiUrl(url) {
  const s = String(url || '');
  if (s.startsWith('api/')) return `/${s}`;
  return s;
}

function redirectFromFileProtocolIfPossible() {
  if (typeof window === 'undefined' || window.location.protocol !== 'file:') return false;
  const fileName = (window.location.pathname.split('/').pop() || 'index.html');
  const target = `http://localhost:8123/${fileName}${window.location.search || ''}${window.location.hash || ''}`;
  fetch('http://localhost:8123/api/health', { mode: 'cors', cache: 'no-store' })
    .then((r) => {
      if (r.ok) window.location.replace(target);
    })
    .catch(() => {});
  return true;
}

if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
  redirectFromFileProtocolIfPossible();
}

function resolveQrTokenFromLocation(loc = window.location) {
  try {
    const params = new URLSearchParams(loc.search || '');
    const qTok = (params.get('t') || '').trim();
    if (qTok) return qTok;
    const m = String(loc.pathname || '').match(/^\/q\/([A-Za-z0-9_-]{1,64})\/?$/);
    return m ? decodeURIComponent(m[1]) : '';
  } catch (_) {
    return '';
  }
}

function generateClientRequestId(prefix = 'ord') {
  try {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `${prefix}_${window.crypto.randomUUID()}`;
    }
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const arr = new Uint8Array(12);
      window.crypto.getRandomValues(arr);
      const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${prefix}_${Date.now().toString(36)}_${hex}`;
    }
  } catch (_) {}
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
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

// Conecta el stream SSE según el rol ('client' o 'staff') con resincronización automática.
function connectStream(opts = {}, onConnection) {
  const scope = opts.scope || 'client';
  const qrToken = scope === 'client'
    ? (opts.qrToken || (!opts.mesa ? resolveQrTokenFromLocation() : ''))
    : '';
  const mesa = scope === 'client' ? (opts.mesa || '') : '';

  const params = new URLSearchParams({ scope });
  if (DEMO_SID) params.set('demoSid', DEMO_SID);
  if (scope === 'client') {
    if (qrToken) params.set('t', qrToken);
    if (mesa) params.set('mesa', mesa);
  } else if (authToken) {
    params.set('token', authToken);
  }

  return new Promise((resolve, reject) => {
    let resolved = false;
    let closed = false;
    let hadDisconnect = false;
    let authChecking = false;
    let resyncInFlight = false;
    let lastResyncAt = 0;
    let lastEventAt = Date.now();
    let es = null;

    function buildSnapshotUrl() {
      const sp = new URLSearchParams();
      if (DEMO_SID) sp.set('demoSid', DEMO_SID);
      if (scope === 'client') {
        if (qrToken) sp.set('t', qrToken);
        if (mesa) sp.set('mesa', mesa);
        const q = sp.toString();
        return `/api/client-state${q ? `?${q}` : ''}`;
      }
      const q = sp.toString();
      return `/api/staff-state${q ? `?${q}` : ''}`;
    }

    function handleAuthExpired() {
      cleanup();
      onConnection?.(true);
      if (!resolved) {
        resolved = true;
        reject(new Error('AUTH_REQUIRED'));
      } else {
        opts.onAuthExpired?.();
        window.dispatchEvent(new CustomEvent('salelisto:auth-expired'));
      }
    }

    async function resyncState(force = false) {
      if (closed || resyncInFlight) return;
      const now = Date.now();
      if (!force && now - lastResyncAt < 1500) return;
      resyncInFlight = true;
      lastResyncAt = now;
      try {
        const headers = scope !== 'client' && authToken ? { 'X-Auth-Token': authToken } : {};
        const r = await fetch(buildSnapshotUrl(), { headers, cache: 'no-store' });
        if (r.status === 401 && scope !== 'client') {
          handleAuthExpired();
          return;
        }
        if (!r.ok) return;
        const fresh = await r.json();
        lastEventAt = Date.now();
        onConnection?.(true);
        if (!resolved) {
          resolved = true;
          hadDisconnect = false;
          currentVersion = typeof fresh.version === 'number' ? fresh.version : 0;
          currentState = fresh;
          resolve({ state: fresh, close: cleanup, resync: () => resyncState(true) });
        } else {
          applyIncomingState(fresh, { fromSSE: true, reconnected: true });
        }
      } catch (_) {
        // Corte transitorio de señal: EventSource seguirá reintentando
      } finally {
        resyncInFlight = false;
      }
    }

    function openEventSource() {
      if (closed) return;
      if (es) {
        try { es.close(); } catch (_) {}
      }
      es = new EventSource(`/api/events?${params.toString()}`);

      es.onopen = () => {
        onConnection?.(true);
        if (resolved && hadDisconnect) {
          hadDisconnect = false;
          resyncState(true);
        }
      };

      es.onmessage = (e) => {
        let s;
        try {
          s = JSON.parse(e.data);
        } catch (_) {
          return;
        }
        lastEventAt = Date.now();
        onConnection?.(true);
        if (!resolved) {
          resolved = true;
          hadDisconnect = false;
          currentVersion = typeof s.version === 'number' ? s.version : 0;
          currentState = s;
          resolve({ state: s, close: cleanup, resync: () => resyncState(true) });
        } else {
          const wasDisconnected = hadDisconnect;
          hadDisconnect = false;
          applyIncomingState(s, { fromSSE: true, reconnected: wasDisconnected });
        }
      };

      es.onerror = async () => {
        if (closed) return;
        hadDisconnect = true;
        onConnection?.(false);
        if (!resolved && scope === 'client') {
          // Microcorte de red en el primer handshake SSE: cargar la carta de inmediato por HTTP
          resyncState(true);
        }
        if (scope !== 'client' && !authChecking) {
          authChecking = true;
          try {
            const r = await fetch('/api/staff-state', {
              headers: authToken ? { 'X-Auth-Token': authToken } : {},
              cache: 'no-store',
            });
            if (r.status === 401) {
              handleAuthExpired();
            } else if (!resolved && r.ok) {
              resyncState(true);
            }
          } catch (_) {
            if (!resolved) {
              cleanup();
              reject(new Error('SERVER_OFFLINE'));
            }
          } finally {
            authChecking = false;
          }
        }
      };
    }

    function onVisibilityChange() {
      if (closed || document.visibilityState !== 'visible') return;
      // Al desbloquear el celular en la mesa o volver de segundo plano
      resyncState(false);
      const staleMs = Date.now() - lastEventAt;
      if (!es || es.readyState === EventSource.CLOSED || staleMs > 45000) {
        hadDisconnect = true;
        openEventSource();
      }
    }

    function onOnline() {
      if (closed) return;
      resyncState(true);
      if (!es || es.readyState === EventSource.CLOSED) {
        hadDisconnect = true;
        openEventSource();
      }
    }

    function cleanup() {
      if (closed) return;
      closed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      if (es) {
        try { es.close(); } catch (_) {}
        es = null;
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    openEventSource();
  });
}

async function apiPost(url, body = {}, extraHeaders = {}) {
  let res;
  try {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (authToken) headers['X-Auth-Token'] = authToken;
    if (DEMO_SID && !headers['X-Demo-Session']) headers['X-Demo-Session'] = DEMO_SID;
    res = await fetch(normalizeApiUrl(url), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (_) {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      redirectFromFileProtocolIfPossible();
      throw new Error('Abriste el archivo directo (file://). Entrá a http://localhost:8123/restaurante.html');
    }
    throw new Error('Sin conexión con el servidor (verificá que python app/server.py o iniciar.bat esté corriendo)');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || 'Ocurrió un error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function dispatch(type, payload = {}) {
  const data = await apiPost('/api/action', { type, payload });
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
