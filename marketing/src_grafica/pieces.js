/* SaleListo · Definición de piezas gráficas (carruseles, posts y banners).
   Cada pieza: { w, h, out, html() }. render.html?p=<id> dibuja una pieza;
   export.js recorre todas y exporta PNG al píxel exacto. */

const A = 'assets/';
const PHONE = '(+54)1138436571';
const MAIL = 'ventas@salelisto.com';

/* ---------- Íconos (trazo 24x24) ---------- */
const I = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  chat: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z"/><path d="M9 10.5c.3 1.8 2.2 3.8 4.3 4.3"/>',
  glass: '<path d="M5 4h14l-7 8.5z"/><path d="M12 12.5V20M8 20h8"/>',
  cloche: '<path d="M3 18h18"/><path d="M5 18a7 7 0 0 1 14 0"/><path d="M12 9V7M10 7h4"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5h4"/>',
  card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  wifiOff: '<path d="M2.5 8.5a14 14 0 0 1 19 0M5.5 12a9.5 9.5 0 0 1 13 0M9 15.5a4.5 4.5 0 0 1 6 0"/><path d="M3 3l18 18"/>',
  signal: '<path d="M5 19v-3M10 19v-6M15 19v-9M20 19V6"/>',
  screen: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  battery: '<rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M22 10.5v3M6 10v4M9.5 10v4M13 10v4"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  weight: '<path d="M6 9h12l2 11H4z"/><circle cx="12" cy="5.5" r="2.5"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  noapp: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 7v6M9.5 10.5L12 13l2.5-2.5"/><path d="M3 3l18 18"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 15.5a1.6 1.6 0 0 1 2.6-1.8L8 16"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  table: '<rect x="3" y="7" width="18" height="4" rx="1.5"/><path d="M6 11v9M18 11v9"/>'
};
const ic = (n, s = 32, c = 'currentColor', w = 2.2) =>
  `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;

/* ---------- Marca ---------- */
const logoL = (h = 52) => `<img class="logo" src="${A}logo.svg" style="height:${h}px" alt="SaleListo">`;
const logoD = (h = 52) => `<img class="logo" src="${A}logo-on-dark.svg" style="height:${h}px" alt="SaleListo">`;
const mark = (s = 48) => `<img class="logo" src="${A}mark.svg" style="width:${s}px;height:${s}px" alt="">`;
const pad = n => String(n).padStart(2, '0');

/* ---------- QR ilustrativo (patrón determinístico) ---------- */
function qr(size = 240, fg = '#1C1917', bg = '#FFFFFF', seed = 11) {
  const n = 25, c = size / n; let s = seed, out = '';
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const finder = (x, y) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (finder(x, y)) continue;
    if (rnd() < 0.47) out += `<rect x="${(x * c).toFixed(2)}" y="${(y * c).toFixed(2)}" width="${(c + 0.4).toFixed(2)}" height="${(c + 0.4).toFixed(2)}" rx="${(c * 0.18).toFixed(2)}"/>`;
  }
  const f = (x, y) => `<rect x="${x * c}" y="${y * c}" width="${7 * c}" height="${7 * c}" rx="${c * 1.6}"/>` +
    `<rect x="${(x + 1) * c}" y="${(y + 1) * c}" width="${5 * c}" height="${5 * c}" rx="${c * 1.1}" fill="${bg}"/>` +
    `<rect x="${(x + 2) * c}" y="${(y + 2) * c}" width="${3 * c}" height="${3 * c}" rx="${c * 0.7}"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="${fg}"><rect width="${size}" height="${size}" fill="${bg}"/>${out}${f(0, 0)}${f(n - 7, 0)}${f(0, n - 7)}</svg>`;
}

/* ---------- Plantillas de carrusel ---------- */
function foot(n, total, last) {
  const segs = Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  return `<div class="foot"><div class="prog">${segs}</div>${last ? '<div class="swipe">Guardalo y compartilo con tu encargado</div>' : '<div class="swipe">Deslizá <b>→</b></div>'}</div>`;
}
function slide({ theme = 'light', n, total = 5, body, last = false }) {
  return `<div class="cv post ${theme}">
    <div class="top">${theme === 'dark' ? logoD(52) : logoL(52)}<div class="count">${pad(n)}<span>/${pad(total)}</span></div></div>
    ${body}
    ${foot(n, total, last)}
  </div>`;
}
function post({ theme = 'light', body, footer = true }) {
  return `<div class="cv post ${theme}">
    <div class="top">${theme === 'dark' ? logoD(52) : logoL(52)}<span class="chip ${theme === 'dark' ? 'dk' : 'acc'}">${ic('percent', 24)}0% comisión</span></div>
    ${body}
    ${footer ? `<div class="pfoot"><span>${ic('chat', 30)}WhatsApp ${PHONE}</span><span>${ic('mail', 30)}${MAIL}</span></div>` : ''}
  </div>`;
}

/* Tarjeta de contacto oscura reutilizable */
const ctaCard = (title, extra = '') => `
  <div class="ink-card" style="padding:44px 48px;display:flex;flex-direction:column;gap:26px">
    <div style="font-size:40px;font-weight:800;line-height:1.15;letter-spacing:-0.02em">${title}</div>
    ${extra}
    <div class="contact" style="font-size:34px">
      <div>${ic('chat', 38, '#D9412B')}WhatsApp ${PHONE}</div>
      <div>${ic('mail', 38, '#D9412B')}${MAIL}</div>
    </div>
  </div>`;

/* Columna de la Estación de Pase */
const passTask = (kind, mesa, txt) => {
  const map = {
    cocina: { c: '#D97706', icon: 'cloche', label: 'Cocina' },
    barra: { c: '#8B5CF6', icon: 'glass', label: 'Barra' },
    cuenta: { c: '#D9412B', icon: 'card', label: 'Cuenta' },
    llama: { c: '#2F8A57', icon: 'hand', label: 'Llama' }
  }[kind];
  return `<div style="background:#26221f;border:1px solid #38322e;border-left:6px solid ${map.c};border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:6px">
    <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:30px;font-weight:800">${mesa}</span>${ic(map.icon, 28, map.c, 2.4)}</div>
    <div style="font-size:22px;font-weight:700;color:rgba(250,247,242,.78);white-space:nowrap">${txt}</div>
  </div>`;
};
const passCol = (name, tasks) => `<div style="flex:1;display:flex;flex-direction:column;gap:12px;min-width:0;flex-shrink:0">
  <div style="display:flex;align-items:center;gap:10px;font-size:24px;font-weight:800;padding:4px 2px 8px;border-bottom:1px solid #38322e"><span style="width:12px;height:12px;border-radius:50%;background:#2F8A57"></span>${name}</div>
  ${tasks.join('')}</div>`;
function passStation(w, h) {
  return `<div class="tablet" style="width:${w}px;height:${h}px"><div class="scr" style="padding:20px 22px;display:flex;flex-direction:column;gap:16px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:12px;font-size:24px;font-weight:800">${mark(32)}Estación de Pase</div>
      <span style="font-size:20px;font-weight:700;color:#2F8A57;background:rgba(47,138,87,.16);padding:6px 14px;border-radius:999px">3 mozos en turno</span>
    </div>
    <div style="display:flex;gap:16px;flex:1">
      ${passCol('Lucía', [passTask('cocina', 'T4', 'Retirar plato'), passTask('cuenta', 'M8', 'Tarjeta · 10%')])}
      ${passCol('Martín', [passTask('barra', 'T2', 'Retirar tragos'), passTask('llama', 'T7', 'Pide atención')])}
      ${passCol('Sofía', [passTask('barra', 'V3', 'Retirar pintas'), passTask('cocina', 'T11', 'Retirar postre')])}
    </div>
  </div></div>`;
}

/* Pulsera Xiaomi Smart Band minimalista */
function bandSvg(w = 230, content = '') {
  const h = Math.round(w * 1.62);
  return `<div class="band" style="width:${w}px">
    <div class="strap t" style="height:${Math.round(w * 0.46)}px"></div>
    <div class="pod" style="height:${h}px"><div class="scr">${content}</div></div>
    <div class="strap b" style="height:${Math.round(w * 0.46)}px"></div>
  </div>`;
}
const bandScreen = (s = 1) => `
  <div style="width:${64 * s}px;height:${64 * s}px;border-radius:50%;background:rgba(139,92,246,.22);display:flex;align-items:center;justify-content:center">${ic('glass', 38 * s, '#A78BFA', 2.4)}</div>
  <div style="font-size:${46 * s}px;font-weight:800;margin-top:${14 * s}px;line-height:1">T2</div>
  <div style="font-size:${24 * s}px;font-weight:700;color:rgba(250,247,242,.8);margin-top:${8 * s}px;line-height:1.15">Retirar<br>Barra</div>`;

/* Teléfono con pantalla "Pedir la cuenta" */
function billPhone(w = 420, h = 640) {
  const pill = (t, sel) => `<span style="font-size:22px;font-weight:700;padding:9px 16px;border-radius:999px;white-space:nowrap;${sel ? 'background:#D9412B;color:#fff' : 'background:#fff;border:1.5px solid #e6dfd3;color:#57534e'}">${t}</span>`;
  return `<div class="phone" style="width:${w}px;height:${h}px"><div class="scr" style="padding:34px 26px 26px;display:flex;flex-direction:column;gap:16px">
    <div style="display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:10px;font-size:24px;font-weight:800">${mark(34)}Mesa T4</div><span class="chip ok" style="font-size:20px;padding:6px 12px">${ic('signal', 20, '#2F8A57', 2.6)}4G</span></div>
    <div style="font-size:34px;font-weight:800;letter-spacing:-0.02em;margin-top:4px">Pedir la cuenta</div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;background:#fff;border:1px solid #e6dfd3;border-radius:15px;padding:14px 18px"><span style="font-size:22px;font-weight:600;color:#57534e">Total</span><b style="font-size:32px;font-weight:800">$48.600</b></div>
    <div style="font-size:21px;font-weight:700;color:#57534e">Medio de pago</div>
    <div style="display:flex;flex-wrap:wrap;gap:10px">${pill('Efectivo')}${pill('Tarjeta', 1)}${pill('QR')}${pill('Transferencia')}</div>
    <div style="font-size:21px;font-weight:700;color:#57534e">Propina</div>
    <div style="display:flex;gap:10px">${pill('0%')}${pill('5%')}${pill('10%', 1)}${pill('15%')}</div>
    <div class="btn" style="margin-top:auto;flex:none;height:64px;font-size:26px;border-radius:15px">Pedir la cuenta</div>
  </div></div>`;
}

/* ======================================================================
   PIEZAS
   ====================================================================== */
const P = {};

/* ---------------- CARRUSEL 01 · Viajes muertos ---------------- */
P.c1s1 = { w: 1080, h: 1350, out: 'posts/carrusel_01_viajes_muertos/slide_01.png', html: () => slide({ n: 1, body: `
  <div style="margin-top:128px">
    <div class="kicker">${ic('clock', 28)}Hora pico en el salón</div>
    <h1 class="h1" style="margin-top:40px">Cobrar una mesa hoy lleva <span style="white-space:nowrap">4 viajes</span>.</h1>
    <h1 class="h1" style="margin-top:22px">Con SaleListo lleva <span class="acc">1</span>.</h1>
    <div class="card" style="margin-top:76px;padding:44px 48px">
      <div style="display:flex;align-items:center;gap:32px">
        <div style="width:170px;font-size:30px;font-weight:800;color:#57534e">Hoy</div>
        <div style="flex:1;display:flex;align-items:center">
          ${[1, 2, 3, 4].map(i => `<div style="width:84px;height:84px;border-radius:50%;border:3px solid #d6cdc0;background:#f3eee6;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:800;color:#57534e;flex:none">${i}</div>`).join('<div style="flex:1;border-top:4px dashed #d6cdc0;margin:0 8px"></div>')}
        </div>
      </div>
      <div style="height:1px;background:#e6dfd3;margin:36px 0"></div>
      <div style="display:flex;align-items:center;gap:32px">
        <div style="width:170px;font-size:30px;font-weight:800;color:#1c1917">SaleListo</div>
        <div style="flex:1;display:flex;align-items:center">
          <div style="width:84px;height:84px;border-radius:50%;background:#D9412B;display:flex;align-items:center;justify-content:center;flex:none">${ic('check', 44, '#fff', 3)}</div>
          <div style="flex:1;height:5px;background:#D9412B;margin:0 8px;border-radius:9px"></div>
          <span class="chip ok" style="font-size:28px;padding:14px 24px">${ic('check', 28, '#2F8A57', 3)}Mesa cobrada</span>
        </div>
      </div>
    </div>
  </div>` }) };

const step = (n, t, s) => `<div class="card-s" style="display:grid;grid-template-columns:68px 1fr 44px;gap:28px;align-items:center;padding:24px 32px">
  <div style="width:68px;height:68px;border-radius:50%;background:#1c1917;color:#faf7f2;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800">${pad(n)}</div>
  <div><div style="font-size:33px;font-weight:800;letter-spacing:-0.01em;line-height:1.2">${t}</div><div style="font-size:26px;font-weight:500;color:#57534e;margin-top:6px;line-height:1.3">${s}</div></div>
  ${ic('route', 40, '#8a837c', 2)}</div>`;

P.c1s2 = { w: 1080, h: 1350, out: 'posts/carrusel_01_viajes_muertos/slide_02.png', html: () => slide({ n: 2, body: `
  <div style="margin-top:72px">
    <h2 class="h2">Los 4 viajes que<br><span class="acc">queman al mozo.</span></h2>
    <p class="lead" style="margin-top:22px">Así se cobra hoy una mesa en hora pico:</p>
    <div style="display:flex;flex-direction:column;gap:16px;margin-top:40px">
      ${step(1, 'Ver qué necesita la mesa', 'Levantan la mano: “¿nos traés la cuenta?”')}
      ${step(2, 'Ir a caja por el pre-ticket', 'Esperar que salga y llevarlo a la mesa.')}
      ${step(3, 'Preguntar cómo van a pagar', 'Efectivo, tarjeta, QR o transferencia.')}
      ${step(4, 'Volver con el posnet o el vuelto', 'Cobrar, esperar la propina y cerrar.')}
    </div>
    <div class="ink-card" style="margin-top:28px;padding:30px 36px;display:flex;align-items:center;gap:22px">
      ${ic('clock', 46, '#D9412B', 2.2)}
      <div style="font-size:32px;font-weight:600;color:rgba(250,247,242,.8)"><b style="color:#faf7f2;font-weight:800;font-size:40px">10 a 15 min</b>&nbsp; por mesa, solo para cobrar.</div>
    </div>
  </div>` }) };

P.c1s3 = { w: 1080, h: 1350, out: 'posts/carrusel_01_viajes_muertos/slide_03.png', html: () => slide({ theme: 'dark', n: 3, body: `
  <div style="margin-top:72px">
    <h2 class="h2">La mesa pide la cuenta <span class="hl">desde el QR</span>.</h2>
    <p class="lead" style="margin-top:24px">Con medio de pago y propina ya elegidos. El mozo va una sola vez y sabe qué llevar.</p>
    <div style="display:flex;gap:44px;align-items:center;margin-top:46px">
      ${billPhone(420, 650)}
      <div style="flex:1;display:flex;flex-direction:column;gap:26px">
        <div style="display:flex;align-items:center;gap:14px;font-size:26px;font-weight:700;color:rgba(250,247,242,.72)">${ic('arrow', 34, '#D9412B', 2.6)}Llega al instante a</div>
        <div class="card-d" style="padding:28px 30px;display:flex;flex-direction:column;gap:16px;border-left:8px solid #D9412B">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:24px;font-weight:700;color:rgba(250,247,242,.72)">Estación de Pase</span>${ic('card', 32, '#D9412B', 2.4)}</div>
          <div style="font-size:46px;font-weight:800;letter-spacing:-0.02em">T4 · Cuenta</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><span class="chip dk">Tarjeta</span><span class="chip dk">Propina 10%</span></div>
          <div style="font-size:30px;font-weight:800">$48.600</div>
        </div>
        <div style="display:flex;align-items:center;gap:18px;margin-top:6px">
          <div style="width:72px;height:72px;border-radius:50%;background:#2F8A57;display:flex;align-items:center;justify-content:center;flex:none">${ic('check', 40, '#fff', 3)}</div>
          <div><div style="font-size:44px;font-weight:800;line-height:1.05">1 solo viaje</div><div style="font-size:26px;font-weight:600;color:rgba(250,247,242,.72);margin-top:6px">con el posnet en la mano</div></div>
        </div>
      </div>
    </div>
  </div>` }) };

const miniStat = (v, l) => `<div style="flex:1"><div style="font-size:38px;font-weight:800;letter-spacing:-0.02em">${v}</div><div style="font-size:24px;font-weight:600;color:#57534e;margin-top:6px;line-height:1.3">${l}</div></div>`;
P.c1s4 = { w: 1080, h: 1350, out: 'posts/carrusel_01_viajes_muertos/slide_04.png', html: () => slide({ n: 4, body: `
  <div style="margin-top:72px">
    <div class="kicker">${ic('spark', 28)}Impacto real en hora pico</div>
    <div style="font-size:142px;font-weight:800;letter-spacing:-0.045em;line-height:1;color:#D9412B;margin-top:44px;white-space:nowrap">+18 a 25 min</div>
    <div class="h3" style="margin-top:18px">recuperados por mesa en cada servicio.</div>
    <div class="card" style="margin-top:56px;padding:42px 44px">
      <div style="display:flex;justify-content:space-between;font-size:28px;font-weight:700;color:#57534e"><span>Servicio tradicional</span><b style="color:#1c1917;font-weight:800">23 a 34 min</b></div>
      <div style="height:26px;border-radius:99px;background:#57534e;margin-top:14px"></div>
      <div style="display:flex;justify-content:space-between;font-size:28px;font-weight:700;color:#57534e;margin-top:30px"><span>Con SaleListo</span><b style="color:#D9412B;font-weight:800">5 a 9 min</b></div>
      <div style="height:26px;border-radius:99px;background:#f3eee6;margin-top:14px"><div style="width:27%;height:100%;border-radius:99px;background:#D9412B"></div></div>
      <div style="height:1px;background:#e6dfd3;margin:36px 0 30px"></div>
      <div style="display:flex;gap:28px">
        ${miniStat('8 a 10 min', 'Primer pedido')}
        ${miniStat('3 a 5 min', 'Envío a Cocina y Barra')}
        ${miniStat('7 a 10 min', 'Cuenta y cobro')}
      </div>
    </div>
    <p style="margin-top:34px;font-size:28px;font-weight:600;color:#57534e;line-height:1.4">Viernes y sábado: de <b style="color:#1c1917">3 a 3,75 rotaciones</b> por mesa. Hasta <b style="color:#1c1917">+25% de capacidad</b> sin sumar mesas.</p>
  </div>` }) };

const planCard = (name, price, meta, hot) => `<div class="card-s" style="flex:1;padding:${hot ? '46px' : '34px'} 26px 30px;position:relative;${hot ? 'border:2.5px solid #D9412B;box-shadow:0 20px 48px -12px rgba(217,65,43,.28)' : ''}">
  ${hot ? '<span class="chip solid" style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:21px;padding:8px 18px">Más elegido</span>' : ''}
  <div style="font-size:25px;font-weight:700;color:#57534e;white-space:nowrap">${name}</div>
  <div style="margin-top:14px;white-space:nowrap"><span style="font-size:50px;font-weight:800;letter-spacing:-0.03em">${price}</span><span style="font-size:24px;font-weight:700;color:#57534e"> /mes</span></div>
  <div style="font-size:24px;font-weight:600;color:#57534e;margin-top:10px">${meta}</div></div>`;
P.c1s5 = { w: 1080, h: 1350, out: 'posts/carrusel_01_viajes_muertos/slide_05.png', html: () => slide({ n: 5, last: true, body: `
  <div style="margin-top:68px">
    <div class="badge0" style="font-size:34px"><b>0%</b>comisión sobre tus ventas</div>
    <h2 class="h2" style="margin-top:36px">Abono fijo mensual.<br><span class="acc">Sin letra chica.</span></h2>
    <div style="display:flex;gap:20px;margin-top:56px;align-items:flex-end">
      ${planCard('Barra / Café', 'USD 35', 'Hasta 12 mesas')}
      ${planCard('Salón / Bistró', 'USD 65', 'Hasta 30 mesas', 1)}
      ${planCard('Gran Salón', 'USD 110', 'Mesas ilimitadas')}
    </div>
    <p style="margin-top:22px;font-size:24px;font-weight:600;color:#8a837c">Precios de referencia en USD, facturados en pesos.</p>
    <div style="margin-top:40px">${ctaCard('Pedí una demo de 10 minutos<br>en tu propio local.')}</div>
  </div>` }) };

/* ---------------- CARRUSEL 02 · Cero celulares ---------------- */
const iconTile = (svg, label, sub, crossed) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center">
  <div style="width:150px;height:150px;border-radius:40px;background:${crossed ? '#1c1917' : '#2f2a26'};border:1.5px solid #38322e;display:flex;align-items:center;justify-content:center;position:relative">${svg}</div>
  <div style="font-size:30px;font-weight:800;line-height:1.15">${label}</div><div style="font-size:24px;font-weight:600;color:rgba(250,247,242,.68);margin-top:-8px">${sub}</div></div>`;
