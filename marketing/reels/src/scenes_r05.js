// Reel 05 · Piloto 14 días en un solo sector (cierre comercial sin riesgo)
// P1: plano de 3 bloques donde solo Terraza se ilumina en verde mientras el resto sigue igual
// P2: reloj veloz "48 h" + acrílico QR fijo con isotipo mark.svg activado
// P3: calendario de 14 días (2 fines de semana destacados) con curva ascendente de rondas
(function () {
  const P = {};
  const lampIcon = `<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M0 -30 V-14"/><path d="M-28 10 A28 24 0 0 1 28 10 Z"/><path d="M-8 10 A8 8 0 0 0 8 10"/></g>`;
  const cupMini = `<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-22 -22 H22 C22 -2 12 6 0 6 C-12 6 -22 -2 -22 -22 Z"/><path d="M0 6 V24"/><path d="M-16 26 H16"/></g>`;
  const sunAwning = `<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="0" cy="-2" r="14"/>
      ${[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
        const r = a * Math.PI / 180;
        return `<path d="M${(21 * Math.cos(r)).toFixed(1)} ${(-2 + 21 * Math.sin(r)).toFixed(1)} L${(29 * Math.cos(r)).toFixed(1)} ${(-2 + 29 * Math.sin(r)).toFixed(1)}"/>`;
      }).join('')}</g>`;

  window.REELS.r05 = {
    build() {
      // ---------- P1: 3 bloques del restaurante; solo Terraza se enciende en verde
      const X = [148, 360, 572];
      const icons = [lampIcon, cupMini, sunAwning];
      let p1 = `<rect id="p1all" x="36" y="118" width="648" height="430" rx="40" fill="none" stroke="${ACC}" stroke-width="4" stroke-dasharray="12 10"/>`;
      X.forEach((x, k) => {
        p1 += `<g id="p1b${k}">
          <rect id="p1r${k}" x="${x - 94}" y="140" width="188" height="386" rx="30" fill="#f5f0e8" stroke="#ded6c8" stroke-width="3.5"/>
          <g id="p1ic${k}" transform="translate(${x} 204)" style="color:#9c9489">${icons[k]}</g>`;
        for (let j = 0; j < 4; j++) {
          const tx = x + (j % 2 ? 38 : -38), ty = 310 + Math.floor(j / 2) * 96;
          p1 += `<rect id="p1t${k}${j}" x="${tx - 30}" y="${ty - 30}" width="60" height="60" rx="14" fill="#ffffff" stroke="${MUTE}" stroke-width="3.5"/>`;
        }
        p1 += `</g>`;
      });
      p1 += `<text id="p1lbl" x="572" y="598" text-anchor="middle" font-size="38" font-weight="800" fill="${INK}">Terraza</text>
        <g id="p1ok"><circle r="32" fill="${OK}"/>${ICON.check(38, 6)}</g>`;
      P.X = X;

      // ---------- P2: Listo en 48 h (reloj veloz + acrílico QR fijo con mark.svg)
      const ticks = Array.from({ length: 12 }, (_, k) => {
        const a = k * Math.PI / 6;
        return `<path d="M${(86 * Math.cos(a)).toFixed(1)} ${(86 * Math.sin(a)).toFixed(1)} L${(98 * Math.cos(a)).toFixed(1)} ${(98 * Math.sin(a)).toFixed(1)}" stroke="${MUTE}" stroke-width="4" stroke-linecap="round"/>`;
      }).join('');
      const p2 = `<g id="p2clk" transform="translate(194 328)">
          <path d="M-24 -128 H24 M0 -128 V-112" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
          <circle cx="0" cy="0" r="112" fill="${CREAM}" stroke="${LINE}" stroke-width="5"/>
          <circle id="p2ring" cx="0" cy="0" r="112" fill="none" stroke="${OK}" stroke-width="8" stroke-linecap="round" transform="rotate(-90)"/>
          ${ticks}
          <g id="p2hands">
            <path id="p2hr" d="M0 10 V-52" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
            <path id="p2mn" d="M0 14 V-78" stroke="${ACC}" stroke-width="6" stroke-linecap="round"/>
            <circle r="9" fill="${INK}"/>
          </g>
          <g id="p2cok"><circle r="44" fill="${OK}"/>${ICON.check(50, 8)}</g>
        </g>
        <g id="p2pill">
          <rect x="-82" y="-34" width="164" height="68" rx="34" fill="${OK}"/>
          <text x="0" y="13" text-anchor="middle" font-size="38" font-weight="800" fill="#ffffff">48 h</text>
        </g>
        <path id="p2arc" d="M316 328 H378" fill="none" stroke="${OK}" stroke-width="6" stroke-dasharray="2 14" stroke-linecap="round"/>
        <g id="p2qr" transform="translate(514 336)">
          <path d="M-112 132 L-132 162 H132 L112 132 Z" fill="#ece6dc" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
          <rect id="p2qbox" x="-124" y="-136" width="248" height="268" rx="28" fill="#ffffff" stroke="${INK}" stroke-width="4.5"/>
          <g transform="translate(-98 -110)">${fakeQR(25, 196, 29)}</g>
          <rect x="-30" y="-42" width="60" height="60" rx="14" fill="#ffffff"/>
          <image href="${ASSETS}mark.svg" x="-24" y="-36" width="48" height="48"/>
          <rect x="-56" y="104" width="112" height="10" rx="5" fill="${MUTE}"/>
        </g>
        <g id="p2qok"><circle r="34" fill="${OK}"/>${ICON.check(40, 6.5)}</g>`;

      // ---------- P3: Calendario de 14 días (2 fines de semana verdes) + curva ascendente
      let cells = '';
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 7; c++) {
          const cx = 132 + c * 68, cy = 248 + r * 124;
          const wknd = c >= 5;
          cells += `<rect id="p3d${r}${c}" x="${cx}" y="${cy}" width="48" height="92" rx="13" fill="${wknd ? '#ede7dd' : '#efe9df'}" stroke="${wknd ? MUTE : 'none'}" stroke-width="3.5"/>`;
        }
      }
      const curve = `M136 588 Q340 546 586 226`;
      const p3 = `<g id="p3cal">
          <rect x="96" y="128" width="528" height="404" rx="32" fill="${CREAM}" stroke="${LINE}" stroke-width="3.5"/>
          <path d="M96 160 Q96 128 128 128 H592 Q624 128 624 160 V212 H96 Z" fill="${INK}"/>
          <rect x="216" y="106" width="16" height="42" rx="8" fill="#57534e"/>
          <rect x="488" y="106" width="16" height="42" rx="8" fill="#57534e"/>
          <rect x="128" y="148" width="116" height="44" rx="22" fill="${ACC}"/>
          <text x="186" y="179" text-anchor="middle" font-size="28" font-weight="800" fill="#ffffff">14d</text>
          <circle cx="526" cy="170" r="11" fill="${OK}"/>
          <circle cx="566" cy="170" r="11" fill="${OK}"/>
          ${cells}
        </g>
        <g id="p3cg">
          <path id="p3halo" d="${curve}" fill="none" stroke="#ffffff" stroke-width="22" stroke-linecap="round"/>
          <path id="p3curv" d="${curve}" fill="none" stroke="${OK}" stroke-width="12" stroke-linecap="round"/>
          <path id="p3ah" d="M-26 -20 L0 0 L-26 20" transform="translate(586 226) rotate(-52.5)" fill="none" stroke="${OK}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
        </g>`;

      return { P1: p1, P2: p2, P3: p3 };
    },
    init() {
      P.ring = drawable('p2ring');
      P.halo = drawable('p3halo'); P.curv = drawable('p3curv');
    },
    render(t) {
      // ================= P1: sin cambiar todo -> solo Terraza se ilumina en verde
      {
        // pulso breve sobre "cambiar todo... de golpe" que se disipa enseguida
        const pall = A(t, 0.55, 0.45) * (1 - A(t, 2.35, 0.45));
        op($('p1all'), 0.65 * pall);
        $('p1all').style.strokeDashoffset = (-t * 28).toFixed(2);

        const on = A(t, M.proba + 0.15, 0.60);
        $('p1r2').setAttribute('fill', mix('#f5f0e8', '#e3f3ea', on));
        $('p1r2').setAttribute('stroke', mix('#ded6c8', OK, on));
        $('p1r2').setAttribute('stroke-width', (3.5 + 1.5 * on).toFixed(2));
        $('p1ic2').style.color = mix('#9c9489', OK, on);
        $('p1lbl').setAttribute('fill', mix(INK, OK, on));

        for (let j = 0; j < 4; j++) {
          const tj = A(t, M.vereda - 0.20 + 0.28 * j, 0.45);
          const el = $(`p1t2${j}`);
          el.setAttribute('fill', mix('#ffffff', '#c7ebd6', tj));
          el.setAttribute('stroke', mix(MUTE, OK, tj));
        }
        const pok = A(t, M.terraza - 0.10, 0.45);
        place($('p1ok'), 648, 160, 0.8 + 0.2 * pok, pok);
      }
      // ================= P2: Listo en 48 h + QR fijo activado
      {
        const s0 = S.P2.start, hr = M.horas, act = M.activamos, qr = M.qr;
        const pc = A(t, s0 + 0.05, IN_D), pq = A(t, s0 + 0.22, IN_D);
        $('p2clk').setAttribute('transform', `translate(194 ${(328 + (1 - pc) * 14).toFixed(2)})`); op($('p2clk'), pc);
        $('p2qr').setAttribute('transform', `translate(514 ${(336 + (1 - pq) * 14).toFixed(2)})`); op($('p2qr'), pq);

        const spin = inout(lin(t, s0 + 0.15, hr + 0.45));
        $('p2mn').setAttribute('transform', `rotate(${(spin * 720).toFixed(1)})`);
        $('p2hr').setAttribute('transform', `rotate(${(spin * 120).toFixed(1)})`);
        P.ring(spin);

        const cok = A(t, hr + 0.25, 0.42);
        op($('p2hands'), 1 - A(t, hr + 0.20, 0.25));
        place($('p2cok'), 0, 0, 0.8 + 0.2 * cok, cok);

        const pp = A(t, hr + 0.10, 0.45);
        place($('p2pill'), 194, 514 + (1 - pp) * 12, 1, pp);

        const parc = A(t, M.carta - 0.10, 0.40);
        op($('p2arc'), parc); $('p2arc').style.strokeDashoffset = (-t * 28).toFixed(2);

        const lit = A(t, act, 0.45);
        $('p2qbox').setAttribute('stroke', mix(INK, OK, lit));
        const qok = A(t, qr, 0.45);
        place($('p2qok'), 624, 212, 0.8 + 0.2 * qok, qok);
      }
      // ================= P3: 14 días (2 fines de semana) + curva ascendente
      {
        const s0 = S.P3.start;
        const pcal = A(t, s0 + 0.02, 0.38);
        vis($('p3cal'), pcal, (1 - pcal) * 12);

        for (let r = 0; r < 2; r++) {
          for (let c = 5; c < 7; c++) {
            const w = A(t, s0 + 0.14 + 0.16 * r + 0.07 * (c - 5), 0.40);
            const el = $(`p3d${r}${c}`);
            el.setAttribute('fill', mix('#ede7dd', '#cdeed9', w));
            el.setAttribute('stroke', mix(MUTE, OK, w));
          }
        }
        const cr = inout(lin(t, s0 + 0.22, s0 + 1.05));
        op($('p3cg'), Math.min(1, cr / 0.08));
        P.halo(cr); P.curv(cr);
        op($('p3ah'), A(t, s0 + 0.90, 0.28));
      }
    },
  };
})();
