// Reel 07 · Reseñas 5 estrellas (puntaje y caja del empresario gastronómico)
// E1: inversión (Cocina top + Local impecable) -> reseña de 1 estrella que apaga todo -> "20 min esperando" -> Mesas que no vuelven
// E2: QR de mesa -> Pide desde la mesa -> Cierra la cuenta -> cuenta regresiva 20 -> 0 min de espera
// E3: 5 estrellas en cascada + puntaje 4.1 -> 4.9 -> barras ascendentes -> + Mesas · + Facturación
(function () {
  const P = {};
  const OKS = '#e3f3ea', OKL = '#bfe3cc', ACS = '#fceae6', ACL = '#f5c9bf', TX2 = '#8b8178', GOLD = '#f4b53f', GRAYF = '#f3efe9';
  const f2 = v => v.toFixed(2);
  const rot = (g, x, y, s, r, o) => { g.setAttribute('transform', `translate(${f2(x)} ${f2(y)}) rotate(${f2(r)}) scale(${s.toFixed(4)})`); op(g, o); };
  // escala alrededor de un centro (cx, cy) + desplazamiento vertical
  const zoom = (g, cx, cy, s, dy, o) => { g.setAttribute('transform', `translate(${f2(cx)} ${f2(cy + dy)}) scale(${s.toFixed(4)}) translate(${f2(-cx)} ${f2(-cy)})`); op(g, o); };
  const star = (R, k = 0.47) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * k : R; d += (i ? 'L' : 'M') + f2(r * Math.cos(a)) + ' ' + f2(r * Math.sin(a)) + ' '; } return d + 'Z'; };
  const spark = s => `M0 ${-s} Q0 0 ${s} 0 Q0 0 0 ${s} Q0 0 ${-s} 0 Q0 0 0 ${-s} Z`;
  const pill = (p, label, fs, h, icon, c) => `<g id="${p}">
      <rect id="${p}r" x="-100" y="${-h / 2}" width="200" height="${h}" rx="${h / 2}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${c.sw || 3}"/>
      <g id="${p}i">${icon}</g>
      <text id="${p}t" x="0" y="${f2(fs * 0.35)}" font-size="${fs}" font-weight="800" fill="${c.text}" letter-spacing="-0.4">${label}</text>
    </g>`;
  const lay = (p, iconW, gap, pad) => {
    const tw = $(p + 't').getComputedTextLength();
    const w = pad * 2 + (iconW ? iconW + gap : 0) + tw, x0 = -w / 2;
    const r = $(p + 'r'); r.setAttribute('x', f2(x0)); r.setAttribute('width', f2(w));
    $(p + 'i').setAttribute('transform', `translate(${f2(x0 + pad + iconW / 2)} 0)`);
    $(p + 't').setAttribute('x', f2(x0 + pad + (iconW ? iconW + gap : 0)));
    return w;
  };
  const strokeG = (id, c, inner, sw = 3.5) => `<g id="${id}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
  const IC = {
    chef: `<path d="M-9 4 C-16 3 -17 -7 -10 -8 C-9 -15 -1 -17 3 -12 C7 -16 15 -13 13 -6 C19 -4 17 5 9 4 Z"/><path d="M-9 4 V13 H9 V4 M-9 8.5 H9"/>`,
    store: `<path d="M-14 -5 L-11 -14 H11 L14 -5"/><path d="M-14 -5 Q-10.5 0 -7 -5 Q-3.5 0 0 -5 Q3.5 0 7 -5 Q10.5 0 14 -5"/><path d="M-11 -1 V14 H11 V-1 M-4 14 V7 H4 V14"/>`,
    down: `<path d="M-12 -7 L-4 1 L1 -4 L12 7"/><path d="M4.5 7 H12 V-0.5"/>`,
    pin: `<path d="M0 16 C-8 7 -12 2 -12 -3 A12 12 0 0 1 12 -3 C12 2 8 7 0 16 Z" fill="${ACS}"/><circle cx="0" cy="-3" r="4"/>`,
    cloche: `<path d="M-17 6 A17 17 0 0 1 17 6 Z"/><path d="M-21 11.5 H21"/><path d="M0 -11 V-13.5"/><circle cx="0" cy="-16" r="2.6"/>`,
    card: `<rect x="-16" y="-11" width="32" height="22" rx="4"/><path d="M-16 -4 H16 M-10 5 H-3"/>`,
  };

  // ---------- geometria
  const TBX = [200, 280, 360, 440, 520], PY1 = 614;            // E1: mesas -> pildora
  const STX = k => 124 + k * 64, STY = 282;                       // E1: estrellas
  const ROWS = [336, 450], CKX = 618;                             // E2: filas
  const E3X = k => 360 + (k - 2) * 88, E3Y = 92;                  // E3: estrellas
  const BX = [120, 204, 288, 372, 456, 540], BH = [36, 50, 68, 92, 120, 154], H0 = [30, 36, 28, 34, 30, 34], BASE = 512;
  const hmix = (a, b, p) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * p).toString(16).padStart(2, '0')).join('');
  const BCOL = BX.map((_, k) => hmix(OKL, OK, 0.45 + 0.55 * k / 5));

  window.REELS.r07 = {
    build() {
      // ================= E1
      const badge = (p, label, icon) => pill(p, label, 30, 62, strokeG(p + 's', OK, icon), { fill: OKS, stroke: OKL, text: OK, sw: 2.5 });
      const sparks1 = [0, 1, 2, 3].map(k => `<path id="e1sp${k}" d="${spark(11)}" fill="${GOLD}"/>`).join('');
      const tables = TBX.map((x, k) => `<g id="e1tb${k}">
          <g id="e1tc${k}" fill="${OK}"><rect x="-9" y="-31" width="18" height="10" rx="5"/><rect x="-9" y="21" width="18" height="10" rx="5"/>
          <rect x="-31" y="-9" width="10" height="18" rx="5"/><rect x="21" y="-9" width="10" height="18" rx="5"/></g>
          <circle id="e1tt${k}" r="16" fill="#ffffff" stroke="${OK}" stroke-width="3.5"/>
        </g>`).join('');
      const C1 = 2 * Math.PI * 17; P.C1 = C1;
      const e1 = `${badge('e1b0', 'Cocina top', IC.chef)}${badge('e1b1', 'Local impecable', IC.store)}${sparks1}
        <g id="e1rev">
          <rect x="48" y="136" width="624" height="388" rx="30" fill="${CREAM}" stroke="${LINE}" stroke-width="3"/>
          <circle cx="104" cy="192" r="28" fill="${MUTE}"/><g transform="translate(104 193)">${ICON.person}</g>
          <text x="150" y="189" font-size="30" font-weight="800" fill="${INK}" letter-spacing="-0.6">Reseña publicada</text>
          <text x="150" y="221" font-size="22" font-weight="700" fill="${TX2}">Cliente · hace 1 min</text>
          <g transform="translate(622 194)">${strokeG('e1pin', ACC, IC.pin, 3.5)}</g>
          <rect id="e1bar" x="72" y="240" width="576" height="84" rx="22" fill="#ffffff" stroke="${LINE}" stroke-width="2.5"/>
          <circle id="e1halo" cx="${STX(0)}" cy="${STY}" r="30" fill="none" stroke="${ACC}" stroke-width="4"/>
          ${[0, 1, 2, 3, 4].map(k => `<path id="e1st${k}" d="${star(25)}" transform="translate(${STX(k)} ${STY})" fill="#ffffff" stroke="${MUTE}" stroke-width="3.5" stroke-linejoin="round"/>`).join('')}
          <path id="e1red" d="${star(25)}" fill="${ACC}" stroke="${ACC}" stroke-width="3.5" stroke-linejoin="round"/>
          <text id="e1val" x="622" y="304" text-anchor="end" font-size="60" font-weight="800" fill="${ACC}" letter-spacing="-1.5">1.0</text>
          <g id="e1sk0"><circle cx="106" cy="368" r="18" fill="#efe9e0"/><rect x="140" y="356" width="300" height="24" rx="12" fill="#efe9e0"/></g>
          <g id="e1sk1"><circle cx="114" cy="452" r="19" fill="#efe9e0"/><rect x="148" y="440" width="360" height="24" rx="12" fill="#efe9e0"/></g>
          <g id="e1q1">
            <circle cx="106" cy="368" r="18" fill="#eee8df"/><g transform="translate(106 368)">${ICON.check(20, 3.5, TX2)}</g>
            <text x="140" y="379" font-size="31" font-weight="800" fill="${TX2}" letter-spacing="-0.5">“Comida excelente...”</text>
          </g>
          <g id="e1q2">
            <rect x="72" y="410" width="576" height="84" rx="22" fill="${ACS}" stroke="${ACL}" stroke-width="2.5"/>
            <circle cx="114" cy="452" r="19" fill="${ACC}"/><path d="M107.5 445.5 L120.5 458.5 M120.5 445.5 L107.5 458.5" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
            <text x="148" y="463" font-size="31" font-weight="800" fill="${ACC}" letter-spacing="-0.5">“...20 min esperando”</text>
            <g transform="translate(604 452)">
              <circle r="17" fill="#ffffff" stroke="${ACL}" stroke-width="4.5"/>
              <circle id="e1ring" r="17" fill="none" stroke="${ACC}" stroke-width="4.5" stroke-linecap="round" transform="rotate(-90)" stroke-dasharray="${f2(C1)} ${f2(C1)}" stroke-dashoffset="${f2(C1)}"/>
              <path id="e1hand" d="M0 0 V-9" stroke="${ACC}" stroke-width="3.5" stroke-linecap="round"/>
              <circle r="3" fill="${ACC}"/>
            </g>
          </g>
        </g>
        ${tables}
        ${pill('e1p', 'Mesas que no vuelven', 36, 88, `<circle r="23" fill="#ffffff"/>${strokeG('e1pd', ACC, IC.down, 3.8)}`, { fill: ACC, stroke: ACC, text: '#ffffff' })}`;

      // ================= E2
      const row = (p, cy, icon, label) => `<g id="${p}">
          <rect id="${p}r" x="48" y="${cy - 46}" width="624" height="92" rx="26" fill="#ffffff" stroke="${LINE}" stroke-width="3"/>
          <circle id="${p}ic" cx="108" cy="${cy}" r="31" fill="${CREAM}"/>
          <g transform="translate(108 ${cy})">${strokeG(p + 'is', INK, icon, 3.5)}</g>
          <text id="${p}t" x="160" y="${cy + 13}" font-size="36" font-weight="800" fill="${INK}" letter-spacing="-0.7">${label}</text>
          <circle id="${p}c" cx="${CKX}" cy="${cy}" r="25" fill="#ffffff" stroke="${MUTE}" stroke-width="3" stroke-dasharray="7 7"/>
          <path id="${p}k" d="M${CKX - 11} ${cy + 1} L${CKX - 3.5} ${cy + 8.5} L${CKX + 11.5} ${cy - 7.5}" fill="none" stroke="#ffffff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
        </g>`;
      const clock2 = `<g id="e2pis" fill="none" stroke="${ACC}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round">
          <circle r="15" cy="2"/><path d="M-4.5 -18 H4.5 M0 -18 V-13"/><path id="e2hand" d="M0 0 V-8" transform="translate(0 2)"/></g>`;
      const e2 = `<g id="e2qr">
          <rect id="e2qrr" x="0" y="0" width="228" height="228" rx="28" fill="#ffffff" stroke="${LINE}" stroke-width="3"/>
          <g transform="translate(18 18)">${fakeQR(25, 192, 31)}</g>
          <rect x="84" y="84" width="60" height="60" rx="14" fill="#ffffff"/>
          <image href="${ASSETS}mark.svg" x="90" y="90" width="48" height="48"/>
          <g id="e2scan"><rect x="8" y="-13" width="212" height="26" rx="13" fill="${ACC}" opacity="0.16"/><rect x="8" y="-3" width="212" height="6" rx="3" fill="${ACC}"/></g>
        </g>
        ${row('e2r0', ROWS[0], IC.cloche, 'Pide desde la mesa')}
        ${row('e2r1', ROWS[1], IC.card, 'Cierra la cuenta')}
        <rect id="e2h" x="-100" y="-48" width="200" height="96" rx="48" fill="none" stroke="${OK}" stroke-width="4" transform="translate(360 598)"/>
        ${pill('e2p', '20 min de espera', 40, 96, clock2, { fill: ACS, stroke: ACL, text: ACC })}`;

      // ================= E3
      const C3 = []; BX.forEach((x, k) => C3.push([x, BASE - BH[k] - 24]));
      const tip = [604, 302];
      const lnD = 'M' + C3.map(p => p.join(' ')).join(' L') + ` L${tip.join(' ')}`;
      const e3 = `<g id="e3top">
          <rect x="48" y="28" width="624" height="260" rx="30" fill="${CREAM}" stroke="${LINE}" stroke-width="3"/>
          ${[0, 1, 2, 3, 4].map(k => `<path d="${star(34)}" transform="translate(${E3X(k)} ${E3Y})" fill="#ffffff" stroke="${MUTE}" stroke-width="3.5" stroke-linejoin="round"/>`).join('')}
          ${[0, 1, 2, 3, 4].map(k => `<path id="e3g${k}" d="${star(34)}" fill="${GOLD}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`).join('')}
          <g id="e3cnt">
            <text id="e3val" x="404" y="252" text-anchor="end" font-size="112" font-weight="800" fill="${INK}" letter-spacing="-3">4.1</text>
            <path id="e3vs" d="${star(30)}" transform="translate(452 212)" fill="#ffffff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
          </g>
          ${[0, 1, 2, 3].map(k => `<path id="e3sp${k}" d="${spark(12)}" fill="${GOLD}"/>`).join('')}
        </g>
        <g id="e3chart">
          <path d="M72 ${BASE} H648" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>
          ${BX.map((x, k) => `<rect id="e3b${k}" x="${x - 26}" y="${BASE - 14}" width="52" height="14" rx="12" fill="${MUTE}"/>`).join('')}
          <path id="e3ln" d="${lnD}" fill="none" stroke="${OK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
          <path id="e3ah" d="M-18 -13 L0 0 L-18 13" fill="none" stroke="${OK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        ${pill('e3p', '+ Mesas · + Facturación', 34, 88, `<circle id="e3pc" r="22" fill="${MUTE}"/><path id="e3pk" d="M-10 1 L-3 8 L11 -7" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`, { fill: '#ffffff', stroke: LINE, text: INK })}`;
      P.tip = tip; P.tipA = Math.atan2(tip[1] - C3[5][1], tip[0] - C3[5][0]) * 180 / Math.PI;
      return { E1: e1, E2: e2, E3: e3 };
    },
    init() {
      P.k0 = drawable('e2r0k'); P.k1 = drawable('e2r1k');
      P.ln = drawable('e3ln'); P.pk = drawable('e3pk');
    },
    layout() {
      const w0 = lay('e1b0', 34, 10, 22), w1 = lay('e1b1', 34, 10, 22), gp = 18;
      P.bx = [360 - (w0 + gp + w1) / 2 + w0 / 2, 360 + (w0 + gp + w1) / 2 - w1 / 2];
      P.bw = [w0, w1];
      P.spk = [[P.bx[0] - w0 / 2 + 6, 50], [P.bx[0] + w0 / 2 - 14, 108], [P.bx[1] + w1 / 2 - 8, 48], [P.bx[1] - w1 / 2 + 18, 110]];
      lay('e1p', 46, 16, 24);
      const w3 = lay('e3p', 44, 14, 24); P.e3s = Math.min(1, 640 / w3);
      P.laid = true;
    },
    render(t) {
      if (!P.laid) this.layout();
      // ================= E1: inversión -> 1 estrella -> 20 min -> mesas que no vuelven
      {
        const es = M.estrella, ep = M.espanta, v = M.veinte;
        const off = A(t, es - 0.04, 0.42);
        // badges de inversión: brillan con "fortunas", se apagan con la estrella
        [0, 1].forEach(k => {
          const p = 'e1b' + k;
          const glow = Math.sin(Math.PI * lin(t, M.fortunas - 0.10 + k * 0.16, M.fortunas + 0.40 + k * 0.16));
          place($(p), P.bx[k], 78 + 3 * off, (1 + 0.06 * glow) * (1 - 0.03 * off), 1 - 0.42 * off);
          $(p + 'r').setAttribute('fill', mix(OKS, GRAYF, off));
          $(p + 'r').setAttribute('stroke', mix(OKL, LINE, off));
          $(p + 't').setAttribute('fill', mix(OK, TX2, off));
          $(p + 's').setAttribute('stroke', mix(OK, TX2, off));
        });
        P.spk.forEach((s, k) => {
          const w = Math.pow(Math.abs(Math.sin(Math.PI * (t * 1.15 + k * 0.29))), 2);
          const boost = Math.sin(Math.PI * lin(t, M.fortunas - 0.05 + k * 0.06, M.fortunas + 0.55 + k * 0.06));
          const a = Math.max(w, boost) * (1 - A(t, es - 0.08, 0.25));
          rot($('e1sp' + k), s[0], s[1], 0.35 + 0.75 * a, 45 * a + k * 10, a);
        });
        // tarjeta de reseña: impacto de la estrella roja
        const sh = lin(t, es + 0.22, es + 0.62);
        const dx = (sh > 0 && sh < 1) ? 5 * Math.sin(sh * Math.PI * 8) * (1 - sh) : 0;
        $('e1rev').setAttribute('transform', `translate(${f2(dx)} 0)`);
        $('e1bar').setAttribute('fill', mix('#ffffff', ACS, off));
        $('e1bar').setAttribute('stroke', mix(LINE, ACL, off));
        for (let k = 1; k < 5; k++) $('e1st' + k).setAttribute('stroke', mix(MUTE, ACL, off));
        const pd = A(t, es - 0.06, 0.34), land = Math.sin(Math.PI * lin(t, es + 0.22, es + 0.56));
        place($('e1red'), STX(0), STY - (1 - pd) * 54, (1 + 0.5 * (1 - pd)) * (1 + 0.14 * land), pd);
        const hl = lin(t, es + 0.22, es + 1.0), halo = $('e1halo');
        halo.setAttribute('r', f2(30 + 34 * ease(hl))); op(halo, (hl > 0 && hl < 1) ? 0.6 * (1 - hl) : 0);
        const pv = A(t, es + 0.08, 0.40);
        $('e1val').setAttribute('transform', `translate(0 ${f2((1 - pv) * 12)})`); op($('e1val'), pv);
        const q1 = A(t, es + 0.55, IN_D); vis($('e1q1'), q1, (1 - q1) * 12);
        // esqueleto de texto (carga) hasta que aparece la cita; respira suave
        const skp = 0.75 + 0.25 * Math.sin(2 * Math.PI * t * 0.8);
        op($('e1sk0'), skp * (1 - A(t, es + 0.45, 0.30)));
        op($('e1sk1'), skp * (1 - A(t, v - 0.24, 0.30)));
        const q2 = A(t, v - 0.14, IN_D), qb = Math.sin(Math.PI * lin(t, v + 0.12, v + 0.50));
        zoom($('e1q2'), 360, 452, 0.97 + 0.03 * q2 + 0.025 * qb, (1 - q2) * 12, q2);
        const pr = inout(lin(t, v - 0.05, S.E1.end - 0.25));
        $('e1ring').setAttribute('stroke-dashoffset', f2(P.C1 * (1 - pr)));
        $('e1hand').setAttribute('transform', `rotate(${f2(720 * pr)})`);
        // mesas llenas que se vacían con "espanta"
        TBX.forEach((x, k) => {
          const tk = ep - 0.10 + k * 0.06;
          const gr = A(t, tk - 0.08, 0.22), gone = A(t, tk, 0.34);
          $('e1tc' + k).setAttribute('fill', mix(OK, MUTE, gr));
          $('e1tt' + k).setAttribute('stroke', mix(OK, MUTE, gr));
          place($('e1tb' + k), x, PY1 + 24 * gone, 1 - 0.25 * gone, 1 - gone);
        });
        const pp = A(t, ep + 0.24, IN_D), pul = Math.sin(Math.PI * lin(t, v, v + 0.42));
        place($('e1p'), 360, PY1 + (1 - pp) * 14, (0.94 + 0.06 * pp) * (1 + 0.04 * pul), pp);
      }
      // ================= E2: QR -> pide -> cierra -> 0 min de espera
      {
        const s0 = S.E2.start;
        const pq = A(t, s0 + 0.04, IN_D);
        $('e2qr').setAttribute('transform', `translate(246 ${f2(30 + (1 - pq) * 12)})`); op($('e2qr'), pq);
        const q = lin(t, M.qr - 0.30, M.qr + 0.75);
        $('e2scan').setAttribute('transform', `translate(0 ${f2(22 + 184 * inout(q))})`);
        op($('e2scan'), (q > 0 && q < 1) ? Math.min(1, q / 0.14, (1 - q) / 0.14) : 0);
        $('e2qrr').setAttribute('stroke', mix(LINE, OK, A(t, M.qr + 0.55, 0.30)));
        [M.pide, M.cierra].forEach((m, k) => {
          const p = 'e2r' + k, cy = ROWS[k];
          const pin = A(t, s0 + 0.20 + k * 0.10, IN_D), on = A(t, m - 0.08, 0.32);
          const bump = Math.sin(Math.PI * lin(t, m - 0.08, m + 0.30));
          zoom($(p), 360, cy, 1 + 0.03 * bump, (1 - pin) * 14, pin);
          $(p + 'r').setAttribute('fill', mix('#ffffff', OKS, on));
          $(p + 'r').setAttribute('stroke', mix(LINE, OK, on));
          $(p + 'ic').setAttribute('fill', mix(CREAM, OK, on));
          $(p + 'is').setAttribute('stroke', mix(INK, '#ffffff', on));
          $(p + 'c').setAttribute('fill', mix('#ffffff', OK, on));
          $(p + 'c').setAttribute('stroke', mix(MUTE, OK, on));
          $(p + 'c').setAttribute('stroke-dasharray', on > 0.02 ? 'none' : '7 7');
          P['k' + k](A(t, m + 0.04, 0.34));
        });
        // cuenta regresiva 20 -> 0 min, de coral a verde protagonista
        const sg = M.segundo;
        const cd = inout(lin(t, M.pide - 0.10, sg - 0.06));
        const n = Math.round(20 * (1 - cd));
        $('e2pt').textContent = `${n} min de espera`;
        const w = lay('e2p', 36, 14, 30);
        const g = A(t, sg - 0.10, 0.30);
        $('e2pr').setAttribute('fill', mix(ACS, OK, g));
        $('e2pr').setAttribute('stroke', mix(ACL, OK, g));
        $('e2pt').setAttribute('fill', mix(ACC, '#ffffff', g));
        $('e2pis').setAttribute('stroke', mix(ACC, '#ffffff', g));
        $('e2hand').setAttribute('transform', `translate(0 2) rotate(${f2(-1080 * cd)})`);
        const pp = A(t, s0 + 0.40, IN_D), pul = Math.sin(Math.PI * lin(t, sg - 0.04, sg + 0.40));
        place($('e2p'), 360, 598 + (1 - pp) * 14, (0.94 + 0.06 * pp) * (1 + 0.06 * pul), pp);
        const hh = lin(t, sg + 0.02, sg + 0.85), d = 26 * ease(hh), eh = $('e2h');
        eh.setAttribute('x', f2(-w / 2 - d)); eh.setAttribute('width', f2(w + 2 * d));
        eh.setAttribute('y', f2(-48 - d)); eh.setAttribute('height', f2(96 + 2 * d)); eh.setAttribute('rx', f2(48 + d));
        op(eh, (hh > 0 && hh < 1) ? 0.55 * (1 - hh) : 0);
      }
      // ================= E3: 5 estrellas + 4.1 -> 4.9 + barras -> + Mesas · + Facturación
      {
        const s0 = S.E3.start, pu = M.puntaje, su = M.sube;
        const pt = A(t, s0 + 0.04, IN_D); vis($('e3top'), pt, (1 - pt) * 14);
        for (let k = 0; k < 5; k++) {
          const tk = pu - 0.06 + k * (su - pu) / 4;
          const on = A(t, tk, 0.30), b = Math.sin(Math.PI * lin(t, tk, tk + 0.34));
          place($('e3g' + k), E3X(k), E3Y, (0.4 + 0.6 * on) * (1 + 0.16 * b), on);
        }
        const c = inout(lin(t, pu - 0.04, su + 0.30));
        $('e3val').textContent = (4.1 + 0.8 * c).toFixed(1);
        $('e3vs').setAttribute('fill', mix('#ffffff', GOLD, A(t, su + 0.10, 0.30)));
        const cb = Math.sin(Math.PI * lin(t, su + 0.22, su + 0.62));
        zoom($('e3cnt'), 344, 212, 1 + 0.05 * cb, 0, 1);
        const SP = [[96, 62], [624, 64], [622, 214], [100, 220]];
        SP.forEach((s, k) => {
          const a = Math.max(Math.sin(Math.PI * lin(t, M.brilla - 0.12 + k * 0.10, M.brilla + 0.62 + k * 0.10)),
            Math.sin(Math.PI * lin(t, su + 0.20 + k * 0.08, su + 0.95 + k * 0.08)));
          rot($('e3sp' + k), s[0], s[1], 0.35 + 0.75 * a, 45 * a, a);
        });
        const pc = A(t, s0 + 0.24, IN_D); vis($('e3chart'), pc, (1 - pc) * 14);
        BX.forEach((x, k) => {
          const g = A(t, M.caja - 0.06 + k * 0.07, 0.45);
          const h = H0[k] + (BH[k] - H0[k]) * g, r = $('e3b' + k);
          r.setAttribute('y', f2(BASE - h)); r.setAttribute('height', f2(h));
          r.setAttribute('fill', mix(MUTE, BCOL[k], g));
        });
        P.ln(A(t, M.caja + 0.16, 0.55));
        const pa = A(t, M.caja + 0.58, 0.28);
        rot($('e3ah'), P.tip[0], P.tip[1], 0.6 + 0.4 * pa, P.tipA, pa);
        const pp = A(t, M.caja - 0.10, IN_D), on = A(t, M.factura - 0.06, 0.32);
        const pb = Math.sin(Math.PI * lin(t, M.factura - 0.06, M.factura + 0.34));
        place($('e3p'), 360, 612 + (1 - pp) * 14, P.e3s * (0.94 + 0.06 * pp) * (1 + 0.05 * pb), pp);
        $('e3pr').setAttribute('fill', mix('#ffffff', OKS, on));
        $('e3pr').setAttribute('stroke', mix(LINE, OK, on));
        $('e3pt').setAttribute('fill', mix(INK, OK, on));
        $('e3pc').setAttribute('fill', mix(MUTE, OK, on));
        P.pk(A(t, M.factura + 0.04, 0.34));
      }
    },
  };
})();
