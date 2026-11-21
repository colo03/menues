// Reel 02 · Segundas rondas en terraza (cervecerías, patios y terrazas)
// B1: pinta vacía esperando (anillo de tiempo perdido + mano que llama sin respuesta)
// B2: Escaneo directo QR (sin apps) -> dos pintas -> Pedir
// B3: la comanda viaja directo a Barra -> luz verde -> sale a la mesa
// B4: más consumo (pintas que crecen + tendencia)
(function () {
  const BEER = '#f4b53f';
  const P = {};
  const emptyPint = `<g ${ST} stroke="${INK}" stroke-width="5">
      <path d="M-70 -120 L-56 128 Q-55 144 -39 144 H39 Q55 144 56 128 L70 -120 Z" fill="#ffffff" stroke="none"/>
      <path d="M-57.5 104 L-56 128 Q-55 144 -39 144 H39 Q55 144 56 128 L57.5 104 Z" fill="${BEER}" stroke="none" opacity="0.55"/>
      <path d="M-62 -52 Q-31 -40 0 -52 T62 -52" stroke="#e8e1d6" stroke-width="5"/>
      <path d="M-59 2 Q-30 12 0 2 T59 2" stroke="#ece6dc" stroke-width="5"/>
      <path d="M-70 -120 L-56 128 Q-55 144 -39 144 H39 Q55 144 56 128 L70 -120"/>
      <path d="M-74 -120 H74"/></g>`;
  const hand = `<g stroke="${ACC}" stroke-width="4" stroke-linejoin="round" id="b1handc">
      ${[-30, -14, 2, 18].map((x, i) => `<rect x="${x}" y="${-48 + (i === 0 || i === 3 ? 8 : 0)}" width="14" height="50" rx="7" fill="#fceae6"/>`).join('')}
      <rect x="-30" y="-12" width="62" height="58" rx="22" fill="#fceae6"/>
      <rect x="22" y="2" width="14" height="40" rx="7" fill="#fceae6" transform="rotate(38 29 22)"/></g>
      <g id="b1wv" fill="none" stroke="${ACC}" stroke-width="4" stroke-linecap="round"><path d="M-50 -30 Q-62 -6 -50 18"/><path d="M-64 -40 Q-80 -6 -64 28"/></g>`;
  const noApp = `<g fill="none" stroke="#a8a29e" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="-14" y="-22" width="28" height="44" rx="6"/><path d="M0 -8 V10 M-7 3 L0 10 L7 3"/></g>
      <path id="b2wx" d="M-26 -22 L26 26" stroke="${ACC}" stroke-width="6" stroke-linecap="round"/>`;
  window.REELS.r02 = {
    build() {
      // ---------- B1
      const b1 = `<circle cx="360" cy="392" r="262" fill="none" stroke="#f3eee6" stroke-width="14"/>
        <circle id="b1arc" cx="360" cy="392" r="262" fill="none" stroke="${ACC}" stroke-width="14" stroke-linecap="round" transform="rotate(-90 360 392)"/>
        <circle id="b1head" r="15" fill="${ACC}"/>
        <g transform="translate(360 392)">${emptyPint}</g>
        <g id="b1hand">${hand}</g>`;
      // ---------- B2
      const b2 = `<g id="b2cam"><rect x="-76" y="-36" width="152" height="72" rx="36" fill="${OK}"/><text x="0" y="14" text-anchor="middle" font-size="40" font-weight="800" fill="#ffffff">QR</text></g>
        <g id="b2na"><rect x="-76" y="-36" width="152" height="72" rx="36" fill="#ffffff" stroke="${LINE}" stroke-width="3"/><g transform="translate(0 -2)">${noApp}</g></g>
        <g id="b2qr" transform="translate(184 196)">
          <rect x="0" y="0" width="352" height="352" rx="32" fill="#ffffff" stroke="${LINE}" stroke-width="3"/>
          <g transform="translate(26 26)">${fakeQR(25, 300, 11)}</g>
          <rect x="136" y="136" width="80" height="80" rx="18" fill="#ffffff"/>
          <image href="${ASSETS}mark.svg" x="144" y="144" width="64" height="64"/>
          <g id="b2scan"><rect x="6" y="-14" width="340" height="28" rx="14" fill="${ACC}" opacity="0.16"/><rect x="6" y="-3" width="340" height="6" rx="3" fill="${ACC}"/></g>
        </g>
        <g id="b2pints">
          <circle cx="262" cy="336" r="112" fill="#fef1dc" opacity="0.7"/><g transform="translate(262 344)">${ICON.pint}</g>
          <circle cx="458" cy="336" r="112" fill="#fef1dc" opacity="0.7"/><g transform="translate(458 344)">${ICON.pint}</g>
        </g>
        <circle id="b2rip0" cx="360" cy="604" r="60" fill="none" stroke="${ACC}" stroke-width="4"/>
        <circle id="b2rip1" cx="360" cy="604" r="60" fill="none" stroke="${ACC}" stroke-width="4"/>
        <g id="b2btn"><rect x="-160" y="-54" width="320" height="108" rx="54" fill="${ACC}"/><text x="0" y="16" text-anchor="middle" font-size="46" font-weight="800" fill="#ffffff">Pedir</text>
          <circle id="b2dot" cx="104" cy="14" r="20" fill="#ffffff"/></g>`;
      // ---------- B3
      const chairs = [[0, -88, 0], [0, 88, 0], [-88, 0, 90], [88, 0, 90]].map(c => `<rect x="${c[0] - 30}" y="${c[1] - 13}" width="60" height="26" rx="13" fill="#ece6dc" stroke="${INK}" stroke-width="4" transform="rotate(${c[2]} ${c[0]} ${c[1]})"/>`).join('');
      const b3 = `<path id="b3ln" d="M360 140 V198" stroke="${MUTE}" stroke-width="5" stroke-linecap="round" fill="none"/>
        <path id="b3ln2" d="M360 432 V520" stroke="${MUTE}" stroke-width="5" stroke-linecap="round" fill="none" stroke-dasharray="1 14"/>
        <g id="b3box"><rect id="b3r" x="170" y="200" width="380" height="232" rx="34" fill="${CREAM}" stroke="${LINE}" stroke-width="3"/>
          <g id="b3i" transform="translate(360 292)" style="color:#a8a29e">${ICON.cup}</g>
          <text id="b3t" x="360" y="398" text-anchor="middle" font-size="44" font-weight="800" fill="#a8a29e">Barra</text>
          <circle id="b3glow0" cx="502" cy="246" r="22" fill="none" stroke="${OK}" stroke-width="4"/>
          <circle id="b3glow1" cx="502" cy="246" r="22" fill="none" stroke="${OK}" stroke-width="4"/>
          <circle id="b3lamp" cx="502" cy="246" r="22" fill="${MUTE}"/></g>
        <g id="b3table" transform="translate(360 612)">${chairs}<circle r="58" fill="#ffffff" stroke="${INK}" stroke-width="4"/></g>
        <g id="b3node"><circle cx="360" cy="92" r="48" fill="${ACC}"/><g transform="translate(360 92)">${ICON.ticket}</g></g>
        <g id="b3p0"><g transform="scale(0.42)">${ICON.pint}</g></g><g id="b3p1"><g transform="scale(0.42)">${ICON.pint}</g></g>`;
      // ---------- B4
      const H = [118, 182, 252, 334], X = [196, 304, 412, 520];
      let b4 = `<path d="M130 594 H590" stroke="${LINE}" stroke-width="5" stroke-linecap="round"/>`;
      X.forEach((x, k) => {
        b4 += `<g id="b4b${k}"><rect id="b4r${k}" x="${x - 38}" y="${594 - H[k]}" width="76" height="${H[k]}" rx="12" fill="${BEER}" stroke="${INK}" stroke-width="4"/>
          <rect id="b4f${k}" x="${x - 42}" y="${594 - H[k] - 14}" width="84" height="30" rx="15" fill="#ffffff" stroke="${INK}" stroke-width="4"/></g>`;
      });
      const pts = X.map((x, k) => [x, 594 - H[k] - 62]);
      b4 += `<path id="b4tr" d="M${pts.map(p => p.join(' ')).join(' L')}" fill="none" stroke="${OK}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <path id="b4ah" d="M-26 -10 L0 0 L-10 26" transform="translate(${pts[3][0] + 6} ${pts[3][1] - 6}) rotate(-36)" fill="none" stroke="${OK}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
      P.H = H; P.X = X;
      return { B1: b1, B2: b2, B3: b3, B4: b4 };
    },
    init() {
      P.arc = drawable('b1arc'); P.trend = drawable('b4tr');
      P.ln = drawable('b3ln');
    },
    render(t) {
      // ================= B1: tiempo perdido esperando al mozo
      {
        const pr = 0.97 * inout(lin(t, 0.30, S.B1.end - 0.25));
        P.arc(pr);
        const ang = -Math.PI / 2 + pr * Math.PI * 2;
        place($('b1head'), 360 + 262 * Math.cos(ang), 392 + 262 * Math.sin(ang), 1, pr > 0.005 ? 1 : 0);
        const ph = A(t, M.nadie - 0.15, 0.45);
        const wave = t > M.nadie ? Math.sin((t - M.nadie) * Math.PI * 2 * 1.6) * (1 - A(t, M.mozo + 0.35, 0.4)) : 0;
        const fade = A(t, M.mozo + 0.35, 0.5);
        $('b1hand').setAttribute('transform', `translate(596 ${(118 + (1 - ph) * 14).toFixed(2)}) rotate(${(12 * wave).toFixed(2)} 0 40)`);
        op($('b1hand'), ph * (1 - 0.55 * fade));
        $('b1handc').setAttribute('stroke', mix(ACC, '#a8a29e', fade));
        [...$('b1handc').querySelectorAll('rect')].forEach(r => r.setAttribute('fill', mix('#fceae6', '#f3eee6', fade)));
        op($('b1wv'), (t > M.nadie ? 1 : 0) * (1 - fade) * (0.55 + 0.45 * Math.abs(wave)));
      }
      // ================= B2: Escaneo directo QR, sin apps -> Pedir
      {
        const qr = M.qr, food = M.piden, tap = M.ronda;
        const qout = A(t, food, 0.32);
        op($('b2qr'), 1 - qout);
        const q = lin(t, qr, qr + 0.95);
        $('b2scan').setAttribute('transform', `translate(0 ${(30 + 292 * inout(q)).toFixed(2)})`);
        op($('b2scan'), (q > 0 && q < 1) ? Math.min(1, q / 0.12, (1 - q) / 0.12) : 0);
        const pg = A(t, M.camara, IN_D), pw = A(t, M.apps, IN_D);
        place($('b2cam'), 276, 112 + (1 - pg) * 12, 1, pg);
        place($('b2na'), 448, 112 + (1 - pw) * 12, 1, pw);
        const wx = $('b2wx'); if (!P.wxL) { P.wxL = wx.getTotalLength(); wx.style.strokeDasharray = `${P.wxL} ${P.wxL}`; }
        wx.style.strokeDashoffset = (P.wxL * (1 - A(t, M.apps + 0.25, 0.35))).toFixed(2);
        const pf = A(t, food + 0.20, IN_D);
        const ep = $('b2pints'); op(ep, pf); ep.setAttribute('transform', `translate(0 ${((1 - pf) * 14).toFixed(2)})`);
        const pb = A(t, food + 0.42, IN_D);
        const press = 1 - 0.05 * Math.sin(Math.PI * lin(t, tap, tap + 0.30));
        place($('b2btn'), 360, 604 + (1 - pb) * 14, press, pb);
        const pd = lin(t, tap - 0.05, tap + 0.55);
        op($('b2dot'), (pd > 0 && pd < 1) ? 0.55 * Math.sin(Math.PI * pd) : 0);
        [0, 1].forEach(k => {
          const r = lin(t, tap + 0.05 + 0.22 * k, tap + 1.05 + 0.22 * k), e = $('b2rip' + k);
          e.setAttribute('r', (60 + 100 * ease(r)).toFixed(2));
          e.style.opacity = (r > 0 && r < 1) ? (0.45 * (1 - r)).toFixed(3) : 0;
        });
      }
      // ================= B3: directo a Barra -> luz verde -> a la mesa
      {
        const s0 = S.B3.start, br = M.barra, vd = M.verde, ms = M.mesa;
        place($('b3node'), 0, 0, 1, A(t, s0 + 0.06, IN_D));
        op($('b3table'), A(t, s0 + 0.30, IN_D));
        P.ln(A(t, s0 + 0.20, 0.45));
        const go0 = br - 0.62;
        const lit = A(t, br - 0.05, 0.45);
        $('b3ln').style.stroke = mix(MUTE, BAR, lit);
        $('b3r').setAttribute('fill', mix(CREAM, '#efeafe', lit)); $('b3r').setAttribute('stroke', mix(LINE, BAR, lit));
        $('b3i').style.color = mix('#a8a29e', BAR, lit); $('b3t').setAttribute('fill', mix('#a8a29e', BAR, lit));
        const pv = A(t, vd, 0.40);
        $('b3lamp').setAttribute('fill', mix(MUTE, OK, pv));
        [0, 1].forEach(k => {
          const r = lin(t, vd + 0.05 + 0.3 * k, vd + 1.05 + 0.3 * k), e = $('b3glow' + k);
          e.setAttribute('r', (22 + 34 * ease(r)).toFixed(2)); e.style.opacity = (r > 0 && r < 1) ? (0.7 * (1 - r)).toFixed(3) : 0;
        });
        op($('b3ln2'), A(t, ms - 0.25, 0.35)); $('b3ln2').style.strokeDashoffset = (-t * 30).toFixed(2);
        [0, 1].forEach(k => {
          const dx = k ? 26 : -26;
          // tramo 1: comanda -> Barra
          const u1 = inout(lin(t, go0 + 0.08 * k, br + 0.08 * k));
          const a1 = A(t, go0 - 0.05 + 0.08 * k, 0.30), in1 = A(t, br - 0.10 + 0.08 * k, 0.30);
          // tramo 2: Barra -> mesa
          const u2 = inout(lin(t, ms + 0.08 * k, ms + 0.80 + 0.08 * k));
          const a2 = A(t, ms - 0.05 + 0.08 * k, 0.30);
          const e = $('b3p' + k);
          if (t < ms - 0.05) place(e, 360 + dx, 120 + 176 * u1, 1 - 0.3 * in1, a1 * (1 - in1));
          else place(e, 360 + dx, 452 + 150 * u2, 1, a2);
        });
      }
      // ================= B4: más consumo
      {
        const s0 = S.B4.start;
        P.X.forEach((x, k) => {
          const g = A(t, s0 + 0.12 + 0.12 * k, 0.60);
          const h = P.H[k] * (0.25 + 0.75 * g);
          $('b4r' + k).setAttribute('y', (594 - h).toFixed(2)); $('b4r' + k).setAttribute('height', h.toFixed(2));
          $('b4f' + k).setAttribute('y', (594 - h - 14).toFixed(2));
          op($('b4b' + k), A(t, s0 + 0.04 + 0.12 * k, 0.35));
        });
        const tr = A(t, s0 + 0.55, 0.70);
        P.trend(tr); op($('b4ah'), A(t, s0 + 1.05, 0.30));
      }
    },
  };
})();