P.c2s1 = { w: 1080, h: 1350, out: 'posts/carrusel_02_cero_celulares/slide_01.png', html: () => slide({ theme: 'dark', n: 1, body: `
  <div style="margin-top:104px">
    <div class="kicker">${ic('eye', 28)}Tecnología invisible</div>
    <h1 class="h1" style="margin-top:40px">Un salón ágil<br><span class="hl">sin mozos</span> mirando<br>el celular.</h1>
    <div class="card-d" style="margin-top:96px;padding:52px 36px;display:flex;gap:16px">
      ${iconTile(`${ic('phone', 76, 'rgba(250,247,242,.45)', 1.8)}<svg style="position:absolute" width="110" height="110" viewBox="0 0 110 110"><path d="M18 18L92 92" stroke="#D9412B" stroke-width="7" stroke-linecap="round"/></svg>`, 'Celular', 'en el bolsillo', 1)}
      ${iconTile(ic('screen', 80, '#FAF7F2', 1.8), 'Estación', 'fija en el pase')}
      ${iconTile(`<svg width="66" height="106" viewBox="0 0 60 96"><rect x="17" y="2" width="26" height="22" rx="8" fill="#3d3632"/><rect x="17" y="72" width="26" height="22" rx="8" fill="#3d3632"/><rect x="5" y="18" width="50" height="60" rx="25" fill="#0b0a09" stroke="#FAF7F2" stroke-width="3.5"/><path d="M21 48l6 6 12-13" stroke="#D9412B" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`, 'Pulsera', 'que vibra')}
    </div>
  </div>` }) };

