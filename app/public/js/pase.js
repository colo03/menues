(async () => {
  const $ = (sel) => document.querySelector(sel);
  const urlParams = new URLSearchParams(location.search);

  const PAY_ICONS = {
    Tarjeta: '💳',
    Efectivo: '💵',
    QR: '📱',
    Transferencia: '🏦',
  };

  const demoSid = typeof getDemoSid === 'function' ? getDemoSid() : '';
  const isEmbed = typeof isDemoEmbed === 'function' ? isDemoEmbed() : false;
  if (isEmbed) document.body.classList.add('is-embed');

  let state = null;
  let theme = demoSid
    ? (urlParams.get('tema') === 'light' ? 'light' : 'dark')
    : (localStorage.getItem('salelisto:paseTheme') === 'light' ? 'light' : 'dark');
  let sectorParamRaw = (urlParams.get('bloque') || '').trim();
  let sectorFilter = 'all';
  let expandIdleCols = false;

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

  // Activar Screen Wake Lock con reintento en visibilitychange (no necesario dentro de demo embebida)
  if (!isEmbed) enableScreenWakeLock();

  // ---------- Panel de Ajustes ----------
  function setSettingsOpen(open) {
    const bd = $('#pSettingsBackdrop');
    const dr = $('#pSettingsDrawer');
    const btn = $('#pSettingsBtn');
    if (bd) bd.hidden = !open;
    if (dr) dr.hidden = !open;
    if (btn) btn.setAttribute('aria-expanded', String(Boolean(open)));
  }
  $('#pSettingsBtn')?.addEventListener('click', () => {
    const dr = $('#pSettingsDrawer');
    setSettingsOpen(dr ? dr.hidden : true);
  });
  $('#pSettingsClose')?.addEventListener('click', () => setSettingsOpen(false));
  $('#pSettingsBackdrop')?.addEventListener('click', () => setSettingsOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setSettingsOpen(false);
  });

  // ---------- Tema Oscuro / Claro ----------
  function applyTheme(nextTheme) {
    theme = nextTheme === 'light' ? 'light' : 'dark';
    document.body.dataset.theme = theme;
    if (!demoSid) {
      try { localStorage.setItem('salelisto:paseTheme', theme); } catch (_) {}
    }
    const btn = $('#pThemeBtn');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️ Cambiar a Modo Claro' : '🌙 Cambiar a Modo Oscuro';
    }
  }
  applyTheme(theme);

  $('#pThemeBtn').onclick = () => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  };

  window.addEventListener('message', (ev) => {
    if (ev.origin !== window.location.origin) return;
    if (ev.data && ev.data.type === 'salelisto:theme') {
      applyTheme(ev.data.theme);
    }
  });

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

  // ---------- Sonido (estado global compartido de ui.js) ----------
  onAudioState((active, detail) => {
    const btn = $('#pAudioBtn');
    if (!btn) return;
    btn.className = `audio-pill ${active ? 'on' : 'off'}`;
    if (active) {
      btn.textContent = '🔔 Activo';
    } else if (detail && detail.muted) {
      btn.textContent = '🔇 Silenciado';
    } else {
      btn.textContent = '🔇 Activar sonido';
    }
  });

  $('#pAudioBtn').onclick = async () => {
    const nowMuted = await toggleSoundMute();
    toast(nowMuted ? '🔇 Campana silenciada en esta pantalla' : '🔔 Sonido de retiros y llamados activo');
  };

  // ---------- Wrapper API hacia POST api/action ----------
  async function apiAction(type, payload = {}) {
    return dispatch(type, payload);
  }

  // ---------- Autenticación igual a cocina.html ----------
  let token = demoSid
    ? ''
    : (sessionStorage.getItem('salelisto:kdsToken') || sessionStorage.getItem('salelisto:adminToken') || '');
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

  // Local con cuenta @salelisto.com iniciada: la estación abre directo, sin PIN
  async function tryAccountStationToken() {
    if (demoSid || typeof fetchAccountSession !== 'function') return false;
    const me = await fetchAccountSession();
    if (!me || !me.authenticated || !me.stationToken) return false;
    token = me.stationToken;
    setAuthToken(token);
    sessionStorage.setItem('salelisto:kdsToken', token);
    $('#pPinGate').hidden = true;
    $('#pApp').hidden = false;
    return true;
  }

  async function ensureKitchenAuth() {
    if (await tryAccountStationToken()) return true;
    try {
      const res = await apiPost('api/auth/kitchen', {});
      token = res.token;
      setAuthToken(token);
      if (!demoSid) sessionStorage.setItem('salelisto:kdsToken', token);
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
  async function openStaffStream() {
    try {
      conn = await connectStream({ scope: 'staff' }, connectionBanner);
    } catch (_) {
      sessionStorage.removeItem('salelisto:kdsToken');
      setAuthToken('');
      await ensureKitchenAuth();
      conn = await connectStream({ scope: 'staff' }, connectionBanner);
    }
    return conn;
  }

  await openStaffStream();
  state = conn.state;

  window.addEventListener('salelisto:auth-expired', async () => {
    toast('🔒 La sesión del local expiró o cambió el PIN. Ingresá nuevamente.');
    sessionStorage.removeItem('salelisto:kdsToken');
    setAuthToken('');
    if (!(await tryAccountStationToken())) await askPinViaGate();
    await openStaffStream();
    state = conn.state;
    seedKnownAlerts(state);
    renderBoard();
  });

  // Resolver ?bloque= inicial (por ID o por nombre normalizado)
  function resolveInitialSector(s) {
    const blocks = s?.blocks || [];
    if (!blocks.length) return 'all';
    if (sectorParamRaw) {
      const normParam = normalizeSearch(sectorParamRaw);
      const match = blocks.find((b) => b.id === sectorParamRaw || normalizeSearch(b.name) === normParam);
      if (match) return match.id;
    }
    if (demoSid) return 'all';
    const saved = localStorage.getItem('salelisto:paseBlock') || 'all';
    if (saved !== 'all' && blocks.some((b) => b.id === saved)) return saved;
    return 'all';
  }
  sectorFilter = resolveInitialSector(state);

  function setSectorFilter(nextBlockId) {
    sectorFilter = nextBlockId || 'all';
    try {
      if (sectorFilter === 'all') localStorage.removeItem('salelisto:paseBlock');
      else localStorage.setItem('salelisto:paseBlock', sectorFilter);
      const u = new URL(location.href);
      if (sectorFilter === 'all') u.searchParams.delete('bloque');
      else u.searchParams.set('bloque', sectorFilter);
      history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`);
    } catch (_) {}
    renderBoard();
  }

  // ---------- Helpers de asignación y cálculo ----------
  function matchesSector(blockId, tableId, tableMap) {
    if (sectorFilter === 'all') return true;
    const bid = blockId || tableMap.get(tableId)?.blockId || '';
    return bid === sectorFilter;
  }

  function getReadyOrders(s, filterBySector = false, tableMap = null) {
    const tMap = tableMap || new Map((s.tables || []).map((t) => [t.id, t]));
    return (s.orders || [])
      .filter((o) => o.isOpenSession && o.status === 'listo' && (!filterBySector || matchesSector(o.blockId, o.tableId, tMap)))
      .slice()
      .sort((a, b) => (a.updatedAt || a.createdAt) - (b.updatedAt || b.createdAt));
  }

  function getActiveCalls(s, callType, filterBySector = false, tableMap = null) {
    const tMap = tableMap || new Map((s.tables || []).map((t) => [t.id, t]));
    return (s.calls || [])
      .filter((c) => c.status !== 'atendida'
        && (!callType || c.type === callType)
        && (!filterBySector || matchesSector(c.blockId, c.tableId, tMap)))
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function getPendingOnlyCalls(s) {
    return (s.calls || []).filter((c) => c.status !== 'atendida');
  }

  function callSignature(c) {
    return `${c.id}:${c.type}:${c.payment || ''}:${c.tip ?? ''}:${c.cashAmount ?? 0}:${c.splitWays ?? 1}:${c.reason || ''}`;
  }

  function seedKnownAlerts(s) {
    knownReadyIds = new Set(getReadyOrders(s).map((o) => o.id));
    knownPendingCalls = new Set(getPendingOnlyCalls(s).map(callSignature));
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
    const cashAmount = Math.max(0, Math.round(Number(call.cashAmount) || 0));
    const splitWays = Math.max(1, Math.round(Number(call.splitWays) || 1));
    return { sub, tipPct, tipAmount, total, cashAmount, splitWays };
  }

  // ---------- Semáforo SLA de demora ----------
  const SLA_ORDER = { warn: 8, late: 15 };
  const SLA_CALL = { warn: 3, late: 6 };

  function slaInfo(ts, th = SLA_ORDER) {
    const mins = Math.max(0, Math.floor((Date.now() - (ts || Date.now())) / 60000));
    if (mins >= th.late) return { level: 'late', mins, text: `Demorado · ${mins} min` };
    if (mins >= th.warn) return { level: 'warn', mins, text: `Atención · ${mins} min` };
    return { level: 'ok', mins, text: mins < 1 ? 'En tiempo · recién' : `En tiempo · ${mins} min` };
  }

  function formatWaitBadge(ts, th = SLA_ORDER) {
    const sla = slaInfo(ts, th);
    return `<span class="p-wait sla-${sla.level}" title="Semáforo de demora">${sla.text}</span>`;
  }

  function countLate(readyOrders, bills, calls) {
    return readyOrders.filter((o) => slaInfo(o.createdAt).level === 'late').length
      + bills.filter((c) => slaInfo(c.createdAt, SLA_CALL).level === 'late').length
      + calls.filter((c) => slaInfo(c.createdAt, SLA_CALL).level === 'late').length;
  }

  function updateHeaderSummary() {
    if (!state) return;
    const tableMap = new Map((state.tables || []).map((t) => [t.id, t]));
    const activeWaiters = (state.waiters || []).filter((w) => w.available);
    const readyOrders = getReadyOrders(state, true, tableMap);
    const activeBills = getActiveCalls(state, 'cuenta', true, tableMap);
    const activeCalls = getActiveCalls(state, 'mozo', true, tableMap);
    const inPrepCount = (state.orders || []).filter(
      (o) => o.isOpenSession && (o.status === 'nuevo' || o.status === 'cocina') && matchesSector(o.blockId, o.tableId, tableMap)
    ).length;

    const totalUrgent = readyOrders.length + activeBills.length + activeCalls.length;
    const secName = sectorFilter !== 'all'
      ? (state.blocks || []).find((b) => b.id === sectorFilter)?.name
      : '';
    const summaryParts = [];
    if (secName) summaryParts.push(`Sector: ${secName}`);
    summaryParts.push(`${activeWaiters.length} mozo${activeWaiters.length === 1 ? '' : 's'} en turno`);
    summaryParts.push(
      totalUrgent > 0
        ? `${readyOrders.length} retiro${readyOrders.length === 1 ? '' : 's'} listo${readyOrders.length === 1 ? '' : 's'} · ${activeBills.length + activeCalls.length} solicitud${activeBills.length + activeCalls.length === 1 ? '' : 'es'}`
        : 'Salón al día'
    );
    if (inPrepCount > 0) summaryParts.push(`${inPrepCount} en preparación`);
    const lateCount = countLate(readyOrders, activeBills, activeCalls);
    if (lateCount > 0) summaryParts.push(`🔴 ${lateCount} demorado${lateCount === 1 ? '' : 's'}`);
    const sumEl = $('#pSummary');
    if (sumEl) {
      sumEl.textContent = summaryParts.join(' · ');
      sumEl.classList.toggle('has-late', lateCount > 0);
    }
  }

  // Refresco in-place cada 15 s: actualiza solo textos/clases de minutos sin destruir nodos DOM ni cortar toques
  function tickSla() {
    if (!state) return;
    document.querySelectorAll('.p-card[data-sla-ts]').forEach((card) => {
      const ts = Number(card.dataset.slaTs || 0);
      if (!ts) return;
      const kind = card.dataset.slaKind;
      const th = kind === 'call' ? SLA_CALL : SLA_ORDER;
      const sla = slaInfo(ts, th);
      card.classList.remove('sla-card-ok', 'sla-card-warn', 'sla-card-late');
      card.classList.add(`sla-card-${sla.level}`);
      const waitEl = card.querySelector('.p-wait');
      if (waitEl) {
        waitEl.className = `p-wait sla-${sla.level}`;
        waitEl.textContent = sla.text;
      }
      const readyTs = Number(card.dataset.readyTs || 0);
      if (readyTs) {
        const readyEl = card.querySelector('.p-ready-ago');
        if (readyEl) {
          const mins = Math.max(0, Math.floor((Date.now() - readyTs) / 60000));
          readyEl.textContent = mins >= 1 ? ` · listo hace ${mins} min` : ' · recién listo';
        }
      }
    });
    updateHeaderSummary();
  }

  // ---------- Renderizado de tarjetas ----------
  function renderReadyCard(o) {
    const cardCls = o.station === 'barra'
      ? 'card-barra'
      : o.station === 'mostrador'
      ? 'card-mostrador'
      : 'card-cocina';
    const pillLabel = o.station === 'barra'
      ? '🍸 RETIRAR EN BARRA'
      : o.station === 'mostrador'
      ? '🍣 RETIRAR EN MOSTRADOR'
      : '🍳 RETIRAR EN COCINA';
    const freshCls = freshCardIds.has(o.id) ? 'fresh' : '';
    const sla = slaInfo(o.createdAt);
    const updatedTs = o.updatedAt || o.createdAt;
    const readyMins = Math.max(0, Math.floor((Date.now() - updatedTs) / 60000));

    return `<article class="p-card ${cardCls} ${freshCls} sla-card-${sla.level}" data-sla-ts="${o.createdAt}" data-ready-ts="${updatedTs}" data-sla-kind="order">
      <div class="p-card-top">
        <span class="p-kind-pill">${pillLabel}</span>
        ${formatWaitBadge(o.createdAt)}
      </div>
      <div class="p-mesa-row">
        <div class="p-mesa-code">MESA ${escapeHtml(o.tableCode)}</div>
        <div class="p-mesa-block">${escapeHtml(o.blockName || '')}<span class="p-ready-ago">${readyMins >= 1 ? ` · listo hace ${readyMins} min` : ' · recién listo'}</span></div>
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

  function renderCashChangeHtml(payment, cashAmount, total) {
    if (payment !== 'Efectivo' || cashAmount <= 0) return '';
    if (cashAmount > total) {
      const change = cashAmount - total;
      return `<div class="p-change-box">💵 Abona con ${money(cashAmount)} -&gt; <strong>Llevar ${money(change)} de vuelto</strong></div>`;
    }
    if (cashAmount === total && total > 0) {
      return `<div class="p-change-box is-exact">💵 Abona con importe justo (${money(total)})</div>`;
    }
    return '';
  }

  function renderBillCard(c, s, tableMap) {
    const { sub, tipPct, tipAmount, total, cashAmount, splitWays } = calcExactBill(c, s, tableMap);
    const payIcon = PAY_ICONS[c.payment] || '💳';
    const freshCls = freshCardIds.has(c.id) ? 'fresh' : '';
    const splitHtml = splitWays > 1
      ? `<span class="p-split-tag">÷ ${splitWays} pers. (${money(Math.ceil(total / splitWays))} c/u)</span>`
      : '';
    const changeHtml = renderCashChangeHtml(c.payment || 'Tarjeta', cashAmount, total);

    const sla = slaInfo(c.createdAt, SLA_CALL);
    return `<article class="p-card card-cuenta ${freshCls} sla-card-${sla.level}" data-sla-ts="${c.createdAt}" data-sla-kind="call">
      <div class="p-card-top">
        <span class="p-kind-pill">💳 CUENTA PEDIDA</span>
        ${formatWaitBadge(c.createdAt, SLA_CALL)}
      </div>
      <div class="p-mesa-row">
        <div class="p-mesa-code">MESA ${escapeHtml(c.tableCode)}</div>
        <div class="p-mesa-block">${escapeHtml(c.blockName || '')}</div>
      </div>
      <div class="p-bill-box">
        <div class="p-bill-tags">
          <span class="p-pay-tag">${payIcon} ${escapeHtml(c.payment || 'Tarjeta')}</span>
          <span class="p-tip-tag">${tipPct > 0 ? `Propina ${tipPct}%` : 'Sin propina (0%)'}</span>
          ${splitHtml}
        </div>
        <div class="p-bill-total-row">
          <span class="p-bill-total-lbl">Total a cobrar</span>
          <strong class="p-bill-total">${money(total)}</strong>
        </div>
        ${tipPct > 0 ? `<div class="p-bill-sub">Consumo ${money(sub)} + Propina ${money(tipAmount)}</div>` : ''}
        ${changeHtml}
      </div>
      <button class="p-act-btn" type="button" data-act="close-bill" data-tid="${escapeHtml(c.tableId)}" data-pay="${escapeHtml(c.payment || 'Tarjeta')}" data-tip="${tipPct}">
        ✔ Cobrar y cerrar
      </button>
    </article>`;
  }

  function renderMozoCallCard(c) {
    const freshCls = freshCardIds.has(c.id) ? 'fresh' : '';
    const sla = slaInfo(c.createdAt, SLA_CALL);
    return `<article class="p-card card-llama ${freshCls} sla-card-${sla.level}" data-sla-ts="${c.createdAt}" data-sla-kind="call">
      <div class="p-card-top">
        <span class="p-kind-pill">🙋 MESA LLAMA</span>
        ${formatWaitBadge(c.createdAt, SLA_CALL)}
      </div>
      <div class="p-mesa-row">
        <div class="p-mesa-code">MESA ${escapeHtml(c.tableCode)}</div>
        <div class="p-mesa-block">${escapeHtml(c.blockName || '')}</div>
      </div>
      <div class="p-reason-box">
        ${escapeHtml(c.reason || 'Consulta en mesa')}
      </div>
      <button class="p-act-btn" type="button" data-act="attend-call" data-cid="${escapeHtml(c.id)}">
        ✔ Atendido
      </button>
    </article>`;
  }

  function renderWaiterColumn(col, tableMap) {
    const { id, name, color, isOrphan, sectorNames, openTables, ready, bills, calls } = col;
    const urgentCount = ready.length + bills.length + calls.length;

    const metaParts = [];
    if (!isOrphan) {
      metaParts.push(`${openTables.length} mesa${openTables.length === 1 ? '' : 's'} activa${openTables.length === 1 ? '' : 's'}`);
      if (sectorNames.length) metaParts.push(sectorNames.join(', '));
    } else {
      metaParts.push('Sin mozo en turno asignado');
    }

    const cardsHtml = urgentCount > 0
      ? `${ready.map(renderReadyCard).join('')}${bills.map((c) => renderBillCard(c, state, tableMap)).join('')}${calls.map(renderMozoCallCard).join('')}`
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
                ${openTables.map((t) => `<button class="p-tbl-chip" type="button" data-open-tbl="${escapeHtml(t.id)}" data-wid="${escapeHtml(id)}">
                    <span>Mesa ${escapeHtml(t.code)}</span>
                    <small>${money(t.subtotal)}</small>
                  </button>`).join('')}
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

  function renderSectorBar(blocks, tableMap) {
    const bar = $('#pSectorBar');
    if (!bar) return;
    if (!blocks || blocks.length <= 1) {
      bar.hidden = true;
      return;
    }
    if (sectorFilter !== 'all' && !blocks.some((b) => b.id === sectorFilter)) {
      sectorFilter = 'all';
    }

    const allReady = getReadyOrders(state, false, tableMap);
    const allCalls = getActiveCalls(state, null, false, tableMap);
    const countForBlock = (bid) => {
      const r = allReady.filter((o) => (o.blockId || tableMap.get(o.tableId)?.blockId) === bid).length;
      const c = allCalls.filter((x) => (x.blockId || tableMap.get(x.tableId)?.blockId) === bid).length;
      return r + c;
    };
    const totalPending = allReady.length + allCalls.length;

    bar.hidden = false;
    bar.innerHTML = `<span class="p-sec-lbl">Sector:</span>`
      + `<button type="button" class="p-sec-pill ${sectorFilter === 'all' ? 'active' : ''}" data-sec="all">
          Todos los sectores${totalPending ? `<span class="p-sec-count">${totalPending}</span>` : ''}
        </button>`
      + blocks.map((b) => {
        const cnt = countForBlock(b.id);
        return `<button type="button" class="p-sec-pill ${sectorFilter === b.id ? 'active' : ''}" data-sec="${escapeHtml(b.id)}">
          <span>${b.icon || ''} ${escapeHtml(b.name)}</span>
          ${cnt ? `<span class="p-sec-count">${cnt}</span>` : ''}
        </button>`;
      }).join('');
  }

  function renderIdleStrip(idleCols, totalColsCount) {
    const strip = $('#pIdleStrip');
    if (!strip) return;
    if (!idleCols.length) {
      strip.hidden = true;
      strip.innerHTML = '';
      return;
    }
    strip.hidden = false;
    strip.innerHTML = `
      <span class="p-idle-title">✔ Todo al día (${idleCols.length}/${totalColsCount}):</span>
      ${idleCols.map((col) => `
        <div class="p-idle-card" style="--w-color:${escapeHtml(col.color)}">
          <span class="p-idle-who"><span class="p-idle-dot"></span>${escapeHtml(col.name)}</span>
          <span class="p-idle-ok">✔ Todo al día</span>
          ${col.openTables.map((t) => `
            <button class="p-tbl-chip" type="button" data-open-tbl="${escapeHtml(t.id)}" data-wid="${escapeHtml(col.id)}">
              <span>Mesa ${escapeHtml(t.code)}</span>
              <small>${money(t.subtotal)}</small>
            </button>
          `).join('')}
        </div>
      `).join('')}
      <button type="button" class="p-ctrl-btn p-idle-toggle" id="pToggleIdleBtn">
        ${expandIdleCols ? 'Compactar columnas al día' : 'Ver todas las columnas'}
      </button>
    `;
  }

  function renderBoard() {
    if (!state) return;

    $('#pRestName').textContent = state.restaurant?.name || 'SaleListo';

    const tableMap = new Map((state.tables || []).map((t) => [t.id, t]));
    const blockMap = new Map((state.blocks || []).map((b) => [b.id, b]));
    renderSectorBar(state.blocks || [], tableMap);
    updateHeaderSummary();

    const allActiveWaiters = (state.waiters || []).filter((w) => w.available);
    const activeWaiterIds = new Set(allActiveWaiters.map((w) => w.id));

    const readyOrders = getReadyOrders(state, true, tableMap);
    const activeBills = getActiveCalls(state, 'cuenta', true, tableMap);
    const activeCalls = getActiveCalls(state, 'mozo', true, tableMap);

    const buckets = new Map();
    allActiveWaiters.forEach((w) => {
      const sectorNames = (w.blockIds || [])
        .map((bid) => blockMap.get(bid)?.name)
        .filter(Boolean);
      const openTables = (state.tables || []).filter(
        (t) => t.active && t.sessionId && t.waiterId === w.id && matchesSector(t.blockId, t.id, tableMap)
      );
      buckets.set(w.id, {
        id: w.id,
        name: w.name,
        color: w.color || '#d9412b',
        blockIds: w.blockIds || [],
        isOrphan: false,
        sectorNames,
        openTables,
        ready: [],
        bills: [],
        calls: [],
      });
    });

    const orphanCol = {
      id: '__orphan__',
      name: 'Apoyo / Sin asignar',
      color: '#d97706',
      blockIds: [],
      isOrphan: true,
      sectorNames: [],
      openTables: [],
      ready: [],
      bills: [],
      calls: [],
    };

    readyOrders.forEach((o) => {
      const wid = resolveColumnWaiterId(o, state, activeWaiterIds, tableMap, blockMap);
      (buckets.get(wid) || orphanCol).ready.push(o);
    });
    activeBills.forEach((c) => {
      const wid = resolveColumnWaiterId(c, state, activeWaiterIds, tableMap, blockMap);
      (buckets.get(wid) || orphanCol).bills.push(c);
    });
    activeCalls.forEach((c) => {
      const wid = resolveColumnWaiterId(c, state, activeWaiterIds, tableMap, blockMap);
      (buckets.get(wid) || orphanCol).calls.push(c);
    });

    let columns = Array.from(buckets.values());
    if (sectorFilter !== 'all') {
      const blk = blockMap.get(sectorFilter);
      const preSet = new Set(blk?.waiterIds || []);
      const filteredCols = columns.filter((col) => (
        col.ready.length + col.bills.length + col.calls.length > 0
        || col.openTables.length > 0
        || col.blockIds.includes(sectorFilter)
        || preSet.has(col.id)
      ));
      if (filteredCols.length > 0) columns = filteredCols;
    }

    if (orphanCol.ready.length + orphanCol.bills.length + orphanCol.calls.length > 0) {
      columns.push(orphanCol);
    }

    const board = $('#pBoard');
    const strip = $('#pIdleStrip');
    if (!columns.length) {
      if (strip) strip.hidden = true;
      board.style.setProperty('--cols', '1');
      board.innerHTML = `<div class="p-board-empty">
        <h2>Sin mozos activos en turno</h2>
        <p>Activá los mozos del turno desde el Panel del Restaurante para visualizar sus columnas en el pase.</p>
        <a class="btn btn-primary" href="restaurante.html">Abrir Panel del Restaurante</a>
      </div>`;
      return;
    }

    // Compactación automática cuando hay 4 o más columnas activas:
    // los mozos "Todo al día" (0 retiros/llamados) pasan a la barra compacta para evitar desborde horizontal a 4 m
    const shouldCompactIdle = columns.length >= 4 && !expandIdleCols;
    const busyCols = shouldCompactIdle
      ? columns.filter((c) => c.ready.length + c.bills.length + c.calls.length > 0)
      : columns;
    const idleCols = shouldCompactIdle
      ? columns.filter((c) => c.ready.length + c.bills.length + c.calls.length === 0)
      : [];

    if (columns.length >= 4 && expandIdleCols) {
      // Mostrar botón para volver a compactar si el usuario expandió manualmente
      const anyIdle = columns.filter((c) => c.ready.length + c.bills.length + c.calls.length === 0);
      if (anyIdle.length && strip) {
        strip.hidden = false;
        strip.innerHTML = `
          <span class="p-idle-title">Mostrando las ${columns.length} columnas completas</span>
          <button type="button" class="p-ctrl-btn p-idle-toggle" id="pToggleIdleBtn">Compactar mozos al día (${anyIdle.length})</button>
        `;
      } else if (strip) {
        strip.hidden = true;
      }
    } else {
      renderIdleStrip(idleCols, columns.length);
    }

    if (!busyCols.length && idleCols.length) {
      board.style.setProperty('--cols', '1');
      board.innerHTML = `<div class="p-calm-banner">
        <span class="p-clear-ico">✔</span>
        <h2>Todo el salón al día</h2>
        <p>Ningún mozo tiene retiros ni llamados pendientes. Los ${idleCols.length} mozos activos y sus mesas figuran abajo.</p>
      </div>`;
      return;
    }

    board.style.setProperty('--cols', String(busyCols.length));
    board.innerHTML = busyCols.map((col) => renderWaiterColumn(col, tableMap)).join('');
  }

  // ---------- Eventos de filtro por sector y barra compacta ----------
  $('#pSectorBar').onclick = (e) => {
    const b = e.target.closest('[data-sec]');
    if (!b) return;
    setSectorFilter(b.dataset.sec);
  };

  $('#pIdleStrip').onclick = (e) => {
    if (e.target.closest('#pToggleIdleBtn')) {
      expandIdleCols = !expandIdleCols;
      renderBoard();
      return;
    }
    const tblChip = e.target.closest('[data-open-tbl]');
    if (tblChip) {
      openTableQuickModal(tblChip.dataset.openTbl, tblChip.dataset.wid || '');
    }
  };

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
        } else if (act === 'close-bill') {
          const tid = btn.dataset.tid;
          const tbl = (state.tables || []).find((t) => t.id === tid);
          const pendingCnt = (state.orders || []).filter(
            (o) => o.isOpenSession && o.tableId === tid && o.status !== 'cancelado' && o.status !== 'entregado'
          ).length;
          let force = false;
          if (pendingCnt > 0) {
            if (!confirm(`Quedan ${pendingCnt} pedido(s) sin marcar entregados en Mesa ${tbl?.code || ''}. ¿Marcarlos entregados y cerrar la cuenta?`)) {
              btn.disabled = false;
              return;
            }
            force = true;
          }
          await apiAction('table.close', {
            tableId: tid,
            payment: btn.dataset.pay || 'Tarjeta',
            tip: Number(btn.dataset.tip || 0),
            force,
          });
          toast(`✔ Mesa ${tbl?.code || ''} cobrada y cerrada`);
        } else if (act === 'attend-call') {
          await apiAction('call.attend', { callId: btn.dataset.cid, status: 'atendida' });
          toast('✔ Llamado de mesa atendido');
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
    const sectorTables = sectorFilter !== 'all'
      ? activeTables.filter((t) => t.blockId === sectorFilter)
      : activeTables;
    const defaultTbl = (sectorTables[0] || activeTables[0]).id;
    orderTableId = preTableId && activeTables.some((t) => t.id === preTableId)
      ? preTableId
      : defaultTbl;
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

    const q = normalizeSearch(orderSearch);
    const visibleItems = (state.items || []).filter((i) => {
      if (!i.available) return false;
      if (orderCatId !== 'all' && i.cat !== orderCatId) return false;
      if (q && !normalizeSearch(`${i.name} ${i.desc || ''}`).includes(q)) return false;
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
          <small style="color:var(--ink-2);font-weight:600">Cargá mesa e ítems en segundos sin usar celular · separa solo a Cocina, Barra y Mostrador</small>
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
                  <small>${money(i.price)} · ${stationLabel(i.effectiveStation)}</small>
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
              Enviar comanda a estaciones
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
          sendBtn.textContent = 'Enviar comanda a estaciones';
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
    let tip = billCall?.tip ?? 0;
    const sub = tbl.subtotal || 0;
    const cashAmount = Math.max(0, Math.round(Number(billCall?.cashAmount) || 0));
    const splitWays = Math.max(1, Math.round(Number(billCall?.splitWays) || 1));

    modalOpen = true;
    $('#pModalBackdrop').hidden = false;
    const modal = $('#pModal');
    modal.style.maxWidth = '540px';

    const renderSummaryTotal = () => {
      const tipAmt = Math.round((sub * tip) / 100);
      const grand = sub + tipAmt;
      const totEl = modal.querySelector('#pqGrand');
      if (totEl) totEl.textContent = money(grand);
      const chgEl = modal.querySelector('#pqChangeBox');
      if (chgEl) {
        chgEl.innerHTML = renderCashChangeHtml(pay, cashAmount, grand);
      }
    };

    const initTotal = sub + Math.round((sub * tip) / 100);

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
            <span style="font-weight:700">Total con propina${splitWays > 1 ? ` · ÷ ${splitWays} pers.` : ''}</span>
            <strong id="pqGrand" style="font-size:22px;font-weight:800">${money(initTotal)}</strong>
          </div>
          <div id="pqChangeBox">${renderCashChangeHtml(pay, cashAmount, initTotal)}</div>
        ` : '<p style="color:var(--ink-3)">Esta mesa no tiene consumos abiertos.</p>'}
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
          <button class="btn btn-ghost" type="button" id="pqAddItems" style="flex:1;min-height:48px;font-weight:800">+ Sumar pedido</button>
          ${tbl.sessionId ? `<button class="btn btn-ok" type="button" id="pqCloseTable" style="flex:1;min-height:48px;font-weight:800">✔ Cobrar y cerrar mesa</button>` : ''}
        </div>
      </div>
    `;

    modal.querySelector('#pqPay')?.addEventListener('change', (ev) => { pay = ev.target.value; renderSummaryTotal(); });
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

    const tableMap = new Map((s.tables || []).map((t) => [t.id, t]));
    const curReady = getReadyOrders(s);
    const curPendingCalls = getPendingOnlyCalls(s);
    let playAlert = false;

    curReady.forEach((o) => {
      if (!knownReadyIds.has(o.id)) {
        freshCardIds.add(o.id);
        setTimeout(() => freshCardIds.delete(o.id), 4500);
        if (matchesSector(o.blockId, o.tableId, tableMap)) {
          playAlert = true;
          toast(`🔔 Listo en ${stationLabel(o.station)} · Mesa ${o.tableCode}`);
        }
      }
    });

    curPendingCalls.forEach((c) => {
      const sig = callSignature(c);
      if (!knownPendingCalls.has(sig)) {
        freshCardIds.add(c.id);
        setTimeout(() => freshCardIds.delete(c.id), 4500);
        if (matchesSector(c.blockId, c.tableId, tableMap)) {
          playAlert = true;
          toast(c.type === 'cuenta' ? `💳 Mesa ${c.tableCode} pidió la cuenta` : `🙋 Mesa ${c.tableCode} llama (${c.reason})`);
        }
      }
    });

    if (playAlert && !isSoundMuted()) {
      ding(2, true);
    }

    seedKnownAlerts(s);
    renderBoard();
  });

  // Refrescar semáforos de demora in-place cada 15 segundos (sin destruir nodos DOM ni cortar toques)
  setInterval(tickSla, 15000);
})();
