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

function notifyBrowser(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body });
    }
  } catch (_) {}
}

function requestPushPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch (_) {}
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
