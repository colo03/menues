// Reel 06 · Mozos que rinden mas (turno convencional vs. mozo con SaleListo)
// R1: radiografia del turno de 1 mozo: barra que supera la mitad en mandados (Anotar pedidos, Ir a cobrar) vs. Atender mesas
// R2: QR en mesa absorbe Carta, Pedido y Cuenta; Tu mozo queda con Llevar platos + Atender mesas (barra verde 100%)
// R3: 2 mozos -> 6 mesas vs. 1 mozo SaleListo (2x) -> 8 mesas + pildora "Más mesas en hora pico"
(function () {
  const P = {};
  const OKS = '#e3f3ea', ACS = '#fceae6', ACL = '#f5c9bf', TX2 = '#8b8178', GRY = '#efe9df', OKL = '#bfe3cc', SOFT = '#f3efe9';
  const f2 = v => v.toFixed(2);
  // pildora autoajustable: rect + icono + texto (centrada en 0,0, se mide en el primer render)
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
  // iconos de trazo (centrados en 0,0, ~32 px)
  const IC = {
    note: `<rect x="-12" y="-15" width="24" height="30" rx="4"/><path d="M-6 -6 H6 M-6 1 H6 M-6 8 H1"/>`,
    card: `<rect x="-16" y="-11" width="32" height="22" rx="4"/><path d="M-16 -3 H16 M-10 5 H-4"/>`,
    book: `<path d="M0 -9 C-5 -13 -11 -13 -16 -11 V12 C-11 10 -5 10 0 14 C5 10 11 10 16 12 V-11 C11 -13 5 -13 0 -9 Z"/><path d="M0 -9 V14"/>`,
    receipt: `<path d="M-12 -16 H12 V16 L8 12 L4 16 L0 12 L-4 16 L-8 12 L-12 16 Z"/><path d="M-5.5 -6 H5.5 M-5.5 2 H5.5"/>`,
  };
  const sic = (id, name, color, s = 1, sw = 3.4) => `<g transform="scale(${s})"><g id="${id}" fill="none" stroke="${color}" stroke-width="${f2(sw / s)}" stroke-linecap="round" stroke-linejoin="round">${IC[name]}</g></g>`;
  const okBadge = (id, r) => `<g id="${id}"><circle r="${r}" fill="${OK}"/>${ICON.check(r * 1.15, r * 0.24)}</g>`;

  // ---------- R1: geometria
  const BX = 56, BW = 608, BY = 96, BH = 126;
  const RY = [362, 478, 594];
  const ROWS = [
    { label: 'Anotar pedidos', pct: '40%', ic: 'note' },
    { label: 'Ir a cobrar', pct: '30%', ic: 'card' },
    { label: 'Atender mesas', pct: '30%', ic: 'person' },
  ];
  // ---------- R2
  const CH = [{ l: 'Carta', ic: 'book' }, { l: 'Pedido', ic: 'note' }, { l: 'Cuenta', ic: 'receipt' }];
  const CTY = [132, 196, 260], CTX = 268, CSY = [466, 528, 590];
  const TX = [208, 512], TY2 = 498;
  // ---------- R3
  const LT = [], RT = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) LT.push([81 + c * 62, 252 + r * 62]);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) RT.push([424 + c * 62, 252 + r * 62]);

  window.REELS.r06 = {
    build() {
      // ================= R1
      const rows = ROWS.map((r, k) => {
        const icon = r.ic === 'person'
          ? `<circle id="g1rc${k}" cx="-246" cy="0" r="32" fill="${MUTE}"/><g transform="translate(-246 1) scale(1.2)">${ICON.person}</g>`
          : `<circle id="g1rc${k}" cx="-246" cy="0" r="32" fill="${SOFT}"/><g transform="translate(-246 0)">${sic('g1ri' + k, r.ic, TX2, 1, 3.4)}</g>`;
        return `<g id="g1r${k}">
          <rect id="g1rr${k}" x="-304" y="-50" width="608" height="100" rx="26" fill="#ffffff" stroke="${LINE}" stroke-width="3"/>
          ${icon}
          <text id="g1rt${k}" x="-194" y="12" font-size="34" font-weight="800" fill="${INK}" letter-spacing="-0.6">${r.label}</text>
          <text id="g1rp${k}" x="272" y="12" text-anchor="end" font-size="34" font-weight="800" fill="${k < 2 ? ACC : TX2}" letter-spacing="-0.6">${r.pct}</text>
        </g>`;
      }).join('');
      const g1 = `<g transform="translate(0 14)"><text x="56" y="70" font-size="30" font-weight="800" fill="${INK}" letter-spacing="-0.6">Turno de 1 mozo</text>
        <circle id="g1lgd0" cx="0" cy="61" r="8" fill="${ACC}"/>
        <text id="g1lgt0" x="0" y="69" font-size="22" font-weight="700" fill="${TX2}">Mandados</text>
        <circle id="g1lgd1" cx="0" cy="61" r="8" fill="${GRY}" stroke="${MUTE}" stroke-width="2"/>
        <text id="g1lgt1" x="0" y="69" font-size="22" font-weight="700" fill="${TX2}">Atender</text>
        <defs><clipPath id="g1clip"><rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="30"/></clipPath></defs>
        <g clip-path="url(#g1clip)">
          <rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" fill="${GRY}"/>
          <rect id="g1sb" x="${BX}" y="${BY}" width="0" height="${BH}" fill="${ACC}"/>
          <rect id="g1sa" x="${BX}" y="${BY}" width="0" height="${BH}" fill="${ACC}"/>
          <rect id="g1fa" x="${BX}" y="${BY}" width="0" height="${BH}" fill="#ffffff"/>
          <rect id="g1fb" x="${BX}" y="${BY}" width="0" height="${BH}" fill="#ffffff"/>
          <rect id="g1dv" x="0" y="${BY}" width="5" height="${BH}" fill="#ffffff"/>
        </g>
        <text id="g1pct" x="86" y="182" font-size="66" font-weight="800" fill="#ffffff" letter-spacing="-2">46%</text>
        <path d="M360 84 V234" stroke="${INK}" stroke-width="3" stroke-dasharray="7 8" stroke-linecap="round" opacity="0.45"/>
        <text id="g1ml" x="360" y="268" text-anchor="middle" font-size="22" font-weight="700" fill="${TX2}">mitad del turno</text>
        <g id="g1mpw"><path d="M-11 -21 L0 -32 L11 -21 Z" fill="${ACC}"/>${pill('g1mp', 'Más de la mitad', 24, 44, '', { fill: ACC, stroke: ACC, text: '#ffffff', sw: 0 })}</g>
        ${rows}</g>`;

      // ================= R2
      const chips = CH.map((c, k) => pill('g2c' + k, c.l, 29, 56, sic('g2c' + k + 's', c.ic, ACC, 0.86, 3.2), { fill: ACS, stroke: ACL, text: ACC, sw: 2.5 })).join('');
      const slots = CH.map((c, k) => `<rect id="g2sl${k}" x="${CTX}" y="${CTY[k] - 28}" width="100" height="56" rx="28" fill="none" stroke="${MUTE}" stroke-width="3" stroke-dasharray="9 9"/>`).join('');
      const cks = CH.map((c, k) => okBadge('g2k' + k, 17)).join('');
      const tiles = [0, 1].map(k => `<g id="g2t${k}">
          <rect id="g2tr${k}" x="-144" y="-82" width="288" height="164" rx="26" fill="#ffffff" stroke="${LINE}" stroke-width="3"/>
          ${k === 0
            ? `<g id="g2ti0" transform="translate(0 -16) scale(0.5)">${ICON.cloche}</g>`
            : `<circle id="g2tc1" cx="0" cy="-24" r="34" fill="${MUTE}"/><g transform="translate(0 -22) scale(1.4)">${ICON.person}</g>`}
          <text id="g2tt${k}" x="0" y="54" text-anchor="middle" font-size="30" font-weight="800" fill="${TX2}" letter-spacing="-0.6">${k ? 'Atender mesas' : 'Llevar platos'}</text>
          <g transform="translate(116 -54)">${okBadge('g2tk' + k, 16)}</g>
        </g>`).join('');
      const g2 = `<g id="g2top">
          <rect x="36" y="36" width="648" height="276" rx="30" fill="${CREAM}" stroke="${LINE}" stroke-width="3"/>
          <text x="64" y="88" font-size="28" font-weight="800" fill="${ACC}" letter-spacing="-0.5">QR en mesa</text>
          <g transform="translate(64 112)">
            <rect x="0" y="0" width="168" height="168" rx="24" fill="#ffffff" stroke="${LINE}" stroke-width="3"/>
            <g transform="translate(19 19)">${fakeQR(25, 130, 19)}</g>
            <rect x="62" y="62" width="44" height="44" rx="11" fill="#ffffff"/>
            <image href="${ASSETS}mark.svg" x="67" y="67" width="34" height="34"/>
            <g id="g2scan"><rect x="10" y="-12" width="148" height="24" rx="12" fill="${ACC}" opacity="0.16"/><rect x="10" y="-3" width="148" height="6" rx="3" fill="${ACC}"/></g>
          </g>
          ${slots}${cks}
        </g>
        <g id="g2bot">
          <rect id="g2br" x="36" y="336" width="648" height="348" rx="30" fill="#ffffff" stroke="${OKL}" stroke-width="3"/>
          <circle cx="90" cy="388" r="26" fill="${OK}"/><g transform="translate(90 389) scale(1.05)">${ICON.person}</g>
          <text x="130" y="399" font-size="32" font-weight="800" fill="${INK}" letter-spacing="-0.6">Tu mozo</text>
          <g id="g2load"><text x="150" y="532" text-anchor="middle" font-size="76" font-weight="800" fill="${ACC}" letter-spacing="-2">3</text><text x="150" y="572" text-anchor="middle" font-size="24" font-weight="800" fill="${ACC}" letter-spacing="-0.3">mandados</text></g>
          ${pill('g2free', 'Sin mandados', 22, 42, ICON.check(20, 4, OK), { fill: OKS, stroke: OK, text: OK, sw: 2 })}
          ${tiles}
          <g id="g2bar">
            <text x="64" y="618" font-size="22" font-weight="700" fill="${TX2}">Tiempo para atender</text>
            <text id="g2bp" x="656" y="618" text-anchor="end" font-size="24" font-weight="800" fill="${OK}">0%</text>
            <rect x="64" y="632" width="592" height="20" rx="10" fill="${GRY}"/>
            <rect id="g2bf" x="64" y="632" width="20" height="20" rx="10" fill="${OK}"/>
          </g>
        </g>
        ${chips}`;

      // ================= R3
      const tile = (id, x, y, fill, stroke, dash) => `<g id="${id}"><rect id="${id}r" x="${x}" y="${y}" width="48" height="48" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="2.5"${dash ? ' stroke-dasharray="6 6"' : ''}/><circle id="${id}c" cx="${x + 24}" cy="${y + 24}" r="9" fill="#ffffff" stroke="${MUTE}" stroke-width="2.5"/></g>`;
      const g3 = `<g id="g3W"><g id="g3L">
          <rect x="36" y="36" width="262" height="450" rx="28" fill="#f6f3ee" stroke="${LINE}" stroke-width="3"/>
          <text x="167" y="94" text-anchor="middle" font-size="32" font-weight="800" fill="${TX2}" letter-spacing="-0.6">2 mozos</text>
          ${[125, 209].map(x => `<circle cx="${x}" cy="172" r="36" fill="${MUTE}"/><g transform="translate(${x} 173) scale(1.35)">${ICON.person}</g>`).join('')}
          ${LT.map(([x, y], k) => tile('g3lt' + k, x, y, '#ece6dc', '#ece6dc', false)).join('')}
          <text x="167" y="434" text-anchor="middle" font-size="36" font-weight="800" fill="${TX2}" letter-spacing="-0.8">6 mesas</text>
        </g>
        <g id="g3A"><circle cx="0" cy="0" r="26" fill="${OK}"/><path d="M-10 0 H10 M2 -8 L10 0 L2 8" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></g>
        <g id="g3R">
          <rect id="g3rr" x="398" y="36" width="286" height="450" rx="28" fill="${OKS}" stroke="${OKL}" stroke-width="3"/>
          <text id="g3rh" x="541" y="94" text-anchor="middle" font-size="28" font-weight="800" fill="${OK}" letter-spacing="-0.6">1 mozo SaleListo</text>
          <circle id="g3h0" cx="500" cy="172" r="42" fill="none" stroke="${OK}" stroke-width="3"/>
          <circle id="g3h1" cx="500" cy="172" r="42" fill="none" stroke="${OK}" stroke-width="3"/>
          <circle cx="500" cy="172" r="42" fill="${OK}"/><g transform="translate(500 173) scale(1.6)">${ICON.person}</g>
          ${RT.map(([x, y], k) => tile('g3rt' + k, x, y, '#ffffff', OK, true)).join('')}
          <text id="g3rn" x="541" y="434" text-anchor="middle" font-size="36" font-weight="800" fill="${OK}" letter-spacing="-0.8"><tspan id="g3n">8</tspan> mesas</text>
        </g>
        <g id="g3b"><rect x="-48" y="-34" width="96" height="68" rx="34" fill="${ACC}"/><text x="0" y="16" text-anchor="middle" font-size="46" font-weight="800" fill="#ffffff" letter-spacing="-1">2x</text></g></g>
        <rect id="g3ph" x="160" y="556" width="400" height="104" rx="52" fill="none" stroke="${OK}" stroke-width="4"/>
        ${pill('g3p', 'Más mesas en hora pico', 36, 100, `<circle r="29" fill="#ffffff"/><path id="g3chk" d="M-13 1 L-4 10 L14 -9" fill="none" stroke="${OK}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>`, { fill: OK, stroke: OK, text: '#ffffff', sw: 0 })}`;

      return { R1: g1, R2: g2, R3: g3 };
    },
    init() {
      P.chk = drawable('g3chk');
    },
    layout() {
      // leyenda R1 alineada a la derecha
      const w0 = $('g1lgt0').getComputedTextLength(), w1 = $('g1lgt1').getComputedTextLength();
      const t1x = 664 - w1, d1x = t1x - 18, t0x = d1x - 8 - 24 - w0, d0x = t0x - 18;
      $('g1lgt1').setAttribute('x', f2(t1x)); $('g1lgd1').setAttribute('cx', f2(d1x));
      $('g1lgt0').setAttribute('x', f2(t0x)); $('g1lgd0').setAttribute('cx', f2(d0x));
      lay('g1mp', 0, 0, 22);
      // R2: chips, slots y tildes
      P.cw = CH.map((c, k) => lay('g2c' + k, 30, 10, 20));
      P.ct = P.cw.map(w => CTX + w / 2);
      P.cw.forEach((w, k) => { $('g2sl' + k).setAttribute('width', f2(w)); });
      P.ck = P.cw.map(w => CTX + w + 30);
      const wf = lay('g2free', 22, 8, 16); P.fx = 652 - wf / 2;
      // R3
      const rh = $('g3rh'), rw = rh.getComputedTextLength();
      if (rw > 252) rh.setAttribute('font-size', f2(28 * 252 / rw));
      P.pw = lay('g3p', 62, 20, 30);
      P.laid = true;
    },
    render(t) {
      if (!P.laid) this.layout();
      // ================= R1: radiografia del turno
      {
        const mi = M.mitad, an = M.anotando, co = M.cobrando;
        const grow = 0.46 + 0.04 * inout(lin(t, 0.10, mi - 0.10)) + 0.20 * A(t, mi - 0.06, 0.80);
        const w = BW * grow, wa = w * 4 / 7;
        $('g1sa').setAttribute('width', f2(wa));
        $('g1sb').setAttribute('width', f2(w));
        $('g1fa').setAttribute('width', f2(wa));
        $('g1fb').setAttribute('x', f2(BX + wa)); $('g1fb').setAttribute('width', f2(w - wa));
        $('g1dv').setAttribute('x', f2(BX + wa - 2.5)); op($('g1dv'), A(t, an - 0.10, 0.30));
        $('g1pct').textContent = Math.round(grow * 100) + '%';
        // marca de mitad: "mitad del turno" -> pildora "Más de la mitad"
        const sw = A(t, mi + 0.05, 0.40);
        const bm = Math.sin(Math.PI * lin(t, mi + 0.05, mi + 0.45));
        op($('g1ml'), 1 - A(t, mi - 0.05, 0.25));
        place($('g1mpw'), 360, 262 + (1 - sw) * 10, (0.9 + 0.1 * sw) * (1 + 0.05 * bm), sw);
        // filas que se encienden en secuencia
        [an, co].forEach((mk, k) => {
          const on = A(t, mk - 0.06, 0.32);
          const bump = Math.sin(Math.PI * lin(t, mk - 0.06, mk + 0.34));
          place($('g1r' + k), 360, RY[k], 1 + 0.035 * bump, 1);
          $('g1rr' + k).setAttribute('fill', mix('#ffffff', ACS, on));
          $('g1rr' + k).setAttribute('stroke', mix(LINE, ACL, on));
          $('g1rc' + k).setAttribute('fill', mix(SOFT, ACC, on));
          $('g1ri' + k).setAttribute('stroke', mix(TX2, '#ffffff', on));
          $('g1rt' + k).setAttribute('fill', mix(INK, ACC, on));
          op($('g1rp' + k), on);
          op($('g1f' + (k ? 'b' : 'a')), 0.38 * bump);
        });
        // Atender mesas: queda chico y gris
        const dm = A(t, co + 0.30, 0.50);
        place($('g1r2'), 360, RY[2], 1, 1);
        op($('g1rp2'), A(t, mi + 0.30, 0.40));
        $('g1rt2').setAttribute('fill', mix(INK, TX2, dm));
        $('g1rr2').setAttribute('fill', mix('#ffffff', '#faf8f5', dm));
      }
      // ================= R2: el QR toma el pedido, el mozo atiende
      {
        const s0 = S.R2.start, qr = M.qr, pl = M.platos, at = M.atienden;
        const pt = A(t, s0 + 0.04, IN_D), pb = A(t, s0 + 0.16, IN_D);
        vis($('g2top'), pt, (1 - pt) * 14);
        vis($('g2bot'), pb, (1 - pb) * 14);
        const q = lin(t, qr - 0.30, qr + 0.75);
        $('g2scan').setAttribute('transform', `translate(0 ${f2(16 + 136 * inout(q))})`);
        op($('g2scan'), (q > 0 && q < 1) ? Math.min(1, q / 0.14, (1 - q) / 0.14) : 0);
        CH.forEach((c, k) => {
          const pin = A(t, s0 + 0.36 + k * 0.08, IN_D);
          const t0 = qr + 0.12 + k * 0.20;
          const u = lin(t, t0, t0 + 0.62), e = inout(u);
          const bob = 2.2 * Math.sin(2 * Math.PI * (t * 0.9 + k * 0.31)) * (1 - e);
          const x = P.ct[k];
          const y = CSY[k] + (CTY[k] - CSY[k]) * e + bob + (1 - pin) * 14;
          place($('g2c' + k), x, y, 1 + 0.08 * Math.sin(Math.PI * u), pin);
          const cc = A(t, t0 + 0.28, 0.24);
          $('g2c' + k + 'r').setAttribute('fill', mix(ACS, OKS, cc));
          $('g2c' + k + 'r').setAttribute('stroke', mix(ACL, OK, cc));
          $('g2c' + k + 't').setAttribute('fill', mix(ACC, OK, cc));
          $('g2c' + k + 's').setAttribute('stroke', mix(ACC, OK, cc));
          op($('g2sl' + k), pt * (1 - A(t, t0 + 0.48, 0.20)));
          const pk = A(t, t0 + 0.52, 0.32);
          place($('g2k' + k), P.ck[k], CTY[k], 0.6 + 0.4 * pk, pk);
        });
        const pld = A(t, s0 + 0.30, IN_D) * (1 - A(t, qr + 0.10, 0.35));
        vis($('g2load'), pld, (1 - A(t, s0 + 0.30, IN_D)) * 10);
        const pf = A(t, qr + 0.95, 0.40);
        place($('g2free'), P.fx, 388 + (1 - pf) * 8, 0.92 + 0.08 * pf, pf);
        [pl, at].forEach((mk, k) => {
          const pin = A(t, qr + 1.05 + k * 0.12, IN_D);
          const on = A(t, mk - 0.08, 0.32);
          const bump = Math.sin(Math.PI * lin(t, mk - 0.08, mk + 0.32));
          place($('g2t' + k), TX[k], TY2 + (1 - pin) * 14, 1 + 0.045 * bump, pin);
          $('g2tr' + k).setAttribute('fill', mix('#ffffff', OKS, on));
          $('g2tr' + k).setAttribute('stroke', mix(LINE, OK, on));
          $('g2tt' + k).setAttribute('fill', mix(TX2, INK, on));
          if (k === 0) op($('g2ti0'), 0.35 + 0.65 * on); else $('g2tc1').setAttribute('fill', mix(MUTE, OK, on));
          const pk = A(t, mk + 0.06, 0.30);
          place($('g2tk' + k), 0, 0, 0.6 + 0.4 * pk, pk);
        });
        $('g2br').setAttribute('stroke', mix(OKL, OK, A(t, pl - 0.08, 0.40)));
        const pbar = A(t, qr + 1.25, IN_D);
        vis($('g2bar'), pbar, (1 - pbar) * 10);
        const fp = 0.5 * A(t, pl, 0.50) + 0.5 * A(t, at, 0.55);
        $('g2bf').setAttribute('width', f2(Math.max(20, 592 * fp)));
        op($('g2bf'), fp > 0.005 ? 1 : 0);
        $('g2bp').textContent = Math.round(fp * 100) + '%';
      }
      // ================= R3: 1 mozo rinde por 2
      {
        const s0 = S.R3.start, rd = M.rinde, dos = M.dos, me = M.mesas, su = M.pico;
        const pl = A(t, s0 + 0.04, IN_D), pr = A(t, s0 + 0.22, IN_D), pa = A(t, s0 + 0.40, IN_D);
        const dim = A(t, rd - 0.05, 0.50);
        vis($('g3L'), pl * (1 - 0.42 * dim), (1 - pl) * 14);
        vis($('g3R'), pr, (1 - pr) * 14);
        place($('g3A'), 348 - 8 * (1 - pa), 261, 0.85 + 0.15 * pa, pa);
        $('g3rr').setAttribute('stroke', mix(OKL, OK, A(t, rd - 0.05, 0.40)));
        // halo radiante desde "rinde"
        [0, 1].forEach(k => {
          const ph = t - rd - k * 0.6;
          const fr = ph > 0 ? (ph / 1.2) % 1 : 0;
          const h = $('g3h' + k);
          h.setAttribute('r', f2(42 + 26 * ease(fr)));
          op(h, ph > 0 ? 0.5 * (1 - fr) * A(t, rd, 0.3) : 0);
        });
        // badge 2x en "dos"
        const pb = A(t, dos - 0.10, 0.40);
        const bb = Math.sin(Math.PI * lin(t, dos - 0.02, dos + 0.40));
        place($('g3b'), 612, 172 + (1 - pb) * 10, (0.6 + 0.4 * pb) * (1 + 0.10 * bb), pb);
        // mesas que se encienden una tras otra
        let lit = 0;
        RT.forEach(([x, y], k) => {
          const tk = me - 0.10 + k * 0.09;
          const on = A(t, tk, 0.28);
          if (t >= tk + 0.08) lit = k + 1;
          const b = Math.sin(Math.PI * lin(t, tk, tk + 0.30));
          const g = $('g3rt' + k);
          g.setAttribute('transform', `translate(${f2(x + 24)} ${f2(y + 24)}) scale(${(1 + 0.12 * b).toFixed(4)}) translate(${-x - 24} ${-y - 24})`);
          $('g3rt' + k + 'r').setAttribute('fill', mix('#ffffff', OK, on));
          $('g3rt' + k + 'r').style.strokeDasharray = on > 0.5 ? 'none' : '6 6';
          $('g3rt' + k + 'r').setAttribute('stroke-opacity', f2(0.55 + 0.45 * on));
          $('g3rt' + k + 'c').setAttribute('stroke', mix(OKL, '#ffffff', on));
        });
        $('g3n').textContent = String(Math.max(1, lit));
        op($('g3rn'), A(t, me - 0.10, 0.30));
        // pildora "Más mesas en hora pico"
        const pp = A(t, su - 0.14, 0.42);
        const bp = Math.sin(Math.PI * lin(t, su - 0.04, su + 0.36));
        place($('g3p'), 360, 608 + (1 - pp) * 14, (0.92 + 0.08 * pp) * (1 + 0.03 * bp), pp);
        $('g3W').setAttribute('transform', `translate(0 ${f2(24 + 75 * (1 - A(t, su - 0.40, 0.60)))})`);
        P.chk(A(t, su + 0.06, 0.40));
        const hl = lin(t, su + 0.05, su + 0.85), ph = $('g3ph'), gr = 22 * ease(hl);
        ph.setAttribute('x', f2(360 - P.pw / 2 - gr)); ph.setAttribute('width', f2(P.pw + 2 * gr));
        ph.setAttribute('y', f2(608 - 52 - gr)); ph.setAttribute('height', f2(104 + 2 * gr)); ph.setAttribute('rx', f2(52 + gr));
        op(ph, (hl > 0 && hl < 1) ? 0.55 * (1 - hl) : 0);
      }
    },
  };
})();
