(async () => {
  const params = new URLSearchParams(location.search);
  const wantDemoAuth = params.get('demo') === '1';
  const $ = (sel) => document.querySelector(sel);

  const EMOJIS = ['🍜', '🍣', '🍙', '🥟', '🍛', '🍱', '🍤', '🍗', '🥢', '🥞', '🫛', '🥗', '🍔', '🍕', '🥩', '🍝', '🌮', '🍡', '🍰', '🍮', '🍨', '🍸', '🍺', '🍷', '🍹', '🧃', '🥤', '🍵', '☕'];
  const COLORS = ['#d9412b', '#2f6bd9', '#2f8a57', '#8b5cf6', '#d97706', '#0d9488', '#db2777', '#4f46e5'];
  const PRICE_BACKUP_KEY = 'salelisto:lastPriceBackup';

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
  let knownLeads = new Set();
  let leadFilter = 'activas';
  let cajaConfigDirty = false;
  let panelBound = false;
  let activeStream = null;
  let unsubState = null;
  let tunnelBusy = false;
  let tunnelNeedsInstall = false;
  let adminRole = sessionStorage.getItem('salelisto:adminRole') || '';

  // Preservar selecciones del modal operativo de mesa ante actualizaciones SSE
  const tableModalDraft = {
    tableId: null,
    pay: null,
    tip: null,
    dirty: false,
  };

  const ITEM_TAG_OPTIONS = [
    ['sin_tacc', '🌾 Sin TACC'],
    ['veggie', '🌱 Veggie'],
    ['vegano', '🌿 Vegano'],
    ['picante', '🌶️ Picante'],
    ['sin_alcohol', '🧃 Sin alcohol'],
  ];
  const LEAD_STATUS = {
    nuevo: { label: 'Nuevo', cls: 'nuevo' },
    contactado: { label: 'Contactado', cls: 'cocina' },
    piloto: { label: 'En piloto', cls: 'listo' },
    descartado: { label: 'Descartado', cls: 'cancelado' },
  };

  function getPriceBackup() {
    try {
      const raw = sessionStorage.getItem(PRICE_BACKUP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function savePriceBackup(backup) {
    try {
      if (backup) sessionStorage.setItem(PRICE_BACKUP_KEY, JSON.stringify(backup));
      else sessionStorage.removeItem(PRICE_BACKUP_KEY);
    } catch (_) {}
    syncUndoPriceBtn();
  }

  function syncUndoPriceBtn() {
    const btn = $('#undoPriceHeaderBtn');
    if (!btn) return;
    const bk = getPriceBackup();
    const canUndo = Boolean(state?.restaurant?.canUndoPrices || (bk && Array.isArray(bk.items) && bk.items.length > 0));
    btn.hidden = !canUndo;
  }

  // ---------- Autenticación del Panel ----------
  let savedToken = sessionStorage.getItem('salelisto:adminToken') || '';
  if (savedToken) setAuthToken(savedToken);

  async function tryBoot() {
    try {
      if (!getAuthToken() && wantDemoAuth) {
        const r = await apiPost('api/auth/admin', { demo: true });
        setAuthToken(r.token);
        adminRole = r.role || 'demo_admin';
        sessionStorage.setItem('salelisto:adminToken', r.token);
        sessionStorage.setItem('salelisto:adminRole', adminRole);
      }
      if (!getAuthToken()) throw new Error('AUTH_REQUIRED');
      activeStream = await connectStream({ scope: 'staff' }, connectionBanner);
      state = activeStream.state;
      startPanel();
    } catch (_) {
      showPinGate();
    }
  }

  function showPinGate() {
    if (activeStream) {
      try { activeStream.close(); } catch (_) {}
      activeStream = null;
    }
    if (unsubState) {
      unsubState();
      unsubState = null;
    }
    $('#adminLayout').hidden = true;
    $('#pinGate').hidden = false;
    $('#pinInput').focus();
  }

  window.addEventListener('salelisto:auth-expired', () => {
    toast('🔒 Tu sesión de encargado venció o cambió el PIN. Ingresá nuevamente.');
    sessionStorage.removeItem('salelisto:adminToken');
    sessionStorage.removeItem('salelisto:adminRole');
    adminRole = '';
    setAuthToken('');
    showPinGate();
  });

  $('#pinForm').onsubmit = async (e) => {
    e.preventDefault();
    const pin = $('#pinInput').value.trim();
    try {
      const res = await apiPost('api/auth/admin', { pin });
      setAuthToken(res.token);
      adminRole = res.role || 'admin';
      sessionStorage.setItem('salelisto:adminToken', res.token);
      sessionStorage.setItem('salelisto:adminRole', adminRole);
      $('#pinInput').value = '';
      unlockAudio();
      activeStream = await connectStream({ scope: 'staff' }, connectionBanner);
      state = activeStream.state;
      startPanel();
    } catch (err) {
      toast(`⚠️ ${err.message}`);
    }
  };

  async function act(type, payload) {
    try {
      return await dispatch(type, payload);
    } catch (err) {
      if (err.status === 401 || /sesión requerida|no autorizado/i.test(err.message)) {
        sessionStorage.removeItem('salelisto:adminToken');
        sessionStorage.removeItem('salelisto:adminRole');
        adminRole = '';
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
    knownLeads = new Set((state.leads || []).map((l) => l.id));

    if (!panelBound) {
      onAudioState((active, detail) => {
        const b = $('#adminAudioBtn');
        const mb = $('#adminAudioBtnMob');
        if (b) {
          b.className = `audio-pill ${active ? 'on' : 'off'}`;
          if (active) b.innerHTML = '🔊 <span class="lbl">Sonido activo</span>';
          else if (detail && detail.muted) b.innerHTML = '🔇 <span class="lbl">Silenciado</span>';
          else b.innerHTML = '🔇 <span class="lbl">Activar sonido</span>';
        }
        if (mb) {
          mb.className = `audio-pill mob-audio-btn ${active ? 'on' : 'off'}`;
          mb.textContent = active ? '🔊 Activo' : (detail && detail.muted ? '🔇 Silenciado' : '🔇 Sonido');
        }
      });

      const handleToggleAudio = async () => {
        const muted = await toggleSoundMute();
        toast(muted ? '🔇 Campana del panel silenciada' : '🔊 Campana activada en el panel');
      };
      $('#adminAudioBtn').onclick = handleToggleAudio;
      $('#adminAudioBtnMob').onclick = handleToggleAudio;

      bindPanelEvents();
      panelBound = true;
    }

    syncUndoPriceBtn();
    renderAll();

    if (unsubState) unsubState();
    unsubState = subscribe((s) => {
      state = s;
      const openOrds = s.orders.filter((o) => o.isOpenSession);
      const newOrders = openOrds.filter((o) => !knownOrders.has(o.id) && o.status === 'nuevo');
      const newCalls = s.calls.filter((c) => !knownCalls.has(c.id));

      newOrders.forEach((o) => {
        freshIds.add(o.id);
        setTimeout(() => freshIds.delete(o.id), 5000);
        toast(`🧾 Nuevo pedido (${stationInfo(o.station).short.toUpperCase()}) · Mesa ${o.tableCode}`);
      });
      newCalls.forEach((c) => {
        toast(c.type === 'mozo' ? `🙋 Mesa ${c.tableCode} llama a ${c.waiterName || 'mozo'}` : `💳 Mesa ${c.tableCode} pide la cuenta`);
      });
      if (newOrders.length || newCalls.length) ding(newCalls.length ? 2 : 1, newCalls.length > 0);

      const newLeads = (s.leads || []).filter((l) => !knownLeads.has(l.id));
      newLeads.forEach((l) => toast(`📨 Nueva consulta comercial: ${l.restaurantName || l.name}`, 5000));
      if (newLeads.length && !newOrders.length && !newCalls.length) ding(1);
      knownLeads = new Set((s.leads || []).map((l) => l.id));

      knownOrders = new Set(openOrds.map((o) => o.id));
      knownCalls = new Set(s.calls.map((c) => c.id));
      renderAll();

      if (openTableModalId && !$('#modalBackdrop').hidden) {
        const stillExists = s.tables.some((t) => t.id === openTableModalId);
        if (stillExists) renderTableOperationalModal(openTableModalId, true);
      }
    });
  }

  // Refrescar etiquetas de minutos cada 30 s sin romper formularios abiertos
  setInterval(() => {
    if (state && !$('#adminLayout').hidden) {
      renderBoard();
      renderCalls();
    }
  }, 30000);

  // ---------- Estado 4G/5G Sin Wi-Fi y Túnel HTTPS ----------
  function urlSourceLabel(src) {
    return {
      restaurant_public_url: 'Dominio fijo guardado',
      env_public_url: 'Variable PUBLIC_URL',
      tunnel: 'Túnel HTTPS Cloudflare',
      forwarded_proxy: 'Proxy HTTPS confiable',
      cloud_env: 'Servidor Cloud HTTPS',
      lan_host: 'Red local Wi-Fi',
      lan: 'Red local Wi-Fi',
    }[src] || 'Red local';
  }

  async function startTunnel(autoInstall = false) {
    if (tunnelBusy) return;
    tunnelBusy = true;
    renderNetBar();
    renderCajaTunnel();
    try {
      toast(autoInstall
        ? '⬇️ Descargando cloudflared oficial e iniciando túnel 4G/5G…'
        : '🚀 Iniciando túnel HTTPS 4G/5G…', 4500);
      const res = await apiPost('/api/tunnel/start', { autoInstall });
      tunnelNeedsInstall = false;
      if (res.network) state.network = res.network;
      toast(res.network?.isPublic4g
        ? `✅ 4G/5G Activo: ${res.network.baseUrl}`
        : '✅ Túnel iniciado; aguardando dirección HTTPS…', 4500);
    } catch (err) {
      if (err.data?.needsInstall) {
        tunnelNeedsInstall = true;
        toast('ℹ️ Falta cloudflared en esta PC. Tocá "Descargar e iniciar 4G" para instalarlo en 1 clic.', 5500);
      } else {
        toast(`⚠️ ${err.message}`, 4500);
      }
      if (err.data?.network) state.network = err.data.network;
    } finally {
      tunnelBusy = false;
      renderNetBar();
      renderCajaTunnel();
    }
  }

  async function stopTunnel() {
    if (tunnelBusy) return;
    tunnelBusy = true;
    renderNetBar();
    renderCajaTunnel();
    try {
      const res = await apiPost('/api/tunnel/stop', {});
      if (res.network) state.network = res.network;
      toast('⏹ Túnel HTTPS detenido');
    } catch (err) {
      toast(`⚠️ ${err.message}`);
    } finally {
      tunnelBusy = false;
      renderNetBar();
      renderCajaTunnel();
    }
  }

  function renderNetBar() {
    const bar = $('#netBar');
    if (!bar || !state) return;
    const net = state.network || {};
    const tun = net.tunnel || {};
    const baseUrl = net.baseUrl || location.origin;
    const is4g = Boolean(net.isPublic4g);
    const isStarting = tunnelBusy || tun.state === 'starting' || tun.state === 'installing';
    const canManage = Boolean(net.canManageTunnel);

    bar.className = `net-bar ${is4g ? 'is-4g' : 'is-local'}`;
    bar.innerHTML = `
      <div class="net-bar-info">
        <span class="net-badge ${is4g ? 'ok' : 'warn'}">
          <span class="dot"></span>
          ${is4g ? '4G/5G Activo · Escaneo sin Wi-Fi' : 'Solo Red Local Wi-Fi'}
        </span>
        <code class="net-url">${escapeHtml(baseUrl)}</code>
        <span class="net-meta">${escapeHtml(urlSourceLabel(net.urlSource))}${net.isTemporaryTunnel ? ' (temporal)' : ''}</span>
      </div>
      <div class="net-bar-actions">
        ${is4g ? `<button class="btn btn-xs btn-ghost" type="button" data-net-copy="${escapeHtml(baseUrl)}">📋 Copiar</button>` : ''}
        ${canManage && tun.active
          ? `<button class="btn btn-xs btn-danger" type="button" data-tunnel-stop ${isStarting ? 'disabled' : ''}>⏹ Detener túnel</button>`
          : (canManage && !is4g && !net.cloudEnv ? `
              ${tunnelNeedsInstall
                ? `<button class="btn btn-xs btn-primary" type="button" data-tunnel-start="install" ${isStarting ? 'disabled' : ''}>${isStarting ? 'Instalando…' : '⬇️ Descargar e iniciar 4G'}</button>`
                : `<button class="btn btn-xs btn-primary" type="button" data-tunnel-start="normal" ${isStarting ? 'disabled' : ''}>${isStarting ? 'Iniciando túnel…' : '🚀 Activar 4G/5G'}</button>`}
            ` : '')}
        ${canManage && !is4g ? `<button class="btn btn-xs btn-ghost" type="button" data-goto-caja>⚙️ Dominio fijo</button>` : ''}
        <a class="btn btn-xs btn-ghost" href="qr.html" target="_blank">🖨️ QRs</a>
      </div>`;
  }

  function renderCajaTunnel() {
    const box = $('#cajaTunnel');
    if (!box || !state) return;
    const net = state.network || {};
    const tun = net.tunnel || {};
    const baseUrl = net.baseUrl || location.origin;
    const lanUrl = net.lanUrl || location.origin;
    const is4g = Boolean(net.isPublic4g);
    const isStarting = tunnelBusy || tun.state === 'starting' || tun.state === 'installing';
    const canManage = Boolean(net.canManageTunnel);

    box.className = `tunnel-panel ${is4g ? 'is-4g' : 'is-local'}`;
    box.innerHTML = `
      <div class="tunnel-head">
        <div>
          <h3 style="margin-bottom:6px">🌐 Acceso 4G/5G sin Wi-Fi (Túnel HTTPS y Dominio Fijo)</h3>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="net-badge ${is4g ? 'ok' : 'warn'}">
              <span class="dot"></span>
              ${is4g ? '4G/5G Activo · Escaneo sin Wi-Fi' : 'Solo Red Local Wi-Fi'}
            </span>
            <code class="net-url">${escapeHtml(baseUrl)}/q/&lt;token&gt;</code>
            <span class="net-meta">Origen: ${escapeHtml(urlSourceLabel(net.urlSource))} · LAN: ${escapeHtml(lanUrl)}</span>
          </div>
        </div>
        <div class="tunnel-actions">
          ${canManage && tun.active
            ? `<button class="btn btn-sm btn-danger" type="button" data-tunnel-stop ${isStarting ? 'disabled' : ''}>⏹ Detener túnel HTTPS</button>`
            : (canManage && !net.cloudEnv ? `
                <button class="btn btn-sm btn-primary" type="button" data-tunnel-start="normal" ${isStarting ? 'disabled' : ''}>
                  ${isStarting ? '⏳ Iniciando túnel…' : '🚀 Iniciar túnel HTTPS 4G/5G'}
                </button>
                ${!tun.binaryInstalled ? `
                  <button class="btn btn-sm btn-ghost" type="button" data-tunnel-start="install" ${isStarting ? 'disabled' : ''}>
                    ⬇️ Descargar cloudflared oficial y activar
                  </button>` : ''}
              ` : '')}
          <a class="btn btn-sm btn-ghost" href="qr.html" target="_blank">🖨️ Abrir Estudio QR</a>
        </div>
      </div>
      ${!canManage ? `
        <div class="tunnel-alert info">
          <strong>🔒 Modo demostración:</strong> el control del túnel HTTPS y del dominio fijo está reservado al encargado autenticado con el PIN real del local.
        </div>` : ''}
      ${!is4g ? `
        <div class="tunnel-alert">
          <strong>⚠️ Atención antes de imprimir QRs:</strong> el servidor apunta hoy a una red local (<code>${escapeHtml(baseUrl)}</code>). Los comensales con datos móviles 4G/5G <strong>no podrán abrir el menú</strong> sin conectarse a tu Wi-Fi hasta que actives el túnel HTTPS 4G/5G o guardes un dominio fijo <code>https://...</code> en la configuración de abajo.
        </div>` : ''}
      ${net.isTemporaryTunnel ? `
        <div class="tunnel-alert info">
          <strong>⚡ Túnel rápido Cloudflare activo:</strong> ya podés escanear los QRs desde cualquier celular con 4G/5G sin Wi-Fi. Esta dirección <code>trycloudflare.com</code> cambia al reiniciar la PC; antes de mandar a imprenta acrílicos definitivos, configurá <code>CLOUDFLARE_TUNNEL_TOKEN</code> + tu dominio fijo HTTPS (o desplegá en la nube).
        </div>` : ''}
      ${tun.state === 'error' && tun.lastError ? `
        <div class="tunnel-alert err">
          <strong>Error del túnel:</strong> ${escapeHtml(tun.lastError)}
        </div>` : ''}
      <p class="muted" style="font-size:12.5px">
        Precedencia automática de QRs: <strong>1) Dominio fijo guardado</strong> -> <strong>2) variable PUBLIC_URL</strong> -> <strong>3) Túnel HTTPS activo</strong> -> <strong>4) Red local LAN</strong>. También podés iniciar con <code>python app/server.py --tunnel</code>.
      </p>`;
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
    nuevo: { label: 'Aceptar -> Preparar', cls: 'btn-primary' },
    cocina: { label: 'Listo (Avisar mozo)', cls: 'btn-ok' },
    listo: { label: 'Entregado', cls: 'btn-ghost' },
  };

  function slaChip(o) {
    if (['entregado', 'cancelado'].includes(o.status)) return '';
    const mins = Math.max(0, Math.floor((Date.now() - o.createdAt) / 60000));
    if (mins >= 15) return `<span class="sla-chip sla-late">Demorado · ${mins} min</span>`;
    if (mins >= 8) return `<span class="sla-chip sla-warn">Atención · ${mins} min</span>`;
    return `<span class="sla-chip sla-ok">En tiempo</span>`;
  }

  function ticketHtml(o) {
    const mins = Math.floor((Date.now() - o.createdAt) / 60000);
    const late = !['entregado', 'cancelado'].includes(o.status) && mins >= 15;
    const nxt = NEXT_FLOW[o.status];
    const isCancel = o.status === 'cancelado';

    return `<article class="ticket ${o.status} ${freshIds.has(o.id) ? 'fresh' : ''} ${late ? 'sla-late-card' : ''}">
      <div class="ticket-head">
        <strong>Mesa ${escapeHtml(o.tableCode)} <small style="font-weight:600;color:var(--ink-2)">(${escapeHtml(o.blockName)})</small></strong>
        <small class="${late ? 'late' : ''}">#${o.id.slice(1)} · ${timeAgo(o.createdAt)}</small>
      </div>
      <div class="ticket-meta">
        <span class="chip ${stationChipClass(o.station)}">${stationLabel(o.station)}</span>
        ${o.waiterName
          ? `<span class="waiter-pill"><span class="waiter-dot" style="background:${escapeHtml(o.waiterColor)}"></span>${escapeHtml(o.waiterName)}</span>`
          : '<span class="chip">Sin mozo</span>'}
        ${isCancel ? `<span class="chip cancelado">Anulado</span>` : ''}
        ${o.isOpenSession ? slaChip(o) : ''}
      </div>
      ${o.items.map((i) => `<div class="t-line"><b>${i.qty}×</b>${escapeHtml(i.name)}${i.note ? `<span class="t-note">↳ ${escapeHtml(i.note)}</span>` : ''}</div>`).join('')}
      ${isCancel && o.cancelReason ? `<p class="muted" style="margin-top:4px;font-size:12px">Motivo: ${escapeHtml(o.cancelReason)}</p>` : ''}
      <div class="ticket-foot">
        <strong>${money(o.total)}</strong>
        <div style="display:flex;gap:4px;margin-left:auto">
          ${o.status !== 'nuevo' ? `<button class="btn btn-xs btn-ghost" type="button" title="Retroceder estado" data-rev="${escapeHtml(o.id)}">↩</button>` : ''}
          ${!isCancel && o.status !== 'entregado' ? `<button class="btn btn-xs btn-danger" type="button" title="Anular pedido" data-cancel-ord="${escapeHtml(o.id)}">✕</button>` : ''}
          ${nxt ? `<button class="btn btn-xs ${nxt.cls}" type="button" data-adv="${escapeHtml(o.id)}">${nxt.label}</button>` : ''}
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
      $('#blocksContainer').innerHTML = `<div class="empty"><span class="big">🏗️</span>Tu salón todavía no tiene bloques.<br><button class="btn btn-primary" type="button" style="margin-top:12px" id="emptyAddBlock">+ Agregar primer bloque pre-armado</button></div>`;
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
            <a class="btn btn-xs btn-ghost" href="pase.html?bloque=${encodeURIComponent(b.id)}" target="_blank" title="Abrir Estación de Pase filtrada en este sector">🛎️ Pase sector</a>
          </div>
          ${designMode ? `<div class="block-actions">
            <button class="btn btn-xs btn-ghost" type="button" title="Subir bloque" data-bmove="${escapeHtml(b.id)}" data-dir="-1">↑</button>
            <button class="btn btn-xs btn-ghost" type="button" title="Bajar bloque" data-bmove="${escapeHtml(b.id)}" data-dir="1">↓</button>
            <button class="btn btn-xs btn-ghost" type="button" data-add-table="${escapeHtml(b.id)}">+ 1 Mesa</button>
            <button class="btn btn-xs btn-ghost" type="button" data-bulk-table="${escapeHtml(b.id)}">+ Varias mesas</button>
            <button class="btn btn-xs btn-ghost" type="button" data-edit-block="${escapeHtml(b.id)}">✏️ Configurar bloque</button>
            <button class="btn btn-xs btn-danger" type="button" data-del-block="${escapeHtml(b.id)}">🗑️</button>
          </div>` : ''}
        </div>
        <div class="tables-grid" style="grid-template-columns: repeat(auto-fill, minmax(${Math.max(145, Math.round(720 / Math.max(2, b.columns)))}px, 1fr))">
          ${tbls.map((t) => `
            <button class="table-tile ${t.status}" type="button" data-table-click="${escapeHtml(t.id)}">
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
        <button class="pill ${isHybrid ? 'active' : ''}" type="button" data-gmode="hybrid">🎯 Por Bloques + Automático</button>
        <button class="pill ${!isHybrid ? 'active' : ''}" type="button" data-gmode="auto">⚡ 100% Automático</button>
      </div>`;

    if (!state.waiters.length) {
      $('#waitersGrid').innerHTML = '<div class="empty" style="grid-column:1/-1"><span class="big">🏃</span>No hay mozos cargados todavía.<br>Agregá mozos para que el sistema les asigne mesas y les avise.</div>';
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
            <input type="checkbox" data-wtoggle="${escapeHtml(w.id)}" ${w.available ? 'checked' : ''}>
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
            <button class="icon-btn" type="button" title="Editar mozo" data-wedit="${escapeHtml(w.id)}">✏️</button>
            <button class="icon-btn" type="button" title="Eliminar mozo (reasigna sus mesas)" data-wdel="${escapeHtml(w.id)}">🗑️</button>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  // ---------- 4. Menú, Categorías y Precios ----------
  function renderMenuAdmin() {
    syncUndoPriceBtn();
    if (!state.categories.length) {
      $('#menuAdmin').innerHTML = '<div class="empty"><span class="big">📖</span>Creá primero una categoría para empezar a cargar platos y bebidas.</div>';
      return;
    }
    const routeText = (st) => st === 'barra' ? '🍸 Va a Barra' : st === 'mostrador' ? '🍣 Va a Mostrador' : '🍳 Va a Cocina';

    $('#menuAdmin').innerHTML = state.categories.map((c) => {
      const items = state.items.filter((i) => i.cat === c.id);
      return `<div class="cat-block">
        <div class="cat-head">
          <h2>
            ${c.icon} ${escapeHtml(c.name)}
            <span class="chip ${stationChipClass(c.station)}">${routeText(c.station)}</span>
            <span class="muted">(${items.length})</span>
          </h2>
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs btn-ghost" type="button" data-cmove="${escapeHtml(c.id)}" data-dir="-1" title="Subir">↑</button>
            <button class="btn btn-xs btn-ghost" type="button" data-cmove="${escapeHtml(c.id)}" data-dir="1" title="Bajar">↓</button>
            <button class="btn btn-xs btn-ghost" type="button" data-cedit="${escapeHtml(c.id)}">✏️ Editar</button>
            <button class="btn btn-xs btn-danger" type="button" data-cdel="${escapeHtml(c.id)}">🗑️</button>
          </div>
        </div>
        ${items.length ? items.map((i) => `
          <div class="menu-row ${i.available ? '' : 'off'}">
            <span class="thumb">${i.imageUrl ? `<img src="${escapeHtml(i.imageUrl)}" alt="">` : i.emoji}</span>
            <div style="min-width:0">
              <div class="name">
                ${escapeHtml(i.name)}
                ${i.popular ? '<span class="chip nuevo">Popular</span>' : ''}
                ${i.stationOverride ? `<span class="chip ${stationChipClass(i.stationOverride)}">${stationLabel(i.stationOverride)}</span>` : ''}
                ${(i.tags || []).filter((t) => !(t === 'veggie' && (i.tags || []).includes('vegano'))).map((t) => {
                  const opt = ITEM_TAG_OPTIONS.find(([id]) => id === t);
                  return opt ? `<span class="chip diet-chip">${opt[1]}</span>` : '';
                }).join('')}
              </div>
              <div class="desc">${escapeHtml(i.desc)}</div>
            </div>
            <span class="price">${money(i.price)}</span>
            <label class="switch">
              <input type="checkbox" data-itoggle="${escapeHtml(i.id)}" ${i.available ? 'checked' : ''}>
              <span class="track"></span>
              ${i.available ? 'Disponible' : 'Agotado'}
            </label>
            <div class="row-actions">
              <button class="icon-btn" type="button" title="Editar" data-iedit="${escapeHtml(i.id)}">✏️</button>
              <button class="icon-btn" type="button" title="Eliminar" data-idel="${escapeHtml(i.id)}">🗑️</button>
            </div>
          </div>`).join('')
        : '<p class="muted" style="padding:8px 4px">Sin productos en esta categoría.</p>'}
      </div>`;
    }).join('');
  }

  // ---------- 5. Caja y Configuración ----------
  function renderCaja() {
    const k = state.kpis;
    const payEntries = Object.entries(k.byPayment || {});
    const tipsByWaiter = (state.waiters || []).filter((w) => w.todayTips > 0 || w.todayClosedTables > 0);

    if (!$('#cajaSummary')) {
      $('#cajaAdmin').innerHTML = `
        <div id="cajaTunnel"></div>
        <div class="caja-grid">
          <div class="caja-card" id="cajaSummary"></div>
          <div class="caja-card" id="cajaConfig"></div>
        </div>
        <div id="cajaHistory"></div>`;
      cajaConfigDirty = false;
    }

    renderCajaTunnel();

    $('#cajaSummary').innerHTML = `
      <h3>💵 Resumen de cobros del día</h3>
      <div class="bill-line"><span>Facturación neta (sin propinas)</span><strong>${money(k.closedSalesToday)}</strong></div>
      <div class="bill-line"><span>Propinas registradas</span><strong>${money(k.closedTipsToday)}</strong></div>
      <div class="bill-total"><span>Total cobrado hoy (${k.closedTablesCount} mesas)</span><span>${money(k.closedSalesToday + k.closedTipsToday)}</span></div>
      <h4 class="caja-sub">Por medio de pago</h4>
      ${payEntries.length
        ? payEntries.map(([m, amt]) => `<div class="bill-line"><span>${escapeHtml(m)}</span><strong>${money(amt)}</strong></div>`).join('')
        : '<p class="muted">Todavía no se cerraron mesas hoy.</p>'}
      ${tipsByWaiter.length ? `
        <h4 class="caja-sub">Propinas por mozo</h4>
        ${tipsByWaiter.map((w) => `<div class="bill-line"><span><span class="waiter-dot" style="display:inline-block;margin-right:6px;background:${escapeHtml(w.color)}"></span>${escapeHtml(w.name)} <small class="muted">(${w.todayClosedTables} mesa${w.todayClosedTables === 1 ? '' : 's'})</small></span><strong>${money(w.todayTips)}</strong></div>`).join('')}` : ''}
      <div class="csv-box">
        <div>
          <strong>Arqueo para Excel</strong>
          <p class="muted">Fecha y hora de apertura y cierre, mesa, bloque, mozo, medio de pago, subtotal, propina y total.</p>
        </div>
        <button class="btn btn-sm btn-primary" type="button" data-csv="all">📥 Descargar Arqueo CSV</button>
      </div>`;

    if (!cajaConfigDirty) renderCajaConfig();

    $('#cajaHistory').innerHTML = state.closedHistory.length ? `
      <div class="caja-card" style="margin-top:16px">
        <h3>🧾 Últimas mesas cerradas hoy</h3>
        ${state.closedHistory.slice(0, 15).map((h) => `
          <div class="bill-line" style="border-bottom:1px solid var(--line);padding:7px 0">
            <span><strong>Mesa ${escapeHtml(h.tableCode)}</strong> (${escapeHtml(h.blockName)}) · ${new Date(h.closedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · Mozo: ${escapeHtml(h.waiterName)} · ${escapeHtml(h.payment)}</span>
            <strong>${money(h.total)} <small class="muted">(prop. ${h.tipPct}%)</small></strong>
          </div>`).join('')}
      </div>` : '';
  }

  function renderCajaConfig() {
    const r = state.restaurant;
    $('#cajaConfig').innerHTML = `
      <h3>⚙️ Configuración del Restaurante</h3>
      <form class="form" id="restConfigForm">
        <div class="field"><label>Nombre del restaurante</label><input class="input" name="name" required value="${escapeHtml(r.name)}"></div>
        <div class="field"><label>Subtítulo / especialidad</label><input class="input" name="subtitle" value="${escapeHtml(r.subtitle || '')}"></div>
        <div class="field">
          <label>Dominio fijo público HTTPS (para QRs 4G/5G permanentes en acrílico)</label>
          <input class="input" name="publicUrl" placeholder="Ej: https://tu-local.trycloudflare.com (vacío = automático)" value="${escapeHtml(r.publicUrl || '')}">
        </div>
        <div class="field">
          <label>Cambiar PIN de Encargado (dejar vacío para mantener el actual)</label>
          <input class="input" type="password" name="adminPin" placeholder="Nuevo PIN (mínimo 4 caracteres)" autocomplete="new-password">
        </div>
        <label class="switch">
          <input type="checkbox" name="demoMode" ${r.demoMode ? 'checked' : ''}>
          <span class="track"></span>
          Permitir Modo Demo (desactivalo al abrir al público real)
        </label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary" type="submit">Guardar configuración</button>
          <button class="btn btn-ghost btn-sm" type="button" id="discardConfigBtn" hidden>Descartar cambios</button>
          <span class="muted" id="configDirtyHint" hidden>Cambios sin guardar</span>
        </div>
      </form>

      <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-ghost" type="button" id="clearOpenTurnBtn">🧹 Limpiar mesas abiertas</button>
        <button class="btn btn-sm btn-ghost" type="button" id="clearOrdersBtn">🧹 Limpiar todo el día</button>
        <button class="btn btn-sm btn-danger" type="button" id="factoryResetBtn">↺ Restaurar demo de fábrica</button>
      </div>`;

    const form = $('#restConfigForm');
    const markDirty = () => {
      cajaConfigDirty = true;
      $('#configDirtyHint').hidden = false;
      $('#discardConfigBtn').hidden = false;
    };
    form.addEventListener('input', markDirty);
    form.addEventListener('change', markDirty);
    $('#discardConfigBtn').onclick = () => {
      cajaConfigDirty = false;
      renderCajaConfig();
    };

    form.onsubmit = async (e) => {
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
          try {
            const r2 = await apiPost('api/auth/admin', { pin });
            setAuthToken(r2.token);
            sessionStorage.setItem('salelisto:adminToken', r2.token);
          } catch (_) {}
        }
        cajaConfigDirty = false;
        renderCajaConfig();
        toast('✔ Configuración guardada');
      }
    };

    $('#clearOpenTurnBtn').onclick = async () => {
      if (!confirm('¿Limpiar solo las mesas abiertas en este momento conservando el historial cerrado del día?')) return;
      if (await act('data.clear_open_turn')) toast('🧹 Mesas abiertas limpiadas; el arqueo cerrado sigue intacto');
    };
    $('#clearOrdersBtn').onclick = async () => {
      if (!confirm('¿Limpiar todos los pedidos y cuentas del día conservando intactos tus bloques, mesas, mozos y menú? Te recomendamos descargar antes el Arqueo CSV.')) return;
      if (await act('data.clear_orders')) toast('🧹 Pedidos limpiados; tu configuración sigue intacta');
    };
    $('#factoryResetBtn').onclick = async () => {
      if (!confirm('⚠️ Atención: esto borrará tu menú personalizado, bloques y mozos y restaurará los datos de demostración originales. ¿Continuar?')) return;
      if (await act('data.reset_demo')) toast('↺ Datos de demostración restaurados');
    };
  }

  // ---------- Exportación contable CSV ----------
  function localDay(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function downloadSessionsCsv(scope = 'all', btn = null) {
    const qs = new URLSearchParams();
    if (scope === 'today') {
      qs.set('desde', localDay());
      qs.set('hasta', localDay());
    }
    if (btn) btn.disabled = true;
    try {
      const tok = getAuthToken();
      const res = await fetch(`api/export/sessions.csv${qs.toString() ? `?${qs}` : ''}`, {
        headers: tok ? { 'X-Auth-Token': tok } : {},
      });
      if (res.status === 401) {
        sessionStorage.removeItem('salelisto:adminToken');
        setAuthToken('');
        showPinGate();
        throw new Error('Tu sesión de encargado venció. Ingresá el PIN de nuevo.');
      }
      if (!res.ok) throw new Error('No se pudo generar el archivo');
      const rows = Number(res.headers.get('X-Rows') || 0);
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const fname = (cd.match(/filename="([^"]+)"/) || [])[1] || `arqueo_salelisto_${localDay()}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(rows
        ? `📥 Arqueo descargado · ${rows} mesa${rows === 1 ? '' : 's'} cerrada${rows === 1 ? '' : 's'}`
        : '📥 Archivo descargado (todavía sin mesas cerradas en ese período)');
    } catch (err) {
      toast(`⚠️ ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ---------- 6. Consultas comerciales (Leads) ----------
  function waLink(lead) {
    const raw = String(lead.contact || '');
    if (raw.includes('@')) return '';
    let digits = raw.replace(/\D/g, '');
    if (digits.length < 8) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 10) digits = `549${digits}`;
    else if (digits.startsWith('54') && !digits.startsWith('549') && digits.length === 12) digits = `549${digits.slice(2)}`;
    const who = lead.name ? ` ${lead.name.split(' ')[0]}` : '';
    const rest = lead.restaurantName ? ` para ${lead.restaurantName}` : '';
    const text = `Hola${who}, ¿cómo estás? Gracias por tu consulta sobre SaleListo${rest}. ¿Te queda bien que coordinemos una demo corta esta semana?`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  function mailLink(lead) {
    const m = String(lead.contact || '').match(/[^\s<>()]+@[^\s<>()]+\.[^\s<>()]+/);
    if (!m) return '';
    const subject = `SaleListo${lead.restaurantName ? ` para ${lead.restaurantName}` : ''}`;
    const body = `Hola${lead.name ? ` ${lead.name.split(' ')[0]}` : ''},\n\nGracias por tu consulta. ¿Te queda bien coordinar una demo corta esta semana?\n\nSaludos,\nEquipo SaleListo\nventas@salelisto.com`;
    return `mailto:${m[0]}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function leadDate(ts) {
    const d = new Date(ts);
    const today = localDay();
    const isToday = localDay(d) === today;
    const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    return isToday ? `Hoy ${time}` : `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${time}`;
  }

  function renderLeads() {
    const leads = state.leads || [];
    const newCount = leads.filter((l) => l.status === 'nuevo').length;
    $('#navLeads').hidden = !newCount;
    $('#navLeads').textContent = newCount;
    document.querySelectorAll('[data-lf]').forEach((b) => b.classList.toggle('active', b.dataset.lf === leadFilter));

    const list = leads.filter((l) => {
      if (leadFilter === 'todas') return true;
      if (leadFilter === 'activas') return l.status !== 'descartado';
      return l.status === leadFilter;
    });

    if (!leads.length) {
      $('#leadsAdmin').innerHTML = `<div class="empty"><span class="big">📨</span>Todavía no llegaron consultas desde la portada.<br>Cuando alguien complete el formulario de demo, aparece acá al instante.</div>`;
      return;
    }
    if (!list.length) {
      $('#leadsAdmin').innerHTML = '<div class="empty"><span class="big">🗂️</span>No hay consultas en este estado.</div>';
      return;
    }

    $('#leadsAdmin').innerHTML = `<div class="leads-grid">${list.map((l) => {
      const st = LEAD_STATUS[l.status] || LEAD_STATUS.nuevo;
      const wa = waLink(l);
      const mail = mailLink(l);
      const meta = [
        l.zone ? `📍 ${escapeHtml(l.zone)}` : '',
        l.tablesCount ? `🪑 ${escapeHtml(l.tablesCount)} mesas` : '',
        l.planInterest ? `🎯 ${escapeHtml(l.planInterest)}` : '',
      ].filter(Boolean);
      return `<article class="lead-card st-${escapeHtml(l.status)}">
        <div class="lead-head">
          <div style="min-width:0">
            <strong class="lead-title">${escapeHtml(l.restaurantName || l.name)}</strong>
            ${l.restaurantName && l.name ? `<div class="muted">${escapeHtml(l.name)}</div>` : ''}
          </div>
          <div style="text-align:right;flex:none">
            <span class="chip ${st.cls}">${st.label}</span>
            <div class="lead-time">${leadDate(l.createdAt)}</div>
          </div>
        </div>
        ${meta.length ? `<div class="lead-meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>` : ''}
        ${l.message ? `<p class="lead-msg">${escapeHtml(l.message)}</p>` : ''}
        <div class="lead-contact">
          <code>${escapeHtml(l.contact)}</code>
          <button class="btn btn-xs btn-ghost" type="button" data-lead-copy="${escapeHtml(l.id)}" title="Copiar contacto">📋 Copiar</button>
        </div>
        <div class="lead-actions">
          ${wa ? `<a class="btn btn-sm btn-ok" href="${escapeHtml(wa)}" target="_blank" rel="noopener" data-lead-reply="${escapeHtml(l.id)}">💬 Responder por WhatsApp</a>` : ''}
          ${mail ? `<a class="btn btn-sm btn-ghost" href="${escapeHtml(mail)}" data-lead-reply="${escapeHtml(l.id)}">✉️ Responder por correo</a>` : ''}
          <div class="pill-group lead-status" role="group" aria-label="Estado de la consulta">
            ${['nuevo', 'contactado', 'piloto'].map((s) => `<button type="button" class="pill ${l.status === s ? 'active' : ''}" data-lead-status="${s}" data-lid="${escapeHtml(l.id)}">${LEAD_STATUS[s].label}</button>`).join('')}
          </div>
          ${l.status === 'descartado'
            ? `<button class="btn btn-xs btn-ghost" type="button" data-lead-status="nuevo" data-lid="${escapeHtml(l.id)}">↺ Reabrir</button>`
            : `<button class="btn btn-xs btn-ghost" type="button" data-lead-status="descartado" data-lid="${escapeHtml(l.id)}" title="Descartar consulta">Descartar</button>`}
        </div>
      </article>`;
    }).join('')}</div>`;
  }

  async function setLeadStatus(leadId, status, quiet = false) {
    const res = await act('lead.status', { leadId, status });
    if (res && !quiet) toast(`✔ Consulta marcada como ${LEAD_STATUS[status]?.label || status}`);
    return res;
  }

  // ---------- Barra derecha + Pestaña móvil: Solicitudes en vivo ----------
  function buildCallsHtml(pending) {
    if (!pending.length) {
      return '<div class="empty"><span class="big">☕</span>Sin solicitudes pendientes.<br>Todo tranquilo en el salón.</div>';
    }
    return pending.map((c) => {
      if (c.type === 'mozo') {
        return `<div class="call mozo">
          <div class="call-head"><strong>🙋 Mesa ${escapeHtml(c.tableCode)} (${escapeHtml(c.blockName)})</strong><small>${timeAgo(c.createdAt)}</small></div>
          <p>Motivo: <strong>${escapeHtml(c.reason)}</strong><br>Mozo: <strong>${escapeHtml(c.waiterName || 'Sin asignar')}</strong> ${c.status === 'en_camino' ? '· 🏃 En camino' : ''}</p>
          <div class="call-actions">
            ${c.status === 'pendiente' ? `<button class="btn btn-xs" type="button" data-call-way="${escapeHtml(c.id)}">En camino</button>` : ''}
            <button class="btn btn-xs" type="button" data-call-done="${escapeHtml(c.id)}">Atendido</button>
          </div>
        </div>`;
      }
      const cash = Math.max(0, Number(c.cashAmount) || 0);
      const splitWays = Math.max(1, Number(c.splitWays) || 1);
      const total = Number(c.total) || 0;
      const splitNote = splitWays > 1 ? ` · ÷ ${splitWays} (${money(Math.ceil(total / splitWays))} c/u)` : '';
      const cashNote = c.payment === 'Efectivo' && cash > total
        ? `<span class="r-change-badge">💵 Abona con ${money(cash)} -&gt; Llevar ${money(cash - total)} de vuelto</span><br>`
        : c.payment === 'Efectivo' && cash === total && total > 0
        ? `<span class="r-change-badge" style="background:var(--ok-soft);color:var(--ok)">💵 Importe justo</span><br>`
        : '';
      return `<div class="call cuenta">
        <div class="call-head"><strong>💳 Mesa ${escapeHtml(c.tableCode)} (${escapeHtml(c.blockName)})</strong><small>${timeAgo(c.createdAt)}</small></div>
        <p>Paga con <strong>${escapeHtml(c.payment)}</strong> · Propina ${c.tip}% -&gt; <strong>${money(total)}</strong>${splitNote}<br>${cashNote}Mozo: <strong>${escapeHtml(c.waiterName || 'Sin asignar')}</strong> ${c.status === 'en_camino' ? '· 🏃 Llevando cobro' : ''}</p>
        <div class="call-actions">
          ${c.status === 'pendiente' ? `<button class="btn btn-xs" type="button" data-call-way="${escapeHtml(c.id)}">Llevando cobro</button>` : ''}
          <button class="btn btn-xs btn-primary" type="button" data-open-bill="${escapeHtml(c.tableId)}">Ver cuenta y cerrar</button>
        </div>
      </div>`;
    }).join('');
  }

  function renderCalls() {
    const pending = state.calls.slice().reverse();
    $('#callCount').hidden = !pending.length;
    $('#callCount').textContent = pending.length;
    const mobBadge = $('#navCallsMob');
    if (mobBadge) {
      mobBadge.hidden = !pending.length;
      mobBadge.textContent = pending.length;
    }
    const html = buildCallsHtml(pending);
    $('#calls').innerHTML = html;
    const mobEl = $('#callsMobile');
    if (mobEl) mobEl.innerHTML = html;
  }

  // ---------- Modales ----------
  function openModal(html, onMount) {
    $('#modal').innerHTML = html;
    $('#modalBackdrop').hidden = false;
    onMount?.($('#modal'));
  }

  function closeModal() {
    openTableModalId = null;
    tableModalDraft.tableId = null;
    tableModalDraft.dirty = false;
    $('#modalBackdrop').hidden = true;
  }

  function renderTableOperationalModal(tableId, fromSse = false) {
    const t = state.tables.find((x) => x.id === tableId);
    if (!t) return closeModal();

    const prevOpenId = openTableModalId;
    openTableModalId = tableId;
    if (prevOpenId !== tableId) {
      tableModalDraft.tableId = tableId;
      tableModalDraft.dirty = false;
    }

    const blk = state.blocks.find((b) => b.id === t.blockId);
    const tOrders = state.orders.filter((o) => o.isOpenSession && o.tableId === t.id);
    const activeOrders = tOrders.filter((o) => o.status !== 'cancelado');
    const pendingDelivery = activeOrders.filter((o) => o.status !== 'entregado').length;
    const billCall = state.calls.find((c) => c.tableId === t.id && c.type === 'cuenta');

    const grouped = [];
    activeOrders.forEach((o) => o.items.forEach((i) => {
      const key = `${i.name}::${i.price}`;
      let g = grouped.find((x) => x.key === key);
      if (!g) { g = { key, name: i.name, price: i.price, qty: 0 }; grouped.push(g); }
      g.qty += i.qty;
    }));

    const sub = t.subtotal || 0;
    // Preservar selecciones abiertas ante SSE; default de propina no solicitada = 0%
    let chosenPay = (fromSse && tableModalDraft.dirty && tableModalDraft.tableId === tableId)
      ? tableModalDraft.pay
      : (billCall?.payment || 'Tarjeta');
    let chosenTip = (fromSse && tableModalDraft.dirty && tableModalDraft.tableId === tableId)
      ? tableModalDraft.tip
      : (billCall?.tip ?? 0);

    const cashAmount = Math.max(0, Number(billCall?.cashAmount) || 0);
    const splitWays = Math.max(1, Number(billCall?.splitWays) || 1);
    const initGrand = sub + Math.round((sub * chosenTip) / 100);

    const formatModalBillExtra = (payMethod, grandVal) => {
      const notes = [];
      if (splitWays > 1) {
        notes.push(`<div style="font-size:13px;font-weight:700;color:var(--ink-2)">÷ Cuenta dividida entre ${splitWays} personas: <strong>${money(Math.ceil(grandVal / splitWays))} c/u</strong></div>`);
      }
      if (payMethod === 'Efectivo' && cashAmount > grandVal) {
        notes.push(`<div class="r-change-badge" style="font-size:13px">💵 Abona con ${money(cashAmount)} -&gt; Llevar <strong>${money(cashAmount - grandVal)}</strong> de vuelto</div>`);
      } else if (payMethod === 'Efectivo' && cashAmount === grandVal && grandVal > 0) {
        notes.push(`<div class="r-change-badge" style="background:var(--ok-soft);color:var(--ok);font-size:13px">💵 Abona con importe justo (${money(grandVal)})</div>`);
      }
      return notes.join('');
    };

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
          <label for="reassignWaiterSel">Mozo atendiendo esta mesa</label>
          <select class="input" id="reassignWaiterSel">
            <option value="" ${!t.waiterId ? 'selected' : ''}>-- Sin mozo asignado --</option>
            ${state.waiters.map((w) => `<option value="${escapeHtml(w.id)}" ${w.id === t.waiterId ? 'selected' : ''}>${escapeHtml(w.name)} ${w.available ? '(En turno)' : '(Fuera de turno)'}</option>`).join('')}
          </select>
        </div>

        <div style="border-top:1px solid var(--line);padding-top:8px">
          ${grouped.length
            ? grouped.map((g) => `<div class="bill-line"><span>${g.qty} × ${escapeHtml(g.name)} <small class="muted">(${money(g.price)} c/u)</small></span><span>${money(g.price * g.qty)}</span></div>`).join('')
            : '<p class="muted">Mesa abierta sin ítems activos.</p>'}
          <div class="bill-total"><span>Subtotal actual</span><span>${money(sub)}</span></div>
        </div>

        ${pendingDelivery ? `<div style="background:var(--warn-soft);color:var(--warn);padding:10px 12px;border-radius:10px;font-size:13px;font-weight:700;margin-top:10px">⚠️ Hay ${pendingDelivery} comanda(s) que todavía figuran sin entregar.</div>` : ''}

        <div class="two" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
          <div class="field">
            <label for="mPaySel">Medio de pago</label>
            <select class="input" id="mPaySel">${['Efectivo', 'Tarjeta', 'QR', 'Transferencia'].map((p) => `<option value="${p}" ${p === chosenPay ? 'selected' : ''}>${p}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label for="mTipSel">Propina</label>
            <select class="input" id="mTipSel">${[0, 5, 10, 15].map((p) => `<option value="${p}" ${p === chosenTip ? 'selected' : ''}>${p}% (${money(Math.round((sub * p) / 100))})</option>`).join('')}</select>
          </div>
        </div>
        <div id="mExtraBillInfo" style="margin-top:8px">${formatModalBillExtra(chosenPay, initGrand)}</div>
        <div class="bill-total" style="margin-top:10px"><span>Total a cobrar</span><span id="mGrandTotal">${money(initGrand)}</span></div>
      ` : '<p class="muted" style="margin:16px 0">La mesa está libre. Se abrirá y asignará mozo en cuanto el cliente escanee el QR y pida, o si cargás un pedido manual.</p>'}

      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" data-cancel>Cerrar ventana</button>
        <button class="btn btn-ghost" type="button" id="manualOrderBtn">+ Pedido manual</button>
        ${t.sessionId ? `<button class="btn btn-primary" type="button" id="confirmCloseTableBtn">Cobrar y cerrar mesa</button>` : ''}
      </div>`, (el) => {
      const rw = el.querySelector('#reassignWaiterSel');
      if (rw) {
        rw.onchange = async () => {
          const wantedWid = rw.value;
          const ok = await act('session.reassign', { tableId: t.id, waiterId: wantedWid });
          if (ok) {
            toast(wantedWid
              ? `🪑 Mesa ${t.code} asignada a ${ok.result?.waiterName || 'mozo'}`
              : `🪑 Mesa ${t.code} dejada sin mozo asignado`);
          } else {
            rw.value = t.waiterId || '';
          }
        };
      }

      const paySel = el.querySelector('#mPaySel');
      const tipSel = el.querySelector('#mTipSel');
      const syncDraftAndTotals = () => {
        const p = paySel ? paySel.value : chosenPay;
        const tipPct = tipSel ? Number(tipSel.value) : chosenTip;
        tableModalDraft.tableId = t.id;
        tableModalDraft.pay = p;
        tableModalDraft.tip = tipPct;
        tableModalDraft.dirty = true;
        const grandVal = sub + Math.round((sub * tipPct) / 100);
        const totEl = el.querySelector('#mGrandTotal');
        if (totEl) totEl.textContent = money(grandVal);
        const exEl = el.querySelector('#mExtraBillInfo');
        if (exEl) exEl.innerHTML = formatModalBillExtra(p, grandVal);
      };
      paySel?.addEventListener('change', syncDraftAndTotals);
      tipSel?.addEventListener('change', syncDraftAndTotals);

      el.querySelector('#manualOrderBtn').onclick = () => openQuickManualOrderModal(t);
      const closeBtn = el.querySelector('#confirmCloseTableBtn');
      if (closeBtn) {
        closeBtn.onclick = async () => {
          let force = false;
          if (pendingDelivery > 0) {
            if (!confirm(`Todavía hay ${pendingDelivery} pedido(s) sin entregar en la Mesa ${t.code}. ¿Marcarlos como entregados y cerrar la cuenta igual?`)) return;
            force = true;
          }
          const pay = paySel?.value || 'Efectivo';
          const tip = Number(tipSel?.value || 0);
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
          <select class="input" name="itemId">${availItems.map((i) => `<option value="${escapeHtml(i.id)}">${i.emoji} ${escapeHtml(i.name)} (${money(i.price)} · ${stationInfo(i.effectiveStation).short})</option>`).join('')}</select>
        </div>
        <div class="two">
          <div class="field"><label>Cantidad</label><input class="input" type="number" name="qty" min="1" max="30" value="1" required></div>
          <div class="field"><label>Aclaración</label><input class="input" name="note" maxlength="100" placeholder="Opcional"></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-primary" type="submit">Enviar comanda</button>
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
              ${templates.map((t) => `<button type="button" class="tpl-btn ${t.id === selectedTpl.id ? 'sel' : ''}" data-tpl="${escapeHtml(t.id)}"><span>${t.icon}</span><span>${escapeHtml(t.name)}</span></button>`).join('')}
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
                <input type="checkbox" name="waiterId" value="${escapeHtml(w.id)}" ${block?.waiterIds?.includes(w.id) ? 'checked' : ''}>
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
          <button class="btn btn-primary" type="submit">${block ? 'Guardar cambios' : 'Crear bloque y mesas'}</button>
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
          <select class="input" name="blockId">${state.blocks.map((b) => `<option value="${escapeHtml(b.id)}" ${b.id === cur.blockId ? 'selected' : ''}>${b.icon} ${escapeHtml(b.name)}</option>`).join('')}</select>
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
          <button class="btn btn-primary" type="submit">${isEdit ? 'Guardar' : 'Crear mesa'}</button>
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
          if (!confirm(`¿Eliminar la Mesa ${tbl.code}? (Si tiene historial de arqueo se conservará en los reportes).`)) return;
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
          <div class="field">
            <label>PIN celular (opcional, 4 a 6 dígitos)</label>
            <input class="input" name="pin" id="wfPinInput" inputmode="numeric" maxlength="6" placeholder="${w?.hasPin ? 'Dejar vacío = mantener PIN actual' : 'Opcional'}">
          </div>
        </div>
        ${w?.hasPin ? `
          <label style="display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--ink-2);cursor:pointer">
            <input type="checkbox" name="clearPin" id="wfClearPin" style="width:16px;height:16px;accent-color:var(--accent)">
            Quitar PIN actual (permitir ingreso sin PIN individual)
          </label>` : ''}
        <div class="field">
          <label>Color identificador</label>
          <div class="color-pick">${COLORS.map((c) => `<button type="button" class="color-swatch ${c === color ? 'sel' : ''}" data-col="${c}" style="background:${c}"></button>`).join('')}</div>
        </div>
        <div class="field">
          <label>Pre-asignar a bloques específicos (opcional)</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;padding:10px;background:var(--surface-2);border-radius:10px">
            ${state.blocks.map((b) => `
              <label style="display:inline-flex;align-items:center;gap:6px;font-weight:600;cursor:pointer">
                <input type="checkbox" name="blockId" value="${escapeHtml(b.id)}" ${cur.blockIds?.includes(b.id) ? 'checked' : ''}>
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
          <button class="btn btn-primary" type="submit">${w ? 'Guardar cambios' : 'Agregar mozo'}</button>
        </div>
      </form>`, (el) => {
      const clrChk = el.querySelector('#wfClearPin');
      const pinInp = el.querySelector('#wfPinInput');
      if (clrChk && pinInp) {
        clrChk.onchange = () => {
          if (clrChk.checked) {
            pinInp.value = '';
            pinInp.disabled = true;
          } else {
            pinInp.disabled = false;
          }
        };
      }
      el.querySelectorAll('[data-col]').forEach((b) => b.onclick = () => {
        color = b.dataset.col;
        el.querySelectorAll('[data-col]').forEach((x) => x.classList.toggle('sel', x === b));
      });
      el.querySelector('#waiterForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const clearPin = Boolean(clrChk && clrChk.checked);
        const res = await act('waiter.save', {
          id: w?.id,
          name: f.get('name').trim(),
          pin: clearPin ? '' : (f.get('pin') || '').trim(),
          clearPin,
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
          <div class="field"><label>Nombre (ej: Pastas, Tragos, Sushi, Parrilla)</label><input class="input" name="name" required maxlength="40" value="${escapeHtml(cur.name)}"></div>
          <div class="field"><label>Ícono / Emoji</label><input class="input" name="icon" maxlength="8" value="${escapeHtml(cur.icon)}"></div>
        </div>
        <div class="field">
          <label>¿Adónde entran directo los pedidos de esta categoría?</label>
          <select class="input" name="station">
            <option value="cocina" ${cur.station === 'cocina' ? 'selected' : ''}>🍳 Directo a Cocina</option>
            <option value="barra" ${cur.station === 'barra' ? 'selected' : ''}>🍸 Directo a Barra</option>
            <option value="mostrador" ${cur.station === 'mostrador' ? 'selected' : ''}>🍣 Directo a Mostrador / Sushi / Parrilla</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-primary" type="submit">${cat ? 'Guardar' : 'Crear categoría'}</button>
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
    const it = item || { name: '', desc: '', price: '', cat: state.categories[0].id, emoji: '🍜', imageUrl: '', stationOverride: '', available: true, popular: false, tags: [] };
    const itTags = Array.isArray(it.tags) ? it.tags : [];
    let emoji = it.emoji;
    let uploadedDataUrl = '';

    openModal(`
      <h3>${item ? 'Editar producto' : 'Nuevo plato / bebida'}</h3>
      <form class="form" id="itemForm">
        <div class="field"><label>Nombre</label><input class="input" name="name" required maxlength="50" value="${escapeHtml(it.name)}"></div>
        <div class="field"><label>Descripción</label><input class="input" name="desc" maxlength="140" value="${escapeHtml(it.desc)}"></div>
        <div class="two">
          <div class="field"><label>Precio ($)</label><input class="input" name="price" type="number" min="0" step="50" required value="${it.price}"></div>
          <div class="field"><label>Categoría</label><select class="input" name="cat">${state.categories.map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === it.cat ? 'selected' : ''}>${c.icon} ${escapeHtml(c.name)} (${stationInfo(c.station).short})</option>`).join('')}</select></div>
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
            <option value="mostrador" ${it.stationOverride === 'mostrador' ? 'selected' : ''}>🍣 Forzar Mostrador / Sushi / Parrilla</option>
          </select>
        </div>
        <div class="field">
          <label>Etiquetas dietarias (se muestran y filtran en la carta QR)</label>
          <div class="tag-checks">
            ${ITEM_TAG_OPTIONS.map(([id, label]) => `<label class="tag-check"><input type="checkbox" name="tags" value="${id}" ${itTags.includes(id) ? 'checked' : ''}><span>${label}</span></label>`).join('')}
          </div>
        </div>
        <label class="switch"><input type="checkbox" name="popular" ${it.popular ? 'checked' : ''}><span class="track"></span>Destacar como “Popular”</label>
        <label class="switch"><input type="checkbox" name="available" ${it.available ? 'checked' : ''}><span class="track"></span>Disponible hoy</label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-primary" type="submit">${item ? 'Guardar cambios' : 'Agregar al menú'}</button>
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
          tags: f.getAll('tags'),
        });
        if (ok) {
          closeModal();
          toast(item ? 'Producto actualizado' : '✔ Producto agregado al menú');
        }
      };
    });
  }

  async function undoLastBulkPrice(btn = null) {
    const bk = getPriceBackup();
    const hasServerUndo = Boolean(state?.restaurant?.canUndoPrices);
    const hasLocalUndo = Boolean(bk && Array.isArray(bk.items) && bk.items.length);
    if (!hasServerUndo && !hasLocalUndo) {
      toast('No hay ajuste previo para deshacer');
      return false;
    }
    const desc = bk?.label ? ` (${bk.label})` : '';
    if (!confirm(`¿Deshacer el último ajuste porcentual de precios${desc} y restaurar los valores anteriores?`)) {
      return false;
    }
    if (btn) btn.disabled = true;
    const payload = hasServerUndo ? {} : { prices: bk.items };
    const res = await act('price.undo', payload);
    if (btn) btn.disabled = false;
    if (res) {
      savePriceBackup(null);
      toast(`↩ Deshecho: se restauraron ${res.result?.restored || bk?.items?.length || 0} precio(s) exactos`);
      return true;
    }
    return false;
  }

  function openBulkPriceModal() {
    openTableModalId = null;
    const existingBackup = getPriceBackup();
    const canUndo = Boolean(state?.restaurant?.canUndoPrices || (existingBackup && existingBackup.items?.length));

    openModal(`
      <h3>📈 Actualizar precios por porcentaje</h3>
      <form class="form" id="bulkForm">
        <div class="field">
          <label for="bulkCat">Aplicar sobre</label>
          <select class="input" name="categoryId" id="bulkCat">
            <option value="">Toda la carta (${state.items.length} productos)</option>
            ${state.categories.map((c) => `<option value="${escapeHtml(c.id)}">${c.icon} Solo ${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="two">
          <div class="field"><label for="bulkPct">Porcentaje (ej: 10 o -5)</label><input class="input" type="number" name="percent" id="bulkPct" step="0.5" value="10" required placeholder="10"></div>
          <div class="field">
            <label for="bulkRound">Redondear precios a múltiplo de</label>
            <select class="input" name="roundTo" id="bulkRound">
              <option value="100" selected>$100</option>
              <option value="50">$50</option>
              <option value="10">$10</option>
              <option value="1">$1 (exacto)</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label id="bulkPreviewTitle">Vista previa Antes / Después</label>
          <div class="preview-box" id="bulkPreviewBox"></div>
        </div>
        <div class="modal-actions">
          ${canUndo ? `<button type="button" class="btn btn-ghost" id="bulkUndoBtn" style="margin-right:auto">↩ Deshacer último ajuste</button>` : ''}
          <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-primary" type="submit" id="bulkApplyBtn">Aplicar ajuste</button>
        </div>
      </form>`, (el) => {
      const catSel = el.querySelector('#bulkCat');
      const pctInp = el.querySelector('#bulkPct');
      const rndSel = el.querySelector('#bulkRound');
      const prevBox = el.querySelector('#bulkPreviewBox');
      const prevTitle = el.querySelector('#bulkPreviewTitle');
      const applyBtn = el.querySelector('#bulkApplyBtn');

      const updatePreview = () => {
        const cid = catSel.value;
        const pct = Number(pctInp.value || 0);
        const roundTo = Math.max(1, Number(rndSel.value || 100));
        const targetItems = cid ? state.items.filter((i) => i.cat === cid) : state.items;

        if (!pct || pct < -90 || pct > 500 || !targetItems.length) {
          prevTitle.textContent = 'Vista previa Antes / Después';
          prevBox.innerHTML = '<p class="muted" style="padding:8px 0">Ingresá un porcentaje distinto de 0% (entre -90% y +500%) para ver los nuevos precios.</p>';
          applyBtn.disabled = true;
          return;
        }
        applyBtn.disabled = false;
        const sign = pct > 0 ? `+${pct}%` : `${pct}%`;
        prevTitle.textContent = `Vista previa (${targetItems.length} producto${targetItems.length === 1 ? '' : 's'} · ${sign})`;
        applyBtn.textContent = `Aplicar ${sign} a ${targetItems.length} ítems`;

        const factor = 1 + pct / 100;
        prevBox.innerHTML = targetItems.map((i) => {
          const newPrice = Math.round(Math.max(0, i.price * factor) / roundTo) * roundTo;
          return `<div class="preview-row">
            <span>${i.emoji || ''} ${escapeHtml(i.name)}</span>
            <span class="preview-old">${money(i.price)}</span>
            <span class="preview-new">${money(newPrice)}</span>
          </div>`;
        }).join('');
      };

      catSel.onchange = updatePreview;
      pctInp.oninput = updatePreview;
      rndSel.onchange = updatePreview;
      updatePreview();

      const undoBtn = el.querySelector('#bulkUndoBtn');
      if (undoBtn) {
        undoBtn.onclick = async () => {
          if (await undoLastBulkPrice(undoBtn)) closeModal();
        };
      }

      el.querySelector('#bulkForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const cid = f.get('categoryId');
        const pct = Number(f.get('percent'));
        const roundTo = Number(f.get('roundTo'));
        const affected = cid ? state.items.filter((i) => i.cat === cid) : state.items;
        const catObj = cid ? state.categories.find((c) => c.id === cid) : null;
        const snapshot = {
          ts: Date.now(),
          label: `${pct > 0 ? '+' : ''}${pct}% en ${catObj ? catObj.name : 'toda la carta'}`,
          items: affected.map((i) => ({ id: i.id, price: i.price })),
        };

        const res = await act('menu.adjust_prices', {
          categoryId: cid,
          percent: pct,
          roundTo,
        });
        if (res) {
          savePriceBackup(snapshot);
          closeModal();
          toast(`📈 Se actualizaron ${res.result?.updated || affected.length} precios al instante`);
        }
      };
    });
  }

  // ---------- Eventos delegados ----------
  const VIEW_HASH = {
    pedidos: '#comandas',
    solicitudes: '#solicitudes',
    mesas: '#salon',
    mozos: '#mozos',
    menu: '#menu',
    caja: '#caja',
    leads: '#consultas',
  };

  function setView(next) {
    if (!document.getElementById(`view-${next}`)) return;
    view = next;
    document.querySelectorAll('.nav-item').forEach((x) => x.classList.toggle('active', x.dataset.view === view));
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${view}`; });
    try { history.replaceState(null, '', `${location.pathname}${location.search}${VIEW_HASH[view] || ''}`); } catch (_) {}
  }

  function bindPanelEvents() {
    document.querySelector('.nav').onclick = (e) => {
      const b = e.target.closest('[data-view]');
      if (!b) return;
      setView(b.dataset.view);
    };
    const hashView = {
      '#comandas': 'pedidos',
      '#solicitudes': 'solicitudes',
      '#salon': 'mesas',
      '#mozos': 'mozos',
      '#menu': 'menu',
      '#caja': 'caja',
      '#consultas': 'leads',
    }[location.hash];
    if (hashView) setView(hashView);

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
      if (e.target.closest('a')) return;
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
    $('#undoPriceHeaderBtn').onclick = (e) => undoLastBulkPrice(e.currentTarget);

    $('#menuAdmin').onchange = (e) => {
      const t = e.target.closest('[data-itoggle]');
      if (t) act('item.toggle', { id: t.dataset.itoggle, itemId: t.dataset.itoggle, available: t.checked });
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

    const handleCallsClick = (e) => {
      const w = e.target.closest('[data-call-way]');
      if (w) act('call.status', { id: w.dataset.callWay, status: 'en_camino' });
      const d = e.target.closest('[data-call-done]');
      if (d) act('call.status', { id: d.dataset.callDone, status: 'atendida' });
      const b = e.target.closest('[data-open-bill]');
      if (b) renderTableOperationalModal(b.dataset.openBill);
    };
    $('#calls').onclick = handleCallsClick;
    $('#callsMobile').onclick = handleCallsClick;

    $('#modalBackdrop').onclick = (e) => {
      if (e.target.id === 'modalBackdrop' || e.target.closest('[data-cancel]')) closeModal();
    };
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    // Arqueo CSV y controles de túnel 4G/5G
    $('#csvAllBtn').onclick = (e) => downloadSessionsCsv('all', e.currentTarget);
    $('#csvTodayBtn').onclick = (e) => downloadSessionsCsv('today', e.currentTarget);
    const handleNetActionClick = async (e) => {
      const startBtn = e.target.closest('[data-tunnel-start]');
      if (startBtn) return startTunnel(startBtn.dataset.tunnelStart === 'install');
      const stopBtn = e.target.closest('[data-tunnel-stop]');
      if (stopBtn) return stopTunnel();
      const copyBtn = e.target.closest('[data-net-copy]');
      if (copyBtn) {
        const val = copyBtn.dataset.netCopy;
        try {
          await navigator.clipboard.writeText(val);
          toast('📋 Dirección HTTPS copiada');
        } catch (_) {
          prompt('Copiá la dirección pública:', val);
        }
        return;
      }
      if (e.target.closest('[data-goto-caja]')) {
        setView('caja');
        setTimeout(() => document.querySelector('#restConfigForm input[name="publicUrl"]')?.focus(), 40);
      }
    };
    $('#netBar').onclick = handleNetActionClick;
    $('#cajaAdmin').addEventListener('click', (e) => {
      const b = e.target.closest('[data-csv]');
      if (b) return downloadSessionsCsv(b.dataset.csv, b);
      handleNetActionClick(e);
    });

    // Consultas comerciales
    $('#leadFilter').onclick = (e) => {
      const b = e.target.closest('[data-lf]');
      if (!b) return;
      leadFilter = b.dataset.lf;
      renderLeads();
    };
    $('#leadsAdmin').onclick = async (e) => {
      const stBtn = e.target.closest('[data-lead-status]');
      if (stBtn) {
        if (stBtn.classList.contains('active')) return;
        stBtn.disabled = true;
        await setLeadStatus(stBtn.dataset.lid, stBtn.dataset.leadStatus);
        return;
      }
      const copy = e.target.closest('[data-lead-copy]');
      if (copy) {
        const lead = (state.leads || []).find((l) => l.id === copy.dataset.leadCopy);
        if (!lead) return;
        try {
          await navigator.clipboard.writeText(lead.contact);
          toast('📋 Contacto copiado');
        } catch (_) {
          prompt('Copiá el contacto:', lead.contact);
        }
        return;
      }
      const reply = e.target.closest('[data-lead-reply]');
      if (reply) {
        const lead = (state.leads || []).find((l) => l.id === reply.dataset.leadReply);
        if (lead && lead.status === 'nuevo') {
          setLeadStatus(lead.id, 'contactado', true).then((r) => { if (r) toast('✔ Marcada como Contactado'); });
        }
      }
    };
  }

  function renderAll() {
    $('#restName').textContent = state.restaurant.name;
    renderNetBar();
    renderKpis();
    renderBoard();
    renderSalon();
    renderWaiters();
    renderMenuAdmin();
    renderCaja();
    renderLeads();
    renderCalls();
  }

  await tryBoot();
})();
