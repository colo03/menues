(async () => {
  const params = new URLSearchParams(location.search);
  const TABLE = Math.max(1, parseInt(params.get('mesa'), 10) || 4);
  const CART_KEY = `pedio:cart:${TABLE}`;

  let state = await connect(connectionBanner);
  let cart = loadCart(); // [{ key, itemId, qty, note }]
  let tab = 'menu';
  let activeCat = state.categories[0]?.id;
  let lastStatuses = statusMap(state);
  let lastCalls = callMap(state);
  let lastClosed = state.closedTables[TABLE] || 0;

  const $ = (sel) => document.querySelector(sel);

  $('#tableNum').textContent = TABLE;
  document.title = `${state.restaurant.name} · Mesa ${TABLE}`;

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
    renderCartBar();
    renderMenu();
  }

  function statusMap(s) {
    return Object.fromEntries(tableOrders(s, TABLE).map((o) => [o.id, o.status]));
  }
  function callMap(s) {
    return Object.fromEntries(s.calls.filter((c) => c.table === TABLE).map((c) => [c.id, c.status]));
  }
  const itemById = (id) => state.items.find((i) => i.id === id);

  // ---------- Menú ----------
  function renderCats() {
    $('#cats').innerHTML = state.categories
      .filter((c) => state.items.some((i) => i.cat === c.id))
      .map((c) => `<button class="cat ${c.id === activeCat ? 'active' : ''}" data-cat="${c.id}">${c.icon} ${escapeHtml(c.name)}</button>`)
      .join('');
  }

  function renderMenu() {
    const inCart = {};
    cart.forEach((l) => { inCart[l.itemId] = (inCart[l.itemId] || 0) + l.qty; });
    $('#menuList').innerHTML = state.categories.map((c) => {
      const items = state.items.filter((i) => i.cat === c.id);
      if (!items.length) return '';
      return `<section class="section" id="sec-${c.id}">
        <h2>${c.icon} ${escapeHtml(c.name)}</h2>
        ${items.map((i) => `
          <button class="item ${i.available ? '' : 'off'}" data-item="${i.id}">
            <div class="item-img">${i.emoji}</div>
            <div class="item-body">
              <div class="item-name">${escapeHtml(i.name)}
                ${i.popular ? '<span class="badge-pop">Popular</span>' : ''}
                ${i.available ? '' : '<span class="badge-off">Agotado</span>'}
              </div>
              <p class="item-desc">${escapeHtml(i.desc)}</p>
              <div class="item-price">${money(i.price)} ${inCart[i.id] ? `<span class="in-cart">· ${inCart[i.id]} en tu pedido</span>` : ''}</div>
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
    if (!item.available) return toast('Este plato está agotado por hoy');
    openItemSheet(item);
  });

  // ---------- Bottom sheet ----------
  function openSheet(html, onMount) {
    $('#sheet').innerHTML = `<div class="sheet-grip"></div>${html}`;
    $('#sheet').hidden = false;
    $('#backdrop').hidden = false;
    onMount?.($('#sheet'));
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    $('#backdrop').hidden = true;
  }
  $('#backdrop').addEventListener('click', closeSheet);

  function openItemSheet(item) {
    let qty = 1;
    openSheet(`
      <div class="sheet-hero">${item.emoji}</div>
      <h3>${escapeHtml(item.name)}</h3>
      <p class="muted">${escapeHtml(item.desc)}</p>
      <div class="sheet-row">
        <strong style="font-size:20px">${money(item.price)}</strong>
        <div class="stepper"><button data-q="-1">−</button><span id="qty">1</span><button data-q="1">+</button></div>
      </div>
      <div class="field">
        <label for="note">Aclaraciones para la cocina</label>
        <input class="input" id="note" placeholder="Ej: sin cebolla, bien picante…" maxlength="80">
      </div>
      <div class="sheet-actions">
        <button class="btn btn-primary" id="addBtn">Agregar · ${money(item.price)}</button>
      </div>`, (el) => {
      el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
        qty = Math.max(1, Math.min(20, qty + Number(b.dataset.q)));
        el.querySelector('#qty').textContent = qty;
        el.querySelector('#addBtn').textContent = `Agregar · ${money(item.price * qty)}`;
      }));
      el.querySelector('#addBtn').addEventListener('click', () => {
        const note = el.querySelector('#note').value.trim();
        const existing = cart.find((l) => l.itemId === item.id && l.note === note);
        if (existing) existing.qty += qty;
        else cart.push({ key: `${item.id}-${Date.now()}`, itemId: item.id, qty, note });
        saveCart();
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
    const lines = cart.map((l) => {
      const it = itemById(l.itemId);
      return `<div class="cart-line">
        <span class="emoji">${it.emoji}</span>
        <div class="grow"><strong>${escapeHtml(it.name)}</strong>
          ${l.note ? `<div class="note">“${escapeHtml(l.note)}”</div>` : ''}
          <div class="muted">${money(it.price * l.qty)}</div></div>
        <div class="stepper"><button data-k="${l.key}" data-q="-1">−</button><span>${l.qty}</span><button data-k="${l.key}" data-q="1">+</button></div>
      </div>`;
    }).join('');
    openSheet(`
      <h3>Tu pedido</h3>
      <p class="muted">Mesa ${TABLE} · revisá antes de enviar a cocina</p>
      ${lines}
      <div class="total-row"><span>Total</span><span>${money(cartTotal())}</span></div>
      <div class="sheet-actions">
        <button class="btn btn-ghost" id="keepBtn">Seguir pidiendo</button>
        <button class="btn btn-primary" id="sendBtn">Enviar a cocina</button>
      </div>`, (el) => {
      el.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
        const line = cart.find((l) => l.key === b.dataset.k);
        line.qty += Number(b.dataset.q);
        if (line.qty <= 0) cart = cart.filter((l) => l !== line);
        saveCart();
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
      await dispatch('order.create', {
        table: TABLE,
        items: cart.map((l) => ({ itemId: l.itemId, qty: l.qty, note: l.note })),
      });
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Enviar a cocina';
      return toast(`⚠️ ${err.message}`);
    }
    cart = [];
    saveCart();
    closeSheet();
    toast('✅ ¡Pedido enviado a la cocina!');
    setTab('orders');
  }

  // ---------- Mis pedidos ----------
  function renderOrders() {
    const orders = tableOrders(state, TABLE).slice().reverse();
    if (!orders.length) {
      $('#ordersList').innerHTML = `<div class="empty"><span class="big">🍽️</span>Todavía no hiciste ningún pedido.<br>Elegí algo rico del menú.</div>`;
      return;
    }
    const total = orders.reduce((t, o) => t + orderTotal(o), 0);
    $('#ordersList').innerHTML = orders.map((o) => {
      const idx = ORDER_STATUSES.findIndex((s) => s.id === o.status);
      return `<article class="order-card">
        <div class="order-head"><strong>Pedido #${o.id.slice(1)}</strong><small>${timeAgo(o.createdAt)}</small></div>
        <div class="progress">${ORDER_STATUSES.map((_, i) => `<span class="${i <= idx ? 'on' : ''}"></span>`).join('')}</div>
        <div class="progress-label">${ORDER_STATUSES[idx].label}</div>
        ${o.items.map((i) => `<div class="order-line"><span>${i.qty} × ${escapeHtml(i.name)}${i.note ? `<span class="note">“${escapeHtml(i.note)}”</span>` : ''}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
      </article>`;
    }).join('') + `<div class="summary"><span>Consumo total</span><span>${money(total)}</span></div>`;
  }

  // ---------- Mozo y cuenta ----------
  function pendingCall(type) {
    return state.calls.find((c) => c.table === TABLE && c.type === type && c.status === 'pendiente');
  }

  function renderCallStatus() {
    const el = $('#callStatus');
    const cuenta = pendingCall('cuenta');
    const mozo = pendingCall('mozo');
    if (cuenta) { el.hidden = false; el.className = 'top-status'; el.textContent = '🧾 Cuenta pedida'; }
    else if (mozo) { el.hidden = false; el.className = 'top-status'; el.textContent = '🙋 Mozo llamado'; }
    else el.hidden = true;
  }

  function openMozoSheet() {
    if (pendingCall('mozo')) {
      return openSheet(`<div class="done-hero"><span class="big">🙋</span><h3>Ya avisamos al mozo</h3>
        <p class="muted">En breve se acerca a la mesa ${TABLE}.</p></div>
        <div class="sheet-actions"><button class="btn btn-ghost" id="ok">Entendido</button></div>`,
        (el) => el.querySelector('#ok').addEventListener('click', closeSheet));
    }
    const reasons = [['🙋', 'Consulta'], ['🍴', 'Cubiertos'], ['🧻', 'Servilletas'], ['🧂', 'Condimentos'], ['💧', 'Agua'], ['💬', 'Otro']];
    let reason = 'Consulta';
    openSheet(`
      <h3>Llamar al mozo</h3>
      <p class="muted">¿Para qué lo necesitás? (opcional)</p>
      <div class="options">${reasons.map(([e, r]) => `<button class="option ${r === reason ? 'selected' : ''}" data-r="${r}">${e} ${r}</button>`).join('')}</div>
      <div class="sheet-actions"><button class="btn btn-primary" id="callBtn">🔔 Llamar al mozo</button></div>`, (el) => {
      el.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
        reason = b.dataset.r;
        el.querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('selected', x === b));
      }));
      el.querySelector('#callBtn').addEventListener('click', async () => {
        try {
          await dispatch('call.create', { table: TABLE, type: 'mozo', reason });
        } catch (err) {
          return toast(`⚠️ ${err.message}`);
        }
        closeSheet();
        renderCallStatus();
        toast('🔔 Avisamos al mozo, ya viene');
      });
    });
  }

  function openCuentaSheet() {
    const orders = tableOrders(state, TABLE);
    if (!orders.length) return toast('Todavía no hay consumos en esta mesa');
    if (pendingCall('cuenta')) {
      return openSheet(`<div class="done-hero"><span class="big">🧾</span><h3>Cuenta pedida</h3>
        <p class="muted">El mozo te la acerca en un momento.</p></div>
        <div class="sheet-actions"><button class="btn btn-ghost" id="ok">Entendido</button></div>`,
        (el) => el.querySelector('#ok').addEventListener('click', closeSheet));
    }
    const subtotal = orders.reduce((t, o) => t + orderTotal(o), 0);
    let payment = 'Tarjeta';
    let tip = 10;
    const render = (el) => {
      el.querySelector('#tipAmt').textContent = money(subtotal * tip / 100);
      el.querySelector('#grand').textContent = money(subtotal * (1 + tip / 100));
    };
    openSheet(`
      <h3>Pedir la cuenta</h3>
      <p class="muted">Mesa ${TABLE} · ${orders.length} pedido${orders.length > 1 ? 's' : ''}</p>
      <div class="sheet-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
      <p class="label-sm">Propina</p>
      <div class="options three">${[0, 10, 15].map((p) => `<button class="option ${p === tip ? 'selected' : ''}" data-tip="${p}">${p ? p + '%' : 'Sin propina'}</button>`).join('')}</div>
      <div class="sheet-row"><span>Propina</span><span id="tipAmt"></span></div>
      <p class="label-sm">¿Cómo vas a pagar?</p>
      <div class="options three">${[['💵', 'Efectivo'], ['💳', 'Tarjeta'], ['📱', 'QR']].map(([e, p]) => `<button class="option ${p === payment ? 'selected' : ''}" data-pay="${p}">${e} ${p}</button>`).join('')}</div>
      <div class="total-row"><span>Total</span><span id="grand"></span></div>
      <div class="sheet-actions"><button class="btn btn-primary" id="billBtn">Pedir la cuenta</button></div>`, (el) => {
      render(el);
      el.querySelectorAll('[data-tip]').forEach((b) => b.addEventListener('click', () => {
        tip = Number(b.dataset.tip);
        el.querySelectorAll('[data-tip]').forEach((x) => x.classList.toggle('selected', x === b));
        render(el);
      }));
      el.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => {
        payment = b.dataset.pay;
        el.querySelectorAll('[data-pay]').forEach((x) => x.classList.toggle('selected', x === b));
      }));
      el.querySelector('#billBtn').addEventListener('click', async () => {
        try {
          await dispatch('call.create', { table: TABLE, type: 'cuenta', payment, tip });
        } catch (err) {
          return toast(`⚠️ ${err.message}`);
        }
        closeSheet();
        renderCallStatus();
        toast('🧾 Pediste la cuenta. ¡Gracias!');
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

  // ---------- Sincronización con el restaurante ----------
  subscribe((s) => {
    state = s;
    // Avisos cuando el restaurante cambia el estado de un pedido.
    tableOrders(s, TABLE).forEach((o) => {
      const prev = lastStatuses[o.id];
      if (prev && prev !== o.status) {
        const label = ORDER_STATUSES.find((x) => x.id === o.status).label;
        toast(o.status === 'listo' ? `🍜 ¡Tu pedido #${o.id.slice(1)} está listo!` : `Pedido #${o.id.slice(1)}: ${label}`);
        if (tab !== 'orders') $('#ordersDot').hidden = false;
      }
    });
    s.calls.filter((c) => c.table === TABLE).forEach((c) => {
      if (lastCalls[c.id] === 'pendiente' && c.status === 'atendida' && c.type === 'mozo') toast('🙋 El mozo viene en camino');
    });
    const closed = s.closedTables[TABLE] || 0;
    if (closed !== lastClosed) {
      lastClosed = closed;
      openSheet(`<div class="done-hero"><span class="big">🙏</span><h3>¡Gracias por tu visita!</h3>
        <p class="muted">La mesa ${TABLE} quedó cerrada. ¡Te esperamos pronto!</p></div>
        <div class="sheet-actions"><button class="btn btn-primary" id="ok">Volver al menú</button></div>`,
        (el) => el.querySelector('#ok').addEventListener('click', () => { closeSheet(); setTab('menu'); }));
    }
    lastStatuses = statusMap(s);
    lastCalls = callMap(s);
    // El carrito puede tener platos que el restaurante quitó del menú.
    cart = cart.filter((l) => s.items.some((i) => i.id === l.itemId && i.available));
    renderAll();
  });

  function renderAll() {
    $('#restName').textContent = state.restaurant.name;
    renderCats();
    renderMenu();
    renderOrders();
    renderCartBar();
    renderCallStatus();
  }

  renderAll();
  setInterval(renderOrders, 30000); // refresca los "hace X min"
})();