const xRow = t => `<div style="display:flex;align-items:center;gap:20px;font-size:32px;font-weight:700"><span style="width:52px;height:52px;border-radius:50%;background:#fceae6;display:flex;align-items:center;justify-content:center;flex:none">${ic('x', 28, '#D9412B', 3)}</span>${t}</div>`;
P.c2s2 = { w: 1080, h: 1350, out: 'posts/carrusel_02_cero_celulares/slide_02.png', html: () => slide({ n: 2, body: `
  <div style="margin-top:72px">
    <div class="kicker">${ic('users', 28)}La objeción real</div>
    <div style="font-size:200px;font-weight:800;line-height:.7;color:#D9412B;margin-top:56px;height:96px">“</div>
    <h2 class="h2" style="font-size:68px">No quiero a mis mozos<br>mirando el celular<br>frente a los clientes.</h2>
    <p class="lead" style="margin-top:24px;font-size:30px">Lo que más escuchamos de dueños gastronómicos.</p>
    <div style="display:flex;flex-direction:column;gap:22px;margin-top:44px">
      ${xRow('Rompe la imagen del salón.')}
      ${xRow('El cliente siente que no lo miran.')}
      ${xRow('Parece distracción, aunque sea trabajo.')}
    </div>
    <div class="ink-card" style="margin-top:48px;padding:34px 40px;font-size:34px;font-weight:700;line-height:1.35">Tienen razón. Por eso SaleListo coordina el salón <span class="hl" style="color:#faf7f2">sin celulares a la vista</span>.</div>
  </div>` }) };

