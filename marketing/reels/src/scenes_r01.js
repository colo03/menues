// Reel 01 · Sin celulares en el salón (Objeción #1: estética del salón)
// A1: celular con notificaciones -> señal de prohibido ("En tu salón, jamás")
// A2: Estación fija del pase (pantalla horizontal, 3 columnas de mozos que se encienden)
// A3: sale el plato -> la pulsera vibra y marca el tilde
(function () {
  const WCOL = [ACC, OK, BAR];
  const P = {};
  window.REELS.r01 = {
    build() {
      // ---------- A1
      let a1 = `<g id="a1ph" transform="translate(360 360)">
          <rect x="-105" y="-190" width="210" height="380" rx="38" fill="${INK}"/>
          <rect x="-91" y="-170" width="182" height="340" rx="26" fill="#f3eee6"/>
          <rect x="-26" y="-182" width="52" height="6" rx="3" fill="#57534e"/>
          <rect x="-34" y="150" width="68" height="6" rx="3" fill="${MUTE}"/>
          ${[ACC, KIT, BAR].map((c, k) => `<g id="a1n${k}">
            <rect x="-76" y="-27" width="152" height="58" rx="16" fill="#ffffff" stroke="${LINE}" stroke-width="2"/>
            <circle cx="-48" cy="2" r="14" fill="${c}"/>
            <rect x="-24" y="-10" width="80" height="9" rx="4.5" fill="${MUTE}"/>
            <rect x="-24" y="7" width="52" height="9" rx="4.5" fill="#e8e1d6"/></g>`).join('')}
        </g>`;
      a1 += prohibSVG('a1x', 360, 360, 252, 26);
      // ---------- A2
      let cols = '';
      WCOL.forEach((c, k) => {
        const x0 = -256 + k * 176;
        cols += `<rect id="a2col${k}" x="${x0}" y="-151" width="160" height="302" rx="14" fill="#36302c"/>
          <rect id="a2hd${k}" x="${x0}" y="-151" width="160" height="58" rx="14" fill="#3d3631"/>
          <circle cx="${x0 + 32}" cy="-122" r="15" fill="#ffffff"/>
          <rect x="${x0 + 56}" y="-128" width="78" height="12" rx="6" fill="#ffffff" opacity="0.8"/>`;
        [0, 1].forEach(j => {
          const y = -78 + j * 96, sc = (k + j) % 2 ? BAR : KIT;
          cols += `<g id="a2tk${k}${j}">
            <rect x="${x0 + 12}" y="${y}" width="136" height="80" rx="12" fill="#ffffff"/>
            <rect x="${x0 + 12}" y="${y}" width="12" height="80" rx="6" fill="${sc}"/>
            <rect x="${x0 + 38}" y="${y + 18}" width="64" height="12" rx="6" fill="${INK}"/>
            <rect x="${x0 + 38}" y="${y + 42}" width="92" height="9" rx="4.5" fill="${MUTE}"/>
            <rect x="${x0 + 38}" y="${y + 58}" width="60" height="9" rx="4.5" fill="#e8e1d6"/>
            <rect id="a2gl${k}${j}" x="${x0 + 10}" y="${y - 2}" width="140" height="84" rx="14" fill="none" stroke="#4ade80" stroke-width="4"/></g>`;
        });
      });
      const a2 = `<g id="a2mon" transform="translate(360 318)">
          <path d="M0 185 V236 M-92 246 H92" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
          <rect x="-290" y="-185" width="580" height="370" rx="30" fill="${INK}"/>
          <rect x="-272" y="-167" width="544" height="334" rx="18" fill="#2b2623"/>
          ${cols}
        </g>`;
      // ---------- A3
      const a3 = `<g id="a3plate">
          <circle id="a3ring" cx="0" cy="0" r="96" fill="none" stroke="${KIT}" stroke-width="4"/>
          <circle cx="0" cy="8" r="112" fill="#fef1dc" opacity="0.65"/>
          <g transform="translate(0 4)">${ICON.cloche}</g></g>
        <path id="a3arc" d="M304 268 Q352 194 404 252" fill="none" stroke="${MUTE}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 15"/>
        <circle id="a3dot" r="10" fill="${ACC}"/>
        <g transform="translate(532 360) scale(0.98)">${ICON.band('a3')}</g>`;
      return { A1: a1, A2: a2, A3: a3 };
    },
    init() {
      P.xc = drawable('a1xc'); P.xs = drawable('a1xs');
      P.arc = $('a3arc'); P.arcL = P.arc.getTotalLength();
    },
    render(t) {
      // ================= A1
      {
        const jm = M.jamas;
        [0, 1, 2].forEach(k => {
          const t0 = [-0.5, 0.30, 0.75][k];
          const p = A(t, t0, 0.42);
          place($('a1n' + k), 0, -112 + k * 76 + (1 - p) * 16, 0.9 + 0.1 * p, p);
        });
        // zumbido del celular con cada notificacion
        let rot = 0;
        [1, 2].forEach(k => { const t0 = [-0.5, 0.30, 0.75][k], u = lin(t, t0, t0 + 0.32); if (u > 0 && u < 1) rot += 2.2 * Math.sin(u * Math.PI * 6) * (1 - u); });
        const dim = A(t, jm + 0.30, 0.45);
        $('a1ph').setAttribute('transform', `translate(360 360) rotate(${rot.toFixed(3)}) scale(${(1.1 - 0.07 * dim).toFixed(4)})`);
        op($('a1ph'), 1 - 0.62 * dim);
        P.xc(A(t, jm - 0.05, 0.55)); P.xs(A(t, jm + 0.30, 0.38));
      }
      // ================= A2
      {
        const s0 = S.A2.start;
        const pm = A(t, s0 + 0.06, IN_D);
        $('a2mon').setAttribute('transform', `translate(360 ${(318 + (1 - pm) * 14).toFixed(2)})`);
        WCOL.forEach((c, k) => {
          const lt = A(t, M.columna + 0.18 * k, 0.5);
          $('a2hd' + k).setAttribute('fill', mix('#3d3631', c, lt));
          $('a2col' + k).setAttribute('fill', mix('#36302c', '#433a34', lt));
          [0, 1].forEach(j => {
            const pt = A(t, M.estacion + 0.10 + 0.14 * k + 0.20 * j, 0.42);
            const g = $(`a2tk${k}${j}`); op(g, pt); g.setAttribute('transform', `translate(0 ${((1 - pt) * -18).toFixed(2)})`);
            const gl = A(t, M.pase + 0.14 * k, 0.35) * (1 - A(t, M.pase + 0.14 * k + 0.55, 0.45));
            op($(`a2gl${k}${j}`), j === 0 ? gl : 0);
          });
        });
      }
      // ================= A3
      {
        const sl = M.sale, vb = M.vibra;
        const pp = A(t, sl - 0.12, IN_D);
        place($('a3plate'), 172 - (1 - pp) * 26, 372, 1.18, pp);
        const rr = lin(t, sl, sl + 0.9), ring = $('a3ring');
        ring.setAttribute('r', (96 + 70 * ease(rr)).toFixed(2)); ring.style.opacity = (rr > 0 && rr < 1) ? (0.6 * (1 - rr)).toFixed(3) : 0;
        const pa = A(t, M.plato - 0.05, 0.40) * (1 - A(t, vb + 0.05, 0.35));
        op(P.arc, pa); P.arc.style.strokeDashoffset = (-t * 30).toFixed(2);
        const u = inout(lin(t, M.plato, M.plato + 0.62));
        const pt = P.arc.getPointAtLength(P.arcL * u);
        place($('a3dot'), pt.x, pt.y, 1, (u > 0 && u < 1) ? Math.min(1, u / 0.1, (1 - u) / 0.1) : 0);
        const pb = A(t, S.A3.start + 0.22, IN_D);
        bandAnim('a3', t, vb, M.pulsera, (1 - pb) * 12, pb);
      }
    },
  };
})();
