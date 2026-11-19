(async () => {
  const VALID_FILTERS = ['todas', 'cocina', 'barra', 'mostrador'];
  const params = new URLSearchParams(location.search);
  let stationFilter = params.get('estacion') || localStorage.getItem('salelisto:kdsStation') || 'todas';
  if (!VALID_FILTERS.includes(stationFilter)) stationFilter = 'todas';

  const $ = (sel) => document.querySelector(sel);

  // Activar Screen Wake Lock con reintento en visibilitychange
  enableScreenWakeLock();

  // Estado del cajón rápido de Agotados (86)
  let stockOpen = false;
  let stockSearch = '';
  let stockStation = 'todas';

  // ---------- Autenticación con modal propio (sin window.prompt) ----------
  let token = sessionStorage.getItem('salelisto:kdsToken') || sessionStorage.getItem('salelisto:adminToken') || '';
  if (token) setAuthToken(token);

  function askPinViaGate() {
    return new Promise((resolve) => {
      const gate = $('#kPinGate');
      const app = $('#kApp');
      const form = $('#kPinForm');
      const input = $('#kPinInput');
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
      $('#kPinGate').hidden = true;
      $('#kApp').hidden = false;
      return true;
    } catch (_) {
      return askPinViaGate();
    }
  }

  if (!token) await ensureKitchenAuth();

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
  let state = conn.state;

  window.addEventListener('salelisto:auth-expired', async () => {
    toast('🔒 La sesión del local expiró o cambió el PIN. Ingresá nuevamente.');
    sessionStorage.removeItem('salelisto:kdsToken');
    setAuthToken('');
    await askPinViaGate();
    await openStaffStream();
    state = conn.state;
    knownIds = new Set(matchingOrders(state).map((o) => o.id));
    seedLateAlerted(state);
    render();
  });

  // ---------- Sonido (estado global silenciar / reactivar de ui.js) ----------
  onAudioState((active, detail) => {
    const b = $('#kAudioBtn');
    if (!b) return;
    b.className = `audio-pill k-audio-btn ${active ? 'on' : 'off'}`;
    if (active) {
      b.textContent = '🔊 Sonido activo';
    } else if (detail && detail.muted) {
      b.textContent = '🔇 Silenciado';
    } else {
      b.textContent = '🔇 Activar sonido';
    }
  });

  $('#kAudioBtn').onclick = async () => {
    const muted = await toggleSoundMute();
    toast(muted ? '🔇 Campana de comandas silenciada' : '🔊 Campana de comandas activada');
  };

  function matchingOrders(s) {
    return (s.orders || []).filter(
      (o) => o.isOpenSession && o.status !== 'cancelado' && (stationFilter === 'todas' || o.station === stationFilter)
    );
  }

  // ---------- Semáforo SLA de demora por comanda ----------
  const SLA_WARN_MIN = 8;
  const SLA_LATE_MIN = 15;
  const lateAlerted = new Set();

  function slaInfo(createdAt) {
    const mins = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
    if (mins >= SLA_LATE_MIN) return { level: 'late', mins, text: `Demorado · ${mins} min`, ico: '🔴' };
    if (mins >= SLA_WARN_MIN) return { level: 'warn', mins, text: `Atención · ${mins} min`, ico: '🟠' };
    return { level: 'ok', mins, text: mins < 1 ? 'En tiempo · recién' : `En tiempo · ${mins} min`, ico: '🟢' };
  }

  function slaClass(level) {
    return `sla-${level}`;
  }

  function seedLateAlerted(s) {
    matchingOrders(s).forEach((o) => {
      if (slaInfo(o.createdAt).level === 'late') lateAlerted.add(o.id);
    });
  }

  let knownIds = new Set(matchingOrders(state).map((o) => o.id));
  seedLateAlerted(state);

  $('#stationTabs').onclick = (e) => {
    const b = e.target.closest('[data-st]');
    if (!b) return;
    stationFilter = b.dataset.st;
    localStorage.setItem('salelisto:kdsStation', stationFilter);
    history.replaceState(null, '', `cocina.html?estacion=${stationFilter}`);
    knownIds = new Set(matchingOrders(state).map((o) => o.id));
    seedLateAlerted(state);
    render();
  };

  $('#kBoard').onclick = async (e) => {
    const adv = e.target.closest('[data-adv]');
    if (adv) {
      adv.disabled = true;
      try { await dispatch('order.advance', { id: adv.dataset.adv }); } catch (err) { adv.disabled = false; toast(`⚠️ ${err.message}`); }
    }
    const rev = e.target.closest('[data-rev]');
    if (rev) {
      rev.disabled = true;
      try { await dispatch('order.revert', { id: rev.dataset.rev }); } catch (err) { rev.disabled = false; toast(`⚠️ ${err.message}`); }
    }
  };

  const NEXT_BTN = {
    nuevo: { label: '🔥 Aceptar y preparar', cls: 'btn-primary' },
    cocina: { label: '🔔 ¡Listo! Avisar al mozo', cls: 'btn-ok' },
  };

  function ensureSlaSummary() {
    let el = document.getElementById('kSlaSummary');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kSlaSummary';
      el.className = 'k-sla-summary';
      el.setAttribute('aria-live', 'polite');
      el.title = 'Semáforo de demora: verde menos de 8 min, ámbar de 8 a 14 min, coral 15 min o más';
      const right = document.querySelector('.k-right');
      if (right) right.prepend(el);
    }
    return el;
  }

  function renderSlaSummary(list) {
    const el = ensureSlaSummary();
    const active = list.filter((o) => o.status === 'nuevo' || o.status === 'cocina');
    const counts = { ok: 0, warn: 0, late: 0 };
    active.forEach((o) => { counts[slaInfo(o.createdAt).level] += 1; });
    el.innerHTML = `
      <span class="k-sla-pill sla-ok" title="En tiempo (menos de ${SLA_WARN_MIN} min)">🟢 ${counts.ok}</span>
      <span class="k-sla-pill sla-warn" title="Atención (${SLA_WARN_MIN} a ${SLA_LATE_MIN - 1} min)">🟠 ${counts.warn}</span>
      <span class="k-sla-pill sla-late ${counts.late ? 'pulse' : ''}" title="Demorados (${SLA_LATE_MIN} min o más)">🔴 ${counts.late}</span>`;
  }

  // Refresco liviano cada 15 s: actualiza solo semáforos sin re-dibujar el tablero
  function tickSla() {
    if (!state) return;
    const list = matchingOrders(state);
    const byId = new Map(list.map((o) => [o.id, o]));
    const newlyLate = [];
    document.querySelectorAll('.k-ticket[data-oid]').forEach((card) => {
      const o = byId.get(card.dataset.oid);
      if (!o) return;
      const sla = slaInfo(o.createdAt);
      card.classList.remove('sla-ok', 'sla-warn', 'sla-late');
      card.classList.add(slaClass(sla.level));
      const badge = card.querySelector('.kt-sla');
      if (badge) {
        badge.className = `kt-sla ${slaClass(sla.level)}`;
        badge.textContent = `${sla.ico} ${sla.text}`;
      }
      if (sla.level === 'late' && o.status !== 'listo' && !lateAlerted.has(o.id)) {
        lateAlerted.add(o.id);
        newlyLate.push(o);
      }
    });
    if (newlyLate.length) {
      ding(1, true);
      newlyLate.forEach((o) => toast(`⏱️ Mesa ${o.tableCode} lleva ${SLA_LATE_MIN} min o más esperando`));
    }
    renderSlaSummary(list);
  }

  function ticketHtml(o) {
    const sla = slaInfo(o.createdAt);
    const nxt = NEXT_BTN[o.status];
    const footActionHtml = nxt
      ? `<button class="btn ${nxt.cls} main-act" type="button" data-adv="${escapeHtml(o.id)}">${nxt.label}</button>`
      : `<div class="kt-waiting-box">
          <span class="kt-waiting-lbl">⏳ Esperando retiro del mozo</span>
          <button class="btn btn-ghost kt-sec-deliver" type="button" data-adv="${escapeHtml(o.id)}" title="Usar solo si se entregó directo en mostrador">Entregado en mano</button>
        </div>`;

    return `<article class="k-ticket ${o.status} st-${o.station} ${slaClass(sla.level)}" data-oid="${escapeHtml(o.id)}">
      <div class="kt-head">
        <div>
          <div class="kt-mesa">Mesa ${escapeHtml(o.tableCode)}</div>
          <div class="kt-sub">${escapeHtml(o.blockName)} · #${o.id.slice(1)}</div>
        </div>
        <div style="text-align:right">
          <span class="chip ${stationChipClass(o.station)}">${stationLabel(o.station)}</span>
        </div>
      </div>
      <div class="kt-sla ${slaClass(sla.level)}">${sla.ico} ${sla.text}</div>
      ${o.waiterName
        ? `<div class="waiter-pill"><span class="waiter-dot" style="background:${escapeHtml(o.waiterColor)}"></span>Mozo: ${escapeHtml(o.waiterName)}</div>`
        : '<div class="chip">Sin mozo asignado</div>'}
      <div class="kt-items">
        ${o.items.map((i) => `
          <div class="kt-line">
            <b>${i.qty}×</b>${escapeHtml(i.name)}
            ${i.note ? `<span class="kt-note">⚠️ ${escapeHtml(i.note)}</span>` : ''}
          </div>`).join('')}
      </div>
      <div class="kt-foot">
        ${o.status !== 'nuevo' ? `<button class="btn btn-ghost rev-btn" type="button" title="Volver al estado anterior" data-rev="${escapeHtml(o.id)}">↩</button>` : ''}
        ${footActionHtml}
      </div>
    </article>`;
  }

  // ---------- Cajón rápido 🚫 Agotados (86) ----------
  function sync86Badge() {
    const soldOutCount = (state?.items || []).filter((i) => !i.available).length;
    const badge = $('#k86Badge');
    if (!badge) return;
    badge.hidden = soldOutCount === 0;
    badge.textContent = String(soldOutCount);
  }

  function renderStockList() {
    if (!stockOpen || !state) return;
    const listEl = $('#kStockList');
    const prevScroll = listEl.scrollTop;
    const q = normalizeSearch(stockSearch);

    document.querySelectorAll('#kStockStations [data-kst]').forEach((b) => {
      b.classList.toggle('active', b.dataset.kst === stockStation);
    });

    const items = (state.items || []).slice().sort((a, b) => {
      // Mostrar primero los agotados para reactivarlos rápido, luego orden normal
      if (Boolean(a.available) !== Boolean(b.available)) return a.available ? 1 : -1;
      return 0;
    }).filter((i) => {
      const st = i.effectiveStation || 'cocina';
      if (stockStation !== 'todas' && st !== stockStation) return false;
      if (q && !normalizeSearch(`${i.name} ${i.desc || ''}`).includes(q)) return false;
      return true;
    });

    listEl.innerHTML = items.length
      ? items.map((i) => `
        <button type="button" class="kd-item ${i.available ? '' : 'is-off'}" data-toggle-item="${escapeHtml(i.id)}">
          <div class="kd-item-info">
            <strong>${escapeHtml(i.emoji || '🍽️')} ${escapeHtml(i.name)}</strong>
            <small>${stationLabel(i.effectiveStation)} · ${money(i.price)}</small>
          </div>
          <span class="kd-state ${i.available ? 'on' : 'off'}">
            ${i.available ? '🟢 Disponible' : '🚫 Agotado'}
          </span>
        </button>
      `).join('')
      : '<div class="empty">No hay productos con ese filtro.</div>';

    listEl.scrollTop = prevScroll;
  }

  function openStockDrawer() {
    stockOpen = true;
    stockStation = stationFilter;
    $('#kStockBackdrop').hidden = false;
    $('#kStockDrawer').hidden = false;
    renderStockList();
  }

  function closeStockDrawer() {
    stockOpen = false;
    $('#kStockBackdrop').hidden = true;
    $('#kStockDrawer').hidden = true;
  }

  $('#kStockBtn').onclick = openStockDrawer;
  $('#kStockClose').onclick = closeStockDrawer;
  $('#kStockBackdrop').onclick = closeStockDrawer;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stockOpen) closeStockDrawer();
  });

  $('#kStockSearch').oninput = (e) => {
    stockSearch = e.target.value;
    renderStockList();
  };

  $('#kStockStations').onclick = (e) => {
    const b = e.target.closest('[data-kst]');
    if (!b) return;
    stockStation = b.dataset.kst;
    renderStockList();
  };

  $('#kStockList').onclick = async (e) => {
    const btn = e.target.closest('[data-toggle-item]');
    if (!btn) return;
    const item = (state.items || []).find((x) => x.id === btn.dataset.toggleItem);
    if (!item) return;
    btn.disabled = true;
    const nextAvail = !item.available;
    try {
      await dispatch('item.toggle', { id: item.id, itemId: item.id, available: nextAvail });
      toast(nextAvail ? `🟢 Reactivado en carta: ${item.name}` : `🚫 Marcado agotado: ${item.name}`);
    } catch (err) {
      btn.disabled = false;
      toast(`⚠️ ${err.message}`);
    }
  };

  function render() {
    $('#kRestName').textContent = state.restaurant.name;
    document.querySelectorAll('.k-st').forEach((b) => b.classList.toggle('active', b.dataset.st === stationFilter));
    sync86Badge();
    if (stockOpen) renderStockList();

    const list = matchingOrders(state);
    const cols = [
      { id: 'nuevo', title: '🆕 Nuevos pedidos', empty: 'Esperando nuevas comandas…' },
      { id: 'cocina', title: '🔥 En preparación', empty: 'Nada en preparación' },
      { id: 'listo', title: '🔔 En el pase', empty: 'Sin pedidos esperando retiro del mozo' },
    ];

    $('#kBoard').innerHTML = cols.map((c) => {
      const items = list.filter((o) => o.status === c.id);
      return `<section class="k-col">
        <div class="k-col-head"><h2>${c.title}</h2><span class="k-count">${items.length}</span></div>
        ${items.length ? items.map(ticketHtml).join('') : `<div class="k-empty">${c.empty}</div>`}
      </section>`;
    }).join('');
    renderSlaSummary(list);
  }

  subscribe((s) => {
    state = s;
    const cur = matchingOrders(s);
    const arrivals = cur.filter((o) => !knownIds.has(o.id) && o.status === 'nuevo');
    if (arrivals.length) {
      ding(2, true);
      arrivals.forEach((o) => toast(`🆕 Comanda ${stationInfo(o.station).short.toUpperCase()} · Mesa ${o.tableCode}`));
    }
    knownIds = new Set(cur.map((o) => o.id));
    render();
  });

  render();
  setInterval(tickSla, 15000);
})();