const okRow = (t, s = 30) => `<div style="display:flex;align-items:center;gap:16px;font-size:${s}px;font-weight:700"><span style="width:44px;height:44px;border-radius:50%;background:#e3f3ea;display:flex;align-items:center;justify-content:center;flex:none">${ic('check', 26, '#2F8A57', 3)}</span>${t}</div>`;
P.c2s3 = { w: 1080, h: 1350, out: 'posts/carrusel_02_cero_celulares/slide_03.png', html: () => slide({ n: 3, body: `
  <div style="margin-top:72px">
    <span class="chip ok" style="font-size:26px;padding:12px 22px">${ic('check', 26, '#2F8A57', 3)}Plan Base · Incluida de serie</span>
    <h2 class="h2" style="margin-top:32px">Estación de Mozos<br><span class="acc">fija en el pase.</span></h2>
    <p class="lead" style="margin-top:22px">Una tablet o monitor en el mostrador, con una columna en vivo por cada mozo.</p>
    <div style="margin-top:42px">${passStation(912, 410)}</div>
    <div style="display:flex;flex-direction:column;gap:18px;margin-top:40px">
      ${okRow('Legible a 3 o 4 metros, con aviso sonoro suave.')}
      ${okRow('Corre en la tablet o monitor que ya tenés.')}
    </div>
  </div>` }) };

const bandStat = (icn, v, l) => `<div style="display:flex;align-items:center;gap:22px">
  <div style="width:76px;height:76px;border-radius:22px;background:#26221f;border:1.5px solid #38322e;display:flex;align-items:center;justify-content:center;flex:none">${ic(icn, 38, '#D9412B', 2.2)}</div>
  <div><div style="font-size:44px;font-weight:800;letter-spacing:-0.02em;line-height:1">${v}</div><div style="font-size:25px;font-weight:600;color:rgba(250,247,242,.72);margin-top:6px">${l}</div></div></div>`;
const waves = (side) => `<svg width="70" height="200" viewBox="0 0 70 200" style="position:absolute;top:50%;${side}:-92px;transform:translateY(-50%)${side === 'left' ? ' scaleX(-1)' : ''}"><path d="M14 60a60 60 0 0 1 0 80" stroke="#D9412B" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M40 34a95 95 0 0 1 0 132" stroke="#D9412B" stroke-opacity=".45" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`;
P.c2s4 = { w: 1080, h: 1350, out: 'posts/carrusel_02_cero_celulares/slide_04.png', html: () => slide({ theme: 'dark', n: 4, body: `
  <div style="margin-top:72px">
    <span class="chip dk" style="font-size:26px;padding:12px 22px">${ic('sun', 26, '#D9412B')}Adicional para patios y terrazas</span>
    <h2 class="h2" style="margin-top:32px">Kit Pulsera Vibradora <span class="hl">Xiaomi Band</span>.</h2>
    <p class="lead" style="margin-top:22px">El celular queda en el bolsillo. El aviso llega a la muñeca.</p>
    <div style="display:flex;align-items:center;gap:40px;margin-top:34px">
      <div style="width:400px;display:flex;justify-content:center;position:relative">
        <div style="position:relative">${waves('left')}${waves('right')}${bandSvg(186, bandScreen(0.95))}</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:30px">
        ${bandStat('battery', 'Hasta 14 días', 'de batería por carga')}
        ${bandStat('weight', '15 g', 'casi no se siente')}
        ${bandStat('drop', '5 ATM', 'resiste agua y salpicaduras')}
      </div>
    </div>
    <div class="card-d" style="margin-top:30px;padding:24px 32px;display:flex;justify-content:space-between;align-items:center;font-size:28px;font-weight:700">
      <span>Pack 3: <b style="font-weight:800">USD 145</b></span><span>Pack 5: <b style="font-weight:800">USD 230</b></span><span style="color:rgba(250,247,242,.68)">Pago único</span>
    </div>
  </div>` }) };

const pilotStep = (v, l) => `<div class="card-s" style="flex:1;padding:30px 26px"><div style="font-size:48px;font-weight:800;letter-spacing:-0.03em;color:#D9412B;white-space:nowrap">${v}</div><div style="font-size:26px;font-weight:700;margin-top:10px;line-height:1.3">${l}</div></div>`;
P.c2s5 = { w: 1080, h: 1350, out: 'posts/carrusel_02_cero_celulares/slide_05.png', html: () => slide({ n: 5, last: true, body: `
  <div style="margin-top:68px">
    <div class="kicker">${ic('shield', 28)}Piloto sin riesgo</div>
    <h2 class="h2" style="margin-top:34px">Probalo en <span class="acc">1 sector</span><br>durante 14 días.</h2>
    <p class="lead" style="margin-top:22px">Elegí el sector más difícil: vereda, patio o terraza. El salón principal no se toca.</p>
    <div style="display:flex;gap:18px;margin-top:44px">
      ${pilotStep('24 h', 'Cargamos tu carta y el ruteo')}
      ${pilotStep('QR fijo', 'En cada mesa del sector')}
      ${pilotStep('2 findes', 'Medimos juntos los resultados')}
    </div>
    <div style="margin-top:40px">${ctaCard('Activá tu piloto:<br>escribinos y lo coordinamos.')}</div>
  </div>` }) };

/* ---------------- POSTS INDIVIDUALES ---------------- */
P.p1 = { w: 1080, h: 1350, out: 'posts/post_01_cero_comision_roi.png', html: () => post({ body: `
  <div style="margin-top:64px">
    <div style="display:flex;align-items:flex-end;gap:28px">
      <div style="font-size:250px;font-weight:800;letter-spacing:-0.06em;line-height:.8;color:#D9412B">0%</div>
      <div style="font-size:38px;font-weight:800;line-height:1.15;padding-bottom:6px">de comisión<br>sobre tus ventas</div>
    </div>
    <h2 class="h2" style="margin-top:46px;font-size:64px">Vos vendés. Nadie se queda con una parte de cada mesa.</h2>
    <div style="display:flex;gap:18px;margin-top:40px">
      <div class="card-s" style="flex:1;padding:30px 30px;background:#f3eee6;box-shadow:none">
        <div style="font-size:24px;font-weight:700;color:#57534e">Apps de delivery</div>
        <div style="font-size:46px;font-weight:800;margin-top:10px;color:#57534e;letter-spacing:-0.02em">18% a 30%</div>
        <div style="font-size:24px;font-weight:600;color:#57534e;margin-top:4px">+ IVA por pedido</div>
      </div>
      <div class="card" style="flex:1;padding:30px 26px;border:2.5px solid #D9412B">
        <div style="font-size:24px;font-weight:700;color:#D9412B">SaleListo en el salón</div>
        <div style="font-size:46px;font-weight:800;margin-top:10px;letter-spacing:-0.02em">USD 35</div>
        <div style="font-size:22px;font-weight:600;color:#57534e;margin-top:4px;white-space:nowrap">abono mensual fijo (Plan Inicial)</div>
      </div>
    </div>
    <div class="ink-card" style="margin-top:22px;padding:30px 36px;display:flex;align-items:center;gap:30px">
      <div style="font-size:84px;font-weight:800;letter-spacing:-0.04em;color:#faf7f2;line-height:1">37x</div>
      <div style="font-size:27px;font-weight:600;line-height:1.38;color:rgba(250,247,242,.8)">Retorno estimado en un restaurante de 25 mesas:<br><b style="color:#faf7f2">+USD 2.409/mes</b> con un abono de USD 65.</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:18px;margin-top:40px">
      ${okRow('Precio fijo y previsible, facturado en pesos.', 29)}
      ${okRow('Sin porcentaje sobre ninguna mesa ni pedido.', 29)}
    </div>
  </div>` }) };

const orderLine = (q, t) => `<div style="display:flex;gap:14px;font-size:26px;font-weight:600;color:#1c1917"><b style="color:#8a837c;width:34px">${q}x</b>${t}</div>`;
const stationCard = (title, color, soft, icn, lines) => `<div style="flex:1;background:#fff;border-radius:24px;overflow:hidden;color:#1c1917">
  <div style="background:${soft};padding:22px 26px;display:flex;align-items:center;gap:14px;border-bottom:4px solid ${color}">${ic(icn, 36, color, 2.4)}<span style="font-size:32px;font-weight:800">${title}</span></div>
  <div style="padding:22px 26px;display:flex;flex-direction:column;gap:12px">${lines}</div></div>`;
