// Utilidades de interfaz compartidas.
function toast(msg, ms = 2600) {
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

// Aviso fijo cuando se corta la conexión con el servidor.
function connectionBanner(online) {
  let el = document.querySelector('.offline-banner');
  if (!el) {
    el = document.createElement('div');
    el.className = 'offline-banner';
    el.textContent = 'Sin conexión con el restaurante · reconectando…';
    document.body.appendChild(el);
  }
  el.hidden = online;
}

let audioCtx;
// Pequeño "ding" sintetizado, sin archivos de audio.
function ding(times = 1) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const t = audioCtx.currentTime + i * 0.22;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    }
  } catch (e) {}
}
