// Reel 04 · Cobrar en un solo viaje (rotación de mesas y cierre de cuenta)
// D1: 4 viajes agotadores entre Mesa y Caja (-15 min) que se contraen
// D2: el cliente pide la cuenta en el QR eligiendo Tarjeta + 10% propina ($34.200)
// D3: el mozo ve el monto exacto en el posnet y resuelve todo en 1 solo viaje
(function () {
  const P = {};
  const chairs = r => [[0, -r, 0], [0, r, 0], [-r, 0, 90], [r, 0, 90]].map(c =>
    `<rect x="${c[0] - 26}" y="${c[1] - 11}" width="52" height="22" rx="11" fill="#ece6dc" stroke="${INK}" stroke-width="4" transform="rotate(${c[2]} ${c[0]} ${c[1]})"/>`).join('');

  window.REELS.r04 = {
    build() {
      // ---------- D1: 4 viajes entre Caja (izq) y Mesa (der)
      const Y = [194, 282, 370, 458];
      const serp = `M472 ${Y[0]} H248 A44 44 0 0 0 248 ${Y[1]} H472 A44 44 0 0 1 472 ${Y[2]} H248 A44 44 0 0 0 248 ${Y[3]} H472`;
      const steps = Y.map((y, k) => `<g id="d1s${k}">
          <circle r="27" fill="#ffffff"/>
          <circle r="23" fill="${ACC}"/>
          <text x="0" y="9" text-anchor="middle" font-size="26" font-weight="800" fill="#ffffff">${k + 1}</text>
        </g>`).join('');
      const d1 = `<g id="d1caja" transform="translate(116 326)">
          <rect x="-56" y="-64" width="112" height="128" rx="26" fill="${CREAM}" stroke="${INK}" stroke-width="4"/>
          <rect x="-34" y="-40" width="68" height="38" rx="9" fill="#ffffff" stroke="${INK}" stroke-width="3.5"/>
          <text x="0" y="-12" text-anchor="middle" font-size="26" font-weight="800" fill="${INK}">$</text>
          <path d="M-32 18 H32 M-24 36 H24" stroke="${MUTE}" stroke-width="5" stroke-linecap="round"/>
        </g>
        <g id="d1mesa" transform="translate(604 326)">${chairs(72)}<circle r="48" fill="#ffffff" stroke="${INK}" stroke-width="4"/></g>
        <g id="d1mid">
          <path id="d1bg" d="${serp}" fill="none" stroke="#efe9df" stroke-width="9" stroke-linecap="round"/>
          <path id="d1serp" d="${serp}" fill="none" stroke="${ACC}" stroke-width="9" stroke-linecap="round"/>
          <circle id="d1dot" r="12" fill="${ACC}"/>
        </g>
        ${steps}
        <g id="d1pill">
          <rect x="-126" y="-36" width="252" height="72" rx="36" fill="#fceae6" stroke="#f5c9bf" stroke-width="2.5"/>
          <circle cx="-74" cy="0" r="18" fill="none" stroke="${ACC}" stroke-width="4"/>
          <path d="M-74 -9 V0 L-67 5" fill="none" stroke="${ACC}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <text x="20" y="13" text-anchor="middle" font-size="36" font-weight="800" fill="${ACC}">-15 min</text>
        </g>`;
      P.Y = Y;

      // ---------- D2: Pide en QR (Tarjeta + 10% propina -> $34.200)
      const d2 = `<g id="d2qr" transform="translate(238 62)">
          <rect x="0" y="0" width="244" height="244" rx="26" fill="#ffffff" stroke="${LINE}" stroke-width="3"/>
          <g transform="translate(20 20)">${fakeQR(25, 204, 17)}</g>
          <rect x="92" y="92" width="60" height="60" rx="14" fill="#ffffff"/>
          <image href="${ASSETS}mark.svg" x="98" y="98" width="48" height="48"/>
          <g id="d2scan"><rect x="6" y="-12" width="232" height="24" rx="12" fill="${ACC}" opacity="0.16"/><rect x="6" y="-3" width="232" height="6" rx="3" fill="${ACC}"/></g>
        </g>
        <g id="d2card">
          <rect id="d2cr" x="84" y="338" width="260" height="178" rx="28" fill="${CREAM}" stroke="${LINE}" stroke-width="3.5"/>
          <g transform="translate(214 427)">
            <rect id="d2cb" x="-76" y="-48" width="152" height="96" rx="15" fill="#ffffff" stroke="${INK}" stroke-width="4"/>
            <rect x="-76" y="-24" width="152" height="18" fill="${INK}"/>
            <rect x="-54" y="6" width="30" height="22" rx="5" fill="#f4b53f" stroke="${INK}" stroke-width="3"/>
            <path d="M-8 14 H52 M-8 28 H30" stroke="${MUTE}" stroke-width="5" stroke-linecap="round"/>
          </g>
        </g>
        <g id="d2ck0"><circle r="24" fill="${OK}"/>${ICON.check(28, 5)}</g>
        <g id="d2tip">
          <rect id="d2tr" x="376" y="338" width="260" height="178" rx="28" fill="${CREAM}" stroke="${LINE}" stroke-width="3.5"/>
          <text id="d2tt" x="506" y="448" text-anchor="middle" font-size="64" font-weight="800" fill="${INK}" letter-spacing="-2">+10%</text>
        </g>
        <g id="d2ck1"><circle r="24" fill="${OK}"/>${ICON.check(28, 5)}</g>
        <g id="d2tot">
          <rect x="-210" y="-44" width="420" height="88" rx="44" fill="${INK}"/>
          <circle cx="-150" cy="0" r="22" fill="${OK}"/>
          <g transform="translate(-150 0)">${ICON.check(24, 4.5)}</g>
          <text id="d2tval" x="22" y="15" text-anchor="middle" font-size="44" font-weight="800" fill="#ffffff" letter-spacing="-1">$30.000</text>
        </g>`;

      // ---------- D3: Posnet con monto exacto -> 1 solo viaje directo a la mesa
      const ghosts = [-92, 92, -46].map((dy, k) =>
        `<path id="d3gh${k}" d="M262 372 Q360 ${372 + dy * 1.6} 458 372" fill="none" stroke="${MUTE}" stroke-width="4" stroke-dasharray="10 10" stroke-linecap="round"/>`).join('');
      const keypad = [0, 1, 2].map(r => [-28, 0, 28].map(x =>
        `<circle cx="${x}" cy="${44 + r * 24}" r="5.5" fill="#57534e"/>`).join('')).join('');
      const d3 = `${ghosts}
        <path id="d3arr" d="M260 372 H452" fill="none" stroke="${OK}" stroke-width="11" stroke-linecap="round"/>
        <path id="d3ah" d="M434 350 L460 372 L434 394" fill="none" stroke="${OK}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
        <g id="d3one"><circle r="34" fill="${OK}"/><text x="0" y="13" text-anchor="middle" font-size="40" font-weight="800" fill="#ffffff">1</text></g>
        <g id="d3pos" transform="translate(166 372)">
          <path d="M-38 -122 V-154 L-24 -144 L-12 -154 L0 -144 L12 -154 L24 -144 L38 -154 V-122 Z" fill="#ffffff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
          <rect x="-70" y="-124" width="140" height="248" rx="30" fill="${INK}"/>
          <rect id="d3scr" x="-54" y="-102" width="108" height="118" rx="16" fill="#2b2623"/>
          <text id="d3amt" x="0" y="-32" text-anchor="middle" font-size="25" font-weight="800" fill="#ffffff">$33.000</text>
          <path id="d3pchk" d="M-24 -40 L-6 -22 L26 -58" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
          ${keypad}
        </g>
        <g id="d3mesa" transform="translate(558 372)">
          ${chairs(82)}
          <circle id="d3mc" r="58" fill="#ffffff" stroke="${INK}" stroke-width="4.5"/>
        </g>
        <g id="d3mok"><circle r="32" fill="${OK}"/>${ICON.check(38, 6)}</g>`;

      return { D1: d1, D2: d2, D3: d3 };
    },
    init() {
      P.serp = $('d1serp'); P.serpL = P.serp.getTotalLength();
      P.serp.style.strokeDasharray = `${P.serpL} ${P.serpL}`;
      P.arr = drawable('d3arr'); P.pchk = drawable('d3pchk');
    },
    render(t) {
      // ================= D1: 4 viajes agotadores que se contraen
      {
        const pr = clamp(0.18 + 0.82 * inout(lin(t, 0.05, M.cobrar + 0.35)));
        P.serp.style.strokeDashoffset = (P.serpL * (1 - pr)).toFixed(2);
        const pt = P.serp.getPointAtLength(P.serpL * pr);
        const sq = A(t, M.esperando, 0.55);
        const sy = 1 - 0.78 * sq;
        place($('d1dot'), pt.x, pt.y, 1, (pr < 0.995 ? 1 : 0) * (1 - sq));
        P.Y.forEach((y, k) => {
          const t0 = k === 0 ? -0.5 : 0.45 * k;
          const ps = A(t, t0, 0.38);
          place($('d1s' + k), 360, 326 + (y - 326) * sy, (0.82 + 0.18 * ps) * (1 - 0.28 * sq), ps * (1 - 0.65 * sq));
        });
        // contraccion vertical de los 4 viajes hacia una sola linea antes del pase a QR
        $('d1mid').setAttribute('transform', `translate(0 ${(326 * (1 - sy)).toFixed(2)}) scale(1 ${sy.toFixed(4)})`);
        op($('d1mid'), 1 - 0.55 * sq);
        const pp = A(t, M.quince, IN_D);
        place($('d1pill'), 360, 598 + (1 - pp) * 14, 1, pp);
      }
      // ================= D2: QR -> Tarjeta + 10% propina -> $34.200
      {
        const s0 = S.D2.start, qr = M.qr, tj = M.tarjeta, prp = M.propina;
        const pq = A(t, s0 + 0.05, IN_D);
        $('d2qr').setAttribute('transform', `translate(238 ${(62 + (1 - pq) * 12).toFixed(2)})`); op($('d2qr'), pq);
        const q = lin(t, qr - 0.25, qr + 0.70);
        $('d2scan').setAttribute('transform', `translate(0 ${(24 + 196 * inout(q)).toFixed(2)})`);
        op($('d2scan'), (q > 0 && q < 1) ? Math.min(1, q / 0.14, (1 - q) / 0.14) : 0);

        const pc = A(t, s0 + 0.18, IN_D), pt = A(t, s0 + 0.30, IN_D);
        vis($('d2card'), pc, (1 - pc) * 14); vis($('d2tip'), pt, (1 - pt) * 14);

        const lt0 = A(t, tj, 0.42);
        $('d2cr').setAttribute('fill', mix(CREAM, '#e3f3ea', lt0));
        $('d2cr').setAttribute('stroke', mix(LINE, OK, lt0));
        $('d2cb').setAttribute('stroke', mix(INK, OK, lt0));
        place($('d2ck0'), 324, 356, 0.8 + 0.2 * lt0, lt0);

        const lt1 = A(t, prp, 0.42);
        $('d2tr').setAttribute('fill', mix(CREAM, '#e3f3ea', lt1));
        $('d2tr').setAttribute('stroke', mix(LINE, OK, lt1));
        $('d2tt').setAttribute('fill', mix(INK, OK, lt1));
        place($('d2ck1'), 616, 356, 0.8 + 0.2 * lt1, lt1);

        const ptot = A(t, tj + 0.12, 0.40);
        $('d2tval').textContent = fmtARS(Math.round((30000 + 3000 * lt1) / 100) * 100);
        place($('d2tot'), 360, 608 + (1 - ptot) * 14, 0.94 + 0.06 * ptot, ptot);
      }
      // ================= D3: Posnet -> 1 solo viaje directo a la mesa
      {
        const s0 = S.D3.start, rs = M.resuelve, vj = M.viaje;
        const pp = A(t, s0 + 0.06, IN_D), pm = A(t, s0 + 0.18, IN_D);
        $('d3pos').setAttribute('transform', `translate(166 ${(372 + (1 - pp) * 14).toFixed(2)})`); op($('d3pos'), pp);
        $('d3mesa').setAttribute('transform', `translate(558 ${(372 + (1 - pm) * 14).toFixed(2)})`); op($('d3mesa'), pm);

        // las 3 curvas viejas desaparecen mientras se traza la unica recta verde
        const go = A(t, rs, 0.55);
        [0, 1, 2].forEach(k => op($('d3gh' + k), 0.45 * pm * (1 - A(t, rs - 0.15, 0.45))));
        P.arr(go);
        op($('d3ah'), A(t, rs + 0.35, 0.28));
        const pone = A(t, rs + 0.18, 0.45);
        place($('d3one'), 356, 286 + (1 - pone) * 10, 0.82 + 0.18 * pone, pone);

        // pantalla del posnet: monto exacto -> verde con tilde en "un solo viaje"
        const pamt = A(t, M.monto - 0.15, 0.35), pok = A(t, vj - 0.15, 0.42);
        op($('d3amt'), pamt * (1 - A(t, vj - 0.15, 0.25)));
        $('d3scr').setAttribute('fill', mix('#2b2623', OK, pok));
        P.pchk(A(t, vj, 0.42));

        $('d3mc').setAttribute('fill', mix('#ffffff', '#e3f3ea', pok));
        $('d3mc').setAttribute('stroke', mix(INK, OK, pok));
        place($('d3mok'), 604, 322, 0.8 + 0.2 * pok, pok);
      }
    },
  };
})();