P.p2 = { w: 1080, h: 1350, out: 'posts/post_02_division_cocina_barra.png', html: () => post({ theme: 'dark', body: `
  <div style="margin-top:64px">
    <h2 class="h2">Un pedido.<br>Dos estaciones.<br><span class="hl">Cero papelitos.</span></h2>
    <p class="lead" style="margin-top:24px">La comanda se divide sola, en el mismo segundo.</p>
    <div style="margin:40px auto 0;width:660px;background:#fff;border-radius:24px;padding:24px 30px;color:#1c1917;box-shadow:0 24px 50px -16px rgba(0,0,0,.6)">
      <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:1px solid #e6dfd3;margin-bottom:14px"><span style="display:flex;align-items:center;gap:12px;font-size:28px;font-weight:800">${mark(36)}Mesa T4</span><span class="chip acc" style="font-size:21px;padding:6px 14px">Nuevo pedido</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 20px">${orderLine(1, 'Milanesa napo')}${orderLine(2, 'Pintas IPA')}${orderLine(1, 'Papas rústicas')}${orderLine(1, 'Fernet con cola')}</div>
    </div>
    <svg width="912" height="96" viewBox="0 0 912 96" style="display:block"><path d="M456 0 C456 50 228 40 228 96" stroke="#D97706" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M456 0 C456 50 684 40 684 96" stroke="#8B5CF6" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="456" cy="6" r="10" fill="#D9412B"/></svg>
    <div style="display:flex;gap:28px">
      ${stationCard('Cocina', '#D97706', '#fef1dc', 'cloche', orderLine(1, 'Milanesa napo') + orderLine(1, 'Papas rústicas'))}
      ${stationCard('Barra', '#6D28D9', '#efeafe', 'glass', orderLine(2, 'Pintas IPA') + orderLine(1, 'Fernet con cola'))}
    </div>
    <div style="display:flex;align-items:center;gap:16px;margin-top:44px;font-size:30px;font-weight:700"><span style="width:44px;height:44px;border-radius:50%;background:#2F8A57;display:flex;align-items:center;justify-content:center;flex:none">${ic('check', 26, '#FAF7F2', 3)}</span>Cada estación ve solo lo que prepara.</div>
  </div>` }) };

const featRow = (icn, t, s) => `<div style="display:flex;gap:22px;align-items:flex-start">
  <div style="width:72px;height:72px;border-radius:20px;background:#fff;border:1px solid #e6dfd3;box-shadow:var(--shadow-card);display:flex;align-items:center;justify-content:center;flex:none">${ic(icn, 36, '#D9412B', 2.2)}</div>
  <div><div style="font-size:31px;font-weight:800;line-height:1.2">${t}</div><div style="font-size:25px;font-weight:500;color:#57534e;margin-top:4px;line-height:1.3">${s}</div></div></div>`;
function tentCard(w = 360) {
  return `<div style="position:relative;width:${w}px">
    <div style="background:#fff;border:1px solid #e6dfd3;border-radius:28px;box-shadow:var(--shadow-float);padding:32px 30px 34px;display:flex;flex-direction:column;align-items:center;gap:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%"><span style="font-size:26px;font-weight:800">Vereda · V3</span>${mark(40)}</div>
      <div style="padding:14px;border:1px solid #e6dfd3;border-radius:18px">${qr(w - 120, '#1C1917', '#FFFFFF', 23)}</div>
      <div style="font-size:24px;font-weight:700;color:#57534e;text-align:center;line-height:1.3">Escaneá con tu cámara<br>y pedí directo</div>
    </div>
    <div style="width:${w - 60}px;height:22px;margin:0 auto;background:#e6dfd3;border-radius:0 0 18px 18px"></div>
    <span class="chip ok" style="position:absolute;top:-24px;right:-34px;font-size:26px;padding:12px 22px;box-shadow:var(--shadow-card);border:1.5px solid #c7e6d4">${ic('signal', 26, '#2F8A57', 2.8)}4G sin Wi-Fi</span>
  </div>`;
}
P.p3 = { w: 1080, h: 1350, out: 'posts/post_03_qr_4g_patios_veredas.png', html: () => post({ body: `
  <div style="margin-top:64px">
    <div class="kicker">${ic('sun', 28)}Veredas, patios y terrazas</div>
    <h2 class="h2" style="margin-top:34px">Tu vereda pide sola, <span class="acc">aunque el Wi-Fi no llegue.</span></h2>
    <div style="display:flex;gap:56px;align-items:center;margin-top:62px">
      ${tentCard(380)}
      <div style="flex:1;display:flex;flex-direction:column;gap:34px">
        ${featRow('signal', 'Usa el 4G del cliente', 'Sin pedir la clave del Wi-Fi.')}
        ${featRow('noapp', 'Sin descargar apps', 'Abre con la cámara del celular.')}
        ${featRow('shield', 'Acrílico para exterior', 'Resiste sol, lluvia y alcohol.')}
      </div>
    </div>
    <div class="card-s" style="margin-top:58px;padding:26px 32px;display:flex;align-items:center;gap:18px;font-size:29px;font-weight:700">${ic('check', 34, '#2F8A57', 3)}Un QR fijo por mesa. Nunca se reimprime.</div>
  </div>` }) };

