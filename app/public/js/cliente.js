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

  // Estado persistente del modal "Pedir la cuenta" (jamás se pisa cuando llega un SSE)
  const billDraft = {
    editing: false,
    payment: 'Tarjeta',
    tip: 10,
    splitWays: 1,
    cashMode: 'exact', // 'exact' | 'preset' | 'custom'
    cashPreset: 0,
    cashCustom: '',
  };

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

  // ---------- Menú: búsqueda instantánea, filtros rápidos y etiquetas dietarias ----------
  const TAG_META = {
    sin_tacc: { label: 'Sin TACC', ico: '🌾', cls: 'tag-tacc' },
    veggie: { label: 'Veggie', ico: '🌱', cls: 'tag-veggie' },
    vegano: { label: 'Vegano', ico: '🌿', cls: 'tag-vegano' },
    picante: { label: 'Picante', ico: '🌶️', cls: 'tag-picante' },
    sin_alcohol: { label: 'Sin alcohol', ico: '🧃', cls: 'tag-noalc' },
  };
  const QUICK_FILTERS = [
    { id: 'popular', label: '⭐ Populares', test: (i) => i.popular },
    { id: 'sin_tacc', label: '🌾 Sin TACC', test: (i) => hasTag(i, 'sin_tacc') },
    { id: 'veggie', label: '🌱 Veggie', test: (i) => hasTag(i, 'veggie') || hasTag(i, 'vegano') },
    { id: 'picante', label: '🌶️ Picante', test: (i) => hasTag(i, 'picante') },
  ];
  let searchQuery = '';
  const activeFilters = new Set();

  function hasTag(item, tag) {
    return Array.isArray(item.tags) && item.tags.includes(tag);
  }

  const normalize = (s) => normalizeSearch(s);

  function itemTagsHtml(item, big = false) {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const shown = tags.filter((t) => TAG_META[t] && !(t === 'veggie' && tags.includes('vegano')));
    if (!shown.length) return '';
    return `<div class="item-tags ${big ? 'big' : ''}">${shown.map((t) => `<span class="tag-pill ${TAG_META[t].cls}">${TAG_META[t].ico} ${TAG_META[t].label}</span>`).join('')}</div>`;
  }

  function isFiltering() {
    return Boolean(searchQuery) || activeFilters.size > 0;
  }

  function matchesFilters(item, catName) {
    for (const fid of activeFilters) {
      const f = QUICK_FILTERS.find((x) => x.id === fid);
      if (f && !f.test(item)) return false;
    }
    if (!searchQuery) return true;
    const hay = normalize(`${item.name} ${item.desc} ${catName} ${(item.tags || []).map((t) => TAG_META[t]?.label || '').join(' ')}`);
    return searchQuery.split(/\s+/).every((w) => hay.includes(w));
  }

  function visibleItemsByCat() {
    const out = new Map();
    state.categories.forEach((c) => {
      const items = state.items.filter((i) => i.cat === c.id && matchesFilters(i, c.name));
      if (items.length) out.set(c.id, items);
    });
    return out;
  }

  function renderFilters() {
    const available = QUICK_FILTERS.filter((f) => state.items.some((i) => f.test(i)) || activeFilters.has(f.id));
    $('#filters').innerHTML = available
      .map((f) => `<button type="button" class="filter-chip ${activeFilters.has(f.id) ? 'on' : ''}" data-filter="${f.id}" aria-pressed="${activeFilters.has(f.id)}">${f.label}</button>`)
      .join('');
    $('#filters').hidden = !available.length;
  }

  // ---------- Menú ----------
  function renderCats(byCat = visibleItemsByCat()) {
    const visibleCats = state.categories.filter((c) => byCat.has(c.id));
    if (visibleCats.length && !visibleCats.some((c) => c.id === activeCat)) {
      activeCat = visibleCats[0].id;
    }
    $('#cats').hidden = !visibleCats.length;
    $('#cats').innerHTML = visibleCats
      .map((c) => `<button class="cat ${c.id === activeCat ? 'active' : ''}" data-cat="${c.id}">${c.icon} ${escapeHtml(c.name)}${isFiltering() ? ` <span class="cat-n">${byCat.get(c.id).length}</span>` : ''}</button>`)
      .join('');
  }

  function renderMenu(byCat = visibleItemsByCat()) {
    const inCart = {};
    cart.forEach((l) => { inCart[l.itemId] = (inCart[l.itemId] || 0) + l.qty; });

    const total = Array.from(byCat.values()).reduce((t, arr) => t + arr.length, 0);
    const hint = $('#resultHint');
    if (isFiltering() && total) {
      hint.hidden = false;
      hint.innerHTML = `${total} resultado${total === 1 ? '' : 's'} <button type="button" class="link-btn" data-clear-filters>Limpiar filtros</button>`;
    } else {
      hint.hidden = true;
    }

    if (!total) {
      $('#menuList').innerHTML = isFiltering()
        ? `<div class="empty"><span class="big">🔎</span>No encontramos platos o bebidas${searchQuery ? ` para “${escapeHtml($('#menuSearch').value.trim())}”` : ''} con esos filtros.<br><button type="button" class="btn btn-ghost btn-sm" style="margin-top:12px" data-clear-filters>Ver toda la carta</button></div>`
        : '<div class="empty"><span class="big">📖</span>La carta se está actualizando. Volvé a intentar en un momento.</div>';
      return;
    }

    $('#menuList').innerHTML = state.categories.map((c) => {
      const items = byCat.get(c.id);
      if (!items) return '';
      const stBadge = c.station === 'barra'
        ? '<span class="badge-bar">🍸 Sale de Barra</span>'
        : c.station === 'mostrador'
        ? '<span class="badge-counter">🍣 Sale de Mostrador</span>'
        : '';
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
              ${itemTagsHtml(i)}
              <div class="item-price">
                <span>${money(i.price)}</span>
                ${inCart[i.id] ? `<span class="in-cart">· ${inCart[i.id]} en tu carrito</span>` : ''}
              </div>
            </div>
            <span class="item-add">${i.available ? '+' : '−'}</span>
          </button>`).join('')}
      </section>`;
    }).join('');
  }

  function renderMenuArea() {
    const byCat = visibleItemsByCat();
    renderFilters();
    renderCats(byCat);
    renderMenu(byCat);
  }

  function clearFilters() {
    searchQuery = '';
    activeFilters.clear();
    activeCat = '';
    $('#menuSearch').value = '';
    $('#searchClear').hidden = true;
    renderMenuArea();
  }

  $('#menuSearch').addEventListener('input', (e) => {
    searchQuery = normalize(e.target.value);
    activeCat = '';
    $('#searchClear').hidden = !e.target.value;
    renderMenuArea();
  });
  $('#menuSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { clearFilters(); e.target.blur(); }
    if (e.key === 'Enter') e.target.blur();
  });
  $('#searchClear').addEventListener('click', () => {
    clearFilters();
    $('#menuSearch').focus();
  });
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    const fid = b.dataset.filter;
    if (activeFilters.has(fid)) activeFilters.delete(fid);
    else activeFilters.add(fid);
    activeCat = '';
    renderMenuArea();
    const top = $('#view-menu').offsetTop;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  });
  $('#view-menu').addEventListener('click', (e) => {
    if (e.target.closest('[data-clear-filters]')) clearFilters();
  });

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
    billDraft.editing = false;
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
        <span class="chip ${stationChipClass(item.station)}">${stationLabel(item.station)}</span>
      </div>
      <p class="muted" style="margin-top:4px">${escapeHtml(item.desc)}</p>
      ${itemTagsHtml(item, true)}
      <div class="sheet-row">
        <strong style="font-size:20px">${money(item.price)}</strong>
        <div class="stepper"><button type="button" data-q="-1">−</button><span id="qty">1</span><button type="button" data-q="1">+</button></div>
      </div>
      <div class="field">
        <label for="note">Aclaraciones (opcional)</label>
        <input class="input" id="note" placeholder="Ej: sin cebolla, poco hielo, punto cocido…" maxlength="100">
      </div>
      <div class="sheet-actions">
        <button class="btn btn-primary" type="button" id="addBtn">Agregar · ${money(item.price)}</button>
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

    const stationsSet = new Set(cart.map((l) => itemById(l.itemId)?.station || 'cocina'));
    const stNames = Array.from(stationsSet).map((st) => stationInfo(st).short);
    const routeHint = stNames.length > 1
      ? `Tu pedido se divide automáticamente entre ${stNames.join(' y ')} en simultáneo.`
      : `Tu pedido entra directo a ${stNames[0] || 'Cocina'}.`;

    const lines = cart.map((l) => {
      const it = itemById(l.itemId);
      if (!it) return '';
      return `<div class="cart-line">
        <span class="emoji">${itemThumb(it)}</span>
        <div class="grow">
          <strong>${escapeHtml(it.name)}</strong>
          ${l.note ? `<div class="note">“${escapeHtml(l.note)}”</div>` : ''}
          <div class="muted">${money(it.price * l.qty)} · ${stationInfo(it.station).short}</div>
        </div>
        <div class="stepper"><button type="button" data-k="${l.key}" data-q="-1">−</button><span>${l.qty}</span><button type="button" data-k="${l.key}" data-q="1">+</button></div>
      </div>`;
    }).join('');

    openSheet('cart', `
      <h3>Tu pedido · Mesa ${escapeHtml(state.table.code)}</h3>
      <p class="muted">${routeHint}</p>
      ${lines}
      <div class="total-row"><span>Subtotal</span><span>${money(cartTotal())}</span></div>
      <div class="sheet-actions">
        <button class="btn btn-ghost" type="button" id="keepBtn">Seguir viendo</button>
        <button class="btn btn-primary" type="button" id="sendBtn">Enviar pedido</button>
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

  // ---------- Mis pedidos (incluye botón rápido 🔄 Repetir en entregados) ----------
  function renderOrders() {
    const orders = (state.orders || []).slice().reverse();
    if (!orders.length) {
      $('#ordersList').innerHTML = `<div class="empty"><span class="big">🍽️</span>Todavía no enviaste pedidos.<br>Elegí tus platos y bebidas desde el menú.</div>`;
      return;
    }
    $('#ordersList').innerHTML = orders.map((o) => {
      const isCancelled = o.status === 'cancelado';
      const isDelivered = o.status === 'entregado';
      const canRepeat = isDelivered && state.table.active && o.items.some((i) => {
        const live = itemById(i.itemId);
        return live && live.available;
      });
      const idx = ORDER_STATUSES.findIndex((s) => s.id === o.status);
      return `<article class="order-card ${isCancelled ? 'cancelled' : ''}">
        <div class="order-head">
          <strong>Pedido #${o.id.slice(1)} <span class="chip ${stationChipClass(o.station)}">${stationLabel(o.station)}</span></strong>
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
        ${canRepeat ? `
          <div class="order-foot">
            <button type="button" class="btn btn-xs repeat-btn" data-repeat-ord="${escapeHtml(o.id)}">🔄 Repetir</button>
          </div>` : ''}
      </article>`;
    }).join('') + `<div class="summary"><span>Consumo acumulado</span><span>${money(state.subtotal || 0)}</span></div>`;
  }

  $('#ordersList').addEventListener('click', async (e) => {
    const repBtn = e.target.closest('[data-repeat-ord]');
    if (!repBtn) return;
    const ord = (state.orders || []).find((o) => o.id === repBtn.dataset.repeatOrd);
    if (!ord) return;
    if (!state.table.active) return toast('Esta mesa está deshabilitada temporalmente');

    const validItems = [];
    const skipped = [];
    ord.items.forEach((i) => {
      const live = itemById(i.itemId);
      if (live && live.available) {
        validItems.push({ itemId: live.id, qty: Math.max(1, Math.min(30, i.qty)), note: i.note || '' });
      } else {
        skipped.push(i.name);
      }
    });
    if (!validItems.length) {
      return toast('⚠️ Los productos de ese pedido ya se agotaron');
    }

    // Cargar en carrito y abrir el resumen listo para confirmar en 1 toque
    validItems.forEach((v) => {
      const ex = cart.find((l) => l.itemId === v.itemId && l.note === v.note);
      if (ex) ex.qty = Math.min(30, ex.qty + v.qty);
      else cart.push({ key: `${v.itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, ...v });
    });
    persistCart();
    renderCartBar();
    renderMenu();
    if (skipped.length) {
      toast(`⚠️ Omitimos por agotado: ${skipped.join(', ')}`);
    }
    openCartSheet();
  });

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
        <div class="sheet-actions"><button class="btn btn-ghost" type="button" id="ok">Entendido</button></div>`,
        (el) => el.querySelector('#ok').addEventListener('click', closeSheet));
    }

    const reasons = [['🙋', 'Consulta'], ['💧', 'Agua / Hielo'], ['🍴', 'Cubiertos'], ['🧻', 'Servilletas'], ['🧂', 'Condimentos'], ['💬', 'Otro']];
    let reason = 'Consulta';
    openSheet('mozo', `
      <h3>Llamar al mozo</h3>
      <p class="muted">${state.waiter ? `Le avisamos directo a <strong>${escapeHtml(state.waiter.name)}</strong>.` : 'Se asignará un mozo disponible y recibirá tu aviso al instante.'}</p>
      <div class="options">${reasons.map(([e, r]) => `<button type="button" class="option ${r === reason ? 'selected' : ''}" data-r="${r}">${e} ${r}</button>`).join('')}</div>
      <div class="field" id="otherReasonWrap" hidden>
        <label for="otherReasonInput">Detalle rápido para ahorrarle un viaje (opcional)</label>
        <input class="input" id="otherReasonInput" type="text" maxlength="40" placeholder="Ej: traer edulcorante / silla de bebé" style="font-size:16px">
      </div>
      <div class="sheet-actions"><button class="btn btn-primary" type="button" id="callBtn">🔔 Avisar al mozo</button></div>`, (el) => {
      const otherWrap = el.querySelector('#otherReasonWrap');
      const otherInput = el.querySelector('#otherReasonInput');
      el.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
        reason = b.dataset.r;
        el.querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('selected', x === b));
        const isOther = reason === 'Otro';
        otherWrap.hidden = !isOther;
        if (isOther) setTimeout(() => otherInput.focus(), 30);
      }));
      el.querySelector('#callBtn').addEventListener('click', async (ev) => {
        ev.currentTarget.disabled = true;
        const customDetail = (otherInput?.value || '').trim();
        const finalReason = reason === 'Otro' ? (customDetail || 'Otro (consulta en mesa)') : reason;
        try {
          const res = await dispatch('call.create', { qrToken: TOKEN, type: 'mozo', reason: finalReason });
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

  function effectiveCashAmountFor(grandTotal) {
    if (billDraft.payment !== 'Efectivo') return 0;
    if (billDraft.cashMode === 'exact') return grandTotal;
    if (billDraft.cashMode === 'preset') return billDraft.cashPreset || 0;
    const parsed = Math.round(Number(String(billDraft.cashCustom || '').replace(/\D/g, '')) || 0);
    return parsed;
  }

  // Actualiza totales, Vaquita y vuelto en vivo sin tocar selecciones del comensal
  function refreshOpenCuentaTotals() {
    if (openSheetKind !== 'cuenta') return;
    const sheet = $('#sheet');
    if (!sheet) return;
    const liveSub = state.subtotal || 0;

    // Si está en vista resumen (no edición), refrescar estado y monto en vivo
    if (!billDraft.editing) {
      const existing = activeCall('cuenta');
      if (!existing) return;
      const tipAmt = Math.round((liveSub * (existing.tip || 0)) / 100);
      const grand = liveSub + tipAmt;
      const hTitle = sheet.querySelector('#cuentaHeroTitle');
      const hTotal = sheet.querySelector('#cuentaHeroTotal');
      const hSplit = sheet.querySelector('#cuentaHeroSplit');
      if (hTitle) hTitle.textContent = existing.status === 'en_camino' ? '¡Tu mozo ya trae la cuenta!' : 'Cuenta solicitada';
      if (hTotal) hTotal.textContent = money(grand);
      if (hSplit && Number(existing.splitWays) > 1) {
        hSplit.textContent = ` · ÷ ${existing.splitWays}: ${money(Math.ceil(grand / existing.splitWays))} c/u`;
      }
      return;
    }

    const tipVal = Math.round((liveSub * billDraft.tip) / 100);
    const grand = liveSub + tipVal;

    const subEl = sheet.querySelector('#subAmt');
    const tipEl = sheet.querySelector('#tipAmt');
    const grandEl = sheet.querySelector('#grand');
    if (subEl) subEl.textContent = money(liveSub);
    if (tipEl) tipEl.textContent = money(tipVal);
    if (grandEl) grandEl.textContent = money(grand);

    // Vaquita: división por persona
    const splitCnt = sheet.querySelector('#splitCount');
    const splitSub = sheet.querySelector('#splitSubRow');
    const splitWaysLbl = sheet.querySelector('#splitWaysLbl');
    const splitPerPerson = sheet.querySelector('#splitPerPerson');
    if (splitCnt) splitCnt.textContent = String(billDraft.splitWays);
    if (splitSub) {
      splitSub.hidden = billDraft.splitWays <= 1;
      if (billDraft.splitWays > 1) {
        if (splitWaysLbl) splitWaysLbl.textContent = String(billDraft.splitWays);
        if (splitPerPerson) splitPerPerson.textContent = `${money(Math.ceil(grand / billDraft.splitWays))} por persona`;
      }
    }

    // Caja de efectivo y vuelto
    const cashBox = sheet.querySelector('#cashBox');
    if (cashBox) {
      cashBox.hidden = billDraft.payment !== 'Efectivo';
      if (billDraft.payment === 'Efectivo') {
        const chip100 = sheet.querySelector('[data-cash-preset="100000"]');
        if (chip100) chip100.hidden = grand <= 40000 && billDraft.cashPreset !== 100000;

        sheet.querySelectorAll('[data-cash-preset]').forEach((b) => {
          const val = Number(b.dataset.cashPreset);
          const isExact = val === 0;
          const sel = (isExact && billDraft.cashMode === 'exact')
            || (!isExact && billDraft.cashMode === 'preset' && billDraft.cashPreset === val);
          b.classList.toggle('selected', sel);
        });

        const cashAmt = effectiveCashAmountFor(grand);
        const hintEl = sheet.querySelector('#cashChangeHint');
        if (hintEl) {
          if (billDraft.cashMode === 'exact' || cashAmt === grand) {
            hintEl.className = 'cash-hint';
            hintEl.textContent = `✔ Avisamos que abonás con el importe justo (${money(grand)})`;
          } else if (cashAmt > grand) {
            hintEl.className = 'cash-hint';
            hintEl.textContent = `💵 Tu vuelto: ${money(cashAmt - grand)} (el mozo ya lo lleva preparado)`;
          } else if (cashAmt > 0 && cashAmt < grand) {
            hintEl.className = 'cash-hint warn';
            hintEl.textContent = `⚠️ El monto elegido (${money(cashAmt)}) es menor al total (${money(grand)})`;
          } else {
            hintEl.className = 'cash-hint';
            hintEl.textContent = 'Indicá con cuánto abonás para traerte el vuelto en 1 viaje.';
          }
        }
      }
    }
  }

  function openCuentaSheet(forceEdit = false) {
    const sub = state.subtotal || 0;
    if (sub <= 0) return toast('Todavía no hay consumos activos en esta mesa');

    const existing = activeCall('cuenta');
    if (existing && !forceEdit) {
      billDraft.editing = false;
      const tipAmt = Math.round((sub * (existing.tip || 0)) / 100);
      const grand = sub + tipAmt;
      const sw = Math.max(1, Number(existing.splitWays) || 1);
      const ca = Math.max(0, Number(existing.cashAmount) || 0);
      const changeInfo = existing.payment === 'Efectivo' && ca > grand
        ? `<br>💵 Abonás con ${money(ca)} · Vuelto: <strong>${money(ca - grand)}</strong>`
        : existing.payment === 'Efectivo' && ca === grand
        ? `<br>💵 Abonás con importe justo`
        : '';
      return openSheet('cuenta', `
        <div class="done-hero">
          <span class="big">🧾</span>
          <h3 id="cuentaHeroTitle">${existing.status === 'en_camino' ? '¡Tu mozo ya trae la cuenta!' : 'Cuenta solicitada'}</h3>
          <p class="muted">Medio de pago: <strong>${escapeHtml(existing.payment)}</strong> · Propina ${existing.tip}%<br>
          Total actualizado: <strong id="cuentaHeroTotal">${money(grand)}</strong><span id="cuentaHeroSplit">${sw > 1 ? ` · ÷ ${sw}: ${money(Math.ceil(grand / sw))} c/u` : ''}</span>${changeInfo}</p>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" type="button" id="editBill">Cambiar pago/propina</button>
          <button class="btn btn-primary" type="button" id="ok">Listo</button>
        </div>`, (el) => {
        el.querySelector('#ok').addEventListener('click', closeSheet);
        el.querySelector('#editBill').addEventListener('click', () => openCuentaSheet(true));
      });
    }

    billDraft.editing = true;
    billDraft.payment = existing?.payment || 'Tarjeta';
    billDraft.tip = existing?.tip ?? 10;
    billDraft.splitWays = Math.max(1, Number(existing?.splitWays) || 1);
    const prevCash = Math.max(0, Number(existing?.cashAmount) || 0);
    if (prevCash > 0 && [20000, 50000, 100000].includes(prevCash)) {
      billDraft.cashMode = 'preset';
      billDraft.cashPreset = prevCash;
      billDraft.cashCustom = '';
    } else if (prevCash > 0 && prevCash !== (sub + Math.round((sub * billDraft.tip) / 100))) {
      billDraft.cashMode = 'custom';
      billDraft.cashPreset = 0;
      billDraft.cashCustom = String(prevCash);
    } else {
      billDraft.cashMode = 'exact';
      billDraft.cashPreset = 0;
      billDraft.cashCustom = '';
    }

    openSheet('cuenta', `
      <h3>Pedir la cuenta</h3>
      <p class="muted">Mesa ${escapeHtml(state.table.code)}${state.waiter ? ` · Atiende ${escapeHtml(state.waiter.name)}` : ''}</p>
      <div class="sheet-row"><span>Consumo actual</span><strong id="subAmt"></strong></div>
      <p class="label-sm">Propina para el mozo</p>
      <div class="options four">${[0, 5, 10, 15].map((p) => `<button type="button" class="option ${p === billDraft.tip ? 'selected' : ''}" data-tip="${p}">${p ? p + '%' : 'No'}</button>`).join('')}</div>
      <div class="sheet-row"><span>Propina</span><span id="tipAmt"></span></div>
      <p class="label-sm">¿Cómo querés pagar?</p>
      <div class="options">${[['💵', 'Efectivo'], ['💳', 'Tarjeta'], ['📱', 'QR'], ['🏦', 'Transferencia']].map(([e, p]) => `<button type="button" class="option ${p === billDraft.payment ? 'selected' : ''}" data-pay="${p}">${e} ${p}</button>`).join('')}</div>

      <div class="cash-box" id="cashBox" ${billDraft.payment === 'Efectivo' ? '' : 'hidden'}>
        <span style="font-size:13px;font-weight:800;color:var(--ink)">💵 ¿Con cuánto abonás? (para llevarte el vuelto)</span>
        <div class="cash-chips">
          <button type="button" class="cash-chip" data-cash-preset="0">Importe justo</button>
          <button type="button" class="cash-chip" data-cash-preset="20000">$20.000</button>
          <button type="button" class="cash-chip" data-cash-preset="50000">$50.000</button>
          <button type="button" class="cash-chip" data-cash-preset="100000">$100.000</button>
        </div>
        <div class="cash-custom-row">
          <input class="input" id="cashCustomInput" type="number" inputmode="numeric" min="0" step="500" placeholder="Otro monto en efectivo ($)" value="${escapeHtml(billDraft.cashCustom)}">
        </div>
        <div class="cash-hint" id="cashChangeHint"></div>
      </div>

      <div class="vaquita-box">
        <div class="vaquita-row">
          <span class="vaquita-lbl">÷ Dividir entre personas ("Vaquita")</span>
          <div class="stepper">
            <button type="button" id="splitMinus" aria-label="Menos personas">−</button>
            <span id="splitCount">${billDraft.splitWays}</span>
            <button type="button" id="splitPlus" aria-label="Más personas">+</button>
          </div>
        </div>
        <div class="vaquita-sub" id="splitSubRow" ${billDraft.splitWays > 1 ? '' : 'hidden'}>
          <span>Entre <span id="splitWaysLbl">${billDraft.splitWays}</span> personas -&gt;</span>
          <strong id="splitPerPerson"></strong>
        </div>
      </div>

      <div class="total-row"><span>Total estimado</span><span id="grand"></span></div>
      <div class="sheet-actions"><button class="btn btn-primary" type="button" id="billBtn">Solicitar la cuenta</button></div>`, (el) => {
      refreshOpenCuentaTotals();

      el.querySelectorAll('[data-tip]').forEach((b) => b.addEventListener('click', () => {
        billDraft.tip = Number(b.dataset.tip);
        el.querySelectorAll('[data-tip]').forEach((x) => x.classList.toggle('selected', x === b));
        refreshOpenCuentaTotals();
      }));

      el.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => {
        billDraft.payment = b.dataset.pay;
        el.querySelectorAll('[data-pay]').forEach((x) => x.classList.toggle('selected', x === b));
        refreshOpenCuentaTotals();
      }));

      el.querySelectorAll('[data-cash-preset]').forEach((b) => b.addEventListener('click', () => {
        const val = Number(b.dataset.cashPreset);
        if (val === 0) {
          billDraft.cashMode = 'exact';
          billDraft.cashPreset = 0;
        } else {
          billDraft.cashMode = 'preset';
          billDraft.cashPreset = val;
        }
        billDraft.cashCustom = '';
        const customInp = el.querySelector('#cashCustomInput');
        if (customInp) customInp.value = '';
        refreshOpenCuentaTotals();
      }));

      const customInp = el.querySelector('#cashCustomInput');
      if (customInp) {
        customInp.addEventListener('input', () => {
          billDraft.cashCustom = customInp.value.trim();
          billDraft.cashMode = billDraft.cashCustom ? 'custom' : 'exact';
          billDraft.cashPreset = 0;
          refreshOpenCuentaTotals();
        });
      }

      el.querySelector('#splitMinus').addEventListener('click', () => {
        billDraft.splitWays = Math.max(1, billDraft.splitWays - 1);
        refreshOpenCuentaTotals();
      });
      el.querySelector('#splitPlus').addEventListener('click', () => {
        billDraft.splitWays = Math.min(20, billDraft.splitWays + 1);
        refreshOpenCuentaTotals();
      });

      el.querySelector('#billBtn').addEventListener('click', async (ev) => {
        const liveSub = state.subtotal || 0;
        const grand = liveSub + Math.round((liveSub * billDraft.tip) / 100);
        const cashAmount = effectiveCashAmountFor(grand);
        if (billDraft.payment === 'Efectivo' && cashAmount > 0 && cashAmount < grand) {
          return toast(`⚠️ El efectivo indicado (${money(cashAmount)}) es menor al total (${money(grand)})`);
        }
        ev.currentTarget.disabled = true;
        try {
          await dispatch('call.create', {
            qrToken: TOKEN,
            type: 'cuenta',
            payment: billDraft.payment,
            tip: billDraft.tip,
            cashAmount: billDraft.payment === 'Efectivo' ? cashAmount : 0,
            splitWays: billDraft.splitWays,
          });
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
          const where = stationLabel(o.station);
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
        <div class="sheet-actions"><button class="btn btn-primary" type="button" id="ok">Volver al menú</button></div>`,
        (el) => el.querySelector('#ok').addEventListener('click', () => { closeSheet(); setTab('menu'); }));
    } else if (lastClosed === 0 && closedNow > 0 && Object.keys(lastOrderStatuses).length > 0 && !(s.orders || []).length) {
      openSheet('closed', `
        <div class="done-hero">
          <span class="big">🙏</span>
          <h3>¡Muchas gracias por tu visita!</h3>
          <p class="muted">La cuenta de la Mesa ${escapeHtml(s.table.code)} quedó cerrada.</p>
        </div>
        <div class="sheet-actions"><button class="btn btn-primary" type="button" id="ok">Volver al menú</button></div>`,
        (el) => el.querySelector('#ok').addEventListener('click', () => { closeSheet(); setTab('menu'); }));
    }
    lastClosed = closedNow;

    lastOrderStatuses = mapOrders(s);
    lastCallStatuses = mapCalls(s);

    sanitizeCart(s, true);
    renderAll();

    // Si el sheet de cuenta está abierto, actualizar subtotales/vuelto/vaquita in-place SIN pisar las opciones del comensal
    if (openSheetKind === 'cuenta') {
      refreshOpenCuentaTotals();
    }
  });

  function renderAll() {
    renderHeader();
    renderMenuArea();
    renderOrders();
    renderCartBar();
    renderCallStatus();
  }

  renderAll();
  setInterval(renderOrders, 30000);
})();
