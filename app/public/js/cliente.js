(async () => {
  const params = new URLSearchParams(location.search);
  const urlToken = (params.get('t') || '').trim();
  const legacyMesa = (params.get('mesa') || '').trim();

  const $ = (sel) => document.querySelector(sel);

  const conn = await connectStream({ scope: 'client', qrToken: urlToken, mesa: legacyMesa }, connectionBanner);
  let state = conn.state;

  if (!state.validTable) {
    renderInvalidScreen(state);
    return;
  }

  $('#clientApp').hidden = false;
  const TOKEN = state.table.qrToken;
  // Si entró por ?mesa=X en modo demo, fijamos la URL con el token seguro real
  if (!urlToken && TOKEN) {
    history.replaceState(null, '', `cliente.html?t=${encodeURIComponent(TOKEN)}`);
  }

  const CART_KEY = `salelisto:cart:${TOKEN}`;
  let cart = loadCart();
  let tab = 'menu';
  let activeCat = state.categories[0]?.id || '';
  let openSheetKind = null; // 'item' | 'cart' | 'mozo' | 'cuenta' | 'closed' | null
  let lastOrderStatuses = mapOrders(state);
  let lastCallStatuses = mapCalls(state);
  let lastWaiterName = state.waiter?.name || null;
  let lastClosed = state.lastClosedAt || 0;

  // Limpiar carrito de inmediato al iniciar (evita crash si un plato fue eliminado mientras el cliente no estaba)
  sanitizeCart(state, false);

  function renderInvalidScreen(s) {
    const wrap = $('#invalidWrap');
    wrap.hidden = false;
    const demoHtml = s.demoTables?.length
      ? `<p style="margin-top:18px;font-weight:700;color:var(--ink)">Modo prueba activo · Elegí una mesa:</p>
         <div class="demo-links">${s.demoTables.map((t) => `<a class="btn btn-ghost btn-sm" href="cliente.html?t=${encodeURIComponent(t.qrToken)}">${escapeHtml(t.blockName)} · Mesa ${escapeHtml(t.code)}</a>`).join('')}</div>`
      : '';
    wrap.innerHTML = `
      <div class="invalid-card">
        <img src="logo.svg" alt="SaleListo" style="height:38px;margin:0 auto 14px;display:block">
        <h2>Escaneá el QR de tu mesa</h2>
        <p>Para ver el menú de <strong>${escapeHtml(s.restaurant?.name || 'nuestro local')}</strong> y pedir desde tu celular sin pedir Wi-Fi, apuntá la cámara al código QR ubicado en tu mesa.</p>
        ${demoHtml}
      </div>`;
  }

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (_) { return []; }
  }
  function persistCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (_) {}
  }

  function sanitizeCart(s, notifyUser) {
    const removedNames = [];
    const next = [];
    for (const line of cart) {
      const item = s.items.find((i) => i.id === line.itemId);
      if (!item || !item.available) {
        if (item) removedNames.push(item.name);
        else removedNames.push('Un plato eliminado');
      } else {
        next.push(line);
      }
    }
    if (next.length !== cart.length) {
      cart = next;
      persistCart();
      if (notifyUser && removedNames.length) {
        toast(`⚠️ Se agotó y quitamos de tu carrito: ${removedNames.join(', ')}`);
      }
      if (openSheetKind === 'cart') {
        cart.length ? openCartSheet() : closeSheet();
      }
    }
  }

  function mapOrders(s) {
    return Object.fromEntries((s.orders || []).map((o) => [o.id, o.status]));
  }
  function mapCalls(s) {
    return Object.fromEntries((s.calls || []).map((c) => [c.id, c.status]));
  }
  const itemById = (id) => state.items.find((i) => i.id === id);

  function itemThumb(item, hero = false) {
    if (item.imageUrl) {
      return `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy">`;
    }
    return item.emoji || (hero ? '🍽️' : '🍽️');
  }

  // ---------- Encabezado ----------
  function renderHeader() {
    $('#restName').textContent = state.restaurant.name;
    $('#blockLabel').textContent = `${state.table.blockIcon || ''} ${state.table.blockName}`.trim();
    $('#tableCode').textContent = state.table.code;
    document.title = `${state.restaurant.name} · Mesa ${state.table.code}`;

    const wb = $('#waiterBadge');
    if (!state.table.active) {
      wb.innerHTML = '<span class="chip nuevo">Mesa deshabilitada temporalmente</span>';
    } else if (state.waiter) {
      wb.innerHTML = `<span class="waiter-pill"><span class="waiter-dot" style="background:${escapeHtml(state.waiter.color)}"></span>Te atiende: <strong>${escapeHtml(state.waiter.name)}</strong></span>`;
    } else {
      wb.innerHTML = '<span style="color:var(--ink-3)">⚡ Mozo asignado automáticamente al pedir</span>';
    }
  }

  // ---------- Menú ----------
  function renderCats() {
    const visibleCats = state.categories.filter((c) => state.items.some((i) => i.cat === c.id));
    if (visibleCats.length && !visibleCats.some((c) => c.id === activeCat)) {
      activeCat = visibleCats[0].id;
    }
    $('#cats').innerHTML = visibleCats
      .map((c) => `<button class="cat ${c.id === activeCat ? 'active' : ''}" data-cat="${c.id}">${c.icon} ${escapeHtml(c.name)}</button>`)
      .join('');
  }

  function renderMenu() {
    const inCart = {};
    cart.forEach((l) => { inCart[l.itemId] = (inCart[l.itemId] || 0) + l.qty; });

    $('#menuList').innerHTML = state.categories.map((c) => {
      const items = state.items.filter((i) => i.cat === c.id);
      if (!items.length) return '';
      const stBadge = c.station === 'barra' ? '<span class="badge-bar">🍸 Sale de Barra</span>' : '';
      return `<section class="section" id="sec-${c.id}">
        <div class="section-head"><h2>${c.icon} ${escapeHtml(c.name)}</h2>${stBadge}</div>
        ${items.map((i) => `
          <button class="item ${i.available ? '' : 'off'}" data-item="${i.id}">
            <div class="item-img">${itemThumb(i)}</div>
            <div class="item-body">
              <div class="item-name">${escapeHtml(i.name)}
                ${i.popular ? '<span class="badge-pop">Popular</span>' : ''}
                ${!i.available ? '<span class="badge-off">Agotado</span>' : ''}
              </div>
              <p class="item-desc">${escapeHtml(i.desc)}</p>
              <div class="item-price">
                <span>${money(i.price)}</span>
                ${inCart[i.id] ? `<span class="in-cart">· ${inCart[i.id]} en tu carrito</span>` : ''}
              </div>
            </div>
            <span class="item-add">${i.available ? '+' : '–'}</span>
          </button>`).join('')}
      </section>`;
    }).join('');
  }

  $('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    activeCat = b.dataset.cat;
    renderCats();
    document.getElementById(`sec-${activeCat}`)?.scrollIntoView({ behavior: 'smooth' });
  });

  $('#menuList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-item]');
    if (!b) return;
    const item = itemById(b.dataset.item);
    if (!item) return;
    if (!item.available) return toast('Este producto está agotado en este momento');
    if (!state.table.active) return toast('Esta mesa está deshabilitada temporalmente');
    openItemSheet(item);
  });

  // ---------- Bottom sheet ----------
  function openSheet(kind, html, onMount) {
    openSheetKind = kind;
    $('#sheet').innerHTML = `<div class="sheet-grip"></div>${html}`;
    $('#sheet').hidden = false;
    $('#backdrop').hidden = false;
    onMount?.($('#sheet'));
  }

  function closeSheet() {
    openSheetKind = null;
    $('#sheet').hidden = true;
    $('#backdrop').hidden = true;
  }
  $('#backdrop').addEventListener('click', closeSheet);

  function openItemSheet(item) {
    let qty = 1;
    openSheet('item', `
      <div class="sheet-hero">${itemThumb(item, true)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <h3>${escapeHtml(item.name)}</h3>
        <span class="chip ${item.station === 'barra' ? 'barra' : 'est-cocina'}">${stationLabel(item.station)}</span>
      </div>
      <p class="muted" style="margin-top:4px">${escapeHtml(item.desc)}</p>
      <div class="sheet-row">
        <strong style="font-size:20px">${money(item.price)}</strong>
        <div class="stepper"><button data-q="-1">−</button><span id="qty">1</span><button data-q="1">+</button></div>
      </div>
      <div class="field">
        <label for="note">Aclaraciones (opcional)</label>
        <input class="input" id="note" placeholder="Ej: sin cebolla, poco hielo, punto cocido…" maxlength="100">
      </div>
      <div class="sheet-actions">
        <button class="btn btn-primary" id="addBtn">Agregar · ${money(item.price)}</button>
      </div>`, (el) => {
      el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
        qty = Math.max(1, Math.min(30, qty + Number(b.dataset.q)));
        el.querySelector('#qty').textContent = qty;
        el.querySelector('#addBtn').textContent = `Agregar · ${money(item.price * qty)}`;
      }));
      el.querySelector('#addBtn').addEventListener('click', () => {
        const note = el.querySelector('#note').value.trim();
        const existing = cart.find((l) => l.itemId === item.id && l.note === note);
        if (existing) existing.qty = Math.min(30, existing.qty + qty);
        else cart.push({ key: `${item.id}-${Date.now()}`, itemId: item.id, qty, note });
        persistCart();
        renderCartBar();
        renderMenu();
        closeSheet();
        toast(`${item.emoji} Agregado: ${qty} × ${item.name}`);
      });
    });
  }

  // ---------- Carrito ----------
  function cartTotal() {
    return cart.reduce((t, l) => t + (itemById(l.itemId)?.price || 0) * l.qty, 0);
  }

  function renderCartBar() {
    const count = cart.reduce((t, l) => t + l.qty, 0);
    $('#cartBar').hidden = count === 0 || tab !== 'menu';
    $('#cartCount').textContent = count;
    $('#cartTotal').textContent = money(cartTotal());
  }

  function openCartSheet() {
    sanitizeCart(state, false);
    if (!cart.length) return closeSheet();

    const hasBar = cart.some((l) => itemById(l.itemId)?.station === 'barra');
    const hasKitchen = cart.some((l) => itemById(l.itemId)?.station !== 'barra');
    const routeHint = hasBar && hasKitchen
      ? 'Las bebidas van directo a Barra y los platos a Cocina en simultáneo.'
      : hasBar ? 'Tu pedido entra directo a Barra.' : 'Tu pedido entra directo a Cocina.';

    const lines = cart.map((l) => {
      const it = itemById(l.itemId);
      if (!it) return '';
      return `<div class="cart-line">
        <span class="emoji">${itemThumb(it)}</span>
        <div class="grow">
          <strong>${escapeHtml(it.name)}</strong>
          ${l.note ? `<div class="note">“${escapeHtml(l.note)}”</div>` : ''}
          <div class="muted">${money(it.price * l.qty)} · ${it.station === 'barra' ? 'Barra' : 'Cocina'}</div>
        </div>
        <div class="stepper"><button data-k="${l.key}" data-q="-1">−</button><span>${l.qty}</span><button data-k="${l.key}" data-q="1">+</button></div>
      </div>`;
    }).join('');

    openSheet('cart', `
      <h3>Tu pedido · Mesa ${escapeHtml(state.table.code)}</h3>
      <p class="muted">${routeHint}</p>
      ${lines}
      <div class="total-row"><span>Subtotal</span><span>${money(cartTotal())}</span></div>
      <div class="sheet-actions">
        <button class="btn btn-ghost" id="keepBtn">Seguir viendo</button>
        <button class="btn btn-primary" id="sendBtn">Enviar pedido</button>
      </div>`, (el) => {
      el.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
        const line = cart.find((l) => l.key === b.dataset.k);
        if (!line) return;
        line.qty += Number(b.dataset.q);
        if (line.qty <= 0) cart = cart.filter((l) => l !== line);
        persistCart();
        renderCartBar();
        renderMenu();
        cart.length ? openCartSheet() : closeSheet();
      }));
      el.querySelector('#keepBtn').addEventListener('click', closeSheet);
      el.querySelector('#sendBtn').addEventListener('click', sendOrder);
    });
  }
  $('#cartBar').addEventListener('click', openCartSheet);

  async function sendOrder(e) {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      const res = await dispatch('order.create', {
        qrToken: TOKEN,
        items: cart.map((l) => ({ itemId: l.itemId, qty: l.qty, note: l.note })),
      });
      cart = [];
      persistCart();
      closeSheet();
      const wMsg = res.result?.waiterName ? ` · Te atiende ${res.result.waiterName}` : '';
      toast(`✅ ¡Pedido enviado!${wMsg}`);
      setTab('orders');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Enviar pedido';
      toast(`⚠️ ${err.message}`);
    }
  }

  // ---------- Mis pedidos ----------
  function renderOrders() {
    const orders = (state.orders || []).slice().reverse();
    if (!orders.length) {
      $('#ordersList').innerHTML = `<div class="empty"><span class="big">🍽️</span>Todavía no enviaste pedidos.<br>Elegí tus platos y bebidas desde el menú.</div>`;
      return;
    }
    $('#ordersList').innerHTML = orders.map((o) => {
      const isCancelled = o.status === 'cancelado';
      const idx = ORDER_STATUSES.findIndex((s) => s.id === o.status);
      return `<article class="order-card ${isCancelled ? 'cancelled' : ''}">
        <div class="order-head">
          <strong>Pedido #${o.id.slice(1)} <span class="chip ${o.station === 'barra' ? 'barra' : 'est-cocina'}">${stationLabel(o.station)}</span></strong>
          <small>${timeAgo(o.createdAt)}</small>
        </div>
        ${isCancelled
          ? `<div class="progress-label" style="color:var(--ink-3)">✕ Anulado${o.cancelReason ? ` · ${escapeHtml(o.cancelReason)}` : ''}</div>`
          : `<div class="progress">${ORDER_STATUSES.map((_, i) => `<span class="${i <= idx ? 'on' : ''}"></span>`).join('')}</div>
             <div class="progress-label">${ORDER_STATUSES[idx]?.label || o.status}</div>`}
        ${o.items.map((i) => `<div class="order-line">
          <span>${i.qty} × ${escapeHtml(i.name)}${i.note ? `<span class="note">“${escapeHtml(i.note)}”</span>` : ''}</span>
          <span>${isCancelled ? '$0' : money(i.price * i.qty)}</span>
        </div>`).join('')}
      </article>`;
    }).join('') + `<div class="summary"><span>Consumo acumulado</span><span>${money(state.subtotal || 0)}</span></div>`;
  }

  // ---------- Llamar al mozo y pedir la cuenta ----------
  function activeCall(type) {
    return (state.calls || []).find((c) => c.type === type && c.status !== 'atendida');
  }

  function renderCallStatus() {
    const el = $('#callStatus');
    const cuenta = activeCall('cuenta');
    const mozo = activeCall('mozo');
    if (cuenta) {
      el.hidden = false;
      el.className = `top-status ${cuenta.status === 'en_camino' ? 'ok' : ''}`;
      el.textContent = cuenta.status === 'en_camino' ? '🏃 Traen tu cuenta' : '🧾 Cuenta pedida';
    } else if (mozo) {
      el.hidden = false;
      el.className = `top-status ${mozo.status === 'en_camino' ? 'ok' : ''}`;
      el.textContent = mozo.status === 'en_camino' ? '🏃 Mozo en camino' : '🙋 Mozo avisado';
    } else {
      el.hidden = true;
    }
  }

  function openMozoSheet() {
    const existing = activeCall('mozo');
    if (existing) {
      const wText = state.waiter ? `Avisamos a ${escapeHtml(state.waiter.name)}.` : 'Avisamos al equipo del salón.';
      return openSheet('mozo', `
        <div class="done-hero">
          <span class="big">${existing.status === 'en_camino' ? '🏃' : '🙋'}</span>
          <h3>${existing.status === 'en_camino' ? '¡Tu mozo ya va en camino!' : 'Ya avisamos a tu mozo'}</h3>
          <p class="muted">${wText} Motivo: <strong>${escapeHtml(existing.reason)}</strong>.</p>
        </div>
        <div class="sheet-actions"><button class="btn btn-ghost" id="ok">Entendido</button></div>`,
        (el) => el.querySelector('#ok').addEventListener('click', closeSheet));
    }

    const reasons = [['🙋', 'Consulta'], ['💧', 'Agua / Hielo'], ['🍴', 'Cubiertos'], ['🧻', 'Servilletas'], ['🧂', 'Condimentos'], ['💬', 'Otro']];
    let reason = 'Consulta';
    openSheet('mozo', `
      <h3>Llamar al mozo</h3>
      <p class="muted">${state.waiter ? `Le avisamos directo en su celular a <strong>${escapeHtml(state.waiter.name)}</strong>.` : 'Se asignará un mozo disponible y recibirá tu aviso al instante.'}</p>
      <div class="options">${reasons.map(([e, r]) => `<button class="option ${r === reason ? 'selected' : ''}" data-r="${r}">${e} ${r}</button>`).join('')}</div>
      <div class="sheet-actions"><button class="btn btn-primary" id="callBtn">🔔 Avisar al mozo</button></div>`, (el) => {
      el.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
        reason = b.dataset.r;
        el.querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('selected', x === b));
      }));
      el.querySelector('#callBtn').addEventListener('click', async (ev) => {
        ev.currentTarget.disabled = true;
        try {
          const res = await dispatch('call.create', { qrToken: TOKEN, type: 'mozo', reason });
          closeSheet();
          const wn = res.result?.waiterName || state.waiter?.name;
          toast(wn ? `🔔 Avisamos a ${wn}, ya se acerca` : '🔔 Avisamos al mozo');
        } catch (err) {
          ev.currentTarget.disabled = false;
          toast(`⚠️ ${err.message}`);
        }
      });
    });
  }

  function openCuentaSheet(forceEdit = false) {
    const sub = state.subtotal || 0;
    if (sub <= 0) return toast('Todavía no hay consumos activos en esta mesa');

    const existing = activeCall('cuenta');
    if (existing && !forceEdit) {
      const tipAmt = Math.round(sub * existing.tip / 100);
      return openSheet('cuenta', `
        <div class="done-hero">
          <span class="big">🧾</span>
          <h3>${existing.status === 'en_camino' ? 'Tu mozo ya trae la cuenta' : 'Cuenta solicitada'}</h3>
          <p class="muted">Medio de pago: <strong>${escapeHtml(existing.payment)}</strong> · Propina ${existing.tip}%<br>
          Total actualizado: <strong>${money(sub + tipAmt)}</strong></p>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" id="editBill">Cambiar pago/propina</button>
          <button class="btn btn-primary" id="ok">Listo</button>
        </div>`, (el) => {
        el.querySelector('#ok').addEventListener('click', closeSheet);
        el.querySelector('#editBill').addEventListener('click', () => openCuentaSheet(true));
      });
    }

    let payment = existing?.payment || 'Tarjeta';
    let tip = existing?.tip ?? 10;

    const updateTotals = (el) => {
      const liveSub = state.subtotal || 0;
      const tipVal = Math.round(liveSub * tip / 100);
      el.querySelector('#subAmt').textContent = money(liveSub);
      el.querySelector('#tipAmt').textContent = money(tipVal);
      el.querySelector('#grand').textContent = money(liveSub + tipVal);
    };

    openSheet('cuenta', `
      <h3>Pedir la cuenta</h3>
      <p class="muted">Mesa ${escapeHtml(state.table.code)}${state.waiter ? ` · Atiende ${escapeHtml(state.waiter.name)}` : ''}</p>
      <div class="sheet-row"><span>Consumo actual</span><strong id="subAmt"></strong></div>
      <p class="label-sm">Propina para el mozo</p>
      <div class="options four">${[0, 5, 10, 15].map((p) => `<button class="option ${p === tip ? 'selected' : ''}" data-tip="${p}">${p ? p + '%' : 'No'}</button>`).join('')}</div>
      <div class="sheet-row"><span>Propina</span><span id="tipAmt"></span></div>
      <p class="label-sm">¿Cómo querés pagar?</p>
      <div class="options">${[['💵', 'Efectivo'], ['💳', 'Tarjeta'], ['📱', 'QR'], ['🏦', 'Transferencia']].map(([e, p]) => `<button class="option ${p === payment ? 'selected' : ''}" data-pay="${p}">${e} ${p}</button>`).join('')}</div>
      <div class="total-row"><span>Total estimado</span><span id="grand"></span></div>
      <div class="sheet-actions"><button class="btn btn-primary" id="billBtn">Solicitar la cuenta</button></div>`, (el) => {
      updateTotals(el);
      el.querySelectorAll('[data-tip]').forEach((b) => b.addEventListener('click', () => {
        tip = Number(b.dataset.tip);
        el.querySelectorAll('[data-tip]').forEach((x) => x.classList.toggle('selected', x === b));
        updateTotals(el);
      }));
      el.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => {
        payment = b.dataset.pay;
        el.querySelectorAll('[data-pay]').forEach((x) => x.classList.toggle('selected', x === b));
      }));
      el.querySelector('#billBtn').addEventListener('click', async (ev) => {
        ev.currentTarget.disabled = true;
        try {
          await dispatch('call.create', { qrToken: TOKEN, type: 'cuenta', payment, tip });
          closeSheet();
          toast('🧾 Avisamos a tu mozo para acercarte la cuenta');
        } catch (err) {
          ev.currentTarget.disabled = false;
          toast(`⚠️ ${err.message}`);
        }
      });
    });
  }

  // ---------- Navegación ----------
  function setTab(t) {
    tab = t;
    document.querySelectorAll('.tab[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    $('#view-menu').hidden = t !== 'menu';
    $('#view-orders').hidden = t !== 'orders';
    if (t === 'orders') $('#ordersDot').hidden = true;
    renderCartBar();
    window.scrollTo(0, 0);
  }

  document.querySelector('.tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (!b) return;
    if (b.dataset.tab) setTab(b.dataset.tab);
    if (b.dataset.action === 'mozo') openMozoSheet();
    if (b.dataset.action === 'cuenta') openCuentaSheet();
  });

  // ---------- Actualizaciones en tiempo real desde el restaurante ----------
  subscribe((s) => {
    if (!s.validTable) {
      $('#clientApp').hidden = true;
      renderInvalidScreen(s);
      return;
    }
    state = s;

    (s.orders || []).forEach((o) => {
      const prev = lastOrderStatuses[o.id];
      if (prev && prev !== o.status) {
        if (o.status === 'cancelado') {
          toast(`✕ Pedido #${o.id.slice(1)} anulado${o.cancelReason ? `: ${o.cancelReason}` : ''}`);
        } else {
          const stLabel = ORDER_STATUSES.find((x) => x.id === o.status)?.label || o.status;
          const where = o.station === 'barra' ? '🍸 Barra' : '🍳 Cocina';
          toast(o.status === 'listo' ? `${where} · ¡Tu pedido #${o.id.slice(1)} ya sale para tu mesa!` : `Pedido #${o.id.slice(1)}: ${stLabel}`);
          if (o.status === 'listo') ding(1);
        }
        if (tab !== 'orders') $('#ordersDot').hidden = false;
      }
    });

    (s.calls || []).forEach((c) => {
      const prev = lastCallStatuses[c.id];
      if (prev === 'pendiente' && c.status === 'en_camino') {
        toast(c.type === 'mozo' ? '🏃 Tu mozo ya va camino a tu mesa' : '🧾 Tu mozo ya te acerca la cuenta');
        ding(1);
      }
    });

    if (lastWaiterName && s.waiter?.name && s.waiter.name !== lastWaiterName) {
      toast(`🙋 Ahora te atiende ${s.waiter.name}`);
    }
    lastWaiterName = s.waiter?.name || null;

    const closedNow = s.lastClosedAt || 0;
    if (closedNow > lastClosed && lastClosed !== 0) {
      openSheet('closed', `
        <div class="done-hero">
          <span class="big">🙏</span>
          <h3>¡Muchas gracias por tu visita!</h3>
          <p class="muted">La cuenta de la Mesa ${escapeHtml(s.table.code)} quedó cerrada.</p>
        </div>
        <div class="sheet-actions"><button class="btn btn-primary" id="ok">Volver al menú</button></div>`,
        (el) => el.querySelector('#ok').addEventListener('click', () => { closeSheet(); setTab('menu'); }));
    } else if (lastClosed === 0 && closedNow > 0 && Object.keys(lastOrderStatuses).length > 0 && !(s.orders || []).length) {
      openSheet('closed', `
        <div class="done-hero">
          <span class="big">🙏</span>
          <h3>¡Muchas gracias por tu visita!</h3>
          <p class="muted">La cuenta de la Mesa ${escapeHtml(s.table.code)} quedó cerrada.</p>
        </div>
        <div class="sheet-actions"><button class="btn btn-primary" id="ok">Volver al menú</button></div>`,
        (el) => el.querySelector('#ok').addEventListener('click', () => { closeSheet(); setTab('menu'); }));
    }
    lastClosed = closedNow;

    lastOrderStatuses = mapOrders(s);
    lastCallStatuses = mapCalls(s);

    sanitizeCart(s, true);
    renderAll();

    // Si el sheet de cuenta está abierto y entró un consumo nuevo en la mesa, refrescarlo en vivo
    if (openSheetKind === 'cuenta') {
      const subEl = document.querySelector('#subAmt');
      if (subEl) openCuentaSheet(true);
    }
  });

  function renderAll() {
    renderHeader();
    renderCats();
    renderMenu();
    renderOrders();
    renderCartBar();
    renderCallStatus();
  }

  renderAll();
  setInterval(renderOrders, 30000);
})();