const priceRow = (name, cat, oldp, newp) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-top:1px solid #e6dfd3">
  <div><div style="font-size:29px;font-weight:800">${name}</div><div style="font-size:22px;font-weight:600;color:#8a837c;margin-top:2px">${cat}</div></div>
  <div style="display:flex;align-items:center;gap:18px;white-space:nowrap"><span style="font-size:25px;font-weight:600;color:#8a837c;text-decoration:line-through">${oldp}</span>${ic('arrow', 26, '#8a837c', 2.4)}<b style="font-size:31px;font-weight:800">${newp}</b></div></div>`;
P.p4 = { w: 1080, h: 1350, out: 'posts/post_04_precios_anti_inflacion.png', html: () => post({ body: `
  <div style="margin-top:64px">
    <div class="kicker">${ic('tag', 28)}Precios anti inflación</div>
    <h2 class="h2" style="margin-top:30px">¿Subiste precios?<br><span class="acc">No reimprimas nada.</span></h2>
    <div class="card" style="margin-top:40px;padding:30px 42px 28px">
      <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:30px;font-weight:800">Ajuste masivo de precios</span><span class="chip">Toda la carta</span></div>
      <div style="display:flex;align-items:center;gap:28px;margin:22px 0 20px">
        <div style="font-size:84px;font-weight:800;letter-spacing:-0.04em;color:#D9412B;line-height:1">+8%</div>
        <div style="flex:1;height:14px;border-radius:99px;background:#f3eee6;position:relative"><div style="width:40%;height:100%;border-radius:99px;background:#D9412B"></div><div style="position:absolute;left:40%;top:50%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:#fff;border:3px solid #D9412B;box-shadow:var(--shadow-card)"></div></div>
      </div>
      ${priceRow('Milanesa napolitana', 'Cocina', '$14.500', '$15.660')}
      ${priceRow('Pinta IPA', 'Barra', '$5.200', '$5.616')}
      ${priceRow('Flan casero', 'Postres', '$4.800', '$5.184')}
      <div class="btn" style="width:100%;height:72px;font-size:29px;margin-top:10px">Aplicar a 46 platos</div>
    </div>
    <div style="display:flex;align-items:center;gap:18px;margin-top:32px;font-size:29px;font-weight:700;line-height:1.35">${ic('check', 34, '#2F8A57', 3)}<span>El QR de cada mesa sigue igual. La carta cambia al segundo.</span></div>
  </div>` }) };

/* ---------------- BANNERS ---------------- */
const splitMini = (s = 1) => `<div style="position:relative;width:${520 * s}px">
  <div style="margin:0 auto;width:${300 * s}px;background:#fff;border:1px solid #e6dfd3;border-radius:${20 * s}px;box-shadow:var(--shadow-float);padding:${18 * s}px ${22 * s}px;display:flex;align-items:center;gap:${14 * s}px">
    ${mark(44 * s)}<div><div style="font-size:${26 * s}px;font-weight:800;line-height:1.1">Mesa T4</div><div style="font-size:${19 * s}px;font-weight:700;color:#57534e;margin-top:${3 * s}px">Pedido por QR</div></div>
  </div>
  <svg width="${520 * s}" height="${80 * s}" viewBox="0 0 520 80" style="display:block"><path d="M260 0C260 42 120 34 120 80" stroke="#D97706" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M260 0C260 42 400 34 400 80" stroke="#8B5CF6" stroke-width="4.5" fill="none" stroke-linecap="round"/></svg>
  <div style="display:flex;gap:${40 * s}px">
    <div style="flex:1;background:#fff;border:1px solid #e6dfd3;border-top:${5 * s}px solid #D97706;border-radius:${18 * s}px;box-shadow:var(--shadow-card);padding:${18 * s}px;display:flex;align-items:center;justify-content:center;gap:${12 * s}px;font-size:${26 * s}px;font-weight:800">${ic('cloche', 34 * s, '#D97706', 2.4)}Cocina</div>
    <div style="flex:1;background:#fff;border:1px solid #e6dfd3;border-top:${5 * s}px solid #6D28D9;border-radius:${18 * s}px;box-shadow:var(--shadow-card);padding:${18 * s}px;display:flex;align-items:center;justify-content:center;gap:${12 * s}px;font-size:${26 * s}px;font-weight:800">${ic('glass', 34 * s, '#6D28D9', 2.4)}Barra</div>
  </div></div>`;

P.web = { w: 1920, h: 600, out: 'banners/banner_web_1920x600.png', html: () => `
  <div class="cv" style="width:1920px;height:600px;padding:0 140px;display:flex;align-items:center;justify-content:space-between">
    <div style="width:980px">
      ${logoL(50)}
      <div style="font-size:76px;font-weight:800;letter-spacing:-0.035em;line-height:1.04;margin-top:36px">Tu salón en orden,<br><span class="acc">sin comisiones.</span></div>
      <div style="font-size:28px;font-weight:500;color:#57534e;line-height:1.45;margin-top:22px;max-width:900px">Pedidos por QR con el 4G del cliente, comanda directa a Cocina y Barra, y mozos coordinados sin celular en el salón.</div>
      <div style="display:flex;gap:14px;margin-top:34px;align-items:center">
        <span class="chip solid" style="font-size:24px;padding:12px 22px">${ic('percent', 24, '#fff', 2.6)}0% comisión</span>
        <span class="chip ok" style="font-size:24px;padding:12px 22px">${ic('signal', 24, '#2F8A57', 2.8)}4G sin Wi-Fi</span>
        <span style="font-size:24px;font-weight:700;color:#57534e;margin-left:16px;display:flex;align-items:center;gap:10px">${ic('chat', 28, '#D9412B')}${PHONE}</span>
      </div>
    </div>
    <div style="padding-right:20px">${splitMini(1.12)}</div>
  </div>` };

P.d728 = { w: 728, h: 90, out: 'banners/banner_display_728x90.png', html: () => `
  <div class="cv" style="width:728px;height:90px;padding:0 16px 0 18px;display:flex;align-items:center;gap:14px;border:1px solid #e6dfd3">
    ${mark(52)}
    <div style="flex:1;min-width:0">
      <div style="font-size:21px;font-weight:800;letter-spacing:-0.015em;line-height:1.15;white-space:nowrap">Pedidos por QR directo a Cocina y Barra</div>
      <div style="display:flex;gap:8px;margin-top:7px">
        <span style="font-size:14px;font-weight:800;color:#D9412B;background:#fceae6;padding:4px 10px;border-radius:99px">0% comisión</span>
        <span style="font-size:14px;font-weight:800;color:#2F8A57;background:#e3f3ea;padding:4px 10px;border-radius:99px">4G sin Wi-Fi</span>
      </div>
    </div>
    <div class="btn" style="height:50px;padding:0 20px;font-size:17px;border-radius:10px">Pedí tu demo ${ic('arrow', 18, '#fff', 2.8)}</div>
  </div>` };

P.d300 = { w: 300, h: 250, out: 'banners/banner_display_300x250.png', html: () => `
  <div class="cv" style="width:300px;height:250px;padding:20px 20px 18px;display:flex;flex-direction:column;border:1px solid #e6dfd3">
    <div style="display:flex;justify-content:space-between;align-items:center">${logoL(28)}<span style="font-size:12px;font-weight:800;color:#D9412B;background:#fceae6;padding:4px 9px;border-radius:99px">0% comisión</span></div>
    <div style="font-size:27px;font-weight:800;letter-spacing:-0.025em;line-height:1.1;margin-top:18px">Cobrá cada mesa en <span class="acc">1 solo viaje.</span></div>
    <div style="font-size:14px;font-weight:600;color:#57534e;margin-top:9px;line-height:1.35">La mesa pide la cuenta por QR con pago y propina elegidos.</div>
    <div class="btn" style="margin-top:auto;height:42px;font-size:16px;border-radius:10px">Pedí tu demo ${ic('arrow', 17, '#fff', 2.8)}</div>
  </div>` };

P.lic = { w: 1584, h: 396, out: 'banners/linkedin_portada_1584x396.png', html: () => `
  <div class="cv dark" style="width:1584px;height:396px">
    <svg width="1584" height="396" style="position:absolute;inset:0"><defs><pattern id="g" width="44" height="44" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="2" fill="#38322e"/></pattern></defs><rect width="520" height="396" fill="url(#g)"/></svg>
    <div style="position:absolute;left:560px;top:0;bottom:0;right:96px;display:flex;align-items:center;justify-content:space-between">
      <div style="width:640px">
        ${logoD(40)}
        <div style="font-size:54px;font-weight:800;letter-spacing:-0.03em;line-height:1.08;margin-top:24px">Calma operativa<br>para tu salón.</div>
        <div style="font-size:24px;font-weight:600;color:rgba(250,247,242,.74);margin-top:16px;line-height:1.4;white-space:nowrap">QR con 4G · Cocina y Barra · Mozos sin celular</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;align-items:flex-start">
        <span class="chip solid" style="font-size:24px;padding:12px 22px">${ic('percent', 24, '#fff', 2.6)}0% comisión</span>
        <span class="chip dk" style="font-size:24px;padding:12px 22px">${ic('signal', 24, '#2F8A57', 2.8)}4G sin Wi-Fi</span>
        <span class="chip dk" style="font-size:24px;padding:12px 22px">${ic('screen', 24, '#D97706', 2.4)}Estación de Pase</span>
      </div>
    </div>
  </div>` };

P.lip = { w: 1200, h: 627, out: 'banners/linkedin_post_1200x627.png', html: () => `
  <div class="cv" style="width:1200px;height:627px;padding:56px 64px;display:flex;gap:48px">
    <div style="flex:1;display:flex;flex-direction:column;align-items:flex-start">
      ${logoL(42)}
      <span class="chip" style="margin-top:34px;align-self:flex-start;font-size:21px">Caso restaurante tipo · 25 mesas</span>
      <div style="font-size:50px;font-weight:800;letter-spacing:-0.03em;line-height:1.08;margin-top:20px">El abono se paga<br>con <span class="acc">2 mesas extra</span> por mes.</div>
      <div style="font-size:23px;font-weight:600;color:#57534e;line-height:1.45;margin-top:18px">Plan Salón USD 65/mes, sin comisión sobre ventas.<br>Más rotación, más rondas y menos errores.</div>
      <div style="margin-top:auto;display:flex;gap:26px;font-size:21px;font-weight:700;color:#57534e"><span style="display:flex;align-items:center;gap:10px">${ic('chat', 24, '#D9412B')}${PHONE}</span><span style="display:flex;align-items:center;gap:10px">${ic('mail', 24, '#D9412B')}${MAIL}</span></div>
    </div>
    <div class="ink-card" style="width:380px;padding:40px 36px;display:flex;flex-direction:column;justify-content:center">
      <div style="font-size:22px;font-weight:700;color:rgba(250,247,242,.72)">Retorno estimado</div>
      <div style="font-size:150px;font-weight:800;letter-spacing:-0.05em;line-height:.95;margin-top:10px">37<span style="color:#D9412B">x</span></div>
      <div style="font-size:22px;font-weight:600;color:rgba(250,247,242,.72);margin-top:8px">sobre el abono mensual</div>
      <div style="height:1px;background:#38322e;margin:28px 0 22px"></div>
      <div style="font-size:36px;font-weight:800">+USD 2.409</div>
      <div style="font-size:21px;font-weight:600;color:rgba(250,247,242,.72);margin-top:4px">beneficio generado por mes</div>
    </div>
  </div>` };

P.mfeed = { w: 1080, h: 1080, out: 'banners/meta_ad_feed_1080x1080.png', html: () => `
  <div class="cv dark" style="width:1080px;height:1080px;padding:76px 84px">
    <div class="top">${logoD(50)}<span class="chip solid" style="font-size:24px;padding:11px 20px">${ic('percent', 24, '#fff', 2.6)}0% comisión</span></div>
    <div class="h1" style="font-size:84px;margin-top:48px">Mozos sin celular.<br><span class="hl">Salón sin caos.</span></div>
    <div style="font-size:30px;font-weight:500;color:rgba(250,247,242,.74);margin-top:22px;line-height:1.4">Cada mozo ve en el pase qué retirar y qué cobrar.</div>
    <div style="margin-top:36px">${passStation(912, 410)}</div>
    <div style="position:absolute;left:84px;right:84px;bottom:70px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:28px;font-weight:700;display:flex;align-items:center;gap:12px">${ic('chat', 32, '#D9412B')}${PHONE}</span>
      <div class="btn" style="height:72px;padding:0 34px;font-size:28px">Pedí tu demo ${ic('arrow', 28, '#fff', 2.8)}</div>
    </div>
  </div>` };

P.mstory = { w: 1080, h: 1920, out: 'banners/meta_ad_story_1080x1920.png', html: () => `
  <div class="cv" style="width:1080px;height:1920px;padding:0 84px">
    <div style="position:absolute;top:260px;left:84px;right:84px">
      <div style="display:flex;justify-content:space-between;align-items:center">${logoL(56)}<span class="chip solid" style="font-size:26px;padding:12px 22px">${ic('percent', 26, '#fff', 2.6)}0% comisión</span></div>
      <div class="kicker" style="margin-top:64px">${ic('shield', 28)}Piloto sin riesgo por 14 días</div>
      <div class="h1" style="font-size:96px;margin-top:30px">Probalo en<br>tu vereda <span class="acc">antes<br>de decidir.</span></div>
      <div style="display:flex;gap:46px;align-items:center;margin-top:70px">
        ${tentCard(390)}
        <div style="flex:1;display:flex;flex-direction:column;gap:30px">
          ${okRow('Carta cargada en 24 h', 31)}
          ${okRow('QR fijo por mesa', 31)}
          ${okRow('Sin apps ni Wi-Fi', 31)}
          ${okRow('Cocina y Barra separadas', 31)}
        </div>
      </div>
      <div class="ink-card" style="margin-top:72px;padding:38px 44px;display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:28px;font-weight:600;color:rgba(250,247,242,.72)">Escribinos por WhatsApp</div><div style="font-size:46px;font-weight:800;margin-top:6px;letter-spacing:-0.01em">${PHONE}</div></div>
        <div style="width:88px;height:88px;border-radius:50%;background:#D9412B;display:flex;align-items:center;justify-content:center">${ic('arrow', 44, '#fff', 3)}</div>
      </div>
    </div>
  </div>` };

const catRow = (name, price, meta, hot) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:34px 36px;border-radius:22px;${hot ? 'background:#fff;border:2.5px solid #D9412B;box-shadow:var(--shadow-float)' : 'background:#fff;border:1px solid #e6dfd3'}">
  <div><div style="display:flex;align-items:center;gap:14px;font-size:36px;font-weight:800">${name}${hot ? '<span class="chip solid" style="font-size:20px;padding:6px 14px">Más elegido</span>' : ''}</div><div style="font-size:25px;font-weight:600;color:#57534e;margin-top:6px">${meta}</div></div>
  <div style="text-align:right;white-space:nowrap"><span style="font-size:50px;font-weight:800;letter-spacing:-0.03em">${price}</span><span style="font-size:24px;font-weight:700;color:#57534e"> /mes</span></div></div>`;
