// Reel 08 · Mesas grandes sin caos (mesa de 8, pedido compartido y cuenta dividida)
// G1: mesa larga de 8 comensales con burbujas de caos (?, $, platos, cuentas) + alerta "8 pedidos · 8 cuentas"
// G2: QR de mesa (sin apps) -> filtros dietarios -> carrito compartido "Mesa 8" (1 -> 8 ítems)
// G3: total $96.000 ÷ 8 personas -> $12.000 c/u -> medios de pago -> sello verde
(function () {
  const P = {};
  const OKS = '#e3f3ea', ACS = '#fceae6', ACL = '#f5c9bf', TX2 = '#8b8178';
  const f2 = v => v.toFixed(2);
  // transform completo con rotacion (place() no rota)
  const rot = (g, x, y, s, r, o) => { g.setAttribute('transform', `translate(${f2(x)} ${f2(y)}) rotate(${f2(r)}) scale(${s.toFixed(4)})`); op(g, o); };
  // mini iconos con trazo constante en pantalla (sw / escala)
  const mini = (name, s = 1, sw = 3.5) => {
    const w = (sw / s).toFixed(3);
    const g = inner => `<g transform="scale(${s})" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
    if (name === 'burger') return g(`<path d="M-18 -3 C-18 -14 -10 -18 0 -18 C10 -18 18 -14 18 -3 Z" fill="#fef1dc"/>
      <path d="M-19 3 Q-15 0 -11 3 T-3 3 T5 3 T13 3 T19 3" stroke="${OK}"/>
      <rect x="-18" y="7" width="36" height="7" rx="3.5" fill="#57534e"/>
      <path d="M-18 17 H18 C18 20 16 21 12 21 H-12 C-16 21 -18 20 -18 17 Z" fill="#fef1dc"/>`);
    if (name === 'wine') return g(`<path d="M-13 -20 H13 C13 -5 8 1 0 1 C-8 1 -13 -5 -13 -20 Z" fill="#efeafe"/>
      <path d="M0 1 V16 M-9 19 H9"/>`);
    if (name === 'pint') return g(`<path d="M-12 -12 L-9.5 17 Q-9 20 -6 20 H6 Q9 20 9.5 17 L12 -12 Z" fill="#f4b53f"/>
      <path d="M-13 -12 C-15 -19 -8 -22 -4 -19 C-1 -23 5 -23 7 -19 C11 -22 16 -18 13 -12 Z" fill="#ffffff"/>`);
    if (name === 'receipt') return g(`<path d="M-12 -17 H12 V17 L8 13 L4 17 L0 13 L-4 17 L-8 13 L-12 17 Z" fill="#ffffff"/>
      <path d="M-5.5 -7 H5.5 M-5.5 2 H5.5"/>`);
    return '';
  };
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

  // ---------- G1: geometria de la mesa larga
  const XS = [195, 305, 415, 525];
  const DIN = [...XS.map(x => ({ x, y: 170, up: true })), ...XS.map(x => ({ x, y: 410, up: false }))];
  const BY = { up: 86, dn: 494 };
  const BUB = 'M-16 -30 H16 A20 20 0 0 1 36 -10 V10 A20 20 0 0 1 16 30 H10 L0 46 L-10 30 H-16 A20 20 0 0 1 -36 10 V-10 A20 20 0 0 1 -16 -30 Z';
  const CONT = {
    q: `<text x="0" y="15" text-anchor="middle" font-size="42" font-weight="800" fill="${ACC}">?</text>`,
    d: `<text x="0" y="14" text-anchor="middle" font-size="38" font-weight="800" fill="${INK}">$</text>`,
    b: mini('burger', 1.05), r: mini('receipt', 1.05), w: mini('wine', 1.05), p: mini('pint', 1.0),
  };
  const KIND = ['q', 'd', 'b', 'q', 'd', 'r', 'q', 'w'];
  const DX = [-6, 7, -5, 8, 6, -7, 5, -8];
  const TILT = [-5, 4, -3, 6, 5, -4, 3, -6];
  // 2 burbujas ya visibles en el cuadro 0 (gancho), el resto estalla con "ocho" -> "frenar"
  const POP = [];
  POP[1] = -1; POP[6] = -1;
  [3, 4, 0, 7, 2, 5].forEach((k, i) => { POP[k] = 0.80 + i * 0.17; });

  // ---------- G2: carrito compartido
  const TILES = [176, 302, 428], TY = 598, CKX = 558;
  const TICON = ['burger', 'wine', 'pint'];

  window.REELS.r08 = {
    build() {
      // ================= G1
      const plates = DIN.map(d => `<circle cx="${d.x}" cy="${d.up ? 256 : 324}" r="18" fill="#ffffff" stroke="${MUTE}" stroke-width="3.5"/>`).join('');
      const diners = DIN.map((d, k) => `<g id="g1d${k}" transform="translate(${d.x} ${d.y})">
          <circle id="g1dc${k}" r="32" fill="${MUTE}"/>
          <g transform="scale(1.1)">${ICON.person}</g>
        </g>`).join('');
      const bubbles = DIN.map((d, k) => `<g id="g1b${k}">
          <path d="${BUB}" fill="#ffffff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"${d.up ? '' : ' transform="scale(1 -1)"'}/>
          ${CONT[KIND[k]]}
        </g>`).join('');
      const C1 = 2 * Math.PI * 24; P.C1 = C1;
      const clock = `<circle r="24" fill="#ffffff" stroke="${ACL}" stroke-width="5"/>
          <circle id="g1ring" r="24" fill="none" stroke="${ACC}" stroke-width="5" stroke-linecap="round" transform="rotate(-90)" stroke-dasharray="${f2(C1)} ${f2(C1)}" stroke-dashoffset="${f2(C1)}"/>
          <path id="g1hand" d="M0 0 V-12" stroke="${ACC}" stroke-width="4" stroke-linecap="round"/>
          <path d="M0 0 L7 4" stroke="${ACC}" stroke-width="4" stroke-linecap="round"/>
          <circle r="3.5" fill="${ACC}"/>`;
      const g1 = `<rect id="g1glow" x="126" y="206" width="468" height="168" rx="40" fill="none" stroke="${ACC}" stroke-width="4" stroke-dasharray="16 12" stroke-linecap="round"/>
        <rect x="140" y="220" width="440" height="140" rx="28" fill="${CREAM}" stroke="${INK}" stroke-width="4"/>
        ${plates}${diners}${bubbles}
        ${pill('g1p', `8 pedidos <tspan id="g1p2">· 8 cuentas</tspan>`, 36, 88, clock, { fill: ACS, stroke: ACL, text: ACC, sw: 2.5 })}`;

      // ================= G2
      const noApp = `<g fill="none" stroke="${OK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="-11" y="-17" width="22" height="34" rx="5"/><path d="M0 -7 V6 M-5 1.5 L0 6 L5 1.5"/></g>
          <path d="M-17 -15 L17 17" stroke="${OKS}" stroke-width="9" stroke-linecap="round"/>
          <path id="g2strike" d="M-17 -15 L17 17" stroke="${ACC}" stroke-width="4.5" stroke-linecap="round" fill="none"/>`;
      const fchk = p => `<circle id="${p}c" r="15" fill="#ffffff" stroke="${MUTE}" stroke-width="3"/><g id="${p}k">${ICON.check(20, 4)}</g>`;
      const cart = `<g fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M-22 -15 H-15 L-9 9 H14 L19 -8 H-12"/><circle cx="-5" cy="17" r="3"/><circle cx="11" cy="17" r="3"/></g>`;
      const slots = TILES.map((x, k) => `<rect id="g2sl${k}" x="${x - 52}" y="${TY - 52}" width="104" height="104" rx="24" fill="none" stroke="${MUTE}" stroke-width="3" stroke-dasharray="9 9"/>`).join('');
      const tiles = TILES.map((x, k) => `<g id="g2ti${k}">
          <rect x="-52" y="-52" width="104" height="104" rx="24" fill="#ffffff" stroke="${LINE}" stroke-width="3"/>
          ${mini(TICON[k], 1.75, 4)}
        </g>`).join('');
      const g2 = `<g id="g2qr">
          <rect x="0" y="0" width="228" height="228" rx="28" fill="#ffffff" stroke="${LINE}" stroke-width="3"/>
          <g transform="translate(14 14)">${fakeQR(25, 200, 23)}</g>
          <rect x="84" y="84" width="60" height="60" rx="14" fill="#ffffff"/>
          <image href="${ASSETS}mark.svg" x="90" y="90" width="48" height="48"/>
          <g id="g2scan"><rect x="8" y="-13" width="212" height="26" rx="13" fill="${ACC}" opacity="0.16"/><rect x="8" y="-3" width="212" height="6" rx="3" fill="${ACC}"/></g>
        </g>
        ${pill('g2app', 'Sin apps', 30, 56, noApp, { fill: OKS, stroke: OK, text: OK, sw: 2.5 })}
        ${pill('g2f0', 'Sin TACC', 30, 64, fchk('g2f0'), { fill: '#ffffff', stroke: LINE, text: INK })}
        ${pill('g2f1', 'Vegano', 30, 64, fchk('g2f1'), { fill: '#ffffff', stroke: LINE, text: INK })}
        <g id="g2cart">
          <rect id="g2cr" x="70" y="420" width="580" height="266" rx="32" fill="${CREAM}" stroke="${LINE}" stroke-width="3"/>
          <g transform="translate(120 468)">${cart}</g>
          <text x="156" y="482" font-size="40" font-weight="800" fill="${INK}" letter-spacing="-0.8">Mesa 8</text>
          <path d="M100 512 H620" stroke="${LINE}" stroke-width="2.5" stroke-linecap="round"/>
          ${slots}
          <circle id="g2ck0" cx="${CKX}" cy="${TY}" r="38" fill="none" stroke="${MUTE}" stroke-width="3" stroke-dasharray="9 9"/>
        </g>
        <g id="g2cnt">
          <rect x="-86" y="-27" width="172" height="54" rx="27" fill="${INK}"/>
          <text id="g2cntt" x="0" y="11" text-anchor="middle" font-size="30" font-weight="800" fill="#ffffff">1 ítem</text>
        </g>
        ${tiles}
        <g id="g2ok"><circle r="38" fill="${OK}"/>${ICON.check(46, 7)}</g>`;

      // ================= G3
      const payIc = {
        card: `<rect x="-15" y="-11" width="30" height="22" rx="4"/><path d="M-15 -3 H15 M-9 5 H-3"/>`,
        qr: `<rect x="-13" y="-13" width="10" height="10" rx="2"/><rect x="3" y="-13" width="10" height="10" rx="2"/><rect x="-13" y="3" width="10" height="10" rx="2"/><path d="M4 4 H6 M11 4 H13 M4 12 H13 M8 8 V9"/>`,
        cash: `<rect x="-17" y="-10" width="34" height="20" rx="4"/><circle cx="0" cy="0" r="4.5"/><path d="M-11 0 H-10 M10 0 H11"/>`,
      };
      const chip = (p, label, ic) => pill(p, label, 28, 62, `<g id="${p}s" fill="none" stroke="${TX2}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${payIc[ic]}</g>`, { fill: '#ffffff', stroke: LINE, text: INK });
      const g3 = `<g id="g3tot">
          <text x="360" y="72" text-anchor="middle" font-size="28" font-weight="800" fill="${TX2}">Total Mesa 8</text>
          <text x="360" y="152" text-anchor="middle" font-size="84" font-weight="800" fill="${INK}" letter-spacing="-2.5">$96.000</text>
        </g>
        <g id="g3div">
          <rect id="g3dr" x="-150" y="-33" width="300" height="66" rx="33" fill="#ffffff" stroke="${LINE}" stroke-width="3"/>
          <text id="g3dt" x="0" y="13" text-anchor="middle" font-size="36" font-weight="800" fill="${INK}" letter-spacing="-0.5">÷ 8 personas</text>
        </g>
        <g id="g3res">
          <rect x="-238" y="-64" width="476" height="128" rx="32" fill="${OKS}" stroke="#bfe3cc" stroke-width="2.5"/>
          <text x="0" y="30" text-anchor="middle" fill="${OK}" font-weight="800" letter-spacing="-2"><tspan id="g3val" font-size="86">$12.000</tspan><tspan font-size="40" dx="10" letter-spacing="-0.5">c/u</tspan></text>
        </g>
        ${chip('g3c0', 'Tarjeta', 'card')}${chip('g3c1', 'QR', 'qr')}${chip('g3c2', 'Efectivo', 'cash')}
        <circle id="g3halo" cx="360" cy="606" r="58" fill="none" stroke="${OK}" stroke-width="4"/>
        <g id="g3seal" transform="translate(360 606)">
          <circle r="58" fill="${OK}"/>
          <circle r="47" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.45"/>
          <path id="g3chk" d="M-24 1 L-7 18 L25 -15" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
        </g>`;

      return { G1: g1, G2: g2, G3: g3 };
    },
    init() {
      P.strike = drawable('g2strike');
      P.chk = drawable('g3chk');
    },
    layout() {
      // medicion de textos con PJS ya cargada (primer render)
      lay('g1p', 52, 18, 30);
      lay('g2app', 36, 12, 24);
      const w0 = lay('g2f0', 30, 12, 20), w1 = lay('g2f1', 30, 12, 20), gp = 20;
      P.fx = [360 - (w0 + gp + w1) / 2 + w0 / 2, 360 + (w0 + gp + w1) / 2 - w1 / 2];
      const cw = [0, 1, 2].map(k => lay('g3c' + k, 36, 10, 22)), cg = 16;
      const tot = cw[0] + cw[1] + cw[2] + 2 * cg; let x = 360 - tot / 2;
      P.cx = cw.map(w => { const c = x + w / 2; x += w + cg; return c; });
      P.laid = true;
    },
    render(t) {
      if (!P.laid) this.layout();
      // ================= G1: mesa de 8 en caos
      {
        const fr = M.frenar, ch = A(t, fr, 0.6);
        DIN.forEach((d, k) => {
          const t0 = POP[k];
          const pb = A(t, t0, 0.40), lit = A(t, t0 - 0.04, 0.30);
          $('g1dc' + k).setAttribute('fill', mix(MUTE, ACC, lit));
          const bump = Math.sin(Math.PI * lin(t, t0, t0 + 0.36));
          place($('g1d' + k), d.x, d.y, 1 + 0.08 * bump, 1);
          // vaiven continuo, mas nervioso desde "frenar"
          const amp = 2.2 + 2.6 * ch, ph = t * (0.9 + 0.5 * ch) + k * 0.37;
          const bob = amp * Math.sin(2 * Math.PI * ph);
          const tilt = TILT[k] * pb + 3.2 * ch * Math.sin(2 * Math.PI * (t * 1.15 + k * 0.23));
          rot($('g1b' + k), d.x + DX[k], (d.up ? BY.up : BY.dn) + bob + (1 - pb) * (d.up ? 12 : -12), 0.55 + 0.45 * pb, tilt, pb);
        });
        // borde coral intermitente: mesa trabada
        const gl = $('g1glow');
        op(gl, ch * (0.55 + 0.45 * Math.sin(2 * Math.PI * (t - fr) * 1.3)));
        gl.style.strokeDashoffset = f2(-(t - fr) * 46);
        // alerta: reloj con anillo de demora + "8 pedidos · 8 cuentas"
        const pp = A(t, fr, IN_D);
        const pul = Math.sin(Math.PI * lin(t, M.cuentas, M.cuentas + 0.42));
        place($('g1p'), 360, 618 + (1 - pp) * 14, (0.96 + 0.04 * pp) * (1 + 0.035 * pul), pp);
        const pr = inout(lin(t, fr + 0.1, S.G1.end - 0.15));
        $('g1ring').setAttribute('stroke-dashoffset', f2(P.C1 * (1 - pr)));
        $('g1hand').setAttribute('transform', `rotate(${f2(540 * pr)})`);
        $('g1p2').setAttribute('fill-opacity', A(t, M.cuentas - 0.12, 0.38).toFixed(3));
      }
      // ================= G2: QR -> sin apps -> filtros -> carrito Mesa 8
      {
        const s0 = S.G2.start;
        const pq = A(t, s0 + 0.04, IN_D);
        $('g2qr').setAttribute('transform', `translate(246 ${f2(18 + (1 - pq) * 12)}) `); op($('g2qr'), pq);
        const q = lin(t, M.qr - 0.30, M.qr + 0.75);
        $('g2scan').setAttribute('transform', `translate(0 ${f2(22 + 184 * inout(q))})`);
        op($('g2scan'), (q > 0 && q < 1) ? Math.min(1, q / 0.14, (1 - q) / 0.14) : 0);
        // badge "Sin apps" + tachado
        const pa = A(t, M.apps - 0.22, 0.42);
        place($('g2app'), 360, 262 + (1 - pa) * 12, 0.9 + 0.1 * pa, pa);
        P.strike(A(t, M.apps, 0.38));
        // filtros dietarios: presentes en neutro, se activan en "filtra"
        [0, 1].forEach(k => {
          const pin = A(t, s0 + 0.30 + k * 0.10, IN_D);
          const on = A(t, M.filtra + 0.05 + k * 0.38, 0.36);
          const bump = Math.sin(Math.PI * lin(t, M.filtra + 0.05 + k * 0.38, M.filtra + 0.43 + k * 0.38));
          place($('g2f' + k), P.fx[k], 352 + (1 - pin) * 14, 1 + 0.05 * bump, pin);
          $('g2f' + k + 'r').setAttribute('fill', mix('#ffffff', OKS, on));
          $('g2f' + k + 'r').setAttribute('stroke', mix(LINE, OK, on));
          $('g2f' + k + 't').setAttribute('fill', mix(INK, OK, on));
          $('g2f' + k + 'c').setAttribute('fill', mix('#ffffff', OK, on));
          $('g2f' + k + 'c').setAttribute('stroke', mix(MUTE, OK, on));
          op($('g2f' + k + 'k'), on);
        });
        // carrito compartido
        const pc = A(t, s0 + 0.45, IN_D);
        vis($('g2cart'), pc, (1 - pc) * 14);
        const su = M.suma;
        const pcn = A(t, su - 0.20, 0.36);
        const cnt = 1 + Math.round(7 * inout(lin(t, su - 0.05, su + 1.15)));
        $('g2cntt').textContent = cnt + (cnt === 1 ? ' ítem' : ' ítems');
        const tick = Math.sin(Math.PI * clamp((t - (su - 0.05)) * 7 % 1)) * (t > su - 0.05 && t < su + 1.15 ? 1 : 0);
        place($('g2cnt'), 534, 467 + (1 - pcn) * 10, 1 + 0.03 * tick, pcn * pc);
        $('g2cr').setAttribute('stroke', mix(LINE, OK, A(t, su + 1.05, 0.35)));
        TILES.forEach((x, k) => {
          const tk = su + 0.08 + k * 0.26;
          const pl = A(t, tk, 0.50);
          const sx = x + (x - 302) * 0.9, sy = TY - 70;
          place($('g2ti' + k), sx + (x - sx) * pl, sy + (TY - sy) * pl, 0.62 + 0.38 * pl, Math.min(1, pl * 1.6) * pc);
          op($('g2sl' + k), pc * (1 - A(t, tk + 0.25, 0.25)));
        });
        const pk = A(t, su + 0.98, 0.40);
        op($('g2ck0'), pc * (1 - pk));
        place($('g2ok'), CKX, TY, 0.7 + 0.3 * pk, pk);
      }
      // ================= G3: $96.000 ÷ 8 -> $12.000 c/u -> pagos -> sello
      {
        const s0 = S.G3.start, dv = M.dividen, sg = M.segundos;
        const pt = A(t, Math.min(M.cerrar - 0.12, s0 + 0.06), IN_D);
        vis($('g3tot'), pt, (1 - pt) * 14);
        const pd = A(t, s0 + 0.18, IN_D), on = A(t, dv - 0.06, 0.34);
        const bump = Math.sin(Math.PI * lin(t, dv - 0.06, dv + 0.36));
        place($('g3div'), 360, 222 + (1 - pd) * 14, 1 + 0.06 * bump, pd);
        $('g3dr').setAttribute('fill', mix('#ffffff', ACC, on));
        $('g3dr').setAttribute('stroke', mix(LINE, ACC, on));
        $('g3dt').setAttribute('fill', mix(INK, '#ffffff', on));
        const pr = A(t, dv + 0.10, 0.45);
        place($('g3res'), 360, 334 + (1 - pr) * 14, 0.92 + 0.08 * pr, pr);
        const cd = ease(lin(t, dv + 0.10, dv + 0.80));
        $('g3val').textContent = fmtARS(Math.round((96000 - 84000 * cd) / 1000) * 1000);
        [0, 1, 2].forEach(k => {
          const pin = A(t, s0 + 0.34 + k * 0.08, IN_D);
          const lt = A(t, dv + 0.62 + k * 0.17, 0.32);
          const b = Math.sin(Math.PI * lin(t, dv + 0.62 + k * 0.17, dv + 0.98 + k * 0.17));
          place($('g3c' + k), P.cx[k], 470 + (1 - pin) * 14, 1 + 0.05 * b, pin);
          $('g3c' + k + 'r').setAttribute('fill', mix('#ffffff', OKS, lt));
          $('g3c' + k + 'r').setAttribute('stroke', mix(LINE, OK, lt));
          $('g3c' + k + 't').setAttribute('fill', mix(INK, OK, lt));
          $('g3c' + k + 's').setAttribute('stroke', mix(TX2, OK, lt));
        });
        const ps = A(t, sg - 0.12, 0.42);
        place($('g3seal'), 360, 606, 0.72 + 0.28 * ps, ps);
        P.chk(A(t, sg + 0.08, 0.40));
        const hl = lin(t, sg + 0.05, sg + 0.80);
        const halo = $('g3halo');
        halo.setAttribute('r', f2(58 + 26 * ease(hl)));
        op(halo, (hl > 0 && hl < 1) ? 0.55 * (1 - hl) : 0);
      }
    },
  };
})();
