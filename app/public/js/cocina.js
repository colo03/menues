(async () => {
  const params = new URLSearchParams(location.search);
  let stationFilter = params.get('estacion') || localStorage.getItem('salelisto:kdsStation') || 'todas';
  if (!['todas', 'cocina', 'barra'].includes(stationFilter)) stationFilter = 'todas';

  const $ = (sel) => document.querySelector(sel);

  // Autenticar pantalla de cocina/barra
  let token = sessionStorage.getItem('salelisto:kdsToken') || '';
  if (token) setAuthToken(token);

  async function ensureKitchenAuth() {
    try {
      const res = await apiPost('api/auth/kitchen', {});
      token = res.token;
      setAuthToken(token);
      sessionStorage.setItem('salelisto:kdsToken', token);
      return true;
    } catch (_) {
      const pin = prompt('Ingresá el PIN del restaurante para abrir la pantalla de Cocina / Barra:') || '';
      if (!pin) return false;
      try {
        const res = await apiPost('api/auth/kitchen', { pin });
        token = res.token;
        setAuthToken(token);
        sessionStorage.setItem('salelisto:kdsToken', token);
        return true;
      } catch (e2) {
        alert(e2.message);
        return ensureKitchenAuth();
      }
    }
  }

  if (!token) await ensureKitchenAuth();

  let conn;
  try {
    conn = await connectStream({ scope: 'staff' }, connectionBanner);
  } catch (_) {
    await ensureKitchenAuth();
    conn = await connectStream({ scope: 'staff' }, connectionBanner);
  }

  let state = conn.state;
  let knownIds = new Set(matchingOrders(state).map((o) => o.id));

  onAudioState((on) => {
    const b = $('#kAudioBtn');
    b.className = `audio-pill ${on ? 'on' : 'off'}`;
    b.textContent = on ? '🔊 Sonido activo' : '🔇 Activar sonido';
  });
  $('#kAudioBtn').onclick = () => {
    unlockAudio();
    ding(1);
    toast('🔊 Campana de comandas activada');
  };

  function matchingOrders(s) {
    return s.orders.filter((o) => o.isOpenSession && o.status !== 'cancelado' && (stationFilter === 'todas' || o.station === stationFilter));
  }

  $('#stationTabs').onclick = (e) => {
    const b = e.target.closest('[data-st]');
    if (!b) return;
    stationFilter = b.dataset.st;
    localStorage.setItem('salelisto:kdsStation', stationFilter);
    history.replaceState(null, '', `cocina.html?estacion=${stationFilter}`);
    knownIds = new Set(matchingOrders(state).map((o) => o.id));
    render();
  };

  $('#kBoard').onclick = async (e) => {
    const adv = e.target.closest('[data-adv]');
    if (adv) {
      adv.disabled = true;
      try { await dispatch('order.advance', { id: adv.dataset.adv }); } catch (err) { toast(`⚠️ ${err.message}`); }
    }
    const rev = e.target.closest('[data-rev]');
    if (rev) {
      rev.disabled = true;
      try { await dispatch('order.revert', { id: rev.dataset.rev }); } catch (err) { toast(`⚠️ ${err.message}`); }
    }
  };

  const NEXT_BTN = {
    nuevo: { label: '🔥 Aceptar y preparar', cls: 'btn-primary' },
    cocina: { label: '🔔 ¡Listo! Avisar al mozo', cls: 'btn-ok' },
    listo: { label: '✔ Marcar entregado', cls: 'btn-ghost' },
  };

  function ticketHtml(o) {
    const mins = Math.floor((Date.now() - o.createdAt) / 60000);
    const late = o.status !== 'entregado' && mins >= 12;
    const nxt = NEXT_BTN[o.status];
    return `<article class="k-ticket ${o.status} st-${o.station} ${late ? 'late' : ''}">
      <div class="kt-head">
        <div>
          <div class="kt-mesa">Mesa ${escapeHtml(o.tableCode)}</div>
          <div class="kt-sub">${escapeHtml(o.blockName)} · #${o.id.slice(1)}</div>
        </div>
        <div style="text-align:right">
          <span class="chip ${o.station === 'barra' ? 'barra' : 'est-cocina'}">${stationLabel(o.station)}</span>
          <div class="kt-time ${late ? 'late' : ''}" style="margin-top:4px">${late ? `⚠️ ${mins} min` : timeAgo(o.createdAt)}</div>
        </div>
      </div>
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
        ${o.status !== 'nuevo' ? `<button class="btn btn-sm btn-ghost" title="Volver estado anterior" data-rev="${o.id}">↩</button>` : ''}
        ${nxt ? `<button class="btn btn-sm ${nxt.cls} main-act" data-adv="${o.id}">${nxt.label}</button>` : ''}
      </div>
    </article>`;
  }

  function render() {
    $('#kRestName').textContent = state.restaurant.name;
    document.querySelectorAll('.k-st').forEach((b) => b.classList.toggle('active', b.dataset.st === stationFilter));

    const list = matchingOrders(state);
    const cols = [
      { id: 'nuevo', title: '🆕 Nuevos pedidos', empty: 'Esperando nuevas comandas…' },
      { id: 'cocina', title: '🔥 En preparación', empty: 'Nada en preparación' },
      { id: 'listo', title: '🔔 Listos (Mozo avisado)', empty: 'Sin pedidos esperando retiro' },
    ];

    $('#kBoard').innerHTML = cols.map((c) => {
      const items = list.filter((o) => o.status === c.id);
      return `<section class="k-col">
        <div class="k-col-head"><h2>${c.title}</h2><span class="k-count">${items.length}</span></div>
        ${items.length ? items.map(ticketHtml).join('') : `<div class="k-empty">${c.empty}</div>`}
      </section>`;
    }).join('');
  }

  subscribe((s) => {
    state = s;
    const cur = matchingOrders(s);
    const arrivals = cur.filter((o) => !knownIds.has(o.id) && o.status === 'nuevo');
    if (arrivals.length) {
      ding(2, true);
      arrivals.forEach((o) => toast(`🆕 Comanda ${o.station.toUpperCase()} · Mesa ${o.tableCode}`));
    }
    knownIds = new Set(cur.map((o) => o.id));
    render();
  });

  render();
  setInterval(render, 25000);
})();