P.wa = { w: 1080, h: 1080, out: 'banners/whatsapp_catalogo_1080x1080.png', html: () => `
  <div class="cv" style="width:1080px;height:1080px;padding:72px 84px">
    <div class="top">${logoL(52)}<span class="chip solid" style="font-size:24px;padding:11px 20px">${ic('percent', 24, '#fff', 2.6)}0% comisión</span></div>
    <div class="h2" style="margin-top:50px;font-size:70px">Planes SaleListo</div>
    <div style="font-size:29px;font-weight:600;color:#57534e;margin-top:14px">Todos incluyen QR con 4G, ruteo a Cocina y Barra<br>y Estación de Mozos en el pase.</div>
    <div style="display:flex;flex-direction:column;gap:18px;margin-top:44px">
      ${catRow('Barra / Café', 'USD 35', 'Hasta 12 mesas · 2 sectores')}
      ${catRow('Salón / Bistró', 'USD 65', 'Hasta 30 mesas · 5 sectores', 1)}
      ${catRow('Gran Salón', 'USD 110', 'Mesas y sectores ilimitados')}
    </div>
    <div style="position:absolute;left:84px;right:84px;bottom:64px;display:flex;justify-content:space-between;align-items:center;font-size:26px;font-weight:700;color:#57534e">
      <span>Precios de referencia, facturados en pesos.</span>
      <span style="display:flex;align-items:center;gap:10px;color:#1c1917">${ic('chat', 30, '#D9412B')}${PHONE}</span>
    </div>
  </div>` };

/* ---------------- CARRUSEL 03 · Cocina y Barra sin comandas perdidas ---------------- */
P.c3s1 = { w: 1080, h: 1350, out: 'posts/carrusel_03_cocina_y_barra/slide_01.png', html: () => slide({ n: 1, body: `
  <div style="margin-top:96px">
    <div class="kicker">${ic('route', 28)}Cocina y Barra en sintonía</div>
    <h1 class="h1" style="font-size:88px;margin-top:36px">Eliminá las <span class="acc">comandas perdidas</span> entre Salón, Cocina y Barra.</h1>
    <div class="card" style="margin-top:64px;padding:40px 44px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:64px;height:64px;border-radius:18px;background:#fceae6;display:flex;align-items:center;justify-content:center;position:relative">${ic('receipt', 34, '#D9412B', 2.2)}</div>
          <div><div style="font-size:28px;font-weight:800;color:#8a837c;text-decoration:line-through;text-decoration-color:#D9412B;text-decoration-thickness:3px">Papelitos y cantadas</div><div style="font-size:22px;font-weight:600;color:#8a837c;margin-top:2px">Cuello de botella en hora pico</div></div>
        </div>
        <span class="chip ok" style="font-size:24px;padding:10px 20px">${ic('check', 24, '#2F8A57', 3)}Ruteo en 0 seg</span>
      </div>
      <div style="height:1px;background:#e6dfd3;margin:30px 0"></div>
      <div style="display:flex;align-items:center;gap:22px">
        <div style="background:#faf7f2;border:1.5px solid #e6dfd3;border-radius:18px;padding:20px 24px;display:flex;align-items:center;gap:14px;flex:none">
          ${mark(44)}
          <div><div style="font-size:28px;font-weight:800;line-height:1.1">Mesa T6</div><div style="font-size:21px;font-weight:700;color:#57534e;margin-top:4px">QR · 4G</div></div>
        </div>
        <svg width="96" height="128" viewBox="0 0 96 128" style="flex:none"><path d="M4 64 C48 64 44 26 92 26" stroke="#D97706" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M4 64 C48 64 44 102 92 102" stroke="#6D28D9" stroke-width="4.5" fill="none" stroke-linecap="round"/><circle cx="6" cy="64" r="6" fill="#D9412B"/></svg>
        <div style="flex:1;display:flex;flex-direction:column;gap:14px">
          <div style="background:#fef1dc;border-left:6px solid #D97706;border-radius:14px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between"><span style="display:flex;align-items:center;gap:12px;font-size:27px;font-weight:800">${ic('cloche', 30, '#D97706', 2.4)}Cocina</span><span style="font-size:22px;font-weight:700;color:#57534e">Platos + notas</span></div>
          <div style="background:#efeafe;border-left:6px solid #6D28D9;border-radius:14px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between"><span style="display:flex;align-items:center;gap:12px;font-size:27px;font-weight:800">${ic('glass', 30, '#6D28D9', 2.4)}Barra</span><span style="font-size:22px;font-weight:700;color:#57534e">Tragos + pintas</span></div>
        </div>
      </div>
    </div>
  </div>` }) };

const painRow = (n, t, s) => `<div class="card-s" style="display:grid;grid-template-columns:68px 1fr 42px;gap:26px;align-items:center;padding:24px 30px">
  <div style="width:68px;height:68px;border-radius:50%;background:#fceae6;color:#D9412B;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800">${pad(n)}</div>
  <div><div style="font-size:32px;font-weight:800;letter-spacing:-0.01em;line-height:1.2">${t}</div><div style="font-size:25px;font-weight:500;color:#57534e;margin-top:6px;line-height:1.3">${s}</div></div>
  ${ic('x', 34, '#D9412B', 2.6)}</div>`;

