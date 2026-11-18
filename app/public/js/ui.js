// Utilidades compartidas de interfaz, sonido desbloqueable, vibración y compresión de fotos.

function toast(msg, ms = 3200) {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function connectionBanner(online) {
  let el = document.querySelector('.offline-banner');
  if (!el) {
    el = document.createElement('div');
    el.className = 'offline-banner';
    el.textContent = 'Sin conexión en vivo · reconectando automáticamente…';
    document.body.appendChild(el);
  }
  el.hidden = online;
}

let audioCtx = null;
let audioUnlocked = false;
const audioListeners = new Set();

function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    audioUnlocked = audioCtx.state === 'running';
    audioListeners.forEach((fn) => fn(audioUnlocked));
    return audioUnlocked;
  } catch (_) {
    return false;
  }
}

// Desbloquear audio automáticamente ante el primer toque/clic en la pantalla
['click', 'touchstart', 'keydown'].forEach((ev) => {
  window.addEventListener(ev, () => {
    if (!audioUnlocked) unlockAudio();
  }, { passive: true });
});

function onAudioState(fn) {
  audioListeners.add(fn);
  fn(audioUnlocked);
}

function ding(times = 1, urgent = false) {
  try {
    unlockAudio();
    if (!audioCtx) return;
    for (let i = 0; i < times; i++) {
      const t = audioCtx.currentTime + i * 0.24;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = urgent ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(urgent ? 988 : 880, t);
      osc.frequency.exponentialRampToValueAtTime(urgent ? 1480 : 1320, t + 0.09);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.42);
    }
  } catch (_) {}
  try {
    if (navigator.vibrate) {
      navigator.vibrate(urgent ? [220, 90, 220, 90, 300] : [180, 80, 180]);
    }
  } catch (_) {}
}

function notifyBrowser(title, body, opts = {}) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
    const notifOpts = {
      body: body || '',
      icon: '/mark.svg',
      badge: '/mark.svg',
      vibrate: [220, 90, 220, 90, 320],
      renotify: true,
      requireInteraction: false,
      tag: opts.tag || 'salelisto-live',
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && typeof reg.showNotification === 'function') {
          return reg.showNotification(title, notifOpts);
        }
        try {
          new Notification(title, { body: body || '', icon: '/mark.svg', tag: notifOpts.tag });
        } catch (_) {}
        return null;
      }).catch(() => {});
      return;
    }
    new Notification(title, { body: body || '', icon: '/mark.svg', tag: notifOpts.tag });
  } catch (_) {}
}

function requestPushPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      return Notification.requestPermission();
    }
    if ('Notification' in window) {
      return Promise.resolve(Notification.permission);
    }
  } catch (_) {}
  return Promise.resolve('unsupported');
}

// ---------- Helpers de Service Worker y Web Push (Modo Pulsera Xiaomi Band) ----------

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getPushSupportStatus() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = Boolean(
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    navigator.standalone
  );
  const supported = Boolean(
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';
  return { supported, isIOS, isStandalone, permission, secure: Boolean(window.isSecureContext) };
}

async function registerSaleListoSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (_) {
    return null;
  }
}

async function getExistingPushSubscription() {
  const status = getPushSupportStatus();
  if (!status.supported) return null;
  try {
    const reg = (await navigator.serviceWorker.getRegistration('/')) || (await registerSaleListoSW());
    if (!reg || !reg.pushManager) return null;
    return await reg.pushManager.getSubscription();
  } catch (_) {
    return null;
  }
}

async function subscribeWaiterPush(waiterId, wristbandMode = true) {
  const status = getPushSupportStatus();
  if (!status.secure) {
    throw new Error('Web Push requiere abrir SaleListo con HTTPS (o localhost)');
  }
  if (!status.supported) {
    if (status.isIOS && !status.isStandalone) {
      throw new Error('En iPhone tocá Compartir -> Agregar a inicio para activar Web Push');
    }
    throw new Error('Este navegador no soporta Web Push en segundo plano');
  }

  const perm = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error('Habilitá el permiso de notificaciones del navegador para usar la pulsera');
  }

  const reg = await registerSaleListoSW();
  if (!reg || !reg.pushManager) {
    throw new Error('No se pudo iniciar el Service Worker de notificaciones');
  }

  const keyRes = await fetch('api/push/vapid-public-key').then((r) => r.json());
  if (!keyRes || !keyRes.publicKey) {
    throw new Error('Clave pública VAPID no disponible en el servidor');
  }
  const appServerKey = urlBase64ToUint8Array(keyRes.publicKey);

  let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options && sub.options.applicationServerKey) {
    const curKey = new Uint8Array(sub.options.applicationServerKey);
    const sameKey = curKey.length === appServerKey.length && curKey.every((v, idx) => v === appServerKey[idx]);
    if (!sameKey) {
      try { await sub.unsubscribe(); } catch (_) {}
      sub = null;
    }
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
  }

  const syncRes = await apiPost('api/push/subscribe', {
    waiterId,
    subscription: sub.toJSON(),
    wristbandMode: Boolean(wristbandMode),
  });
  try { localStorage.setItem('salelisto:wristbandWaiter', waiterId); } catch (_) {}
  return { subscription: sub, server: syncRes };
}

async function unsubscribeWaiterPush() {
  const sub = await getExistingPushSubscription();
  if (sub) {
    try { await apiPost('api/push/unsubscribe', { endpoint: sub.endpoint }); } catch (_) {}
    try { await sub.unsubscribe(); } catch (_) {}
  }
  try { localStorage.removeItem('salelisto:wristbandWaiter'); } catch (_) {}
  return true;
}

async function sendWaiterPushTest(waiterId) {
  const sub = await getExistingPushSubscription();
  return apiPost('api/push/test', {
    waiterId,
    endpoint: sub ? sub.endpoint : '',
  });
}

// Redimensiona una foto elegida desde el dispositivo a JPEG liviano (~35 KB) para carga instantánea en 4G.
function compressImageFile(file, maxSide = 480, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Archivo de imagen inválido'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
