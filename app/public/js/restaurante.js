(async () => {
  const params = new URLSearchParams(location.search);
  const wantDemoAuth = params.get('demo') === '1';
  const $ = (sel) => document.querySelector(sel);

  const EMOJIS = ['🍜', '🍣', '🍙', '🥟', '🍛', '🍱', '🍤', '🍗', '🥢', '🥞', '🫛', '🥗', '🍔', '🍕', '🥩', '🍝', '🌮', '🍡', '🍰', '🍮', '🍨', '🍸', '🍺', '🍷', '🍹', '🧃', '🥤', '🍵', '☕'];
  const COLORS = ['#d9412b', '#2f6bd9', '#2f8a57', '#8b5cf6', '#d97706', '#0d9488', '#db2777', '#4f46e5'];

  let state = null;
  let view = 'pedidos';
  let boardStation = 'todas';
  let designMode = false;
  let delivOpen = false;
  let cancelOpen = false;
  let openTableModalId = null;
  let knownOrders = new Set();
  let knownCalls = new Set();
  let freshIds = new Set();

  // ---------- Autenticación del Panel ----------
  let savedToken = sessionStorage.getItem('salelisto:adminToken') || '';
  if (savedToken) setAuthToken(savedToken);

  async function tryBoot() {
    try {
      if (!getAuthToken() && wantDemoAuth) {
        const r = await apiPost('api/auth/admin', { demo: true });
        setAuthToken(r.token);
        sessionStorage.setItem('salelisto:adminToken', r.token);
      }
      if (!getAuthToken()) throw new Error('AUTH_REQUIRED');
      const conn = await connectStream({ scope: 'staff' }, connectionBanner);
      state = conn.state;
      startPanel();
    } catch (_) {
      showPinGate();
    }
  }

  function showPinGate() {
    $('#adminLayout').hidden = true;
    $('#pinGate').hidden = false;
    $('#pinInput').focus();
  }

  $('#pinForm').onsubmit = async (e) => {
    e.preventDefault();
    const pin = $('#pinInput').value.trim();
    try {
      const res = await apiPost('api/auth/admin', { pin });
      setAuthToken(res.token);
      sessionStorage.setItem('salelisto:adminToken', res.token);
      $('#pinInput').value = '';
      unlockAudio();
      const conn = await connectStream({ scope: 'staff' }, connectionBanner);
      state = conn.state;
      startPanel();
    } catch (err) {
      toast(`⚠️ ${err.message}`);
    }
  };

  await tryBoot();

  async function act(type, payload) {
    try {
      return await dispatch(type, payload);
    } catch (err) {
      if (err.status === 401 || /encargado/i.test(err.message)) {
        sessionStorage.removeItem('salelisto:adminToken');
        setAuthToken('');
        showPinGate();
      }
      toast(`⚠️ ${err.message}`);
      return null;
    }
  }

  function startPanel() {
    $('#pinGate').hidden = true;
    $('#adminLayout').hidden = false;

    knownOrders = new Set(state.orders.filter((o) => o.isOpenSession).map((o) => o.id));
    knownCalls = new Set(state.calls.map((c) => c.id));

    onAudioState((on) => {
      const b = $('#adminAudioBtn');
      b.className = `audio-pill ${on ? 'on' : 'off'}`;
      b.innerHTML = on ? '🔊 <span class="lbl">Sonido activo</span>' : '🔇 <span class="lbl">Activar sonido</span>';
    });
    $('#adminAudioBtn').onclick = () => {
      unlockAudio();
      ding(1);
      toast('🔊 Campana activada en el panel');
    };

    bindPanelEvents();
    renderAll();

    subscribe((s) => {
      state = s;
      const openOrds = s.orders.filter((o) => o.isOpenSession);
      const newOrders = openOrds.filter((o) => !knownOrders.has(o.id) && o.status === 'nuevo');
      const newCalls = s.calls.filter((c) => !knownCalls.has(c.id));

      newOrders.forEach((o) => {
        freshIds.add(o.id);
        setTimeout(() => freshIds.delete(o.id), 5000);
        toast(`🧾 Nuevo pedido (${o.station.toUpperCase()}) · Mesa ${o.tableCode}`);
      });
      newCalls.forEach((c) => {
        toast(c.type === 'mozo' ? `🙋 Mesa ${c.tableCode} llama a ${c.waiterName || 'mozo'}` : `💳 Mesa ${c.tableCode} pide la cuenta`);
      });
      if (newOrders.length || newCalls.length) ding(newCalls.length ? 2 : 1, newCalls.length > 0);

      knownOrders = new Set(openOrds.map((o) => o.id));
      knownCalls = new Set(s.calls.map((c) => c.id));
      renderAll();

      if (openTableModalId && !$('#modalBackdrop').hidden) {
        const stillExists = s.tables.some((t) => t.id === openTableModalId);
        if (stillExists) renderTableOperationalModal(openTableModalId);
      }
    });

    setInterval(renderAll, 30000);
  }

  // ---------- KPIs Reales ----------
  function renderKpis() {
    const k = state.kpis;
    const activeTables = state.tables.filter((t) => t.active);
    const occupied = activeTables.filter((t) => t.sessionId).length;
    const activeOrders = state.orders.filter((o) => o.isOpenSession && !['entregado', 'cancelado'].includes(o.status)).length;
    const availWaiters = state.waiters.filter((w) => w.available).length;

    $('#navWaiters').textContent = availWaiters;
    $('#kpis').innerHTML = [
      ['Ventas cobradas hoy', money(k.closedSalesToday), `${k.closedTablesCount} mesa(s) cerradas · Propinas ${money(k.closedTipsToday)}`],
      ['Consumo en salón ahora', money(k.openConsumption), `${activeOrders} comanda(s) en curso`],
      ['Ocupación y Mozos', `${occupied} / ${activeTables.length} mesas`, `${availWaiters} mozo(s) disponibles ahora`],
      ['Ticket prom. por mesa', money(k.avgTicketClosed), 'Calculado sobre mesas cerradas hoy'],
    ].map(([title, val, sub]) => `<div class="kpi"><small>${title}</small><strong>${val}</strong><span class="sub">${sub}</span></div>`).join('');
  }

  // ---------- 1. Tablero de Comandas ----------
  const NEXT_FLOW = {
    nuevo: { label: 'Aceptar → Preparar', cls: 'btn-primary' },
    cocina: { label: 'Listo (Avisar mozo)', cls: 'btn-ok' },
    listo: { label: 'Entregado', cls: 'btn-ghost' },
  };

  function ticketHtml(o) {
    const mins = Math.floor((Date.now() - o.createdAt) / 60000);
    const late = !['entregado', 'cancelado'].includes(o.status) && mins >= 15;
    const nxt = NEXT_FLOW[o.status];
    const isCancel = o.status === 'cancelado';

    return `<article class="ticket ${o.status} ${freshIds.has(o.id) ? 'fresh' : ''}">
      <div class="ticket-head">
        <strong>Mesa ${escapeHtml(o.tableCode)} <small style="font-weight:600;color:var(--ink-2)">(${escapeHtml(o.blockName)})</small></strong>
        <small class="${late ? 'late' : ''}">#${o.id.slice(1)} · ${timeAgo(o.createdAt)}</small>
      </div>
      <div class="ticket-meta">
        <span class="chip ${o.station === 'barra' ? 'barra' : 'est-cocina'}">${stationLabel(o.station)}</span>
        ${o.waiterName
          ? `<span class="waiter-pill"><span class="waiter-dot" style="background:${escapeHtml(o.waiterColor)}"></span>${escapeHtml(o.waiterName)}</span>`
          : '<span class="chip">Sin mozo</span>'}
        ${isCancel ? `<span class="chip cancelado">Anulado</span>` : ''}
      </div>
      ${o.items.map((i) => `<div class="t-line"><b>${i.qty}×</b>${escapeHtml(i.name)}${i.note ? `<span class="t-note">↳ ${escapeHtml(i.note)}</span>` : ''}</div>`).join('')}
      ${isCancel && o.cancelReason ? `<p class="muted" style="margin-top:4px;font-size:12px">Motivo: ${escapeHtml(o.cancelReason)}</p>` : ''}
      <div class="ticket-foot">
        <strong>${money(o.total)}</strong>
        <div style="display:flex;gap:4px;margin-left:auto">
          ${o.status !== 'nuevo' ? `<button class="btn btn-xs btn-ghost" title="Retroceder estado" data-rev="${o.id}">↩</button>` : ''}
          ${!isCancel && o.status !== 'entregado' ? `<button class="btn btn-xs btn-danger" title="Anular pedido" data-cancel-ord="${o.id}">✕</button>` : ''}
          ${nxt ? `<button class="btn btn-xs ${nxt.cls}" data-adv="${o.id}">${nxt.label}</button>` : ''}
        </div>
      </div>
    </article>`;
  }

  function renderBoard() {
    const filtered = state.orders.filter((o) => boardStation === 'todas' || o.station === boardStation);
    const activeOrds = filtered.filter((o) => o.isOpenSession);
    const cols = [
      { id: 'nuevo', title: 'Nuevos', color: 'var(--accent)' },
      { id: 'cocina', title: 'En preparación', color: 'var(--warn)' },
      { id: 'listo', title: 'Listos (Mozo avisado)', color: 'var(--info)' },
    ];
    const delivered = filtered.filter((o) => o.status === 'entregado').slice().reverse();
    const cancelled = filtered.filter((o) => o.status === 'cancelado').slice().reverse();

    $('#board').innerHTML = cols.map((c) => {
      const list = activeOrds.filter((o) => o.status === c.id);
      return `<div class="col">
        <div class="col-head"><h3><span class="dot-s" style="background:${c.color}"></span>${c.title}</h3><span class="n">${list.length}</span></div>
        ${list.length ? list.map(ticketHtml).join('') : `<div class="col-empty">${c.id === 'nuevo' ? 'Esperando pedidos…' : 'Sin comandas'}</div>`}
      </div>`;
    }).join('')
      + (delivered.length ? `<details class="delivered" id="delivDetails" style="grid-column:1/-1" ${delivOpen ? 'open' : ''}>
          <summary>✔ Entregados hoy (${delivered.length})</summary>
          <div class="delivered-list">${delivered.slice(0, 24).map(ticketHtml).join('')}</div>
        </details>` : '')
      + (cancelled.length ? `<details class="delivered" id="cancelDetails" style="grid-column:1/-1" ${cancelOpen ? 'open' : ''}>
          <summary>✕ Anulados (${cancelled.length})</summary>
          <div class="delivered-list">${cancelled.slice(0, 16).map(ticketHtml).join('')}</div>
        </details>` : '');

    const dd = $('#delivDetails');
    if (dd) dd.ontoggle = () => { delivOpen = dd.open; };
    const cd = $('#cancelDetails');
    if (cd) cd.ontoggle = () => { cancelOpen = cd.open; };

    const newCount = state.orders.filter((o) => o.isOpenSession && o.status === 'nuevo').length;
    $('#navNew').hidden = !newCount;
    $('#navNew').textContent = newCount;
  }

  // ---------- 2. Salón por Bloques y Mesas ----------
  function renderSalon() {
    $('#designToolbar').hidden = !designMode;
    $('#toggleDesignBtn').className = `btn ${designMode ? 'btn-primary' : 'btn-ghost'}`;
    $('#toggleDesignBtn').textContent = designMode ? '✔ Volver a Vista Operativa' : '🛠️ Diseñar bloques y mesas';

    const stLabels = {
      libre: 'Libre',
      ocupada: 'Ocupada',
      mozo: '🙋 Llama al mozo',
      cuenta: '💳 Pide la cuenta',
      inactiva: 'Fuera de servicio',
    };

    if (!state.blocks.length) {
      $('#blocksContainer').innerHTML = `<div class="empty"><span class="big">🏗️</span>Tu salón todavía no tiene bloques.<br><button class="btn btn-primary" style="margin-top:12px" id="emptyAddBlock">+ Agregar primer bloque pre-armado</button></div>`;
      const eb = $('#emptyAddBlock');
      if (eb) eb.onclick = () => openBlockModal(null);
      return;
    }

    $('#blocksContainer').innerHTML = state.blocks.map((b) => {
      const tbls = state.tables.filter((t) => t.blockId === b.id && (designMode || t.active));
      const preWaiters = b.waiterIds.map((wid) => state.waiters.find((w) => w.id === wid)).filter(Boolean);
      const assignTag = state.restaurant.assignmentMode === 'auto' || b.assignmentMode === 'auto'
        ? '<span class="chip">⚡ Asignación automática</span>'
        : preWaiters.length
          ? `<span class="chip entregado">🎯 Sector de: ${preWaiters.map((w) => escapeHtml(w.name)).join(', ')}</span>`
          : '<span class="chip nuevo">⚠️ Pre-asignado sin mozos (usa automático)</span>';

      return `<section class="salon-block">
        <div class="block-head">
          <div class="block-title">
            <span style="font-size:22px">${b.icon}</span>
            <h2>${escapeHtml(b.name)}</h2>
            <span class="muted">(${tbls.length} mesa${tbls.length === 1 ? '' : 's'})</span>
            ${assignTag}
          </div>
          ${designMode ? `<div class="block-actions">
            <button class="btn btn-xs btn-ghost" title="Subir bloque" data-bmove="${b.id}" data-dir="-1">↑</button>
            <button class="btn btn-xs btn-ghost" title="Bajar bloque" data-bmove="${b.id}" data-dir="1">↓</button>
            <button class="btn btn-xs btn-ghost" data-add-table="${b.id}">+ 1 Mesa</button>
            <button class="btn btn-xs btn-ghost" data-bulk-table="${b.id}">+ Varias mesas</button>
            <button class="btn btn-xs btn-ghost" data-edit-block="${b.id}">✏️ Configurar bloque</button>
            <button class="btn btn-xs btn-danger" data-del-block="${b.id}">🗑️</button>
          </div>` : ''}
        </div>
        <div class="tables-grid" style="grid-template-columns: repeat(auto-fill, minmax(${Math.max(145, Math.round(720 / Math.max(2, b.columns)))}px, 1fr))">
          ${tbls.map((t) => `
            <button class="table-tile ${t.status}" data-table-click="${t.id}">
              <div style="display:flex;justify-content:space-between;width:100%;align-items:baseline">
                <span class="num">${escapeHtml(t.code)}</span>
                <small style="font-size:11px;color:var(--ink-3)">${t.seats} pers.</small>
              </div>
              <span class="state">${designMode ? '✏️ Editar mesa / QR' : stLabels[t.status]}</span>
              ${t.waiterName ? `<span class="waiter-pill" style="margin-top:4px"><span class="waiter-dot" style="background:${escapeHtml(t.waiterColor)}"></span>${escapeHtml(t.waiterName)}</span>` : ''}
              ${t.sessionId ? `<span class="amt">${money(t.subtotal)}</span>` : ''}
            </button>`).join('') || '<p class="muted">Sin mesas en este bloque.</p>'}
        </div>
      </section>`;
    }).join('');
  }

  // ---------- 3. Mozos ----------
  function renderWaiters() {
    const isHybrid = state.restaurant.assignmentMode !== 'auto';
    $('#assignBanner').innerHTML = `
      <div>
        <strong>Modo de asignación de mesas a mozos</strong>
        <p class="muted">${isHybrid
          ? 'Híbrido activo: respeta los mozos pre-asignados a cada bloque y balancea automáticamente el resto por menor carga.'
          : '100% Automático activo: cada nueva mesa se asigna al mozo disponible con menos mesas abiertas en todo el local.'}</p>
      </div>
      <div class="pill-group">
        <button class="pill ${isHybrid ? 'active' : ''}" data-gmode="hybrid">🎯 Por Bloques + Automático</button>
        <button class="pill ${!isHybrid ? 'active' : ''}" data-gmode="auto">⚡ 100% Automático</button>
      </div>`;

    if (!state.waiters.length) {
      $('#waitersGrid').innerHTML = '<div class="empty" style="grid-column:1/-1"><span class="big">🏃</span>No hay mozos cargados todavía.<br>Agregá mozos para que el sistema les asigne mesas y les avise en su celular.</div>';
      return;
    }

    $('#waitersGrid').innerHTML = state.waiters.map((w) => {
      const openTables = state.tables.filter((t) => t.waiterId === w.id && t.sessionId);
      const preBlocks = w.blockIds.map((bid) => state.blocks.find((b) => b.id === bid)).filter(Boolean);

      return `<article class="waiter-card ${w.available ? '' : 'off'}" style="border-top-color:${escapeHtml(w.color)}">
        <div class="wc-head">
          <span class="wc-av" style="background:${escapeHtml(w.color)}">${escapeHtml(w.name.slice(0, 1).toUpperCase())}</span>
          <div style="flex:1;min-width:0">
            <strong style="font-size:17px">${escapeHtml(w.name)}</strong>
            <div class="muted">${w.hasPin ? '🔒 Con PIN' : 'Ingreso directo'}</div>
          </div>
          <label class="switch" title="Cambiar disponibilidad en el momento">
            <input type="checkbox" data-wtoggle="${w.id}" ${w.available ? 'checked' : ''}>
            <span class="track"></span>
            ${w.available ? 'Disponible' : 'Fuera'}
          </label>
        </div>

        <div>
          <small class="muted" style="font-weight:700">Mesas atendiendo ahora (${openTables.length}):</small>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
            ${openTables.length
              ? openTables.map((t) => `<span class="chip nuevo">Mesa ${escapeHtml(t.code)}</span>`).join('')
              : '<span class="muted">Ninguna abierta en este instante</span>'}
          </div>
        </div>

        <div>
          <small class="muted" style="font-weight:700">Bloques pre-asignados:</small>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
            ${preBlocks.length
              ? preBlocks.map((b) => `<span class="chip">${b.icon} ${escapeHtml(b.name)}</span>`).join('')
              : '<span class="muted">Disponible para asignación automática general</span>'}
          </div>
        </div>

        <div class="wc-stats">
          <div><span>Ventas hoy (${w.todayClosedTables} mesas)</span><strong>${money(w.todaySales)}</strong></div>
          <div><span>Propinas hoy</span><strong>${money(w.todayTips)}</strong></div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:auto;padding-top:4px">
          <a class="btn btn-xs btn-ghost" href="mozo.html?waiter=${encodeURIComponent(w.id)}" target="_blank">📱 Abrir celular mozo</a>
          <div style="display:flex;gap:4px">
            <button class="icon-btn" title="Editar mozo" data-wedit="${w.id}">✏️</button>
            <button class="icon-btn" title="Eliminar mozo (reasigna sus mesas)" data-wdel="${w.id}">🗑️</button>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  // ---------- 4. Menú, Categorías y Precios ----------
  function renderMenuAdmin() {
    if (!state.categories.length) {
      $('#menuAdmin').innerHTML = '<div class="empty"><span class="big">📖</span>Creá primero una categoría para empezar a cargar platos y bebidas.</div>';
      return;
    }
    $('#menuAdmin').innerHTML = state.categories.map((c) => {
      const items = state.items.filter((i) => i.cat === c.id);
      return `<div class="cat-block">
        <div class="cat-head">
          <h2>
            ${c.icon} ${escapeHtml(c.name)}
            <span class="chip ${c.station === 'barra' ? 'barra' : 'est-cocina'}">${c.station === 'barra' ? '🍸 Va a Barra' : '🍳 Va a Cocina'}</span>
            <span class="muted">(${items.length})</span>
          </h2>
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs btn-ghost" data-cmove="${c.id}" data-dir="-1" title="Subir">↑</button>
            <button class="btn btn-xs btn-ghost" data-cmove="${c.id}" data-dir="1" title="Bajar">↓</button>
            <button class="btn btn-xs btn-ghost" data-cedit="${c.id}">✏️ Editar</button>
            <button class="btn btn-xs btn-danger" data-cdel="${c.id}">🗑️</button>
          </div>
        </div>
        ${items.length ? items.map((i) => `
          <div class="menu-row ${i.available ? '' : 'off'}">
            <span class="thumb">${i.imageUrl ? `<img src="${escapeHtml(i.imageUrl)}" alt="">` : i.emoji}</span>
            <div style="min-width:0">
              <div class="name">
                ${escapeHtml(i.name)}
                ${i.popular ? '<span class="chip nuevo">Popular</span>' : ''}
                ${i.stationOverride ? `<span class="chip ${i.stationOverride === 'barra' ? 'barra' : 'est-cocina'}">${stationLabel(i.stationOverride)}</span>` : ''}
              </div>
              <div class="desc">${escapeHtml(i.desc)}</div>
            </div>
            <span class="price">${money(i.price)}</span>
            <label class="switch">
              <input type="checkbox" data-itoggle="${i.id}" ${i.available ? 'checked' : ''}>
              <span class="track"></span>
              ${i.available ? 'Disponible' : 'Agotado'}
            </label>
            <div class="row-actions">
              <button class="icon-btn" title="Editar" data-iedit="${i.id}">✏️</button>
              <button class="icon-btn" title="Eliminar" data-idel="${i.id}">🗑️</button>
            </div>
          </div>`).join('')
        : '<p class="muted" style="padding:8px 4px">Sin productos en esta categoría.</p>'}
      </div>`;
    }).join('');
  }

  // ---------- 5. Caja y Configuración ----------
  function renderCaja() {
    const k = state.kpis;
    const r = state.restaurant;
    const payEntries = Object.entries(k.byPayment || {});

    $('#cajaAdmin').innerHTML = `
      <div class="caja-grid">
        <div class="caja-card">
          <h3>💵 Resumen de cobros del día</h3>
          <div class="bill-line"><span>Facturación neta (sin propinas)</span><strong>${money(k.closedSalesToday)}</strong></div>
          <div class="bill-line"><span>Propinas registradas</span><strong>${money(k.closedTipsToday)}</strong></div>
          <div class="bill-total"><span>Total cobrado hoy (${k.closedTablesCount} mesas)</span><span>${money(k.closedSalesToday + k.closedTipsToday)}</span></div>
          <h4 style="margin:16px 0 8px;font-size:13px;color:var(--ink-2);text-transform:uppercase">Por medio de pago</h4>
          ${payEntries.length
            ? payEntries.map(([m, amt]) => `<div class="bill-line"><span>${escapeHtml(m)}</span><strong>${money(amt)}</strong></div>`).join('')
            : '<p class="muted">Todavía no se cerraron mesas hoy.</p>'}
        </div>

        <div class="caja-card">
          <h3>⚙️ Configuración del Restaurante</h3>
          <form class="form" id="restConfigForm">
            <div class="field"><label>Nombre del restaurante</label><input class="input" name="name" required value="${escapeHtml(r.name)}"></div>
            <div class="field"><label>Subtítulo / especialidad</label><input class="input" name="subtitle" value="${escapeHtml(r.subtitle || '')}"></div>
            <div class="field">
              <label>Link público en internet (opcional, para QRs 4G/5G)</label>
              <input class="input" name="publicUrl" placeholder="Automático según el dominio donde se abra" value="${escapeHtml(r.publicUrl || '')}">
            </div>
            <div class="field">
              <label>Cambiar PIN de Encargado (dejar vacío para mantener el actual)</label>
              <input class="input" type="password" name="adminPin" placeholder="Nuevo PIN (mínimo 4 caracteres)">
            </div>
            <label class="switch">
              <input type="checkbox" name="demoMode" ${r.demoMode ? 'checked' : ''}>
              <span class="track"></span>
              Permitir Modo Demo (desactivalo al abrir al público real)
            </label>
            <button class="btn btn-primary">Guardar configuración</button>
          </form>

          <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm btn-ghost" id="clearOrdersBtn">🧹 Limpiar solo pedidos/sesiones</button>
            <button class="btn btn-sm btn-danger" id="factoryResetBtn">↺ Restaurar demo de fábrica</button>
          </div>
        </div>
      </div>

      ${state.closedHistory.length ? `
        <div class="caja-card" style="margin-top:16px">
          <h3>🧾 Últimas mesas cerradas hoy</h3>
          ${state.closedHistory.slice(0, 15).map((h) => `
            <div class="bill-line" style="border-bottom:1px solid var(--line);padding:7px 0">
              <span><strong>Mesa ${escapeHtml(h.tableCode)}</strong> (${escapeHtml(h.blockName)}) · Mozo: ${escapeHtml(h.waiterName)} · ${escapeHtml(h.payment)}</span>
              <strong>${money(h.total)} <small class="muted">(prop. ${h.tipPct}%)</small></strong>
            </div>`).join('')}
        </div>` : ''}`;

    $('#restConfigForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const pin = f.get('adminPin').trim();
      if (pin && pin.length < 4) return toast('⚠️ El PIN debe tener al menos 4 caracteres');
      const ok = await act('restaurant.save', {
        name: f.get('name').trim(),
        subtitle: f.get('subtitle').trim(),
        publicUrl: f.get('publicUrl').trim(),
        adminPin: pin,
        demoMode: f.has('demoMode'),
      });
      if (ok) {
        if (pin) {
          const r2 = await apiPost('api/auth/admin', { pin });
          setAuthToken(r2.token);
          sessionStorage.setItem('salelisto:adminToken', r2.token);
        }
        toast('✔ Configuración guardada');
      }
    };

    $('#clearOrdersBtn').onclick = async () => {
      if (!confirm('¿Limpiar todos los pedidos y cuentas del día conservando intactos tus bloques, mesas, mozos y menú?')) return;
      if (await act('data.clear_orders')) toast('🧹 Pedidos limpiados; tu configuración sigue intacta');
    };
    $('#factoryResetBtn').onclick = async () => {
      if (!confirm('⚠️ Atención: esto borrará tu menú personalizado, bloques y mozos y restaurará los datos de demostración originales. ¿Continuar?')) return;
      if (await act('data.reset_demo')) toast('↺ Datos de demostración restaurados');
    };
  }

  // ---------- Barra derecha: Solicitudes en vivo ----------
  function renderCalls() {
    const pending = state.calls.slice().reverse();
    $('#callCount').hidden = !pending.length;
    $('#callCount').textContent = pending.length;
    if (!pending.length) {
      $('#calls').innerHTML = '<div class="empty"><span class="big">☕</span>Sin solicitudes pendientes.<br>Todo tranquilo en el salón.</div>';
      return;
    }
    $('#calls').innerHTML = pending.map((c) => c.type === 'mozo'
      ? `<div class="call mozo">
          <div class="call-head"><strong>🙋 Mesa ${escapeHtml(c.tableCode)} (${escapeHtml(c.blockName)})</strong><small>${timeAgo(c.createdAt)}</small></div>
          <p>Motivo: <strong>${escapeHtml(c.reason)}</strong><br>Mozo: <strong>${escapeHtml(c.waiterName || 'Sin asignar')}</strong> ${c.status === 'en_camino' ? '· 🏃 En camino' : ''}</p>
          <div class="call-actions">
            ${c.status === 'pendiente' ? `<button class="btn btn-xs" data-call-way="${c.id}">En camino</button>` : ''}
            <button class="btn btn-xs" data-call-done="${c.id}">Atendido</button>
          </div>
        </div>`
      : `<div class="call cuenta">
          <div class="call-head"><strong>💳 Mesa ${escapeHtml(c.tableCode)} (${escapeHtml(c.blockName)})</strong><small>${timeAgo(c.createdAt)}</small></div>
          <p>Paga con <strong>${escapeHtml(c.payment)}</strong> · Propina ${c.tip}% → <strong>${money(c.total)}</strong><br>Mozo: <strong>${escapeHtml(c.waiterName || 'Sin asignar')}</strong></p>
          <div class="call-actions">
            <button class="btn btn-xs btn-primary" data-open-bill="${c.tableId}">Ver cuenta y cerrar</button>
          </div>
        </div>`).join('');
  }

  // ---------- Modales ----------
  function openModal(html, onMount) {
    $('#modal').innerHTML = html;
    $('#modalBackdrop').hidden = false;
    onMount?.($('#modal'));
  }
  function closeModal() {
    openTableModalId = null;
    $('#modalBackdrop').hidden = true;
  }

  function renderTableOperationalModal(tableId) {
    const t = state.tables.find((x) => x.id === tableId);
    if (!t) return closeModal();
    openTableModalId = tableId;
    const blk = state.blocks.find((b) => b.id === t.blockId);
    const tOrders = state.orders.filter((o) => o.isOpenSession && o.tableId === t.id);
    const activeOrders = tOrders.filter((o) => o.status !== 'cancelado');
    const pendingDelivery = activeOrders.filter((o) => o.status !== 'entregado').length;
    const billCall = state.calls.find((c) => c.tableId === t.id && c.type === 'cuenta');

    // Agrupar respetando nombre + precio unitario exacto (corrige desfase si cambió un precio entre rondas)
    const grouped = [];
    activeOrders.forEach((o) => o.items.forEach((i) => {
      const key = `${i.name}::${i.price}`;
      let g = grouped.find((x) => x.key === key);
      if (!g) { g = { key, name: i.name, price: i.price, qty: 0 }; grouped.push(g); }
      g.qty += i.qty;
    }));

    const sub = t.subtotal || 0;
    let chosenPay = billCall?.payment || 'Tarjeta';
    let chosenTip = billCall?.tip ?? (billCall ? 0 : 10);

    openModal(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div>
          <h3>${blk ? blk.icon + ' ' + escapeHtml(blk.name) + ' · ' : ''}Mesa ${escapeHtml(t.code)}</h3>
          <p class="muted">Capacidad ${t.seats} personas · Código QR fijo: <code>${escapeHtml(t.qrToken)}</code></p>
        </div>
        <a class="btn btn-xs btn-ghost" href="cliente.html?t=${encodeURIComponent(t.qrToken)}" target="_blank">📱 Abrir QR cliente</a>
      </div>

      ${t.sessionId ? `
        <div class="field" style="margin:12px 0">
          <label>Mozo atendiendo esta mesa</label>
          <select class="input" id="reassignWaiterSel">
            <option value="">-- Sin mozo asignado --</option>
            ${state.waiters.map((w) => `<option value="${w.id}" ${w.id === t.waiterId ? 'selected' : ''}>${escapeHtml(w.name)} ${w.available ? '(En turno)' : '(Fuera de turno)'}</option>`).join('')}
          </select>
        </div>

        <div style="border-top:1px solid var(--line);padding-top:8px">
          ${grouped.length
            ? grouped.map((g) => `<div class="bill-line"><span>${g.qty} × ${escapeHtml(g.name)} <small class="muted">(${money(g.price)} c/u)</small></span><span>${money(g.price * g.qty)}</span></div>`).join('')
            : '<p class="muted">Mesa abierta sin ítems activos.</p>'}
          <div class="bill-total"><span>Subtotal actual</span><span>${money(sub)}</span></div>
        </div>

        ${pendingDelivery ? `<div style="background:var(--warn-soft);color:var(--warn);padding:10px 12px;border-radius:10px;font-size:13px;font-weight:700;margin-top:10px">⚠️ Hay ${pendingDelivery} comanda(s) que todavía figuran sin entregar en Cocina/Barra.</div>` : ''}

        <div class="two" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
          <div class="field">
            <label>Medio de pago</label>
            <select class="input" id="mPaySel">${['Efectivo', 'Tarjeta', 'QR', 'Transferencia'].map((p) => `<option ${p === chosenPay ? 'selected' : ''}>${p}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label>Propina</label>
            <select class="input" id="mTipSel">${[0, 5, 10, 15].map((p) => `<option value="${p}" ${p === chosenTip ? 'selected' : ''}>${p}% (${money(Math.round(sub * p / 100))})</option>`).join('')}</select>
          </div>
        </div>
        <div class="bill-total" style="margin-top:10px"><span>Total a cobrar</span><span id="mGrandTotal">${money(sub + Math.round(sub * chosenTip / 100))}</span></div>
      ` : '<p class="muted" style="margin:16px 0">La mesa está libre. Se abrirá y asignará mozo en cuanto el cliente escanee el QR y pida, o si cargás un pedido manual.</p>'}

      <div class="modal-actions">
        <button class="btn btn-ghost" data-cancel>Cerrar ventana</button>
        <button class="btn btn-ghost" id="manualOrderBtn">+ Pedido manual</button>
        ${t.sessionId ? `<button class="btn btn-primary" id="confirmCloseTableBtn">Cobrar y cerrar mesa</button>` : ''}
      </div>`, (el) => {
      const rw = el.querySelector('#reassignWaiterSel');
      if (rw) {
        rw.onchange = async () => {
          if (!rw.value) return;
          const ok = await act('session.reassign', { tableId: t.id, waiterId: rw.value });
          if (ok) toast(`🪑 Mesa ${t.code} asignada a ${ok.result?.waiterName || 'mozo'}`);
        };
      }
      const tipSel = el.querySelector('#mTipSel');
      if (tipSel) {
        tipSel.onchange = () => {
          const p = Number(tipSel.value);
          el.querySelector('#mGrandTotal').textContent = money(sub + Math.round(sub * p / 100));
        };
      }
      el.querySelector('#manualOrderBtn').onclick = () => openQuickManualOrderModal(t);
      const closeBtn = el.querySelector('#confirmCloseTableBtn');
      if (closeBtn) {
        closeBtn.onclick = async () => {
          let force = false;
          if (pendingDelivery > 0) {
            if (!confirm(`Todavía hay ${pendingDelivery} pedido(s) sin entregar en la Mesa ${t.code}. ¿Marcarlos como entregados y cerrar la cuenta igual?`)) return;
            force = true;
          }
          const pay = el.querySelector('#mPaySel')?.value || 'Efectivo';
          const tip = Number(el.querySelector('#mTipSel')?.value || 0);
          const ok = await act('table.close', { tableId: t.id, payment: pay, tip, force });
          if (ok) {
            closeModal();
            toast(`✔ Mesa ${t.code} cobrada y cerrada`);
          }
        };
      }
    });
  }

  function openQuickManualOrderModal(tbl) {
    openTableModalId = null;
    const availItems = state.items.filter((i) => i.available);
    if (!availItems.length) return toast('No hay productos disponibles en el menú');
    openModal(`
      <h3>Cargar pedido manual · Mesa ${escapeHtml(tbl.code)}</h3>
      <form class="form" id="quickOrdForm">
        <div class="field">
          <label>Producto</label>
          <select class="input" name="itemId">${availItems.map((i) => `<option value="${i.id}">${i.emoji} ${escapeHtml(i.name)} (${money(i.price)} · ${i.effectiveStation === 'barra' ? 'Barra' : 'Cocina'})</option>`).join('')}</select>
        </div>
        <div class="two">
          <div class="field"><label>Cantidad</label><input class="input" type="number" name="qty" min="1" max="30" value="1" required></div>
          <div class="field"><label>Aclaración</label><input class="input" name="note" maxlength="100" placeholder="Opcional"></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-primary">Enviar a Cocina / Barra</button>
        </div>
      </form>`, (el) => {
      el.querySelector('#quickOrdForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const ok = await act('order.create', {
          tableId: tbl.id,
          source: 'caja',
          items: [{ itemId: f.get('itemId'), qty: Number(f.get('qty')), note: f.get('note').trim() }],
        });
        if (ok) {
          toast(`✅ Pedido cargado en Mesa ${tbl.code}`);
          renderTableOperationalModal(tbl.id);
        }
      };
    });
  }

  function openBlockModal(block) {
    openTableModalId = null;
    const templates = state.blockTemplates || [];
    let selectedTpl = block ? (templates.find((t) => t.id === block.template) || templates[0]) : templates[0];
    let amode = block?.assignmentMode || 'auto';

    openModal(`
      <h3>${block ? 'Configurar Bloque' : 'Agregar Bloque Pre-armado'}</h3>
      <form class="form" id="blockForm">
        ${!block ? `
          <div class="field">
            <label>Elegí un bloque pre-armado de referencia</label>
            <div class="tpl-grid" id="tplPicker">
              ${templates.map((t) => `<button type="button" class="tpl-btn ${t.id === selectedTpl.id ? 'sel' : ''}" data-tpl="${t.id}"><span>${t.icon}</span><span>${escapeHtml(t.name)}</span></button>`).join('')}
            </div>
          </div>` : ''}
        <div class="two">
          <div class="field"><label>Nombre del bloque / sector</label><input class="input" name="name" id="bfName" required maxlength="40" value="${escapeHtml(block ? block.name : selectedTpl.name)}"></div>
          <div class="field"><label>Ícono</label><input class="input" name="icon" id="bfIcon" maxlength="8" value="${escapeHtml(block ? block.icon : selectedTpl.icon)}"></div>
        </div>
        <div class="two">
          <div class="field"><label>Columnas visuales en grilla</label><input class="input" type="number" name="columns" id="bfCols" min="1" max="8" value="${block ? block.columns : selectedTpl.columns}"></div>
          <div class="field">
            <label>Asignación de mozos en este bloque</label>
            <select class="input" name="assignmentMode" id="bfMode">
              <option value="auto" ${amode === 'auto' ? 'selected' : ''}>⚡ Automático (menor carga)</option>
              <option value="preassigned" ${amode === 'preassigned' ? 'selected' : ''}>🎯 Pre-asignar mozos fijos</option>
            </select>
          </div>
        </div>
        <div class="field" id="bfWaitersBox" ${amode === 'auto' ? 'hidden' : ''}>
          <label>Mozos asignados a este bloque</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;padding:8px 10px;background:var(--surface-2);border-radius:10px">
            ${state.waiters.length ? state.waiters.map((w) => `
              <label style="display:inline-flex;align-items:center;gap:6px;font-weight:600;cursor:pointer">
                <input type="checkbox" name="waiterId" value="${w.id}" ${block?.waiterIds?.includes(w.id) ? 'checked' : ''}>
                ${escapeHtml(w.name)}
              </label>`).join('') : '<span class="muted">Aún no hay mozos creados.</span>'}
          </div>
        </div>
        ${!block ? `
          <div style="padding:12px;border-radius:12px;background:var(--surface-2);display:grid;gap:10px">
            <strong style="font-size:13px">Mesas iniciales dentro del bloque</strong>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
              <div class="field"><label>Cantidad</label><input class="input" type="number" name="initialTables" id="bfCount" min="0" max="40" value="${selectedTpl.count}"></div>
              <div class="field"><label>Prefijo (ej: T, B)</label><input class="input" name="prefix" id="bfPrefix" maxlength="8" value="${escapeHtml(selectedTpl.prefix)}"></div>
              <div class="field"><label>Sillas c/u</label><input class="input" type="number" name="seats" id="bfSeats" min="1" max="24" value="${selectedTpl.seats}"></div>
            </div>
          </div>` : ''}
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-primary">${block ? 'Guardar cambios' : 'Crear bloque y mesas'}</button>
        </div>
      </form>`, (el) => {
      const modeSel = el.querySelector('#bfMode');
      modeSel.onchange = () => { el.querySelector('#bfWaitersBox').hidden = modeSel.value !== 'preassigned'; };

      const picker = el.querySelector('#tplPicker');
      if (picker) {
        picker.onclick = (e) => {
          const b = e.target.closest('[data-tpl]');
          if (!b) return;
          selectedTpl = templates.find((t) => t.id === b.dataset.tpl) || templates[0];
          picker.querySelectorAll('[data-tpl]').forEach((x) => x.classList.toggle('sel', x === b));
          el.querySelector('#bfName').value = selectedTpl.name;
          el.querySelector('#bfIcon').value = selectedTpl.icon;
          el.querySelector('#bfCols').value = selectedTpl.columns;
          el.querySelector('#bfCount').value = selectedTpl.count;
          el.querySelector('#bfPrefix').value = selectedTpl.prefix;
          el.querySelector('#bfSeats').value = selectedTpl.seats;
        };
      }

      el.querySelector('#blockForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const payload = {
          id: block?.id,
          template: selectedTpl.id,
          name: f.get('name').trim(),
          icon: f.get('icon').trim(),
          columns: Number(f.get('columns')),
          assignmentMode: f.get('assignmentMode'),
          waiterIds: f.getAll('waiterId'),
        };
        if (!block) {
          payload.initialTables = Number(f.get('initialTables'));
          payload.prefix = f.get('prefix').trim();
          payload.seats = Number(f.get('seats'));
        }
        if (await act('block.save', payload)) {
          closeModal();
          toast(block ? 'Bloque actualizado' : `🏗️ Bloque "${payload.name}" creado con sus QRs fijos`);
        }
      };
    });
  }

  function openTableDesignModal(tbl, defaultBlockId) {
    openTableModalId = null;
    const isEdit = Boolean(tbl);
    const cur = tbl || { code: '', blockId: defaultBlockId || state.blocks[0]?.id, seats: 4, active: true };
    openModal(`
      <h3>${isEdit ? `Configurar Mesa ${escapeHtml(tbl.code)}` : 'Nueva Mesa'}</h3>
      <form class="form" id="tblForm">
        <div class="two">
          <div class="field"><label>Código / Nombre (ej: 7, T5, B2)</label><input class="input" name="code" required maxlength="14" value="${escapeHtml(cur.code)}"></div>
          <div class="field"><label>Capacidad (sillas)</label><input class="input" type="number" name="seats" min="1" max="30" value="${cur.seats}"></div>
        </div>
        <div class="field">
          <label>Bloque / Sector</label>
          <select class="input" name="blockId">${state.blocks.map((b) => `<option value="${b.id}" ${b.id === cur.blockId ? 'selected' : ''}>${b.icon} ${escapeHtml(b.name)}</option>`).join('')}</select>
        </div>
        <label class="switch">
          <input type="checkbox" name="active" ${cur.active ? 'checked' : ''}>
          <span class="track"></span>
          Mesa habilitada para recibir pedidos
        </label>
        ${isEdit ? `
          <div style="padding:10px 12px;border-radius:10px;background:var(--surface-2);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
            <div style="font-size:12.5px">Token fijo del QR: <strong><code>${escapeHtml(tbl.qrToken)}</code></strong></div>
            <button type="button" class="btn btn-xs btn-ghost" id="regenQrBtn">🔄 Regenerar QR</button>
          </div>` : ''}
        <div class="modal-actions">
          ${isEdit ? `<button type="button" class="btn btn-danger" id="delTblBtn" style="margin-right:auto">Eliminar mesa</button>` : ''}
          <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-primary">${isEdit ? 'Guardar' : 'Crear mesa'}</button>
        </div>
      </form>`, (el) => {
      if (isEdit) {
        el.querySelector('#regenQrBtn').onclick = async () => {
          if (!confirm('Si regenerás el token, el cartel QR impreso anterior de esta mesa dejará de funcionar y deberás imprimir el nuevo. ¿Continuar?')) return;
          const res = await act('table.regen_qr', { id: tbl.id });
          if (res) {
            toast('🔄 Nuevo token QR generado');
            closeModal();
          }
        };
        el.querySelector('#delTblBtn').onclick = async () => {
          if (!confirm(`¿Eliminar la Mesa ${tbl.code}?`)) return;
          if (await act('table.delete', { id: tbl.id })) {
            closeModal();
            toast('Mesa eliminada');
          }
        };
      }
      el.querySelector('#tblForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        if (await act('table.save', {
          id: tbl?.id,
          code: f.get('code').trim(),
          seats: Number(f.get('seats')),
          blockId: f.get('blockId'),
          active: f.has('active'),
        })) {
          closeModal();
          toast(isEdit ? 'Mesa actualizada' : '🪑 Mesa agregada con su QR fijo');
        }
      };
    });
  }

  function openWaiterModal(w) {
    openTableModalId = null;
    const cur = w || { name: '', color: COLORS[state.waiters.length % COLORS.length], available: true, blockIds: [] };
    let color = cur.color;

    openModal(`
      <h3>${w ? 'Editar Mozo' : 'Agregar Mozo'}</h3>
      <form class="form" id="waiterForm">
        <div class="two">
          <div class="field"><label>Nombre</label><input class="input" name="name" required maxlength="40" value="${escapeHtml(cur.name)}"></div>
          <div class="field"><label>PIN celular (opcional, 4 dígitos)</label><input class="input" name="pin" maxlength="6" placeholder="${w?.hasPin ? 'Dejar vacío = sin PIN' : 'Opcional'}"></div>
        </div>
        <div class="field">
          <label>Color identificador</label>
          <div class="color-pick">${COLORS.map((c) => `<button type="button" class="color-swatch ${c === color ? 'sel' : ''}" data-col="${c}" style="background:${c}"></button>`).join('')}</div>
        </div>
        <div class="field">
          <label>Pre-asignar a bloques específicos (opcional)</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;padding:10px;background:var(--surface-2);border-radius:10px">
            ${state.blocks.map((b) => `
              <label style="display:inline-flex;align-items:center;gap:6px;font-weight:600;cursor:pointer">
                <input type="checkbox" name="blockId" value="${b.id}" ${cur.blockIds?.includes(b.id) ? 'checked' : ''}>
                ${b.icon} ${escapeHtml(b.name)}
              </label>`).join('')}
          </div>
        </div>
        <label class="switch">
          <input type="checkbox" name="available" ${cur.available ? 'checked' : ''}>
          <span class="track"></span>
          Disponible ahora mismo en turno
        </label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-primary">${w ? 'Guardar cambios' : 'Agregar mozo'}</button>
        </div>
      </form>`, (el) => {
      el.querySelectorAll('[data-col]').forEach((b) => b.onclick = () => {
        color = b.dataset.col;
        el.querySelectorAll('[data-col]').forEach((x) => x.classList.toggle('sel', x === b));
      });
      el.querySelector('#waiterForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const res = await act('waiter.save', {
          id: w?.id,
          name: f.get('name').trim(),
          pin: f.get('pin').trim(),
          color,
          available: f.has('available'),
          blockIds: f.getAll('blockId'),
        });
        if (res) {
          closeModal();
          const tr = res.result?.reassigned?.length || 0;
          toast(tr ? `Mozo guardado · ${tr} mesa(s) reasignadas automáticamente` : '🏃 Plantel de mozos actualizado');
        }
      };
    });
  }

  function openCategoryModal(cat) {
    openTableModalId = null;
    const cur = cat || { name: '', icon: '🍽️', station: 'cocina' };
    openModal(`
      <h3>${cat ? 'Editar Categoría' : 'Nueva Categoría del Menú'}</h3>
      <form class="form" id="catForm">
        <div class="two">
          <div class="field"><label>Nombre (ej: Pastas, Tragos, Parrilla)</label><input class="input" name="name" required maxlength="40" value="${escapeHtml(cur.name)}"></div>
          <div class="field"><label>Ícono / Emoji</label><input class="input" name="icon" maxlength="8" value="${escapeHtml(cur.icon)}"></div>
        </div>
        <div class="field">
          <label>¿Adónde entran directo los pedidos de esta categoría?</label>
          <select class="input" name="station">
            <option value="cocina" ${cur.station === 'cocina' ? 'selected' : ''}>🍳 Directo a Cocina</option>
            <option value="barra" ${cur.station === 'barra' ? 'selected' : ''}>🍸 Directo a Barra</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-primary">${cat ? 'Guardar' : 'Crear categoría'}</button>
        </div>
      </form>`, (el) => {
      el.querySelector('#catForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        if (await act('category.save', {
          id: cat?.id,
          name: f.get('name').trim(),
          icon: f.get('icon').trim(),
          station: f.get('station'),
        })) {
          closeModal();
          toast('📖 Categoría guardada');
        }
      };
    });
  }

  function openItemModal(item) {
    openTableModalId = null;
    if (!state.categories.length) return toast('Creá primero una categoría');
    const it = item || { name: '', desc: '', price: '', cat: state.categories[0].id, emoji: '🍜', imageUrl: '', stationOverride: '', available: true, popular: false };
    let emoji = it.emoji;
    let uploadedDataUrl = '';

    openModal(`
      <h3>${item ? 'Editar producto' : 'Nuevo plato / bebida'}</h3>
      <form class="form" id="itemForm">
        <div class="field"><label>Nombre</label><input class="input" name="name" required maxlength="50" value="${escapeHtml(it.name)}"></div>
        <div class="field"><label>Descripción</label><input class="input" name="desc" maxlength="140" value="${escapeHtml(it.desc)}"></div>
        <div class="two">
          <div class="field"><label>Precio ($)</label><input class="input" name="price" type="number" min="0" step="50" required value="${it.price}"></div>
          <div class="field"><label>Categoría</label><select class="input" name="cat">${state.categories.map((c) => `<option value="${c.id}" ${c.id === it.cat ? 'selected' : ''}>${c.icon} ${escapeHtml(c.name)} (${c.station === 'barra' ? 'Barra' : 'Cocina'})</option>`).join('')}</select></div>
        </div>
        <div class="two">
          <div class="field">
            <label>Foto real (subir desde tu dispositivo)</label>
            <input class="input" type="file" id="imgFileInput" accept="image/*" style="padding:7px">
          </div>
          <div class="field">
            <label>O link de foto (opcional)</label>
            <input class="input" name="imageUrl" id="imgUrlInput" placeholder="https://…" value="${escapeHtml(it.imageUrl || '')}">
          </div>
        </div>
        <div class="field"><label>Ícono de respaldo (si no subís foto)</label><div class="emoji-pick">${EMOJIS.map((e) => `<button type="button" data-emoji="${e}" class="${e === emoji ? 'sel' : ''}">${e}</button>`).join('')}</div></div>
        <div class="field">
          <label>Destino de preparación</label>
          <select class="input" name="stationOverride">
            <option value="" ${!it.stationOverride ? 'selected' : ''}>Usar el destino de su categoría</option>
            <option value="cocina" ${it.stationOverride === 'cocina' ? 'selected' : ''}>🍳 Forzar Cocina</option>
            <option value="barra" ${it.stationOverride === 'barra' ? 'selected' : ''}>🍸 Forzar Barra</option>
          </select>
        </div>
        <label class="switch"><input type="checkbox" name="popular" ${it.popular ? 'checked' : ''}><span class="track"></span>Destacar como “Popular”</label>
        <label class="switch"><input type="checkbox" name="available" ${it.available ? 'checked' : ''}><span class="track"></span>Disponible hoy</label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-primary">${item ? 'Guardar cambios' : 'Agregar al menú'}</button>
        </div>
      </form>`, (el) => {
      el.querySelectorAll('[data-emoji]').forEach((b) => b.onclick = () => {
        emoji = b.dataset.emoji;
        el.querySelectorAll('[data-emoji]').forEach((x) => x.classList.toggle('sel', x === b));
      });
      el.querySelector('#imgFileInput').onchange = async (ev) => {
        const file = ev.target.files?.[0];
        if (!file) return;
        try {
          uploadedDataUrl = await compressImageFile(file);
          toast('📷 Imagen lista para guardar');
        } catch (err) {
          toast(`⚠️ ${err.message}`);
        }
      };
      el.querySelector('#itemForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const ok = await act('item.save', {
          id: item?.id,
          name: f.get('name').trim(),
          desc: f.get('desc').trim(),
          price: Number(f.get('price')),
          cat: f.get('cat'),
          emoji,
          imageUrl: f.get('imageUrl').trim(),
          imageData: uploadedDataUrl,
          stationOverride: f.get('stationOverride'),
          popular: f.has('popular'),
          available: f.has('available'),
        });
        if (ok) {
          closeModal();
          toast(item ? 'Producto actualizado' : '✔ Producto agregado al menú');
        }
      };
    });
  }

  function openBulkPriceModal() {
    openTableModalId = null;
    openModal(`
      <h3>📈 Actualizar precios por porcentaje</h3>
      <form class="form" id="bulkForm">
        <div class="field">
          <label>Aplicar sobre</label>
          <select class="input" name="categoryId">
            <option value="">Toda la carta (${state.items.length} productos)</option>
            ${state.categories.map((c) => `<option value="${c.id}">${c.icon} Solo ${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="two">
          <div class="field"><label>Porcentaje (ej: 10 o -5)</label><input class="input" type="number" name="percent" step="0.5" required placeholder="10"></div>
          <div class="field">
            <label>Redondear precios a múltiplo de</label>
            <select class="input" name="roundTo">
              <option value="100" selected>$100</option>
              <option value="50">$50</option>
              <option value="10">$10</option>
              <option value="1">$1 (exacto)</option>
            </select>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-primary">Aplicar ajuste</button>
        </div>
      </form>`, (el) => {
      el.querySelector('#bulkForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const res = await act('menu.adjust_prices', {
          categoryId: f.get('categoryId'),
          percent: Number(f.get('percent')),
          roundTo: Number(f.get('roundTo')),
        });
        if (res) {
          closeModal();
          toast(`📈 Se actualizaron ${res.result?.updated || 0} precios al instante`);
        }
      };
    });
  }

  // ---------- Eventos delegados ----------
  function bindPanelEvents() {
    document.querySelector('.nav').onclick = (e) => {
      const b = e.target.closest('[data-view]');
      if (!b) return;
      view = b.dataset.view;
      document.querySelectorAll('.nav-item').forEach((x) => x.classList.toggle('active', x === b));
      document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${view}`; });
    };

    $('#boardStationFilter').onclick = (e) => {
      const b = e.target.closest('[data-bst]');
      if (!b) return;
      boardStation = b.dataset.bst;
      document.querySelectorAll('[data-bst]').forEach((x) => x.classList.toggle('active', x === b));
      renderBoard();
    };

    $('#board').onclick = async (e) => {
      const adv = e.target.closest('[data-adv]');
      if (adv) { adv.disabled = true; freshIds.delete(adv.dataset.adv); await act('order.advance', { id: adv.dataset.adv }); }
      const rev = e.target.closest('[data-rev]');
      if (rev) { rev.disabled = true; await act('order.revert', { id: rev.dataset.rev }); }
      const can = e.target.closest('[data-cancel-ord]');
      if (can) {
        const reason = prompt('Motivo de anulación (ej: error del cliente, sin stock):', 'Pedido cancelado');
        if (reason === null) return;
        await act('order.cancel', { id: can.dataset.cancelOrd, reason });
        toast('✕ Pedido anulado');
      }
    };

    $('#toggleDesignBtn').onclick = () => {
      designMode = !designMode;
      renderSalon();
    };
    $('#addBlockBtn').onclick = () => openBlockModal(null);

    $('#blocksContainer').onclick = async (e) => {
      const tc = e.target.closest('[data-table-click]');
      if (tc) {
        const tbl = state.tables.find((x) => x.id === tc.dataset.tableClick);
        if (!tbl) return;
        return designMode ? openTableDesignModal(tbl) : renderTableOperationalModal(tbl.id);
      }
      const addT = e.target.closest('[data-add-table]');
      if (addT) return openTableDesignModal(null, addT.dataset.addTable);
      const bulkT = e.target.closest('[data-bulk-table]');
      if (bulkT) {
        const cnt = Number(prompt('¿Cuántas mesas querés agregar a este bloque?', '4') || 0);
        if (!cnt) return;
        const pref = prompt('Prefijo opcional para numerarlas (ej: T, E, S1- o dejar vacío):', '') ?? '';
        const res = await act('table.bulk', { blockId: bulkT.dataset.bulkTable, count: cnt, prefix: pref, seats: 4 });
        if (res) toast(`🪑 ${res.result?.created || cnt} mesas agregadas`);
      }
      const edB = e.target.closest('[data-edit-block]');
      if (edB) return openBlockModal(state.blocks.find((b) => b.id === edB.dataset.editBlock));
      const mvB = e.target.closest('[data-bmove]');
      if (mvB) return act('block.move', { id: mvB.dataset.bmove, dir: Number(mvB.dataset.dir) });
      const delB = e.target.closest('[data-del-block]');
      if (delB) {
        const blk = state.blocks.find((b) => b.id === delB.dataset.delBlock);
        if (!confirm(`¿Eliminar el bloque "${blk?.name}" y todas sus mesas?`)) return;
        if (await act('block.delete', { id: delB.dataset.delBlock })) toast('Bloque eliminado');
      }
    };

    $('#newWaiterBtn').onclick = () => openWaiterModal(null);
    $('#assignBanner').onclick = async (e) => {
      const gm = e.target.closest('[data-gmode]');
      if (!gm) return;
      if (await act('restaurant.save', { assignmentMode: gm.dataset.gmode })) {
        toast(gm.dataset.gmode === 'auto' ? '⚡ Modo 100% Automático activado' : '🎯 Modo Por Bloques + Automático activado');
      }
    };
    $('#waitersGrid').onchange = async (e) => {
      const wt = e.target.closest('[data-wtoggle]');
      if (!wt) return;
      const res = await act('waiter.toggle', { id: wt.dataset.wtoggle, available: wt.checked });
      if (res?.result?.reassigned?.length) {
        toast(`🔄 ${res.result.reassigned.length} mesa(s) abierta(s) fueron reasignadas automáticamente`);
      }
    };
    $('#waitersGrid').onclick = async (e) => {
      const ed = e.target.closest('[data-wedit]');
      if (ed) return openWaiterModal(state.waiters.find((w) => w.id === ed.dataset.wedit));
      const del = e.target.closest('[data-wdel]');
      if (del) {
        const w = state.waiters.find((x) => x.id === del.dataset.wdel);
        if (!confirm(`¿Eliminar a "${w?.name}"? Si tiene mesas abiertas se reasignarán automáticamente a otros mozos disponibles.`)) return;
        const res = await act('waiter.delete', { id: del.dataset.wdel });
        if (res) {
          const n = res.result?.reassigned?.length || 0;
          toast(n ? `Mozo eliminado · ${n} mesa(s) reasignadas automáticamente` : 'Mozo eliminado');
        }
      }
    };

    $('#newCatBtn').onclick = () => openCategoryModal(null);
    $('#newItemBtn').onclick = () => openItemModal(null);
    $('#bulkPriceBtn').onclick = () => openBulkPriceModal();

    $('#menuAdmin').onchange = (e) => {
      const t = e.target.closest('[data-itoggle]');
      if (t) act('item.toggle', { id: t.dataset.itoggle, available: t.checked });
    };
    $('#menuAdmin').onclick = async (e) => {
      const cm = e.target.closest('[data-cmove]');
      if (cm) return act('category.move', { id: cm.dataset.cmove, dir: Number(cm.dataset.dir) });
      const ce = e.target.closest('[data-cedit]');
      if (ce) return openCategoryModal(state.categories.find((c) => c.id === ce.dataset.cedit));
      const cd = e.target.closest('[data-cdel]');
      if (cd) {
        if (!confirm('¿Eliminar esta categoría vacía?')) return;
        if (await act('category.delete', { id: cd.dataset.cdel })) toast('Categoría eliminada');
      }
      const ie = e.target.closest('[data-iedit]');
      if (ie) return openItemModal(state.items.find((i) => i.id === ie.dataset.iedit));
      const idel = e.target.closest('[data-idel]');
      if (idel) {
        const it = state.items.find((i) => i.id === idel.dataset.idel);
        if (!confirm(`¿Eliminar "${it?.name}" del menú?`)) return;
        if (await act('item.delete', { id: idel.dataset.idel })) toast('Producto eliminado');
      }
    };

    $('#calls').onclick = (e) => {
      const w = e.target.closest('[data-call-way]');
      if (w) act('call.status', { id: w.dataset.callWay, status: 'en_camino' });
      const d = e.target.closest('[data-call-done]');
      if (d) act('call.status', { id: d.dataset.callDone, status: 'atendida' });
      const b = e.target.closest('[data-open-bill]');
      if (b) renderTableOperationalModal(b.dataset.openBill);
    };

    $('#modalBackdrop').onclick = (e) => {
      if (e.target.id === 'modalBackdrop' || e.target.closest('[data-cancel]')) closeModal();
    };
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  }

  function renderAll() {
    $('#restName').textContent = state.restaurant.name;
    renderKpis();
    renderBoard();
    renderSalon();
    renderWaiters();
    renderMenuAdmin();
    renderCaja();
    renderCalls();
  }
})();