P.c3s2 = { w: 1080, h: 1350, out: 'posts/carrusel_03_cocina_y_barra/slide_02.png', html: () => slide({ n: 2, body: `
  <div style="margin-top:68px">
    <h2 class="h2">El papel manchado y las<br><span class="acc">“cantadas” salen caros.</span></h2>
    <p class="lead" style="margin-top:20px">Lo que frena el despacho cada viernes a la noche:</p>
    <div style="display:flex;flex-direction:column;gap:16px;margin-top:36px">
      ${painRow(1, 'Letra apurada en salón ruidoso', '“Era sin cebolla” o “punto jugoso” que nadie leyó.')}
      ${painRow(2, 'Bebidas trabadas atrás de los platos', 'Dos pintas esperan 15 min por una misma comanda.')}
      ${painRow(3, 'Viajes al pase a preguntar “¿ya sale?”', 'El mozo camina en vano y descuida su sector.')}
      ${painRow(4, 'Platos devueltos e invitaciones', 'Desperdicio directo de mercadería y mal momento.')}
    </div>
    <div class="ink-card" style="margin-top:26px;padding:28px 36px;display:flex;align-items:center;gap:22px">
      ${ic('receipt', 44, '#D9412B', 2.2)}
      <div style="font-size:29px;font-weight:600;color:rgba(250,247,242,.82);line-height:1.3"><b style="color:#faf7f2;font-weight:800;font-size:36px">1,5% a 3%</b> de tu venta mensual se va<br>en mermas y cortesías evitables.</div>
    </div>
  </div>` }) };

const noteItem = (q, name, note, noteBg, noteFg) => `<div style="display:flex;flex-direction:column;gap:6px;padding:10px 0;border-bottom:1px solid #f3eee6">
  <div style="display:flex;gap:12px;font-size:26px;font-weight:700;color:#1c1917"><b style="color:#8a837c;width:32px">${q}x</b>${name}</div>
  ${note ? `<div><span style="display:inline-block;margin-left:44px;font-size:20px;font-weight:700;padding:4px 12px;border-radius:999px;background:${noteBg};color:${noteFg}">${note}</span></div>` : ''}
</div>`;

P.c3s3 = { w: 1080, h: 1350, out: 'posts/carrusel_03_cocina_y_barra/slide_03.png', html: () => slide({ theme: 'dark', n: 3, body: `
  <div style="margin-top:64px">
    <h2 class="h2">Se separa sola en<br><span class="hl">0 segundos.</span></h2>
    <p class="lead" style="margin-top:20px">El cliente elige y escribe sus aclaraciones en el QR. Cada estación ve únicamente lo que prepara.</p>
    <div style="margin:36px auto 0;width:720px;background:#fff;border-radius:22px;padding:22px 28px;color:#1c1917;box-shadow:0 24px 50px -16px rgba(0,0,0,.6)">
      <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #e6dfd3;margin-bottom:12px">
        <span style="display:flex;align-items:center;gap:12px;font-size:27px;font-weight:800">${mark(34)}Mesa T6 · Confirmado</span>
        <span class="chip ok" style="font-size:20px;padding:6px 14px">${ic('signal', 20, '#2F8A57', 2.6)}4G directo</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;font-size:24px;font-weight:700">
        <div>1x Ojo de bife <span style="color:#D97706">(Sin TACC)</span></div>
        <div>2x Gin tonic <span style="color:#6D28D9">(Poco hielo)</span></div>
        <div>1x Papas rústicas</div>
        <div>1x Limonada menta</div>
      </div>
    </div>
    <svg width="912" height="84" viewBox="0 0 912 84" style="display:block"><path d="M456 0 C456 44 228 36 228 84" stroke="#D97706" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M456 0 C456 44 684 36 684 84" stroke="#8B5CF6" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="456" cy="6" r="9" fill="#D9412B"/></svg>
    <div style="display:flex;gap:28px">
      ${stationCard('Cocina', '#D97706', '#fef1dc', 'cloche', noteItem(1, 'Ojo de bife', 'Sin TACC · Jugoso', '#fef1dc', '#b45309') + noteItem(1, 'Papas rústicas', '', '', ''))}
      ${stationCard('Barra', '#6D28D9', '#efeafe', 'glass', noteItem(2, 'Gin tonic', 'Poco hielo · Limón', '#efeafe', '#6D28D9') + noteItem(1, 'Limonada menta', '', '', ''))}
    </div>
  </div>` }) };

const slaRow = (dotColor, bgSoft, badge, desc) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 24px;border-radius:18px;background:${bgSoft};border:1px solid rgba(28,25,23,.06)">
  <div style="display:flex;align-items:center;gap:14px;white-space:nowrap">
    <span style="width:18px;height:18px;border-radius:50%;background:${dotColor};flex:none"></span>
    <span style="font-size:28px;font-weight:800;color:#1c1917">${badge}</span>
  </div>
  <span style="font-size:23px;font-weight:600;color:#57534e;white-space:nowrap">${desc}</span>
</div>`;

P.c3s4 = { w: 1080, h: 1350, out: 'posts/carrusel_03_cocina_y_barra/slide_04.png', html: () => slide({ n: 4, body: `
  <div style="margin-top:66px">
    <div class="kicker">${ic('clock', 28)}Control en vivo del despacho</div>
    <h2 class="h2" style="margin-top:30px">Semáforo SLA y<br><span class="acc">agotados en 1 clic.</span></h2>
    <div class="card" style="margin-top:38px;padding:32px 36px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:27px;font-weight:800">Tiempo desde que pidió la mesa</span>
        <span class="chip" style="font-size:20px;padding:6px 14px">Cocina · Barra · Pase</span>
      </div>
      ${slaRow('#2F8A57', '#e3f3ea', 'En tiempo · 4 min', 'Menos de 8 min')}
      ${slaRow('#D97706', '#fef1dc', 'Atención · 11 min', 'De 8 a 14 min · Contorno ámbar')}
      ${slaRow('#D9412B', '#fceae6', 'Demorado · 16 min', '15 min o más · Aviso sonoro')}
    </div>
    <div class="ink-card" style="margin-top:26px;padding:30px 36px;display:flex;align-items:center;justify-content:space-between;gap:24px">
      <div>
        <div style="font-size:29px;font-weight:800;color:#faf7f2">¿Se acabó un barril o un postre?</div>
        <div style="font-size:24px;font-weight:500;color:rgba(250,247,242,.76);margin-top:6px;line-height:1.35">Lo pausás en 1 toque y desaparece al segundo de todos los QR del salón.</div>
      </div>
      <div style="background:#26221f;border:1.5px solid #38322e;border-radius:16px;padding:14px 20px;display:flex;flex-direction:column;align-items:center;gap:8px;flex:none">
        <span style="font-size:21px;font-weight:800;color:#fff;background:#D9412B;padding:6px 16px;border-radius:999px;white-space:nowrap">Agotado</span>
        <span style="font-size:19px;font-weight:600;color:rgba(250,247,242,.65);white-space:nowrap">0 viajes de disculpa</span>
      </div>
    </div>
  </div>` }) };

P.c3s5 = { w: 1080, h: 1350, out: 'posts/carrusel_03_cocina_y_barra/slide_05.png', html: () => slide({ n: 5, last: true, body: `
  <div style="margin-top:68px">
    <div class="kicker">${ic('shield', 28)}Piloto sin riesgo · 0% comisión</div>
    <h2 class="h2" style="margin-top:34px">Ordená Cocina y Barra<br><span class="acc">en 14 días de prueba.</span></h2>
    <p class="lead" style="margin-top:22px">Arrancamos por tu vereda, patio o terraza sin frenar el salón principal.</p>
    <div style="display:flex;gap:18px;margin-top:44px">
      ${pilotStep('48 h', 'Carta y estaciones configuradas')}
      ${pilotStep('0%', 'Comisión sobre tus ventas')}
      ${pilotStep('2 findes', 'Medimos tiempos y rondas')}
    </div>
    <div style="margin-top:40px">${ctaCard('Pedí tu piloto de 14 días<br>por WhatsApp o correo.')}</div>
  </div>` }) };

window.PIECES = P;
