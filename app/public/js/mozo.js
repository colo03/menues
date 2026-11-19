(async () => {
  const params = new URLSearchParams(location.search);
  const preselectWaiter = params.get('waiter') || sessionStorage.getItem('salelisto:waiterId') || '';
  const savedToken = sessionStorage.getItem('salelisto:waiterToken') || '';

  const $ = (sel) => document.querySelector(sel);
  let state = null;
  let myId = '';
  let mtab = 'alerts';
  let tableFilter = 'mine';
  let padCatId = 'all';
  let padCart = []; // [{ key, itemId, qty, note }]
  let knownReady = new Set();
  let knownCalls = new Set();
  let knownNotifs = new Set();
  let wristbandActive = false;
  let eventsBound = false;
  let activeStream = null;
  let unsubState = null;

  registerSaleListoSW();

  // Estado colapsable de la tarjeta Modo Pulsera
  let wristCollapsedPref = localStorage.getItem('salelisto:wristCollapsed'); // '1' | '0' | null
  function applyWristCollapsed(collapsed) {
    const card = $('#wristCard');
    const head = $('#wristToggleHead');
    if (!card || !head) return;
    card.classList.toggle('collapsed', Boolean(collapsed));
    head.setAttribute('aria-expanded', String(!collapsed));
  }

  async function showLoginScreen() {
    if (activeStream) {
      try { activeStream.close(); } catch (_) {}
      activeStream = null;
    }
    if (unsubState) {
      unsubState();
      unsubState = null;
    }
    $('#waiterApp').hidden = true;
    const lv = $('#loginView');
    lv.hidden = false;
    const pub = await fetch('api/waiters-public').then((r) => r.json());
    if (!pub.waiters.length) {
      lv.innerHTML = `<div class="login-card"><img src="logo.svg" alt="SaleListo" style="height:36px;margin-bottom:14px;display:block"><h1>Sin mozos cargados</h1><p>Agregá mozos desde el Panel del Restaurante para ingresar acá.</p><a class="btn btn-primary" href="restaurante.html">Ir al Panel</a></div>`;
      return;
    }
    const prodNeedsPin = !pub.demoMode;
    lv.innerHTML = `
      <div class="login-card">
        <img src="logo.svg" alt="SaleListo" style="height:36px;margin-bottom:14px;display:block">
        <p style="font-size:12px;font-weight:800;color:var(--accent);text-transform:uppercase;margin-bottom:4px">${escapeHtml(pub.restaurant)}</p>
        <h1>App del Mozo</h1>
        <p>Elegí tu nombre para recibir en vivo los pedidos, retiros de cocina/barra/mostrador y llamados de tus mesas.</p>
        <div class="w-pick-list">
          ${pub.waiters.map((w) => {
            const reqPin = w.hasPin || prodNeedsPin;
            return `
              <button class="w-pick" type="button" data-wid="${escapeHtml(w.id)}" data-wname="${escapeHtml(w.name)}" data-pin="${reqPin ? '1' : '0'}">
                <span class="av" style="background:${escapeHtml(w.color)}">${escapeHtml(w.name.slice(0, 1).toUpperCase())}</span>
                <div>
                  <div>${escapeHtml(w.name)}</div>
                  <small style="color:var(--ink-3);font-weight:600">${w.hasPin ? '🔒 Con PIN personal' : prodNeedsPin ? '🔒 PIN del local' : 'Ingreso rápido'}</small>
                </div>
                <span class="chip ${w.available ? 'entregado' : ''}" style="margin-left:auto">${w.available ? 'En turno' : 'Fuera de turno'}</span>
              </button>`;
          }).join('')}
        </div>
        <form id="loginPinForm" style="margin-top:14px" hidden>
          <div class="field">
            <label id="loginPinLabel" for="loginPinInput">PIN de acceso</label>
            <input class="input" id="loginPinInput" type="password" inputmode="numeric" placeholder="Ingresá tu PIN" autocomplete="off" style="font-size:18px;text-align:center;letter-spacing:0.18em">
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button type="button" class="btn btn-ghost" id="loginPinCancel" style="flex:1">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1">Ingresar</button>
          </div>
        </form>
      </div>`;

    let pendingWid = '';
    const pinForm = lv.querySelector('#loginPinForm');
    const pinInp = lv.querySelector('#loginPinInput');
    const pinLbl = lv.querySelector('#loginPinLabel');

    lv.querySelectorAll('[data-wid]').forEach((b) => b.addEventListener('click', async () => {
      if (b.dataset.pin === '1') {
        pendingWid = b.dataset.wid;
        pinLbl.textContent = `PIN para ingresar como ${b.dataset.wname}`;
        pinInp.value = '';
        pinForm.hidden = false;
        setTimeout(() => pinInp.focus(), 30);
        return;
      }
      await loginAs(b.dataset.wid, '');
    }));

    lv.querySelector('#loginPinCancel')?.addEventListener('click', () => {
      pinForm.hidden = true;
      pendingWid = '';
    });

    pinForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = pinInp.value.trim();
      if (!pin || !pendingWid) return;
      await loginAs(pendingWid, pin);
    });
  }

  async function loginAs(waiterId, pin = '') {
    try {
      const res = await apiPost('api/auth/waiter', { waiterId, pin });
      myId = res.waiter.id;
      setAuthToken(res.token);
      sessionStorage.setItem('salelisto:waiterId', myId);
      sessionStorage.setItem('salelisto:waiterToken', res.token);
      history.replaceState(null, '', `mozo.html?waiter=${encodeURIComponent(myId)}`);
      unlockAudio();
      requestPushPermission();
      await bootApp();
    } catch (err) {
      sessionStorage.removeItem('salelisto:waiterId');
      sessionStorage.removeItem('salelisto:waiterToken');
      toast(`⚠️ ${err.message}`);
      await showLoginScreen();
    }
  }

  window.addEventListener('salelisto:auth-expired', () => {
    toast('🔒 Tu sesión expiró. Volvé a ingresar.');
    sessionStorage.removeItem('salelisto:waiterToken');
    setAuthToken('');
    showLoginScreen();
  });

  // Intento automático si viene ?waiter=w1 o sesión guardada
  if (preselectWaiter) {
    const savedId = sessionStorage.getItem('salelisto:waiterId') || '';
    if (savedToken && savedId === preselectWaiter) {
      setAuthToken(savedToken);
    }
    try {
      const pub = await fetch('api/waiters-public').then((r) => r.json());
      const found = pub.waiters.find((w) => w.id === preselectWaiter);
      if (found && savedToken && savedId === found.id) {
        myId = found.id;
        await bootApp();
        return;
      }
      if (found && !found.hasPin && pub.demoMode) {
        await loginAs(found.id, '');
        return;
      }
    } catch (_) {}
  }
  await showLoginScreen();

  // ---------- App Iniciada ----------
  async function bootApp() {
    $('#loginView').hidden = true;
    $('#waiterApp').hidden = false;

    try {
      activeStream = await connectStream({ scope: 'staff' }, connectionBanner);
    } catch (_) {
      sessionStorage.removeItem('salelisto:waiterToken');
      setAuthToken('');
      await showLoginScreen();
      return;
    }
    state = activeStream.state;

    seedKnownSets(state);
    if (!eventsBound) {
      bindEvents();
      eventsBound = true;
    }
    renderAll();
    syncWristbandState(true);

    unsubState = subscribe((s) => {
      state = s;
      // Si eliminaron a este mozo en vivo, volver al selector
      if (!s.waiters.some((w) => w.id === myId)) {
        toast('Tu usuario fue dado de baja del turno');
        sessionStorage.removeItem('salelisto:waiterId');
        sessionStorage.removeItem('salelisto:waiterToken');
        showLoginScreen();
        return;
      }
      checkLiveAlerts(s);
      renderHeader();
      renderAlerts();
      renderTables();
      renderOrderPad();
    });
  }

  function myWaiter() {
    return state.waiters.find((w) => w.id === myId);
  }

  function isMineOrOrphan(waiterId) {
    return waiterId === myId || !waiterId;
  }

  function seedKnownSets(s) {
    knownReady = new Set(s.orders.filter((o) => o.status === 'listo' && isMineOrOrphan(o.waiterId)).map((o) => o.id));
    knownCalls = new Set(s.calls.filter((c) => isMineOrOrphan(c.waiterId)).map((c) => `${c.id}:${c.status}`));
    knownNotifs = new Set(s.notifications.filter((n) => isMineOrOrphan(n.waiterId)).map((n) => n.id));
  }

  async function syncWristbandState(resyncServer = false) {
    const card = $('#wristCard');
    const badge = $('#wristStateBadge');
    const enableBtn = $('#wristEnableBtn');
    const testBtn = $('#wristTestBtn');
    const disableBtn = $('#wristDisableBtn');
    if (!card || !badge) return;

    const sup = getPushSupportStatus();
    const sub = await getExistingPushSubscription({ waiterId: myId });

    if (sub) {
      if (resyncServer && myId) {
        try {
          await apiPost('api/push/subscribe', {
            waiterId: myId,
            subscription: sub.toJSON(),
            wristbandMode: true,
          });
        } catch (_) {}
      }
      wristbandActive = true;
      card.classList.add('active');
      badge.className = 'wrist-state on';
      badge.textContent = '🟢 Activa';
      enableBtn.hidden = true;
      testBtn.hidden = false;
      disableBtn.hidden = false;
      // Si ya está activa y el mozo no forzó expandirla, colapsar para despejar los avisos
      if (wristCollapsedPref !== '0') {
        applyWristCollapsed(true);
      }
      return;
    }

    wristbandActive = false;
    card.classList.remove('active');
    enableBtn.hidden = false;
    testBtn.hidden = true;
    disableBtn.hidden = true;
    if (wristCollapsedPref === '1') {
      applyWristCollapsed(true);
    } else {
      applyWristCollapsed(false);
    }

    if (!sup.secure) {
      badge.className = 'wrist-state warn';
      badge.textContent = 'Requiere HTTPS';
    } else if (sup.isIOS && !sup.isStandalone) {
      badge.className = 'wrist-state warn';
      badge.textContent = 'Agregar a Inicio';
    } else if (sup.permission === 'denied') {
      badge.className = 'wrist-state warn';
      badge.textContent = 'Permiso bloqueado';
    } else {
      badge.className = 'wrist-state off';
      badge.textContent = 'Opcional';
    }
  }

  function checkLiveAlerts(s) {
    let urgentAlert = false;
    let softAlert = false;

    s.orders.filter((o) => o.status === 'listo' && isMineOrOrphan(o.waiterId)).forEach((o) => {
      if (!knownReady.has(o.id)) {
        urgentAlert = true;
        const stInfo = stationInfo(o.station);
        const msg = `¡Retirar en ${stInfo.icon} ${stInfo.short.toUpperCase()} -> Mesa ${o.tableCode}!`;
        toast(msg, 4200);
        if (!wristbandActive) {
          const shortHdr = `${stInfo.icon} ${o.tableCode} · Retirar ${stInfo.short}`;
          notifyBrowser(shortHdr, o.items.map((i) => `${i.qty}x ${i.name}`).join(', '), {
            tag: `salelisto-ready-${o.id}`,
          });
        }
      }
    });

    s.calls.filter((c) => isMineOrOrphan(c.waiterId)).forEach((c) => {
      const key = `${c.id}:${c.status}`;
      if (!knownCalls.has(key) && c.status === 'pendiente') {
        urgentAlert = true;
        const msg = c.type === 'mozo' ? `🙋 Mesa ${c.tableCode} te llama (${c.reason})` : `💳 Mesa ${c.tableCode} pide la cuenta`;
        toast(msg, 4200);
        if (!wristbandActive) {
          notifyBrowser(msg, c.blockName, { tag: `salelisto-call-${c.id}` });
        }
      }
    });

    s.notifications.filter((n) => isMineOrOrphan(n.waiterId) && !n.read).forEach((n) => {
      if (!knownNotifs.has(n.id)) {
        if (n.kind === 'table_transferred') {
          urgentAlert = true;
          toast(n.title, 4500);
        } else if (n.kind === 'new_order') {
          softAlert = true;
          toast(n.title, 3500);
        }
      }
    });

    if (urgentAlert) ding(2, true);
    else if (softAlert) ding(1, false);

    seedKnownSets(s);
  }

  function bindEvents() {
    onAudioState((active, detail) => {
      const b = $('#audioBtn');
      if (!b) return;
      b.className = `audio-pill ${active ? 'on' : 'off'}`;
      if (active) b.textContent = '🔊 Activo';
      else if (detail && detail.muted) b.textContent = '🔇 Silenciado';
      else b.textContent = '🔇 Activar';
    });

    $('#audioBtn').onclick = async () => {
      const muted = await toggleSoundMute();
      if (!muted) requestPushPermission();
      toast(muted ? '🔇 Sonido silenciado' : '🔊 Sonido y vibración activados');
    };

    const toggleWristCard = () => {
      const card = $('#wristCard');
      const nextCollapsed = !card.classList.contains('collapsed');
      wristCollapsedPref = nextCollapsed ? '1' : '0';
      try { localStorage.setItem('salelisto:wristCollapsed', wristCollapsedPref); } catch (_) {}
      applyWristCollapsed(nextCollapsed);
    };
    $('#wristToggleHead').onclick = toggleWristCard;
    $('#wristToggleHead').onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWristCard(); }
    };
    $('#wristHideBtn').onclick = () => {
      wristCollapsedPref = '1';
      try { localStorage.setItem('salelisto:wristCollapsed', '1'); } catch (_) {}
      applyWristCollapsed(true);
    };

    $('#wristEnableBtn').onclick = async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = 'Activando…';
      unlockAudio();
      try {
        await subscribeWaiterPush(myId, true);
        wristCollapsedPref = '0'; // Mantener visible tras activarla para que pueda tocar "Probar vibración"
        await syncWristbandState(false);
        ding(1);
        toast('⌚ Modo Pulsera activo para pantalla bloqueada');
      } catch (err) {
        toast(`⚠️ ${err.message}`);
        await syncWristbandState(false);
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
    };
    $('#wristTestBtn').onclick = async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      try {
        await sendWaiterPushTest(myId);
        toast('⌚ Señal enviada: bloqueá el celu para sentir tu Xiaomi Band');
      } catch (err) {
        toast(`⚠️ ${err.message}`);
      } finally {
        setTimeout(() => { btn.disabled = false; }, 1200);
      }
    };
    $('#wristDisableBtn').onclick = async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      try {
        await unsubscribeWaiterPush();
        await syncWristbandState(false);
        toast('Modo Pulsera desactivado en este dispositivo');
      } finally {
        btn.disabled = false;
      }
    };
    $('#logoutBtn').onclick = () => {
      sessionStorage.removeItem('salelisto:waiterId');
      sessionStorage.removeItem('salelisto:waiterToken');
      location.href = 'mozo.html';
    };
    $('#shiftBtn').onclick = async () => {
      const w = myWaiter();
      if (!w) return;
      const myOpen = state.tables.filter((t) => t.waiterId === myId && t.sessionId).length;
      if (w.available && myOpen > 0) {
        if (!confirm(`Tenés ${myOpen} mesa(s) abierta(s). Al salir de turno se reasignarán automáticamente a tus compañeros disponibles. ¿Continuar?`)) return;
      }
      try {
        const res = await dispatch('waiter.toggle', { id: myId, available: !w.available });
        if (res.result?.reassigned?.length) {
          toast(`🔄 ${res.result.reassigned.length} mesa(s) transferidas automáticamente`);
        } else {
          toast(res.result?.available ? '✅ Ya estás disponible en turno' : '⏸️ Saliste de turno');
        }
      } catch (err) {
        toast(`⚠️ ${err.message}`);
      }
    };

    document.querySelector('.m-tabbar').onclick = (e) => {
      const b = e.target.closest('[data-mtab]');
      if (!b) return;
      mtab = b.dataset.mtab;
      document.querySelectorAll('.m-tab').forEach((x) => x.classList.toggle('active', x === b));
      $('#mview-alerts').hidden = mtab !== 'alerts';
      $('#mview-tables').hidden = mtab !== 'tables';
      $('#mview-order').hidden = mtab !== 'order';
      renderPadBar();
    };

    document.querySelector('.m-filter-bar').onclick = (e) => {
      const b = e.target.closest('[data-tfilter]');
      if (!b) return;
      tableFilter = b.dataset.tfilter;
      document.querySelectorAll('[data-tfilter]').forEach((x) => x.classList.toggle('active', x === b));
      renderTables();
    };

    $('#alertsContent').onclick = async (e) => {
      const claim = e.target.closest('[data-claim-table]');
      if (claim) {
        claim.disabled = true;
        const ok = await safeAct('session.reassign', { tableId: claim.dataset.claimTable, waiterId: myId });
        if (ok) toast('🪑 Tomaste la atención de esta mesa');
        else claim.disabled = false;
        return;
      }
      const deliver = e.target.closest('[data-deliver]');
      if (deliver) {
        deliver.disabled = true;
        await safeAct('order.advance', { id: deliver.dataset.deliver });
        toast('✔ Entregado en mesa');
        return;
      }
      const onway = e.target.closest('[data-onway]');
      if (onway) {
        onway.disabled = true;
        await safeAct('call.status', { id: onway.dataset.onway, status: 'en_camino' });
        toast('🏃 Cliente avisado que vas en camino');
        return;
      }
      const attend = e.target.closest('[data-attend]');
      if (attend) {
        attend.disabled = true;
        await safeAct('call.status', { id: attend.dataset.attend, status: 'atendida' });
        return;
      }
      const openTbl = e.target.closest('[data-open-table]');
      if (openTbl) openTableSheet(openTbl.dataset.openTable);
      if (e.target.closest('#clearNotifs')) {
        await safeAct('notifications.read', { waiterId: myId });
      }
    };

    $('#tablesContent').onclick = (e) => {
      const b = e.target.closest('[data-tid]');
      if (b) openTableSheet(b.dataset.tid);
    };

    $('#padSearch').oninput = renderOrderPadItems;
    $('#padCats').onclick = (e) => {
      const b = e.target.closest('[data-pcat]');
      if (!b) return;
      padCatId = b.dataset.pcat;
      renderOrderPadCats();
      renderOrderPadItems();
    };
    $('#padItems').onclick = (e) => {
      const b = e.target.closest('[data-padd]');
      if (!b) return;
      const item = state.items.find((i) => i.id === b.dataset.padd);
      if (!item || !item.available) return;
      const ex = padCart.find((l) => l.itemId === item.id && !l.note);
      if (ex) ex.qty = Math.min(30, ex.qty + 1);
      else padCart.push({ key: `${item.id}-${Date.now()}`, itemId: item.id, qty: 1, note: '' });
      renderOrderPadItems();
      renderPadBar();
    };
    $('#padBar').onclick = openPadReviewSheet;
    $('#mBackdrop').onclick = closeSheet;
  }

  async function safeAct(type, payload) {
    try {
      return await dispatch(type, payload);
    } catch (err) {
      toast(`⚠️ ${err.message}`);
      return null;
    }
  }

  // ---------- Renderizado ----------
  function renderHeader() {
    const w = myWaiter();
    if (!w) return;
    $('#wAvatar').textContent = w.name.slice(0, 1).toUpperCase();
    $('#wAvatar').style.background = w.color;
    $('#wName').textContent = w.name;
    $('#wRest').textContent = state.restaurant.name;
    const sb = $('#shiftBtn');
    sb.className = `shift-pill ${w.available ? 'on' : 'off'}`;
    sb.textContent = w.available ? '🟢 En turno' : '⏸️ Fuera de turno';
  }

  function formatCashChangeNote(c) {
    if (c.payment !== 'Efectivo') return '';
    const cash = Math.max(0, Number(c.cashAmount) || 0);
    const total = Number(c.total) || 0;
    if (cash > total && total > 0) {
      return `<span class="m-change-pill">💵 Abona con ${money(cash)} -&gt; Llevar ${money(cash - total)} de vuelto</span>`;
    }
    if (cash === total && total > 0) {
      return `<span class="m-change-pill" style="background:var(--ok-soft);color:var(--ok)">💵 Abona con importe justo</span>`;
    }
    return '';
  }

  function renderAlerts() {
    const readyOrders = state.orders.filter((o) => o.isOpenSession && o.status === 'listo' && isMineOrOrphan(o.waiterId));
    const myCalls = state.calls.filter((c) => isMineOrOrphan(c.waiterId));
    const myNotifs = state.notifications.filter((n) => isMineOrOrphan(n.waiterId) && !n.read);

    const urgentTotal = readyOrders.length + myCalls.length;
    const badge = $('#alertsBadge');
    badge.hidden = urgentTotal === 0;
    badge.textContent = urgentTotal;

    let html = '';

    // 1. Listos para retirar en Barra / Cocina / Mostrador
    html += `<section class="m-section">
      <div class="m-section-head"><h2>🍽️ Listos para llevar (${readyOrders.length})</h2></div>
      ${readyOrders.length ? readyOrders.map((o) => {
        const stInfo = stationInfo(o.station);
        const cardCls = o.station === 'barra' ? 'barra' : o.station === 'mostrador' ? 'mostrador-ready' : 'cocina-ready';
        const isOrphan = !o.waiterId;
        return `
        <article class="alert-card ${cardCls}">
          <div class="alert-top">
            <strong>Mesa ${escapeHtml(o.tableCode)} · ${escapeHtml(o.blockName)}</strong>
            <span class="chip ${stInfo.chipCls}">${stInfo.icon} Retirar en ${stInfo.short.toUpperCase()}</span>
          </div>
          ${isOrphan ? '<div style="margin-bottom:6px"><span class="chip nuevo">⚠️ Mesa sin mozo asignado</span></div>' : ''}
          <div class="alert-lines">
            ${o.items.map((i) => `<div><b>${i.qty}×</b> ${escapeHtml(i.name)}${i.note ? `<span class="note">↳ ${escapeHtml(i.note)}</span>` : ''}</div>`).join('')}
          </div>
          <div class="alert-actions">
            ${isOrphan ? `<button class="btn btn-ghost btn-sm" type="button" data-claim-table="${escapeHtml(o.tableId)}">🤚 Tomar mesa</button>` : ''}
            <button class="btn btn-ok btn-sm" type="button" data-deliver="${escapeHtml(o.id)}">✔ Entregado en mesa</button>
          </div>
        </article>`;
      }).join('')
      : '<p style="font-size:13px;color:var(--ink-3);padding:4px 0 8px">No hay pedidos esperando retiro.</p>'}
    </section>`;

    // 2. Llamados y Cuentas
    html += `<section class="m-section">
      <div class="m-section-head"><h2>🙋 Llamados y Cuentas (${myCalls.length})</h2></div>
      ${myCalls.length ? myCalls.map((c) => {
        const isOrphan = !c.waiterId;
        if (c.type === 'mozo') {
          return `<article class="alert-card call-mozo">
            <div class="alert-top"><strong>🙋 Mesa ${escapeHtml(c.tableCode)} (${escapeHtml(c.blockName)})</strong><small>${timeAgo(c.createdAt)}</small></div>
            <p style="font-size:14px;margin-bottom:10px">Necesita: <strong>${escapeHtml(c.reason)}</strong> ${c.status === 'en_camino' ? '<span class="chip entregado">En camino</span>' : ''} ${isOrphan ? '<span class="chip nuevo">Sin mozo</span>' : ''}</p>
            <div class="alert-actions">
              ${isOrphan ? `<button class="btn btn-ghost btn-sm" type="button" style="background:#fff" data-claim-table="${escapeHtml(c.tableId)}">🤚 Tomar mesa</button>` : ''}
              ${c.status === 'pendiente' ? `<button class="btn btn-sm" type="button" style="background:#fff" data-onway="${escapeHtml(c.id)}">🏃 Voy en camino</button>` : ''}
              <button class="btn btn-primary btn-sm" type="button" data-attend="${escapeHtml(c.id)}">✔ Atendido</button>
            </div>
          </article>`;
        }
        const splitWays = Math.max(1, Number(c.splitWays) || 1);
        const splitTxt = splitWays > 1 ? ` · ÷ ${splitWays} (${money(Math.ceil((c.total || 0) / splitWays))} c/u)` : '';
        return `<article class="alert-card call-cuenta">
          <div class="alert-top"><strong>💳 Mesa ${escapeHtml(c.tableCode)} (${escapeHtml(c.blockName)})</strong><small>${timeAgo(c.createdAt)}</small></div>
          <p style="font-size:14px;margin-bottom:8px">
            Paga con <strong>${escapeHtml(c.payment)}</strong> · Propina ${c.tip}% -&gt; <strong>${money(c.total)}</strong>${splitTxt}
            ${c.status === 'en_camino' ? ' <span class="chip entregado">Llevando cobro</span>' : ''}
            ${isOrphan ? ' <span class="chip nuevo">Sin mozo</span>' : ''}
            ${formatCashChangeNote(c)}
          </p>
          <div class="alert-actions">
            ${isOrphan ? `<button class="btn btn-ghost btn-sm" type="button" style="background:#fff" data-claim-table="${escapeHtml(c.tableId)}">🤚 Tomar mesa</button>` : ''}
            ${c.status === 'pendiente' ? `<button class="btn btn-sm" type="button" style="background:#fff" data-onway="${escapeHtml(c.id)}">🏃 Llevo cuenta</button>` : ''}
            <button class="btn btn-primary btn-sm" type="button" data-open-table="${escapeHtml(c.tableId)}">Cobrar y cerrar</button>
          </div>
        </article>`;
      }).join('')
      : '<p style="font-size:13px;color:var(--ink-3);padding:4px 0 8px">Ninguna de tus mesas tiene llamados pendientes.</p>'}
    </section>`;

    // 3. Avisos recientes
    html += `<section class="m-section">
      <div class="m-section-head">
        <h2>📬 Novedades recientes (${myNotifs.length})</h2>
        ${myNotifs.length ? '<button class="btn btn-xs btn-ghost" type="button" id="clearNotifs">Limpiar</button>' : ''}
      </div>
      ${myNotifs.length ? myNotifs.slice(0, 12).map((n) => `
        <div class="notif-row unread">
          <div style="display:flex;justify-content:space-between;gap:8px">
            <strong>${escapeHtml(n.title)}</strong>
            <small>${timeAgo(n.createdAt)}</small>
          </div>
          ${n.body ? `<div style="color:var(--ink-2)">${escapeHtml(n.body)}</div>` : ''}
        </div>`).join('')
      : '<p style="font-size:13px;color:var(--ink-3)">Todo al día en tu sector.</p>'}
    </section>`;

    $('#alertsContent').innerHTML = html;
  }

  function renderTables() {
    const myOpenCount = state.tables.filter((t) => t.waiterId === myId && t.sessionId).length;
    const mb = $('#myTablesBadge');
    mb.hidden = myOpenCount === 0;
    mb.textContent = myOpenCount;
    $('#fMine').textContent = `Mis mesas (${myOpenCount})`;

    const w = myWaiter();
    const mySectorSet = new Set(w?.blockIds || []);
    const labels = { libre: 'Libre', ocupada: 'Ocupada', mozo: '🙋 Llama', cuenta: '💳 Cuenta', inactiva: 'Inactiva' };

    const blocksHtml = state.blocks.map((b) => {
      let tbls = state.tables.filter((t) => t.blockId === b.id && t.active);
      if (tableFilter === 'mine') {
        tbls = tbls.filter((t) => t.waiterId === myId || (!t.sessionId && mySectorSet.has(b.id)));
      }
      if (!tbls.length) return '';
      return `<div class="m-block">
        <h3>${b.icon} ${escapeHtml(b.name)}</h3>
        <div class="m-grid">
          ${tbls.map((t) => `
            <button class="m-table ${t.status}" type="button" data-tid="${escapeHtml(t.id)}">
              <div style="display:flex;justify-content:space-between;width:100%;align-items:baseline">
                <span class="code">Mesa ${escapeHtml(t.code)}</span>
                <small>${t.seats} pers.</small>
              </div>
              <span class="st">${labels[t.status] || t.status}</span>
              ${t.sessionId ? `<strong style="margin-top:4px">${money(t.subtotal)}</strong>` : ''}
              ${t.waiterName ? `<span class="waiter-pill" style="margin-top:4px"><span class="waiter-dot" style="background:${escapeHtml(t.waiterColor)}"></span>${escapeHtml(t.waiterName)}</span>` : ''}
            </button>`).join('')}
        </div>
      </div>`;
    }).join('');

    $('#tablesContent').innerHTML = blocksHtml || '<div class="empty"><span class="big">🪑</span>Aún no tenés mesas abiertas asignadas.<br>Cambiá a "Todo el salón" para ver todas las mesas.</div>';
  }

  function renderOrderPadCats() {
    const cats = state.categories || [];
    if (padCatId !== 'all' && !cats.some((c) => c.id === padCatId)) {
      padCatId = 'all';
    }
    $('#padCats').innerHTML = [
      `<button type="button" class="pad-cat ${padCatId === 'all' ? 'active' : ''}" data-pcat="all">Todo</button>`,
      ...cats.map((c) => `<button type="button" class="pad-cat ${padCatId === c.id ? 'active' : ''}" data-pcat="${escapeHtml(c.id)}">${c.icon} ${escapeHtml(c.name)}</button>`),
    ].join('');
  }

  function renderOrderPad() {
    const sel = $('#padTable');
    const prev = sel.value;
    const activeTables = state.tables.filter((t) => t.active);
    activeTables.sort((a, b) => ((b.waiterId === myId) - (a.waiterId === myId)));
    sel.innerHTML = activeTables.map((t) => {
      const blk = state.blocks.find((b) => b.id === t.blockId);
      const tag = t.waiterId === myId ? ' · Tu mesa' : t.waiterName ? ` · ${t.waiterName}` : ' · Libre';
      return `<option value="${escapeHtml(t.id)}">${blk ? escapeHtml(blk.name) + ' · ' : ''}Mesa ${escapeHtml(t.code)}${escapeHtml(tag)}</option>`;
    }).join('');
    if (prev && activeTables.some((t) => t.id === prev)) sel.value = prev;
    renderOrderPadCats();
    renderOrderPadItems();
    renderPadBar();
  }

  function renderOrderPadItems() {
    const q = normalizeSearch($('#padSearch').value || '');
    const inPad = {};
    padCart.forEach((l) => { inPad[l.itemId] = (inPad[l.itemId] || 0) + l.qty; });

    const list = state.items.filter((i) => {
      if (!i.available) return false;
      if (padCatId !== 'all' && i.cat !== padCatId) return false;
      if (q && !normalizeSearch(`${i.name} ${i.desc || ''}`).includes(q)) return false;
      return true;
    });
    $('#padItems').innerHTML = list.map((i) => `
      <div class="pad-row">
        <div class="info">
          <strong>${i.emoji} ${escapeHtml(i.name)} ${inPad[i.id] ? `<span class="chip nuevo">${inPad[i.id]}×</span>` : ''}</strong>
          <small>${money(i.price)} · ${stationLabel(i.effectiveStation)}</small>
        </div>
        <button class="btn btn-sm btn-primary" type="button" data-padd="${escapeHtml(i.id)}">+ Agregar</button>
      </div>`).join('') || '<div class="empty">No se encontraron productos disponibles.</div>';
  }

  function renderPadBar() {
    const count = padCart.reduce((t, l) => t + l.qty, 0);
    const total = padCart.reduce((t, l) => t + (state.items.find((i) => i.id === l.itemId)?.price || 0) * l.qty, 0);
    $('#padBar').hidden = mtab !== 'order' || count === 0;
    $('#padCount').textContent = count;
    $('#padTotal').textContent = money(total);
  }

  // ---------- Sheets de Mesa y Envío Manual ----------
  function openSheet(html, onMount) {
    $('#mSheet').innerHTML = `<div class="sheet-grip"></div>${html}`;
    $('#mSheet').hidden = false;
    $('#mBackdrop').hidden = false;
    onMount?.($('#mSheet'));
  }
  function closeSheet() {
    $('#mSheet').hidden = true;
    $('#mBackdrop').hidden = true;
  }

  function openPadReviewSheet() {
    const tid = $('#padTable').value;
    const tbl = state.tables.find((t) => t.id === tid);
    if (!tbl || !padCart.length) return;

    const linesHtml = padCart.map((l) => {
      const it = state.items.find((i) => i.id === l.itemId);
      if (!it) return '';
      return `<div style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <strong>${it.emoji} ${escapeHtml(it.name)}</strong>
          <div class="stepper">
            <button type="button" data-pk="${escapeHtml(l.key)}" data-pq="-1">−</button>
            <span>${l.qty}</span>
            <button type="button" data-pk="${escapeHtml(l.key)}" data-pq="1">+</button>
          </div>
        </div>
        <input class="input" data-pnote="${escapeHtml(l.key)}" placeholder="Aclaración (opcional)" value="${escapeHtml(l.note)}" style="margin-top:6px;padding:7px 10px;font-size:14px">
      </div>`;
    }).join('');

    openSheet(`
      <h3>Enviar pedido · Mesa ${escapeHtml(tbl.code)}</h3>
      <p style="font-size:13px;color:var(--ink-2);margin-bottom:8px">Separación automática por estación (Cocina, Barra y Mostrador).</p>
      ${linesHtml}
      <div class="sheet-actions">
        <button class="btn btn-ghost" type="button" id="pCancel">Volver</button>
        <button class="btn btn-primary" type="button" id="pSend">Enviar comanda</button>
      </div>`, (el) => {
      el.querySelectorAll('[data-pnote]').forEach((inp) => inp.addEventListener('input', () => {
        const ln = padCart.find((x) => x.key === inp.dataset.pnote);
        if (ln) ln.note = inp.value;
      }));
      el.querySelectorAll('[data-pk]').forEach((b) => b.addEventListener('click', () => {
        const ln = padCart.find((x) => x.key === b.dataset.pk);
        if (!ln) return;
        ln.qty += Number(b.dataset.pq);
        if (ln.qty <= 0) padCart = padCart.filter((x) => x !== ln);
        renderOrderPadItems();
        renderPadBar();
        padCart.length ? openPadReviewSheet() : closeSheet();
      }));
      el.querySelector('#pCancel').onclick = closeSheet;
      el.querySelector('#pSend').onclick = async (ev) => {
        ev.currentTarget.disabled = true;
        const ok = await safeAct('order.create', {
          tableId: tid,
          waiterId: myId,
          source: 'mozo',
          items: padCart.map((l) => ({ itemId: l.itemId, qty: l.qty, note: l.note })),
        });
        if (ok) {
          padCart = [];
          closeSheet();
          renderOrderPadItems();
          renderPadBar();
          toast(`✅ Comanda enviada para Mesa ${tbl.code}`);
        } else {
          ev.currentTarget.disabled = false;
        }
      };
    });
  }

  function openTableSheet(tableId) {
    const t = state.tables.find((x) => x.id === tableId);
    if (!t) return;
    const blk = state.blocks.find((b) => b.id === t.blockId);
    const tOrders = state.orders.filter((o) => o.isOpenSession && o.tableId === t.id && o.status !== 'cancelado');
    const billCall = state.calls.find((c) => c.tableId === t.id && c.type === 'cuenta');
    const pendingOrders = tOrders.filter((o) => o.status !== 'entregado').length;

    let pay = billCall?.payment || 'Tarjeta';
    let tip = billCall?.tip ?? 0;
    const sub = t.subtotal || 0;
    const cashAmount = Math.max(0, Number(billCall?.cashAmount) || 0);
    const splitWays = Math.max(1, Number(billCall?.splitWays) || 1);

    const calcGrand = (tipPct) => sub + Math.round((sub * tipPct) / 100);

    openSheet(`
      <h3>${blk ? blk.icon + ' ' + escapeHtml(blk.name) + ' · ' : ''}Mesa ${escapeHtml(t.code)}</h3>
      <p style="font-size:13px;color:var(--ink-2);margin-bottom:10px">
        ${t.sessionId ? `Atiende: <strong>${escapeHtml(t.waiterName || 'Sin asignar')}</strong>` : 'Mesa libre'}
      </p>
      ${tOrders.length ? `
        <div style="max-height:200px;overflow-y:auto;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:8px 0">
          ${tOrders.map((o) => o.items.map((i) => `
            <div style="display:flex;justify-content:space-between;font-size:14px;padding:3px 0">
              <span>${i.qty}× ${escapeHtml(i.name)} <small style="color:var(--ink-3)">(${escapeHtml(o.status)})</small></span>
              <span>${money(i.price * i.qty)}</span>
            </div>`).join('')).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:800;font-size:17px;margin:10px 0">
          <span>Subtotal</span><span>${money(sub)}</span>
        </div>
        ${pendingOrders ? `<div style="background:var(--warn-soft);color:var(--warn);padding:8px 10px;border-radius:10px;font-size:12px;font-weight:700;margin-bottom:8px">⚠️ Hay ${pendingOrders} pedido(s) aún sin marcar como entregado.</div>` : ''}
        <div class="field" style="margin-top:8px">
          <label id="closeGrandLbl">Medio de pago y propina (${tip}% -&gt; Total ${money(calcGrand(tip))})</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <select class="input" id="closePay">${['Efectivo', 'Tarjeta', 'QR', 'Transferencia'].map((p) => `<option value="${p}" ${p === pay ? 'selected' : ''}>${p}</option>`).join('')}</select>
            <select class="input" id="closeTip">${[0, 5, 10, 15].map((p) => `<option value="${p}" ${p === tip ? 'selected' : ''}>Propina ${p}%</option>`).join('')}</select>
          </div>
        </div>
        <div id="closeExtraInfo" style="margin-top:8px"></div>
      ` : '<p style="color:var(--ink-3);padding:12px 0">Sin consumos abiertos.</p>'}
      <div class="sheet-actions">
        <button class="btn btn-ghost" type="button" id="goPadBtn">+ Cargar pedido</button>
        ${t.sessionId ? `<button class="btn btn-primary" type="button" id="closeTblBtn">Cobrar ${money(calcGrand(tip))} y cerrar</button>` : ''}
      </div>`, (el) => {
      const syncCloseTotals = () => {
        const chosenPay = el.querySelector('#closePay')?.value || pay;
        const chosenTip = Number(el.querySelector('#closeTip')?.value ?? tip);
        const grand = calcGrand(chosenTip);
        const lbl = el.querySelector('#closeGrandLbl');
        if (lbl) lbl.textContent = `Medio de pago y propina (${chosenTip}% -> Total ${money(grand)})`;
        const cb = el.querySelector('#closeTblBtn');
        if (cb) cb.textContent = `Cobrar ${money(grand)} y cerrar`;
        const extra = el.querySelector('#closeExtraInfo');
        if (extra) {
          const parts = [];
          if (splitWays > 1) {
            parts.push(`<div style="font-size:13px;font-weight:700;color:var(--ink-2)">÷ Dividido entre ${splitWays}: <strong>${money(Math.ceil(grand / splitWays))} c/u</strong></div>`);
          }
          if (chosenPay === 'Efectivo' && cashAmount > grand) {
            parts.push(`<div class="m-change-pill">💵 Abona con ${money(cashAmount)} -&gt; Llevar ${money(cashAmount - grand)} de vuelto</div>`);
          } else if (chosenPay === 'Efectivo' && cashAmount === grand && grand > 0) {
            parts.push(`<div class="m-change-pill" style="background:var(--ok-soft);color:var(--ok)">💵 Abona con importe justo</div>`);
          }
          extra.innerHTML = parts.join('');
        }
      };

      el.querySelector('#closePay')?.addEventListener('change', syncCloseTotals);
      el.querySelector('#closeTip')?.addEventListener('change', syncCloseTotals);
      syncCloseTotals();

      el.querySelector('#goPadBtn').onclick = () => {
        closeSheet();
        mtab = 'order';
        document.querySelectorAll('.m-tab').forEach((x) => x.classList.toggle('active', x.dataset.mtab === 'order'));
        $('#mview-alerts').hidden = true;
        $('#mview-tables').hidden = true;
        $('#mview-order').hidden = false;
        $('#padTable').value = t.id;
        renderPadBar();
      };
      const cb = el.querySelector('#closeTblBtn');
      if (cb) {
        cb.onclick = async () => {
          const chosenPay = el.querySelector('#closePay')?.value || 'Efectivo';
          const chosenTip = Number(el.querySelector('#closeTip')?.value || 0);
          let force = false;
          if (pendingOrders > 0) {
            if (!confirm(`Todavía figuran ${pendingOrders} pedido(s) sin entregar. ¿Marcarlos entregados y cerrar la Mesa ${t.code}?`)) return;
            force = true;
          }
          const ok = await safeAct('table.close', { tableId: t.id, payment: chosenPay, tip: chosenTip, force });
          if (ok) {
            closeSheet();
            toast(`✔ Mesa ${t.code} cobrada y cerrada`);
          }
        };
      }
    });
  }

  function renderAll() {
    renderHeader();
    renderAlerts();
    renderTables();
    renderOrderPad();
  }
})();
