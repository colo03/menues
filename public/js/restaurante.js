(async () => {
  let state = await connect(connectionBanner);

  // Manda una acción al servidor; el estado nuevo llega por subscribe().
  async function act(type, payload) {
    try {
      return await dispatch(type, payload);
    } catch (err) {
      toast(`⚠️ ${err.message}`);
      return null;
    }
  }
  let view = 'pedidos';
  let knownOrders = new Set(state.orders.map((o) => o.id));
  let knownCalls = new Set(state.calls.map((c) => c.id));
  let freshIds = new Set();

  const $ = (sel) => document.querySelector(sel);
  const EMOJIS = ['🍜', '🍣', '🍙', '🥟', '🍛', '🍱', '🍤', '🍗', '🥢', '🥞', '🫛', '🥗', '🍡', '🍰', '🍮', '🍨', '🍵', '🍺', '🍶', '🧃', '🥤', '☕', '🌯', '🍲'];
  const NEXT = {
    nuevo: { to: 'cocina', label: 'Aceptar → cocina' },
    cocina: { to: 'listo', label: 'Marcar listo' },
    listo: { to: 'entregado', label: 'Entregado' },
  };

  // ---------- KPIs ----------
  function renderKpis() {
    const active = state.orders.filter((o) => o.status !== 'entregado').length;
    const sales = state.orders.reduce((t, o) => t + orderTotal(o), 0);
    const occupied = tableList().filter((t) => t.status !== 'libre').length;
    const avg = state.orders.length ? sales / state.orders.length : 0;
    $('#kpis').innerHTML = [
      ['Ventas del día', money(sales)],
      ['Pedidos en curso', active],
      ['Mesas ocupadas', `${occupied} / ${state.restaurant.tables}`],
      ['Ticket promedio', money(avg)],
    ].map(([k, v]) => `<div class="kpi"><small>${k}</small><strong>${v}</strong></div>`).join('');
  }

  // ---------- Pedidos ----------
  function ticketHtml(o) {
    const mins = Math.floor((Date.now() - o.createdAt) / 60000);
    const late = o.status !== 'entregado' && mins >= 15;
    const next = NEXT[o.status];
    return `<article class="ticket ${o.status} ${freshIds.has(o.id) ? 'fresh' : ''}">
      <div class="ticket-head"><strong>Mesa ${o.table}</strong><small class="${late ? 'late' : ''}">#${o.id.slice(1)} · ${timeAgo(o.createdAt)}</small></div>
      ${o.items.map((i) => `<div class="t-line"><b>${i.qty}×</b>${escapeHtml(i.name)}${i.note ? `<span class="t-note">↳ ${escapeHtml(i.note)}</span>` : ''}</div>`).join('')}
      <div class="ticket-foot"><strong>${money(orderTotal(o))}</strong>
        ${next ? `<button class="btn btn-sm ${o.status === 'nuevo' ? 'btn-primary' : 'btn-ghost'}" data-advance="${o.id}">${next.label}</button>` : ''}
      </div>
    </article>`;
  }

  function renderBoard() {
    const cols = [
      { id: 'nuevo', title: 'Nuevos', color: 'var(--accent)' },
      { id: 'cocina', title: 'En cocina', color: 'var(--warn)' },
      { id: 'listo', title: 'Listos para servir', color: 'var(--info)' },
    ];
    const delivered = state.orders.filter((o) => o.status === 'entregado').slice().reverse();
    $('#board').innerHTML = cols.map((c) => {
      const list = state.orders.filter((o) => o.status === c.id);
      return `<div class="col">
        <div class="col-head"><h3><span class="dot-s" style="background:${c.color}"></span>${c.title}</h3><span class="n">${list.length}</span></div>
        ${list.length ? list.map(ticketHtml).join('') : `<div class="col-empty">${c.id === 'nuevo' ? 'Esperando pedidos…' : 'Nada por acá'}</div>`}
      </div>`;
    }).join('') + (delivered.length ? `<details class="delivered" style="grid-column:1/-1">
        <summary>Entregados (${delivered.length})</summary>
        <div class="delivered-list">${delivered.map(ticketHtml).join('')}</div>
      </details>` : '');
    const n = state.orders.filter((o) => o.status === 'nuevo').length;
    $('#navNew').hidden = !n;
    $('#navNew').textContent = n;
  }

  $('#board').addEventListener('click', (e) => {
    const b = e.target.closest('[data-advance]');
    if (!b) return;
    const id = b.dataset.advance;
    b.disabled = true;
    freshIds.delete(id);
    act('order.advance', { id });
  });

  // ---------- Mesas ----------
  function tableList() {
    return Array.from({ length: state.restaurant.tables }, (_, i) => {
      const n = i + 1;
      const orders = tableOrders(state, n);
      const calls = state.calls.filter((c) => c.table === n && c.status === 'pendiente');
      const status = calls.some((c) => c.type === 'cuenta') ? 'cuenta'
        : calls.some((c) => c.type === 'mozo') ? 'mozo'
        : orders.length ? 'ocupada' : 'libre';
      return { n, orders, status, total: orders.reduce((t, o) => t + orderTotal(o), 0) };
    });
  }

  function renderTables() {
    const labels = { libre: 'Libre', ocupada: 'Ocupada', mozo: '🙋 Llama al mozo', cuenta: '🧾 Pide la cuenta' };
    $('#tables').innerHTML = tableList().map((t) => `
      <button class="table-tile ${t.status}" data-table="${t.n}">
        <span class="num">${t.n}</span>
        <span class="state">${labels[t.status]}</span>
        ${t.orders.length ? `<span class="muted">${t.orders.length} pedido${t.orders.length > 1 ? 's' : ''}</span><span class="amt">${money(t.total)}</span>` : ''}
      </button>`).join('');
  }

  $('#tables').addEventListener('click', (e) => {
    const b = e.target.closest('[data-table]');
    if (b) openTableModal(Number(b.dataset.table));
  });

  function openTableModal(n) {
    const t = tableList().find((x) => x.n === n);
    const lines = {};
    t.orders.forEach((o) => o.items.forEach((i) => {
      lines[i.name] = lines[i.name] || { ...i, qty: 0 };
      lines[i.name].qty += i.qty;
    }));
    const bill = state.calls.find((c) => c.table === n && c.type === 'cuenta' && c.status === 'pendiente');
    openModal(`
      <h3>Mesa ${n}</h3>
      ${t.orders.length ? Object.values(lines).map((i) => `<div class="bill-line"><span>${i.qty} × ${escapeHtml(i.name)}</span><span>${money(i.price * i.qty)}</span></div>`).join('')
        + `<div class="bill-total"><span>Consumo</span><span>${money(t.total)}</span></div>`
        + (bill ? `<p class="muted" style="margin-top:10px">Pidió la cuenta · paga con <b>${bill.payment}</b> · propina ${bill.tip}% → <b>${money(bill.total)}</b></p>` : '')
        : '<p class="muted">La mesa está libre.</p>'}
      <div class="modal-actions">
        <a class="btn btn-ghost" href="cliente.html?mesa=${n}" target="_blank">📱 Abrir como cliente</a>
        ${t.orders.length ? `<button class="btn btn-primary" data-close-table="${n}">Cobrar y cerrar mesa</button>` : ''}
      </div>`);
  }

  async function closeTable(n) {
    if (!(await act('table.close', { table: n }))) return;
    closeModal();
    toast(`Mesa ${n} cerrada ✔`);
  }

  // ---------- Solicitudes (mozo / cuenta) ----------
  function renderCalls() {
    const pending = state.calls.filter((c) => c.status === 'pendiente').slice().reverse();
    $('#callCount').hidden = !pending.length;
    $('#callCount').textContent = pending.length;
    if (!pending.length) {
      $('#calls').innerHTML = '<div class="empty"><span class="big">☕</span>Sin solicitudes.<br>Todo tranquilo en el salón.</div>';
      return;
    }
    $('#calls').innerHTML = pending.map((c) => c.type === 'mozo'
      ? `<div class="call mozo">
          <div class="call-head"><strong>🙋 Mesa ${c.table}</strong><small>${timeAgo(c.createdAt)}</small></div>
          <p>Llama al mozo · ${escapeHtml(c.reason || 'Consulta')}</p>
          <button class="btn btn-sm" data-attend="${c.id}">Voy en camino</button>
        </div>`
      : `<div class="call cuenta">
          <div class="call-head"><strong>🧾 Mesa ${c.table}</strong><small>${timeAgo(c.createdAt)}</small></div>
          <p>Pide la cuenta · ${c.payment} · ${money(c.total)}${c.tip ? ` (incl. ${c.tip}% propina)` : ''}</p>
          <button class="btn btn-sm btn-primary" data-bill="${c.table}">Ver cuenta y cerrar</button>
        </div>`).join('');
  }

  $('#calls').addEventListener('click', (e) => {
    const a = e.target.closest('[data-attend]');
    if (a) act('call.attend', { id: a.dataset.attend });
    const b = e.target.closest('[data-bill]');
    if (b) openTableModal(Number(b.dataset.bill));
  });

  // ---------- Menú ----------
  function renderMenuAdmin() {
    $('#menuAdmin').innerHTML = state.categories.map((c) => {
      const items = state.items.filter((i) => i.cat === c.id);
      return `<div class="cat-block">
        <h2>${c.icon} ${escapeHtml(c.name)} <span class="muted">(${items.length})</span></h2>
        ${items.map((i) => `<div class="menu-row ${i.available ? '' : 'off'}">
          <span class="emoji">${i.emoji}</span>
          <div style="min-width:0"><div class="name">${escapeHtml(i.name)} ${i.popular ? '<span class="chip nuevo">Popular</span>' : ''}</div><div class="desc">${escapeHtml(i.desc)}</div></div>
          <span class="price">${money(i.price)}</span>
          <label class="switch"><input type="checkbox" data-toggle="${i.id}" ${i.available ? 'checked' : ''}><span class="track"></span>${i.available ? 'Disponible' : 'Agotado'}</label>
          <div class="row-actions">
            <button class="icon-btn" title="Editar" data-edit="${i.id}">✏️</button>
            <button class="icon-btn" title="Eliminar" data-del="${i.id}">🗑️</button>
          </div>
        </div>`).join('') || '<p class="muted">Sin platos en esta categoría.</p>'}
      </div>`;
    }).join('');
  }

  $('#menuAdmin').addEventListener('change', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    act('item.toggle', { id: t.dataset.toggle, available: t.checked });
  });
  $('#menuAdmin').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) openItemModal(state.items.find((i) => i.id === ed.dataset.edit));
    const del = e.target.closest('[data-del]');
    if (del) {
      const item = state.items.find((i) => i.id === del.dataset.del);
      if (!confirm(`¿Eliminar "${item.name}" del menú?`)) return;
      act('item.delete', { id: item.id }).then((ok) => ok && toast('Plato eliminado'));
    }
  });
  $('#newItemBtn').addEventListener('click', () => openItemModal(null));

  function openItemModal(item) {
    const it = item || { name: '', desc: '', price: '', cat: state.categories[0].id, emoji: '🍜', available: true, popular: false };
    let emoji = it.emoji;
    openModal(`
      <h3>${item ? 'Editar plato' : 'Nuevo plato'}</h3>
      <form class="form" id="itemForm">
        <div class="field"><label>Nombre</label><input class="input" name="name" required maxlength="40" value="${escapeHtml(it.name)}"></div>
        <div class="field"><label>Descripción</label><input class="input" name="desc" maxlength="90" value="${escapeHtml(it.desc)}"></div>
        <div class="two">
          <div class="field"><label>Precio ($)</label><input class="input" name="price" type="number" min="0" step="100" required value="${it.price}"></div>
          <div class="field"><label>Categoría</label><select class="input" name="cat">${state.categories.map((c) => `<option value="${c.id}" ${c.id === it.cat ? 'selected' : ''}>${c.icon} ${escapeHtml(c.name)}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Imagen</label><div class="emoji-pick">${EMOJIS.map((e) => `<button type="button" data-emoji="${e}" class="${e === emoji ? 'sel' : ''}">${e}</button>`).join('')}</div></div>
        <label class="switch"><input type="checkbox" name="popular" ${it.popular ? 'checked' : ''}><span class="track"></span>Destacar como “Popular”</label>
        <label class="switch"><input type="checkbox" name="available" ${it.available ? 'checked' : ''}><span class="track"></span>Disponible</label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-primary">${item ? 'Guardar cambios' : 'Agregar al menú'}</button>
        </div>
      </form>`, (el) => {
      el.querySelectorAll('[data-emoji]').forEach((b) => b.addEventListener('click', () => {
        emoji = b.dataset.emoji;
        el.querySelectorAll('[data-emoji]').forEach((x) => x.classList.toggle('sel', x === b));
      }));
      el.querySelector('#itemForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const data = {
          name: f.get('name').trim(), desc: f.get('desc').trim(), price: Number(f.get('price')),
          cat: f.get('cat'), emoji, popular: f.has('popular'), available: f.has('available'),
        };
        if (!(await act('item.save', { ...data, id: item?.id }))) return;
        closeModal();
        toast(item ? 'Cambios guardados' : `${emoji} ${data.name} agregado al menú`);
      });
    });
  }

  // ---------- Modal ----------
  function openModal(html, onMount) {
    $('#modal').innerHTML = html;
    $('#modalBackdrop').hidden = false;
    onMount?.($('#modal'));
  }
  function closeModal() { $('#modalBackdrop').hidden = true; }
  $('#modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop' || e.target.closest('[data-cancel]')) closeModal();
    const c = e.target.closest('[data-close-table]');
    if (c) closeTable(Number(c.dataset.closeTable));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // ---------- Navegación ----------
  document.querySelector('.nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    view = b.dataset.view;
    document.querySelectorAll('.nav-item').forEach((x) => x.classList.toggle('active', x === b));
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${view}`; });
  });

  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('¿Borrar pedidos y volver al menú de ejemplo?')) return;
    act('reset').then((ok) => ok && toast('Datos reiniciados'));
  });

  // ---------- Sincronización con los clientes ----------
  subscribe((s) => {
    state = s;
    const newOrders = s.orders.filter((o) => !knownOrders.has(o.id));
    const newCalls = s.calls.filter((c) => !knownCalls.has(c.id));
    newOrders.forEach((o) => {
      freshIds.add(o.id);
      setTimeout(() => freshIds.delete(o.id), 5000);
      toast(`🧾 Nuevo pedido · Mesa ${o.table}`);
    });
    newCalls.forEach((c) => toast(c.type === 'mozo' ? `🙋 Mesa ${c.table} llama al mozo` : `🧾 Mesa ${c.table} pide la cuenta`));
    if (newOrders.length || newCalls.length) ding(newCalls.length ? 2 : 1);
    knownOrders = new Set(s.orders.map((o) => o.id));
    knownCalls = new Set(s.calls.map((c) => c.id));
    renderAll();
  });

  function renderAll() {
    $('#restName').textContent = state.restaurant.name;
    renderKpis();
    renderBoard();
    renderTables();
    renderCalls();
    renderMenuAdmin();
  }

  renderAll();
  setInterval(renderAll, 30000); // refresca tiempos y alertas de demora
})();
