(async () => {
  const $ = (sel) => document.querySelector(sel);

  const PAY_ICONS = {
    Tarjeta: '💳',
    Efectivo: '💵',
    QR: '📱',
    Transferencia: '🏦',
  };

  let state = null;
  let theme = localStorage.getItem('salelisto:paseTheme') === 'light' ? 'light' : 'dark';
  let soundMuted = localStorage.getItem('salelisto:paseMuted') === '1';
  let audioReady = false;

  let knownReadyIds = new Set();
  let knownPendingCalls = new Set();
  let freshCardIds = new Set();

  // Estado del modal "+ Pedido en mostrador"
  let modalOpen = false;
  let orderTableId = '';
  let orderWaiterId = '';
  let orderCatId = 'all';
  let orderSearch = '';
  let counterCart = []; // [{ key, itemId, qty, note }]

  // ---------- Tema Oscuro / Claro en 1 clic ----------
  function applyTheme(nextTheme) {
    theme = nextTheme === 'light' ? 'light' : 'dark';
    document.body.dataset.theme = theme;
    localStorage.setItem('salelisto:paseTheme', theme);
    const btn = $('#pThemeBtn');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
    }
  }
  applyTheme(theme);

  $('#pThemeBtn').onclick = () => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // ---------- Reloj en vivo ----------
  function updateClock() {
    const el = $('#pClock');
    if (!el) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    el.textContent = `${hh}:${mm}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ---------- Pantalla Completa ----------
  function syncFullscreenBtn() {
    const btn = $('#pFsBtn');
    if (!btn) return;
    btn.textContent = document.fullscreenElement ? '⛶ Salir' : '⛶ Pantalla completa';
  }
  document.addEventListener('fullscreenchange', syncFullscreenBtn);

  $('#pFsBtn').onclick = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
      syncFullscreenBtn();
    } catch (_) {
      toast('Tu navegador bloqueó pantalla completa en esta vista');
    }
  };

  // ---------- Sonido (unlockAudio + ding de ui.js) ----------
  function syncAudioBtn() {
    const btn = $('#pAudioBtn');
    if (!btn) return;
    const active = audioReady && !soundMuted;
    btn.className = `audio-pill ${active ? 'on' : 'off'}`;
    if (active) {
      btn.textContent = '🔔 Activo';
    } else if (soundMuted && audioReady) {
      btn.textContent = '🔇 Silenciado';
    } else {
      btn.textContent = '🔇 Activar sonido';
    }
  }

  onAudioState((unlocked) => {
    audioReady = unlocked;
    syncAudioBtn();
  });

  $('#pAudioBtn').onclick = () => {
    if (!audioReady || soundMuted) {
      soundMuted = false;
      localStorage.removeItem('salelisto:paseMuted');
      unlockAudio();
      ding(1, false);
      syncAudioBtn();
      toast('🔔 Sonido de retiros y llamados activo');
    } else {
      soundMuted = true;
      localStorage.setItem('salelisto:paseMuted', '1');
      syncAudioBtn();
      toast('🔇 Campana silenciada en esta pantalla');
    }
  };

  // ---------- Wrapper API hacia POST api/action ----------
  async function apiAction(type, payload = {}) {
    return dispatch(type, payload);
  }

  // ---------- Autenticación igual a cocina.html ----------
  let token = sessionStorage.getItem('salelisto:kdsToken') || '';
  if (token) setAuthToken(token);

  function askPinViaGate() {
    return new Promise((resolve) => {
      const gate = $('#pPinGate');
      const app = $('#pApp');
      const form = $('#pPinForm');
      const input = $('#pPinInput');
      app.hidden = true;
      gate.hidden = false;
      input.value = '';
      setTimeout(() => input.focus(), 40);

      form.onsubmit = async (e) => {
        e.preventDefault();
        const pin = input.value.trim();
        if (!pin) return;
        try {
          const res = await apiPost('api/auth/kitchen', { pin });
          token = res.token;
          setAuthToken(token);
          sessionStorage.setItem('salelisto:kdsToken', token);
          unlockAudio();
          gate.hidden = true;
          app.hidden = false;
          resolve(true);
        } catch (err) {
          toast(`⚠️ ${err.message}`);
          input.select();
        }
      };
    });
  }

  async function ensureKitchenAuth() {
    try {
      const res = await apiPost('api/auth/kitchen', {});
      token = res.token;
      setAuthToken(token);
      sessionStorage.setItem('salelisto:kdsToken', token);
      $('#pPinGate').hidden = true;
      $('#pApp').hidden = false;
      return true;
    } catch (_) {
      return askPinViaGate();
    }
  }

  if (!token) {
    await ensureKitchenAuth();
  }

  let conn;
  try {
    conn = await connectStream({ scope: 'staff' }, connectionBanner);
  } catch (_) {
    sessionStorage.removeItem('salelisto:kdsToken');
    setAuthToken('');
    await ensureKitchenAuth();
    conn = await connectStream({ scope: 'staff' }, connectionBanner);
  }

  state = conn.state;

  // ---------- Helpers de asignación y cálculo ----------
  function getReadyOrders(s) {
    return (s.orders || [])
      .filter((o) => o.isOpenSession && o.status === 'listo')
      .slice()
      .sort((a, b) => (a.updatedAt || a.createdAt) - (b.updatedAt || b.createdAt));
  }

  function getPendingCalls(s, callType) {
    return (s.calls || [])
      .filter((c) => c.status === 'pendiente' && (!callType || c.type === callType))
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function callSignature(c) {
    return `${c.id}:${c.type}:${c.status}:${c.payment || ''}:${c.tip ?? ''}:${c.reason || ''}`;
  }

  function seedKnownAlerts(s) {
    knownReadyIds = new Set(getReadyOrders(s).map((o) => o.id));
    knownPendingCalls = new Set(getPendingCalls(s).map(callSignature));
  }

  function resolveColumnWaiterId(entity, s, activeWaiterIds, tableMap, blockMap) {
    if (entity.waiterId && activeWaiterIds.has(entity.waiterId)) {
      return entity.waiterId;
    }
    const tbl = tableMap.get(entity.tableId);
    if (tbl?.waiterId && activeWaiterIds.has(tbl.waiterId)) {
      return tbl.waiterId;
    }
    if (tbl && s.restaurant?.assignmentMode !== 'auto') {
      const blk = blockMap.get(tbl.blockId);
      if (blk?.assignmentMode === 'preassigned' && Array.isArray(blk.waiterIds)) {
        const pre = blk.waiterIds.find((wid) => activeWaiterIds.has(wid));
        if (pre) return pre;
      }
    }
    return '__orphan__';
  }

  function calcExactBill(call, s, tableMap) {
    const tbl = tableMap.get(call.tableId);
    let sub = typeof call.subtotal === 'number' && call.subtotal > 0 ? call.subtotal : (tbl?.subtotal || 0);
    if (!sub && call.sessionId) {
      sub = (s.orders || [])
        .filter((o) => o.sessionId === call.sessionId && o.status !== 'cancelado')
        .reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    }
    const tipPct = Number(call.tip ?? 0);
    const tipAmount = Math.round((sub * tipPct) / 100);
    const total = sub + tipAmount;
    return { sub, tipPct, tipAmount, total };
  }

  function formatWaitBadge(ts, lateThresholdMin = 5) {
    const mins = Math.max(0, Math.floor((Date.now() - (ts || Date.now())) / 60000));
    const late = mins >= lateThresholdMin;
    const text = mins < 1 ? 'Recién' : `${mins} min`;
    return `<span class="p-wait ${late ? 'late' : ''}">${late ? `⏱️ ${text}` : text}</span>`;
  }

  // ---------- Renderizado de tarjetas ----------
  function renderReadyCard(o) {
    const isBarra = o.station === 'barra';
    const cardCls = isBarra ? 'card-barra' : 'card-cocina';
    const pillLabel = isBarra ? '🍸 RETIRAR EN BARRA' : '🍳 RETIRAR EN COCINA';
    const freshCls = freshCardIds.has(o.id) ? 'fresh' : '';

    return `<article class="p-card ${cardCls} ${freshCls}">
      <div class="p-card-top">
        <span class="p-kind-pill">${pillLabel}</span>
        ${formatWaitBadge(o.updatedAt || o.createdAt, 5)}
      </div>
      <div class="p-mesa-row">
        <div class="p-mesa-code">MESA ${escapeHtml(o.tableCode)}</div>
        <div class="p-mesa-block">${escapeHtml(o.blockName || '')}</div>
      </div>
      <div class="p-items">
        ${(o.items || []).map((i) => `
          <div>
            <div class="p-item-line">
              <span class="p-qty">${i.qty}×</span>
              <span>${i.emoji ? `${escapeHtml(i.emoji)} ` : ''}${escapeHtml(i.name)}</span>
            </div>
            ${i.note ? `<div class="p-item-note">⚠️ ${escapeHtml(i.note)}</div>` : ''}
          </div>
        `).join('')}
      </div>
      <button class="p-act-btn" type="button" data-act="deliver" data-oid="${escapeHtml(o.id)}">
        ✔ Ya lo llevé
      </button>
    </article>`;
  }

  function renderBillCard(c, s, tableMap) {
    const { sub, tipPct, tipAmount, total } = calcExactBill(c, s, tableMap);
    const payIcon = PAY_ICONS[c.payment] || '💳';
    const freshCls = freshCardIds.has(c.id) ? 'fresh' : '';

    return `<article class="p-card card-cuenta ${freshCls}">
      <div class="p-card-top">
        <span class="p-kind-pill">💳 CUENTA PEDIDA</span>
        ${formatWaitBadge(c.createdAt, 4)}
      </div>
      <div class="p-mesa-row">
        <div class="p-mesa-code">MESA ${escapeHtml(c.tableCode)}</div>
        <div class="p-mesa-block">${escapeHtml(c.blockName || '')}</div>
      </div>
      <div class="p-bill-box">
        <div class="p-bill-tags">
          <span class="p-pay-tag">${payIcon} ${escapeHtml(c.payment || 'Tarjeta')}</span>
          <span class="p-tip-tag">${tipPct > 0 ? `Propina ${tipPct}%` : 'Sin propina (0%)'}</span>
        </div>
        <div class="p-bill-total-row">
          <span class="p-bill-total-lbl">Total a cobrar</span>
          <strong class="p-bill-total">${money(total)}</strong>
        </div>
        ${tipPct > 0 ? `<div class="p-bill-sub">Consumo ${money(sub)} + Propina ${money(tipAmount)}</div>` : ''}
      </div>
      <button class="p-act-btn" type="button" data-act="attend-bill" data-cid="${escapeHtml(c.id)}">
        ✔ Llevando cobro
      </button>
    </article>`;
  }

  function renderMozoCallCard(c) {
    const freshCls = freshCardIds.has(c.id) ? 'fresh' : '';
    return `<article class="p-card card-llama ${freshCls}">
      <div class="p-card-top">
        <span class="p-kind-pill">🙋 MESA LLAMA</span>
        ${formatWaitBadge(c.createdAt, 3)}
      </div>
      <div class="p-mesa-row">
        <div class="p-mesa-code">MESA ${escapeHtml(c.tableCode)}</div>
        <div class="p-mesa-block">${escapeHtml(c.blockName || '')}</div>
      </div>
      <div class="p-reason-box">
        ${escapeHtml(c.reason || 'Consulta en mesa')}
      </div>
      <button class="p-act-btn" type="button" data-act="attend-call" data-cid="${escapeHtml(c.id)}">
        ✔ Voy
      </button>
    </article>`;
  }

  function renderWaiterColumn(col) {
    const { id, name, color, isOrphan, sectorNames, openTables, ready, bills, calls, inFlightBillTableIds } = col;
    const urgentCount = ready.length + bills.length + calls.length;

    const metaParts = [];
    if (!isOrphan) {
      metaParts.push(`${openTables.length} mesa${openTables.length === 1 ? '' : 's'} activa${openTables.length === 1 ? '' : 's'}`);
      if (sectorNames.length) metaParts.push(sectorNames.join(', '));
    } else {
      metaParts.push('Sin mozo en turno asignado');
    }

    const cardsHtml = urgentCount > 0
      ? `${ready.map(renderReadyCard).join('')}${bills.map((c) => renderBillCard(c, state, new Map(state.tables.map((t) => [t.id, t])))).join('')}${calls.map(renderMozoCallCard).join('')}`
      : `<div class="p-all-clear">
          <span class="p-clear-ico">✔</span>
          <h3>Todo al día</h3>
          <p>Sin retiros ni llamados pendientes</p>
        </div>`;

    const openTablesHtml = !isOrphan
      ? `<div class="p-open-wrap">
          <div class="p-open-title">
            <span>Mesas abiertas (${openTables.length})</span>
            ${openTables.length ? '<span>Tocar mesa para gestionar</span>' : ''}
          </div>
          ${openTables.length
            ? `<div class="p-open-chips">
                ${openTables.map((t) => {
                  const cobrando = inFlightBillTableIds.has(t.id);
                  return `<button class="p-tbl-chip ${cobrando ? 'cobrando' : ''}" type="button" data-open-tbl="${escapeHtml(t.id)}" data-wid="${escapeHtml(id)}">
                    <span>Mesa ${escapeHtml(t.code)}</span>
                    <small>${cobrando ? '💳 En cobro · ' : ''}${money(t.subtotal)}</small>
                  </button>`;
                }).join('')}
              </div>`
            : '<div class="p-no-tables">Sin mesas abiertas en este momento</div>'}
        </div>`
      : '';

    return `<section class="p-col ${isOrphan ? 'col-orphan' : ''}" style="--w-color:${escapeHtml(color)}">
      <div class="p-col-head">
        <div class="p-waiter-id">
          <span class="p-waiter-av">${isOrphan ? '!' : escapeHtml(name.slice(0, 1).toUpperCase())}</span>
          <div style="min-width:0">
            <h2 class="p-wname">${escapeHtml(name)}</h2>
            <div class="p-wmeta">${escapeHtml(metaParts.join(' · '))}</div>
          </div>
        </div>
        <span class="p-col-badge ${urgentCount > 0 ? 'has-urgent' : 'all-ok'}">
          ${urgentCount > 0 ? urgentCount : '✔ Al día'}
        </span>
      </div>
      <div class="p-col-body">
        ${cardsHtml}
      </div>
      ${openTablesHtml}
    </section>`;
  }

  function renderBoard() {
    if (!state) return;

    $('#pRestName').textContent = state.restaurant?.name || 'SaleListo';

    const activeWaiters = (state.waiters || []).filter((w) => w.available);
    const activeWaiterIds = new Set(activeWaiters.map((w) => w.id));
    const tableMap = new Map((state.tables || []).map((t) => [t.id, t]));
    const blockMap = new Map((state.blocks || []).map((b) => [b.id, b]));

    const readyOrders = getReadyOrders(state);
    const pendingBills = getPendingCalls(state, 'cuenta');
    const pendingCalls = getPendingCalls(state, 'mozo');
    const inPrepCount = (state.orders || []).filter((o) => o.isOpenSession && (o.status === 'nuevo' || o.status === 'cocina')).length;

    const inFlightBillTableIds = new Set(
      (state.calls || [])
        .filter((c) => c.type === 'cuenta' && c.status === 'en_camino')
        .map((c) => c.tableId)
    );

    const totalUrgent = readyOrders.length + pendingBills.length + pendingCalls.length;
    const summaryParts = [
      `${activeWaiters.length} mozo${activeWaiters.length === 1 ? '' : 's'} en turno`,
      totalUrgent > 0
        ? `${readyOrders.length} retiro${readyOrders.length === 1 ? '' : 's'} listo${readyOrders.length === 1 ? '' : 's'} · ${pendingBills.length + pendingCalls.length} llamado${pendingBills.length + pendingCalls.length === 1 ? '' : 's'}`
        : 'Salón al día',
    ];
    if (inPrepCount > 0) {
      summaryParts.push(`${inPrepCount} en preparación`);
    }
    $('#pSummary').textContent = summaryParts.join(' · ');

    const buckets = new Map();
    activeWaiters.forEach((w) => {
      const sectorNames = (w.blockIds || [])
        .map((bid) => blockMap.get(bid)?.name)
        .filter(Boolean);
      const openTables = (state.tables || []).filter((t) => t.active && t.sessionId && t.waiterId === w.id);
      buckets.set(w.id, {
        id: w.id,
        name: w.name,
        color: w.color || '#d9412b',
        isOrphan: false,
        sectorNames,
        openTables,
        ready: [],
        bills: [],
        calls: [],
        inFlightBillTableIds,
      });
    });

    const orphanCol = {
      id: '__orphan__',
      name: 'Apoyo / Sin asignar',
      color: '#d97706',
      isOrphan: true,
      sectorNames: [],
      openTables: [],
      ready: [],
      bills: [],
      calls: [],
      inFlightBillTableIds,
    };

    readyOrders.forEach((o) => {
      const wid = resolveColumnWaiterId(o, state, activeWaiterIds, tableMap, blockMap);
      (buckets.get(wid) || orphanCol).ready.push(o);
    });
    pendingBills.forEach((c) => {
      const wid = resolveColumnWaiterId(c, state, activeWaiterIds, tableMap, blockMap);
      (buckets.get(wid) || orphanCol).bills.push(c);
    });
    pendingCalls.forEach((c) => {
      const wid = resolveColumnWaiterId(c, state, activeWaiterIds, tableMap, blockMap);
      (buckets.get(wid) || orphanCol).calls.push(c);
    });

    const columns = Array.from(buckets.values());
    if (orphanCol.ready.length + orphanCol.bills.length + orphanCol.calls.length > 0) {
      columns.push(orphanCol);
    }

    const board = $('#pBoard');
    if (!columns.length) {
      board.style.setProperty('--cols', '1');
      board.innerHTML = `<div class="p-board-empty">
        <h2>Sin mozos activos en turno</h2>
        <p>Activá los mozos del turno desde el Panel del Restaurante para visualizar sus columnas en el pase.</p>
        <a class="btn btn-primary" href="restaurante.html">Abrir Panel del Restaurante</a>
      </div>`;
      return;
    }

    board.style.setProperty('--cols', String(columns.length));
    board.innerHTML = columns.map(renderWaiterColumn).join('');
  }

  // ---------- Acciones en las tarjetas de las columnas ----------
  $('#pBoard').onclick = async (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn) {
      btn.disabled = true;
      const act = btn.dataset.act;
      try {
        if (act === 'deliver') {
          await apiAction('order.status', { orderId: btn.dataset.oid, status: 'entregado' });
          toast('✔ Retiro marcado como entregado en mesa');
        } else if (act === 'attend-bill') {
          await apiAction('call.attend', { callId: btn.dataset.cid, status: 'en_camino' });
          toast('💳 Llevando cobro a la mesa');
        } else if (act === 'attend-call') {
          await apiAction('call.attend', { callId: btn.dataset.cid });
          toast('🙋 Llamado de mesa atendido');
        }
      } catch (err) {
        btn.disabled = false;
        toast(`⚠️ ${err.message}`);
      }
      return;
    }

    const tblChip = e.target.closest('[data-open-tbl]');
    if (tblChip) {
      openTableQuickModal(tblChip.dataset.openTbl, tblChip.dataset.wid || '');
    }
  };

  // ---------- Modal Ágil "+ Pedido en mostrador" (carga en 5 segundos) ----------
  function closeModal() {
    modalOpen = false;
    $('#pModalBackdrop').hidden = true;
    $('#pModal').style.maxWidth = '';
    $('#pModal').innerHTML = '';
  }

  $('#pModalBackdrop').onclick = (e) => {
    if (e.target.id === 'pModalBackdrop' || e.target.closest('[data-pclose]')) {
      closeModal();
    }
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOpen) closeModal();
  });

  function pickDefaultWaiterForTable(tableId) {
    const tbl = (state.tables || []).find((t) => t.id === tableId);
    if (!tbl) return '';
    if (tbl.waiterId) return tbl.waiterId;
    const blk = (state.blocks || []).find((b) => b.id === tbl.blockId);
    const activeSet = new Set((state.waiters || []).filter((w) => w.available).map((w) => w.id));
    if (blk?.assignmentMode === 'preassigned' && Array.isArray(blk.waiterIds)) {
      const pre = blk.waiterIds.find((wid) => activeSet.has(wid));
      if (pre) return pre;
    }
    return '';
  }

  function openCounterOrderModal(preTableId = '', preWaiterId = '') {
    const activeTables = (state.tables || []).filter((t) => t.active);
    if (!activeTables.length) {
      toast('No hay mesas habilitadas en el salón');
      return;
    }

    modalOpen = true;
    orderTableId = preTableId && activeTables.some((t) => t.id === preTableId)
      ? preTableId
      : activeTables[0].id;
    orderWaiterId = preWaiterId || pickDefaultWaiterForTable(orderTableId);
    orderCatId = 'all';
    orderSearch = '';
    counterCart = [];

    $('#pModalBackdrop').hidden = false;
    renderCounterOrderModal();
  }

  function renderCounterOrderModal() {
    if (!modalOpen) return;
    const activeTables = (state.tables || []).filter((t) => t.active);
    const activeWaiters = (state.waiters || []).filter((w) => w.available);
    const selectedTbl = activeTables.find((t) => t.id === orderTableId) || activeTables[0];
    if (selectedTbl) orderTableId = selectedTbl.id;

    const inCartQty = {};
    counterCart.forEach((l) => {
      inCartQty[l.itemId] = (inCartQty[l.itemId] || 0) + l.qty;
    });

    const q = orderSearch.trim().toLowerCase();
    const visibleItems = (state.items || []).filter((i) => {
      if (!i.available) return false;
      if (orderCatId !== 'all' && i.cat !== orderCatId) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });

    const cartSubtotal = counterCart.reduce((acc, l) => {
      const it = (state.items || []).find((x) => x.id === l.itemId);
      return acc + (it ? it.price * l.qty : 0);
    }, 0);

    const modal = $('#pModal');
    modal.innerHTML = `
      <div class="pm-head">
        <div>
          <h2>+ Pedido en mostrador</h2>
          <small style="color:var(--ink-2);font-weight:600">Cargá mesa e ítems en segundos sin usar celular · separa solo a Cocina y Barra</small>
        </div>
        <button class="pm-close" type="button" data-pclose aria-label="Cerrar">✕</button>
      </div>
      <div class="pm-body">
        <div class="pm-left">
          <div>
            <span class="pm-label">1 · Elegí la mesa</span>
            <div class="pm-tables-row" id="pmTables">
              ${activeTables.map((t) => {
                const blk = (state.blocks || []).find((b) => b.id === t.blockId);
                const sel = t.id === orderTableId;
                return `<button class="pm-tbl-btn ${sel ? 'sel' : ''}" type="button" data-ptbl="${escapeHtml(t.id)}">
                  <span>${blk ? `${blk.icon} ` : ''}Mesa ${escapeHtml(t.code)}</span>
                  ${t.waiterName ? `<small style="opacity:0.8">· ${escapeHtml(t.waiterName)}</small>` : ''}
                </button>`;
              }).join('')}
            </div>
          </div>

          ${activeWaiters.length ? `
          <div>
            <span class="pm-label">2 · Mozo asignado</span>
            <div class="pm-cats" id="pmWaiters">
              <button class="pm-cat-btn ${!orderWaiterId ? 'sel' : ''}" type="button" data-pwaiter="">⚡ Automático</button>
              ${activeWaiters.map((w) => `
                <button class="pm-cat-btn ${orderWaiterId === w.id ? 'sel' : ''}" type="button" data-pwaiter="${escapeHtml(w.id)}">
                  <span class="waiter-dot" style="display:inline-block;background:${escapeHtml(w.color)};margin-right:5px"></span>${escapeHtml(w.name)}
                </button>
              `).join('')}
            </div>
          </div>` : ''}

          <div>
            <span class="pm-label">3 · Tocá para sumar platos o bebidas</span>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              <input class="input" id="pmSearch" placeholder="Buscar plato o bebida…" value="${escapeHtml(orderSearch)}" style="max-width:240px;padding:7px 11px">
              <div class="pm-cats" id="pmCats">
                <button class="pm-cat-btn ${orderCatId === 'all' ? 'sel' : ''}" type="button" data-pcat="all">Todo</button>
                ${(state.categories || []).map((c) => `
                  <button class="pm-cat-btn ${orderCatId === c.id ? 'sel' : ''}" type="button" data-pcat="${escapeHtml(c.id)}">
                    ${c.icon} ${escapeHtml(c.name)}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="pm-items-grid" id="pmItemsGrid">
              ${visibleItems.map((i) => `
                <button class="pm-item-tile ${inCartQty[i.id] ? 'in-cart' : ''}" type="button" data-pitem="${escapeHtml(i.id)}">
                  ${inCartQty[i.id] ? `<span class="pm-qty-badge">${inCartQty[i.id]}×</span>` : ''}
                  <strong>${escapeHtml(i.emoji || '🍽️')} ${escapeHtml(i.name)}</strong>
                  <small>${money(i.price)} · ${i.effectiveStation === 'barra' ? '🍸 Barra' : '🍳 Cocina'}</small>
                </button>
              `).join('') || '<div class="empty">Sin productos coincidentes.</div>'}
            </div>
          </div>
        </div>

        <div class="pm-right">
          <span class="pm-label">Resumen · Mesa ${selectedTbl ? escapeHtml(selectedTbl.code) : ''}</span>
          <div class="pm-cart-list" id="pmCartList">
            ${counterCart.length ? counterCart.map((l) => {
              const it = (state.items || []).find((x) => x.id === l.itemId);
              if (!it) return '';
              return `<div class="pm-cart-line">
                <div class="pm-cart-top">
                  <strong>${escapeHtml(it.emoji || '')} ${escapeHtml(it.name)}</strong>
                  <div class="pm-stepper">
                    <button type="button" data-pstep="${escapeHtml(l.key)}" data-delta="-1">-</button>
                    <span>${l.qty}</span>
                    <button type="button" data-pstep="${escapeHtml(l.key)}" data-delta="1">+</button>
                  </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px">
                  <input class="input" data-pnote="${escapeHtml(l.key)}" placeholder="Nota opcional (sin hielo, cocido…)" value="${escapeHtml(l.note)}" style="padding:6px 9px;font-size:12.5px">
                  <strong style="font-size:13.5px;white-space:nowrap">${money(it.price * l.qty)}</strong>
                </div>
              </div>`;
            }).join('') : '<div class="empty" style="padding:36px 12px">Tocá cualquier producto de la izquierda para armar la comanda.</div>'}
          </div>
          <div class="pm-foot">
            <div class="pm-total-row">
              <span>Subtotal comanda</span>
              <span>${money(cartSubtotal)}</span>
            </div>
            <button class="btn btn-primary pm-send-btn" type="button" id="pmSendBtn" ${counterCart.length === 0 ? 'disabled' : ''}>
              Enviar comanda a Cocina / Barra
            </button>
          </div>
        </div>
      </div>
    `;

    bindCounterModalEvents(modal, selectedTbl);
  }

  function bindCounterModalEvents(modal, selectedTbl) {
    modal.querySelector('#pmTables')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ptbl]');
      if (!b) return;
      orderTableId = b.dataset.ptbl;
      orderWaiterId = pickDefaultWaiterForTable(orderTableId);
      renderCounterOrderModal();
    });

    modal.querySelector('#pmWaiters')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pwaiter]');
      if (!b) return;
      orderWaiterId = b.dataset.pwaiter;
      renderCounterOrderModal();
    });

    modal.querySelector('#pmCats')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pcat]');
      if (!b) return;
      orderCatId = b.dataset.pcat;
      renderCounterOrderModal();
    });

    const searchInp = modal.querySelector('#pmSearch');
    if (searchInp) {
      searchInp.oninput = () => {
        orderSearch = searchInp.value;
        const pos = searchInp.selectionStart;
        renderCounterOrderModal();
        const nextInp = $('#pmSearch');
        if (nextInp) {
          nextInp.focus();
          nextInp.setSelectionRange(pos, pos);
        }
      };
    }

    modal.querySelector('#pmItemsGrid')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pitem]');
      if (!b) return;
      const iid = b.dataset.pitem;
      const existing = counterCart.find((l) => l.itemId === iid && !l.note);
      if (existing) existing.qty = Math.min(30, existing.qty + 1);
      else counterCart.push({ key: `${iid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, itemId: iid, qty: 1, note: '' });
      renderCounterOrderModal();
    });

    modal.querySelector('#pmCartList')?.addEventListener('click', (e) => {
      const step = e.target.closest('[data-pstep]');
      if (!step) return;
      const line = counterCart.find((l) => l.key === step.dataset.pstep);
      if (!line) return;
      line.qty += Number(step.dataset.delta);
      if (line.qty <= 0) counterCart = counterCart.filter((l) => l !== line);
      renderCounterOrderModal();
    });

    modal.querySelectorAll('[data-pnote]').forEach((inp) => {
      inp.oninput = () => {
        const line = counterCart.find((l) => l.key === inp.dataset.pnote);
        if (line) line.note = inp.value;
      };
    });

    const sendBtn = modal.querySelector('#pmSendBtn');
    if (sendBtn) {
      sendBtn.onclick = async () => {
        if (!selectedTbl || !counterCart.length) return;
        sendBtn.disabled = true;
        sendBtn.textContent = 'Enviando…';
        try {
          const payload = {
            tableId: selectedTbl.id,
            items: counterCart.map((l) => ({ itemId: l.itemId, qty: l.qty, note: l.note.trim() })),
            source: 'mozo',
          };
          if (orderWaiterId) payload.waiterId = orderWaiterId;
          await apiAction('order.create', payload);
          closeModal();
          toast(`✅ Comanda enviada · Mesa ${selectedTbl.code}`);
        } catch (err) {
          sendBtn.disabled = false;
          sendBtn.textContent = 'Enviar comanda a Cocina / Barra';
          toast(`⚠️ ${err.message}`);
        }
      };
    }
  }

  // ---------- Detalle rápido al tocar una mesa abierta en la columna ----------
  function openTableQuickModal(tableId, waiterId = '') {
    const tbl = (state.tables || []).find((t) => t.id === tableId);
    if (!tbl) return;
    const blk = (state.blocks || []).find((b) => b.id === tbl.blockId);
    const tOrders = (state.orders || []).filter((o) => o.isOpenSession && o.tableId === tbl.id && o.status !== 'cancelado');
    const billCall = (state.calls || []).find((c) => c.tableId === tbl.id && c.type === 'cuenta');
    const pendingCnt = tOrders.filter((o) => o.status !== 'entregado').length;

    let pay = billCall?.payment || 'Tarjeta';
    let tip = billCall?.tip ?? 10;
    const sub = tbl.subtotal || 0;

    modalOpen = true;
    $('#pModalBackdrop').hidden = false;
    const modal = $('#pModal');
    modal.style.maxWidth = '540px';

    const renderSummaryTotal = () => {
      const tipAmt = Math.round((sub * tip) / 100);
      const totEl = modal.querySelector('#pqGrand');
      if (totEl) totEl.textContent = money(sub + tipAmt);
    };

    modal.innerHTML = `
      <div class="pm-head">
        <div>
          <h2>${blk ? `${blk.icon} ${escapeHtml(blk.name)} · ` : ''}Mesa ${escapeHtml(tbl.code)}</h2>
          <small style="color:var(--ink-2);font-weight:600">Atiende: ${escapeHtml(tbl.waiterName || 'Sin asignar')}</small>
        </div>
        <button class="pm-close" type="button" data-pclose aria-label="Cerrar">✕</button>
      </div>
      <div style="padding:18px 20px;display:flex;flex-direction:column;gap:12px;overflow-y:auto">
        ${tOrders.length ? `
          <div style="max-height:220px;overflow-y:auto;border-bottom:1px solid var(--line);padding-bottom:8px">
            ${tOrders.map((o) => o.items.map((i) => `
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14.5px;font-weight:600">
                <span><b>${i.qty}×</b> ${escapeHtml(i.name)} <small style="color:var(--ink-3)">(${escapeHtml(o.status)})</small></span>
                <span>${money(i.price * i.qty)}</span>
              </div>
            `).join('')).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:800">
            <span>Subtotal consumo</span>
            <span>${money(sub)}</span>
          </div>
          ${pendingCnt > 0 ? `<div style="padding:8px 11px;border-radius:var(--radius-control);background:var(--kitchen-soft);color:var(--kitchen);font-size:13px;font-weight:700">⚠️ Hay ${pendingCnt} comanda(s) todavía sin marcar como entregadas.</div>` : ''}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="field">
              <label>Medio de pago</label>
              <select class="input" id="pqPay">
                ${['Tarjeta', 'Efectivo', 'QR', 'Transferencia'].map((p) => `<option value="${p}" ${p === pay ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Propina</label>
              <select class="input" id="pqTip">
                ${[0, 5, 10, 15].map((p) => `<option value="${p}" ${p === tip ? 'selected' : ''}>${p}%</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;padding:10px 12px;border-radius:var(--radius-control);background:var(--ok-soft);color:#165934">
            <span style="font-weight:700">Total con propina</span>
            <strong id="pqGrand" style="font-size:22px;font-weight:800">${money(sub + Math.round((sub * tip) / 100))}</strong>
          </div>
        ` : '<p style="color:var(--ink-3)">Esta mesa no tiene consumos abiertos.</p>'}
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
          <button class="btn btn-ghost" type="button" id="pqAddItems" style="flex:1;min-height:48px;font-weight:800">+ Sumar pedido</button>
          ${tbl.sessionId ? `<button class="btn btn-ok" type="button" id="pqCloseTable" style="flex:1;min-height:48px;font-weight:800">✔ Cobrar y cerrar mesa</button>` : ''}
        </div>
      </div>
    `;

    modal.querySelector('#pqPay')?.addEventListener('change', (ev) => { pay = ev.target.value; });
    modal.querySelector('#pqTip')?.addEventListener('change', (ev) => { tip = Number(ev.target.value); renderSummaryTotal(); });

    modal.querySelector('#pqAddItems').onclick = () => {
      modal.style.maxWidth = '';
      openCounterOrderModal(tbl.id, waiterId || tbl.waiterId || '');
    };

    const closeBtn = modal.querySelector('#pqCloseTable');
    if (closeBtn) {
      closeBtn.onclick = async () => {
        let force = false;
        if (pendingCnt > 0) {
          if (!confirm(`Quedan ${pendingCnt} pedido(s) sin marcar entregados en Mesa ${tbl.code}. ¿Marcarlos entregados y cerrar la cuenta?`)) return;
          force = true;
        }
        closeBtn.disabled = true;
        try {
          await apiAction('table.close', { tableId: tbl.id, payment: pay, tip, force });
          modal.style.maxWidth = '';
          closeModal();
          toast(`✔ Mesa ${tbl.code} cobrada y cerrada`);
        } catch (err) {
          closeBtn.disabled = false;
          toast(`⚠️ ${err.message}`);
        }
      };
    }
  }

  $('#pNewOrderBtn').onclick = () => {
    $('#pModal').style.maxWidth = '';
    openCounterOrderModal();
  };

  // ---------- Suscripción en vivo (SSE) ----------
  seedKnownAlerts(state);
  renderBoard();

  subscribe((s) => {
    state = s;

    const curReady = getReadyOrders(s);
    const curCalls = getPendingCalls(s);
    let playAlert = false;

    curReady.forEach((o) => {
      if (!knownReadyIds.has(o.id)) {
        playAlert = true;
        freshCardIds.add(o.id);
        setTimeout(() => freshCardIds.delete(o.id), 4500);
        const st = o.station === 'barra' ? '🍸 Barra' : '🍳 Cocina';
        toast(`🔔 Listo en ${st} · Mesa ${o.tableCode}`);
      }
    });

    curCalls.forEach((c) => {
      const sig = callSignature(c);
      if (!knownPendingCalls.has(sig)) {
        playAlert = true;
        freshCardIds.add(c.id);
        setTimeout(() => freshCardIds.delete(c.id), 4500);
        toast(c.type === 'cuenta' ? `💳 Mesa ${c.tableCode} pidió la cuenta` : `🙋 Mesa ${c.tableCode} llama (${c.reason})`);
      }
    });

    if (playAlert && !soundMuted) {
      ding(2, true);
    }

    seedKnownAlerts(s);
    renderBoard();
  });

  // Refrescar minutos de espera cada 20 segundos
  setInterval(() => {
    if (state) renderBoard();
  }, 20000);
})();
