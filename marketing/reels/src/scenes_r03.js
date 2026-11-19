// Reel 03 · Cero comisión + precios al día (rentabilidad del dueño, anti inflación)
// C1: anillo de ganancia que se completa al 100%
// C2: contraste 0% comisión frente al recorte porcentual tradicional
// C3: botón +10% que actualiza toda la carta al instante
// C4: mismo QR, sin reimprimir
(function () {
  const P = {};
  const OLD = [8500, 4200, 3900], NEW = [9350, 4620, 4290];
  const ROWY = [276, 422, 568];
  const bar = (x, y, w, h, r) => `M${x} ${y + h} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h} Z`;
  const barB = (x, y, w, h, r) => `M${x} ${y} H${x + w} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} Z`;
  window.REELS.r03 = {
    build() {
      // ---------- C1
      const c1 = `<circle cx="360" cy="372" r="226" fill="none" stroke="#f3eee6" stroke-width="36"/>
        <circle id="c1glow" cx="360" cy="372" r="226" fill="none" stroke="${OK}" stroke-width="36" opacity="0"/>
        <circle id="c1arc" cx="360" cy="372" r="226" fill="none" stroke="${OK}" stroke-width="36" stroke-linecap="round" transform="rotate(-90 360 372)"/>
        <g id="c1coin"><circle cx="360" cy="266" r="34" fill="#e3f3ea" stroke="${OK}" stroke-width="4"/>
          <text x="360" y="281" text-anchor="middle" font-size="42" font-weight="800" fill="${OK}">$</text></g>
        <text id="c1num" x="360" y="438" text-anchor="middle" font-size="128" font-weight="800" fill="${INK}" letter-spacing="-4">0%</text>
        <g id="c1ok"><circle r="40" fill="${OK}"/>${ICON.check(48, 7)}</g>`;
      // ---------- C2
      const LX = 124, RX = 400, W = 196, Y0 = 196, H = 360, CUT = 98;
      const lines = x => [0, 1, 2].map(i => `<rect x="${x + 36}" y="${Y0 + CUT + 54 + i * 52}" width="${i === 2 ? 76 : 124}" height="14" rx="7" fill="${MUTE}"/>`).join('');
      const c2 = `<g id="c2L">
          <path d="${barB(LX, Y0 + CUT, W, H - CUT, 30)}" fill="#f3eee6" stroke="${MUTE}" stroke-width="4"/>
          ${lines(LX)}
          <g id="c2chunk"><path d="${bar(LX, Y0, W, CUT, 30)}" fill="#fceae6" stroke="${ACC}" stroke-width="4" stroke-linejoin="round"/>
            <text x="${LX + W / 2}" y="${Y0 + 66}" text-anchor="middle" font-size="50" font-weight="800" fill="${ACC}">%</text></g>
          <path id="c2cut" d="M${LX - 14} ${Y0 + CUT} H${LX + W + 14}" stroke="${ACC}" stroke-width="5" stroke-linecap="round" stroke-dasharray="12 10"/>
        </g>
        <g id="c2R">
          <path id="c2rb" d="${bar(RX, Y0, W, H, 30)}" fill="#e3f3ea" stroke="${OK}" stroke-width="4"/>
          <image href="${ASSETS}mark.svg" x="${RX + W / 2 - 42}" y="${Y0 + 26}" width="84" height="84"/>
          ${[0, 1, 2].map(i => `<rect x="${RX + 36}" y="${Y0 + CUT + 54 + i * 52}" width="${i === 2 ? 76 : 124}" height="14" rx="7" fill="#b7dcc5"/>`).join('')}
        </g>
        <g id="c2pl"><rect x="-74" y="-35" width="148" height="70" rx="35" fill="#fceae6" stroke="#f5c9bf" stroke-width="2"/>
          <path d="M-40 0 H-18" stroke="${ACC}" stroke-width="7" stroke-linecap="round"/><text x="14" y="15" text-anchor="middle" font-size="42" font-weight="800" fill="${ACC}">%</text></g>
        <g id="c2pr"><rect x="-74" y="-35" width="148" height="70" rx="35" fill="${OK}"/>
          <text x="0" y="15" text-anchor="middle" font-size="42" font-weight="800" fill="#ffffff">0%</text></g>
        <g id="c2ok"><circle r="34" fill="${OK}"/>${ICON.check(40, 6)}</g>`;
      P.c2 = { LX, RX, W, Y0, H };
      // ---------- C3
      const icons = [`<circle r="48" fill="#fef1dc"/><g transform="scale(0.5)">${ICON.burger}</g>`,
        `<circle r="48" fill="#efeafe"/><g transform="translate(0 4) scale(0.52)">${ICON.glass}</g>`,
        `<circle r="48" fill="#fef1dc"/><g transform="translate(0 2) scale(0.36)">${ICON.pint}</g>`];
      let c3 = `<rect x="100" y="196" width="520" height="452" rx="30" fill="${CREAM}" stroke="${LINE}" stroke-width="3"/>
        <path d="M128 349 H592 M128 495 H592" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`;
      ROWY.forEach((y, k) => {
        c3 += `<rect id="c3fl${k}" x="112" y="${y - 62}" width="496" height="124" rx="22" fill="#e3f3ea"/>
          <g transform="translate(180 ${y})">${icons[k]}</g>
          <rect x="248" y="${y - 22}" width="${[124, 104, 116][k]}" height="15" rx="7.5" fill="${INK}"/>
          <rect x="248" y="${y + 8}" width="${[86, 70, 92][k]}" height="11" rx="5.5" fill="${MUTE}"/>
          <text id="c3p${k}" x="590" y="${y + 17}" text-anchor="end" font-size="50" font-weight="800" fill="${INK}" letter-spacing="-1">${fmtARS(OLD[k])}</text>`;
      });
      c3 += `<circle id="c3rip0" cx="360" cy="104" r="50" fill="none" stroke="${ACC}" stroke-width="4"/>
        <circle id="c3rip1" cx="360" cy="104" r="50" fill="none" stroke="${ACC}" stroke-width="4"/>
        <g id="c3btn"><rect x="-140" y="-50" width="280" height="100" rx="50" fill="${ACC}"/>
          <text x="0" y="18" text-anchor="middle" font-size="52" font-weight="800" fill="#ffffff">+10%</text>
          <circle id="c3dot" cx="92" cy="18" r="18" fill="#ffffff"/></g>`;
      // ---------- C4
      const c4 = `<g id="c4qr" transform="translate(52 190) scale(0.97)">
          <rect x="0" y="0" width="352" height="352" rx="32" fill="#ffffff" stroke="${LINE}" stroke-width="3.5"/>
          <g transform="translate(26 26)">${fakeQR(25, 300, 23)}</g>
          <rect x="136" y="136" width="80" height="80" rx="18" fill="#ffffff"/>
          <image href="${ASSETS}mark.svg" x="144" y="144" width="64" height="64"/></g>
        <g id="c4ok"><circle r="40" fill="${OK}"/>${ICON.check(48, 7)}</g>
        <g id="c4pr" transform="translate(560 360) scale(1.1)">
          <rect x="-52" y="-92" width="104" height="70" rx="8" fill="#ffffff" stroke="${INK}" stroke-width="5"/>
          <rect x="-84" y="-34" width="168" height="98" rx="20" fill="#ece6dc" stroke="${INK}" stroke-width="5"/>
          <circle cx="56" cy="-6" r="7" fill="${OK}"/>
          <rect x="-52" y="34" width="104" height="74" rx="8" fill="#ffffff" stroke="${INK}" stroke-width="5"/>
          <path d="M-32 58 H32 M-32 80 H12" stroke="${MUTE}" stroke-width="6" stroke-linecap="round"/></g>
        ${prohibSVG('c4x', 560, 360, 134, 18)}`;
      return { C1: c1, C2: c2, C3: c3, C4: c4 };
    },
    init() {
      P.arc = drawable('c1arc');
      P.xc = drawable('c4xc'); P.xs = drawable('c4xs');
    },
    render(t) {
      // ================= C1: ganancia 100% tuya
      {
        const pr = inout(lin(t, 0.0, M.cien + 0.70));
        P.arc(pr);
        $('c1num').textContent = Math.round(100 * pr) + '%';
        op($('c1num'), A(t, 0.38, 0.40));
        // la moneda arranca grande en el centro (cuadro de portada) y sube a su lugar cuando entra el contador
        const pcn = A(t, 0.05, 0.60);
        $('c1coin').setAttribute('transform', `translate(360 ${(372 - 106 * pcn).toFixed(2)}) scale(${(2.6 - 1.6 * pcn).toFixed(4)}) translate(-360 -266)`);
        const pk = A(t, M.tuya, 0.45);
        place($('c1ok'), 520, 532, 0.8 + 0.2 * pk, pk);
        const g = lin(t, M.tuya, M.tuya + 0.9); const gl = $('c1glow');
        gl.setAttribute('r', (226 + 30 * ease(g)).toFixed(2)); gl.style.opacity = (g > 0 && g < 1) ? (0.35 * (1 - g)).toFixed(3) : 0;
        gl.setAttribute('stroke-width', (36 * (1 - 0.6 * g)).toFixed(2));
      }
      // ================= C2: 0% comisión frente al recorte porcentual
      {
        const s0 = S.C2.start, c = P.c2, ct = M.cero;
        const pl = A(t, s0 + 0.08, IN_D), pr = A(t, s0 + 0.22, IN_D);
        vis($('c2L'), pl, (1 - pl) * 16); vis($('c2R'), pr, (1 - pr) * 16);
        const off = A(t, ct + 0.05, 0.60);
        $('c2chunk').setAttribute('transform', `translate(${(-34 * off).toFixed(2)} ${(-70 * off).toFixed(2)}) rotate(${(-12 * off).toFixed(2)} ${c.LX + c.W / 2} ${c.Y0 + 49})`);
        op($('c2chunk'), 1 - A(t, ct + 0.25, 0.50));
        op($('c2cut'), A(t, ct - 0.30, 0.30) * (1 - A(t, ct + 0.35, 0.40)));
        $('c2cut').style.strokeDashoffset = (-t * 40).toFixed(2);
        const pp = A(t, s0 + 0.45, IN_D), pg = A(t, ct + 0.10, IN_D);
        place($('c2pl'), c.LX + c.W / 2, 628 + (1 - pp) * 12, 1, pp);
        place($('c2pr'), c.RX + c.W / 2, 628 + (1 - pg) * 12, 1, pg);
        $('c2rb').setAttribute('stroke-width', (4 + 3 * A(t, ct + 0.10, 0.4)).toFixed(2));
        const pk = A(t, ct + 0.40, 0.45);
        place($('c2ok'), c.RX + c.W - 8, c.Y0 + 8, 0.8 + 0.2 * pk, pk);
      }
      // ================= C3: +10% actualiza toda la carta al instante
      {
        const s0 = S.C3.start, tap = M.boton, up = M.actualizas;
        const pb = A(t, s0 + 0.30, IN_D);
        const press = 1 - 0.06 * Math.sin(Math.PI * lin(t, tap, tap + 0.30));
        place($('c3btn'), 360, 104 + (1 - pb) * 12, press, pb);
        const pd = lin(t, tap - 0.05, tap + 0.55);
        op($('c3dot'), (pd > 0 && pd < 1) ? 0.55 * Math.sin(Math.PI * pd) : 0);
        [0, 1].forEach(k => {
          const r = lin(t, tap + 0.05 + 0.22 * k, tap + 1.0 + 0.22 * k), e = $('c3rip' + k);
          e.setAttribute('r', (50 + 70 * ease(r)).toFixed(2));
          e.style.opacity = (r > 0 && r < 1) ? (0.45 * (1 - r)).toFixed(3) : 0;
        });
        ROWY.forEach((y, k) => {
          const t0 = up + 0.15 + 0.20 * k;
          const u = A(t, t0, 0.55);
          const v = Math.round((OLD[k] + (NEW[k] - OLD[k]) * u) / 10) * 10;
          const e = $('c3p' + k); e.textContent = fmtARS(v);
          const fl = A(t, t0, 0.30) * (1 - A(t, t0 + 0.75, 0.6));
          e.setAttribute('fill', mix(INK, OK, Math.max(fl, 0.0)));
          op($('c3fl' + k), fl * 0.9);
        });
      }
      // ================= C4: mismo QR, sin reimprimir
      {
        const s0 = S.C4.start, rp = M.reimprimir, qr = M.qr;
        const pq = A(t, s0 + 0.06, IN_D), pp = A(t, s0 + 0.20, IN_D);
        $('c4qr').setAttribute('transform', `translate(52 ${(190 + (1 - pq) * 14).toFixed(2)}) scale(0.97)`); op($('c4qr'), pq);
        $('c4pr').setAttribute('transform', `translate(560 ${(360 + (1 - pp) * 14).toFixed(2)}) scale(1.1)`); op($('c4pr'), pp * (1 - 0.55 * A(t, rp + 0.75, 0.4)));
        P.xc(A(t, rp + 0.15, 0.50)); P.xs(A(t, rp + 0.50, 0.35));
        const pk = A(t, qr, 0.45);
        place($('c4ok'), 380, 200, 0.8 + 0.2 * pk, pk);
      }
    },
  };
})();
