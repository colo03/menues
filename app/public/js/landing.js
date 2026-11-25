/* SaleListo · Landing Page Comercial
   Interacciones: navbar, aparición al scroll, videos, spot, pestañas,
   balanceo, calculadora ROI con deep-links y moneda sincronizada, acordeón y captura de leads. */
(function () {
  'use strict';

  var WA_NUMBER = '541138436571';
  var SALES_EMAIL = 'ventas@salelisto.com';
  var USD_ARS = 1615;
  var FX_META = { rate: USD_ARS, source: 'Dólar oficial venta', updatedAt: '', live: false };
  var FX_CACHE_KEY = 'salelisto:fx_usd_ars_v1';
  var FX_CACHE_MS = 15 * 60 * 1000;

  function roundArs(val) {
    return Math.round(val / 100) * 100;
  }

  var PLAN_COST = [
    { max: 12, name: 'Barra / Café', usd: 75, ars: roundArs(75 * USD_ARS) },
    { max: 30, name: 'Salón / Bistró', usd: 139, ars: roundArs(139 * USD_ARS) },
    { max: Infinity, name: 'Gran Salón / Multisede', usd: 239, ars: roundArs(239 * USD_ARS) }
  ];

  function syncPlanCosts() {
    PLAN_COST.forEach(function (p) { p.ars = roundArs(p.usd * USD_ARS); });
  }

  var currentCur = 'ars';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  var hasIO = 'IntersectionObserver' in window;

  // Compatibilidad con enlaces antiguos /?mesas=...#roi -> planes.html
  if (location.hash === '#roi' && !document.getElementById('roi-tables')) {
    location.replace('planes.html' + location.search + '#roi');
    return;
  }

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function fmtNum(n) { return Math.round(n).toLocaleString('es-AR'); }
  function fmtARS(n) { return 'ARS ' + fmtNum(n); }
  function fmtUSD(n) { return 'USD ' + fmtNum(n); }
  function fmtMoney(arsVal) {
    return currentCur === 'usd' ? fmtUSD(arsVal / USD_ARS) : fmtARS(arsVal);
  }

  /* ---------- 1. Navbar ---------- */
  var nav = $('#nav');
  var burger = $('#nav-burger');
  var waFloat = $('.wa-float');

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (nav) nav.classList.toggle('is-scrolled', y > 24);
    if (waFloat) waFloat.classList.toggle('is-visible', y > window.innerHeight * 0.6);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function closeMenu() {
    if (!nav) return;
    nav.classList.remove('is-open');
    if (burger) { burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Abrir menú'); }
  }
  if (burger) {
    burger.addEventListener('click', function () {
      var open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
  }
  $all('#nav-links a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  document.addEventListener('click', function (e) {
    if (nav && nav.classList.contains('is-open') && !nav.contains(e.target)) closeMenu();
  });

  // Sección activa en la navegación
  var navLinks = $all('.nav-links > a[href^="#"]');
  if (hasIO && navLinks.length) {
    var linkById = {};
    navLinks.forEach(function (a) { linkById[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && linkById[en.target.id]) {
          navLinks.forEach(function (a) { a.classList.remove('is-active'); });
          linkById[en.target.id].classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(linkById).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ---------- 2. Aparición al scroll (sutil y rápida en desktop, inmediata en celular) ---------- */
  var reveals = $all('.reveal');
  if (isMobile || !hasIO || reduceMotion) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    reveals.forEach(function (el) {
      var sibs = el.parentElement ? $all(':scope > .reveal', el.parentElement) : [];
      var i = sibs.indexOf(el);
      if (i > 0) el.style.setProperty('--d', Math.min(i, 2) * 25 + 'ms');
    });
    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    var pending = [];
    reveals.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < vh * 1.25) {
        el.classList.add('is-in');
      } else {
        pending.push(el);
      }
    });
    if (pending.length) {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting || en.boundingClientRect.top < (window.innerHeight || 800) + 220) {
            en.target.classList.add('is-in');
            ro.unobserve(en.target);
          }
        });
      }, { rootMargin: '0px 0px 260px 0px', threshold: 0 });
      pending.forEach(function (el) { ro.observe(el); });
      var revealCheck = function () {
        var lim = (window.innerHeight || 800) + 240;
        for (var k = pending.length - 1; k >= 0; k--) {
          if (pending[k].getBoundingClientRect().top < lim) {
            pending[k].classList.add('is-in');
            ro.unobserve(pending[k]);
            pending.splice(k, 1);
          }
        }
        if (!pending.length) window.removeEventListener('scroll', revealCheck);
      };
      window.addEventListener('scroll', revealCheck, { passive: true });
    }
  }

  /* ---------- 3. Videos de fondo ---------- */
  function markMissing(video) {
    var host = video.closest('.media-frame, .hero-media, .phone');
    if (host) host.classList.add(host.classList.contains('phone') ? 'is-missing' : 'media-missing');
  }
  function watchErrors(video) {
    var srcs = $all('source', video);
    var last = srcs[srcs.length - 1];
    if (last) last.addEventListener('error', function () { markMissing(video); });
    video.addEventListener('error', function () { markMissing(video); });
  }

  var hero = $('.hero-media .bg-video');
  if (hero) {
    watchErrors(hero);
    if (reduceMotion) { hero.removeAttribute('autoplay'); hero.pause(); }
  }

  var lazyVideos = $all('.lazy-video');
  function loadVideo(v) {
    if (v.dataset.loaded) return;
    $all('source[data-src]', v).forEach(function (s) { s.src = s.getAttribute('data-src'); });
    watchErrors(v);
    v.dataset.loaded = '1';
    v.load();
  }
  function safePlay(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }

  if (hasIO) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) {
          loadVideo(v);
          if (!reduceMotion) safePlay(v);
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { rootMargin: '200px 0px', threshold: 0.1 });
    lazyVideos.forEach(function (v) { vo.observe(v); });
    if (hero && !reduceMotion) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) safePlay(hero); else hero.pause(); });
      }).observe(hero);
    }
  } else {
    lazyVideos.forEach(function (v) { loadVideo(v); if (!reduceMotion) safePlay(v); });
  }

  /* ---------- 4. Spot vertical con sonido (preload metadata + sin reiniciar al desmutear) ---------- */
  var spot = $('#spot-video');
  var spotSound = $('#spot-sound');
  var spotPlay = $('#spot-play');
  var spotProg = $('#spot-progress');
  if (spot) {
    watchErrors(spot);
    if (reduceMotion) { spot.removeAttribute('autoplay'); spot.pause(); }

    var syncPlayBtn = function () {
      var paused = spot.paused;
      spotPlay.classList.toggle('is-paused', paused);
      spotPlay.setAttribute('aria-label', paused ? 'Reproducir spot' : 'Pausar spot');
    };
    spot.addEventListener('play', syncPlayBtn);
    spot.addEventListener('pause', syncPlayBtn);
    spot.addEventListener('timeupdate', function () {
      if (spot.duration && spotProg) spotProg.style.width = (spot.currentTime / spot.duration * 100) + '%';
    });
    syncPlayBtn();

    spotPlay.addEventListener('click', function () { if (spot.paused) safePlay(spot); else spot.pause(); });

    spotSound.addEventListener('click', function () {
      var label = $('.spot-sound-label', spotSound);
      var ico = $('.spot-sound-ico', spotSound);
      if (spot.muted) {
        var wasRunning = !spot.paused && spot.currentTime > 0 && !spot.ended;
        spot.muted = false;
        if (!wasRunning && spot.ended) {
          spot.currentTime = 0;
        }
        safePlay(spot);
        spotSound.setAttribute('aria-pressed', 'true');
        label.textContent = 'Silenciar';
        ico.textContent = '🔇';
      } else {
        spot.muted = true;
        spotSound.setAttribute('aria-pressed', 'false');
        label.textContent = 'Activar audio';
        ico.textContent = '🔊';
      }
    });

    if (hasIO) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            if (!reduceMotion && (spot.dataset.autoPaused || !spot.dataset.started)) {
              delete spot.dataset.autoPaused;
              spot.dataset.started = '1';
              safePlay(spot);
            }
          } else if (!spot.paused) {
            spot.pause();
            spot.dataset.autoPaused = '1';
          }
        });
      }, { threshold: 0.2 }).observe(spot);
    } else if (!reduceMotion) {
      safePlay(spot);
    }
  }

  /* ---------- 5. Explorador de pantallas (pestañas accesibles) ---------- */
  var tabs = $all('.tab[role="tab"]');
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t, false); });
    t.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') n = tabs[0];
      else if (e.key === 'End') n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); selectTab(n, true); }
    });
  });

  /* ---------- 6. Balanceo por bloques: simulación de corte de turno ---------- */
  var balanceBtn = $('#balance-btn');
  if (balanceBtn) {
    var terraza = $('.blk[data-blk="Terraza"]');
    var tWaiter = $('.waiter', terraza);
    var status = $('#balance-status');
    var msg = $('#balance-msg');
    var reassigned = false;
    var busy = false;
    balanceBtn.addEventListener('click', function () {
      if (busy) return;
      busy = true;
      var delay = reduceMotion ? 0 : 520;
      if (!reassigned) {
        tWaiter.classList.add('is-leaving');
        terraza.classList.add('is-off');
        status.className = 'pill pill-accent';
        status.textContent = 'Martín finalizó su turno';
        msg.textContent = 'Reasignando las 4 mesas activas de Terraza...';
        setTimeout(function () {
          tWaiter.className = 'waiter w3';
          tWaiter.textContent = 'Sofía';
          terraza.classList.remove('is-off');
          status.className = 'pill pill-ok';
          status.textContent = 'Reasignado automáticamente';
          msg.textContent = 'Sofía asume Terraza junto a Vereda para mantener la atención sin interrupciones.';
          balanceBtn.textContent = 'Reiniciar simulación';
          reassigned = true; busy = false;
        }, delay + 700);
      } else {
        tWaiter.classList.add('is-leaving');
        setTimeout(function () {
          tWaiter.className = 'waiter w2';
          tWaiter.textContent = 'Martín';
          status.textContent = '5 sectores en equilibrio';
          msg.textContent = 'Cada mozo opera su sector con carga equilibrada.';
          balanceBtn.textContent = 'Simular: Martín finaliza turno';
          reassigned = false; busy = false;
        }, delay);
      }
    });
  }

  /* ---------- 7. Calculadora ROI (sincronizada con ARS/USD + deep-links B2B) ---------- */
  var rTables = $('#roi-tables');
  var rTicket = $('#roi-ticket');
  var rShifts = $('#roi-shifts');
  var roiCopyBtn = $('#roi-copy-link');
  var roiState = null;

  function clampRange(input, rawVal) {
    var n = Number(rawVal);
    if (!isFinite(n)) return null;
    var min = +input.min;
    var max = +input.max;
    var step = +input.step || 1;
    var clamped = Math.max(min, Math.min(max, n));
    return Math.round(clamped / step) * step;
  }

  function setFill(input) {
    var min = +input.min, max = +input.max, val = +input.value;
    input.style.setProperty('--p', ((val - min) / (max - min) * 100) + '%');
  }
  function planFor(tables) {
    for (var i = 0; i < PLAN_COST.length; i++) if (tables <= PLAN_COST[i].max) return PLAN_COST[i];
    return PLAN_COST[PLAN_COST.length - 1];
  }

  function applyRoiUrlParams() {
    if (!rTables || !rTicket || !rShifts || !('URLSearchParams' in window)) return;
    var qs = new URLSearchParams(location.search);
    var qMesas = qs.get('mesas');
    var qTicket = qs.get('ticket');
    var qTurnos = qs.get('turnos');
    var qMoneda = (qs.get('moneda') || '').toLowerCase();

    if (qMesas !== null) {
      var mVal = clampRange(rTables, qMesas);
      if (mVal !== null) {
        rTables.value = String(mVal);
        var lfTbl = $('#lf-tables');
        if (lfTbl && !lfTbl.value) lfTbl.value = String(mVal);
      }
    }
    if (qTicket !== null) {
      var tVal = clampRange(rTicket, qTicket);
      if (tVal !== null) rTicket.value = String(tVal);
    }
    if (qTurnos !== null) {
      var sVal = clampRange(rShifts, qTurnos);
      if (sVal !== null) rShifts.value = String(sVal);
    }
    if (qMoneda === 'usd' || qMoneda === 'ars') {
      currentCur = qMoneda;
    }
  }

  function calcROI() {
    if (!rTables || !rTicket || !rShifts) return;
    var M = +rTables.value;
    var T = +rTicket.value;
    var S = +rShifts.value;
    var WEEKS = 4.3;
    var ROTATIONS = 2.6;
    var OCCUPANCY = 0.85;
    var ROT_UPLIFT = 0.10;
    var ROUND_UPLIFT = 0.06;
    var MARGIN = 0.67;

    var sessionsPerShift = M * ROTATIONS * OCCUPANCY;
    var shiftsMonth = S * WEEKS;
    var extraTables = sessionsPerShift * ROT_UPLIFT * shiftsMonth;
    var rotNet = extraTables * T * MARGIN;
    var roundsNet = sessionsPerShift * shiftsMonth * T * ROUND_UPLIFT * MARGIN;
    var plan = planFor(M);
    var gross = rotNet + roundsNet;
    var netArs = gross - plan.ars;
    var mult = gross / plan.ars;

    var isUsd = currentCur === 'usd';
    var rotDisplay = isUsd ? fmtUSD(Math.round(rotNet / USD_ARS)) : fmtARS(rotNet);
    var roundsDisplay = isUsd ? fmtUSD(Math.round(roundsNet / USD_ARS)) : fmtARS(roundsNet);
    var costDisplay = isUsd ? fmtUSD(plan.usd) : fmtARS(plan.ars);
    var netVal = isUsd
      ? (Math.round(rotNet / USD_ARS) + Math.round(roundsNet / USD_ARS) - plan.usd)
      : netArs;
    var netDisplay = (netVal >= 0 ? '+ ' : '- ') + (isUsd ? fmtUSD(Math.abs(netVal)) : fmtARS(Math.abs(netVal)));

    $('#roi-tables-out').textContent = M + ' mesas';
    $('#roi-ticket-out').textContent = isUsd ? (fmtUSD(T / USD_ARS) + ' (' + fmtARS(T) + ')') : fmtARS(T);
    $('#roi-shifts-out').textContent = S + (S === 1 ? ' turno' : ' turnos');

    var scaleMin = $('#roi-ticket-min');
    var scaleMax = $('#roi-ticket-max');
    if (scaleMin) scaleMin.textContent = isUsd ? fmtUSD(15000 / USD_ARS) : 'ARS 15.000';
    if (scaleMax) scaleMax.textContent = isUsd ? fmtUSD(150000 / USD_ARS) : 'ARS 150.000';

    $('#roi-net').textContent = netDisplay;
    $('#roi-mult').textContent = (mult >= 10 ? Math.round(mult) : mult.toFixed(1).replace('.', ',')) + 'x';
    $('#roi-rot').textContent = '+ ' + rotDisplay;
    $('#roi-rounds').textContent = '+ ' + roundsDisplay;
    $('#roi-rot-note').textContent = fmtNum(extraTables) + ' mesas adicionales atendidas por mes, contribución neta';
    $('#roi-plan').textContent = plan.name;
    $('#roi-cost').textContent = '- ' + costDisplay;
    var maxPart = Math.max(rotNet, roundsNet) || 1;
    $('#roi-rot-bar').style.width = (rotNet / maxPart * 100) + '%';
    $('#roi-rounds-bar').style.width = (roundsNet / maxPart * 100) + '%';
    [rTables, rTicket, rShifts].forEach(setFill);

    roiState = { tables: M, ticket: T, shifts: S, netArs: netArs, netDisplay: netDisplay, mult: mult, plan: plan.name };

    // Si la calculadora está en planes.html (sin formulario local), pasar los datos por URL al piloto
    var roiCtaEl = $('#roi-cta');
    if (roiCtaEl && !$('#lead-form')) {
      var msgTxt = 'Estimación realizada con la calculadora ROI: ' + M + ' mesas, ticket promedio ' + fmtMoney(T) +
        ', ' + S + ' turnos pico por semana. Contribución neta estimada: ' + netDisplay + '/mes.';
      roiCtaEl.href = '/?plan=' + encodeURIComponent(plan.name) +
        '&mesas=' + encodeURIComponent(String(M)) +
        '&msg=' + encodeURIComponent(msgTxt) + '#piloto';
    }
  }

  function buildRoiShareUrl() {
    var base = location.origin && location.origin !== 'null'
      ? (location.origin + location.pathname)
      : location.href.split('?')[0].split('#')[0];
    var qs = '?mesas=' + encodeURIComponent(rTables.value)
      + '&ticket=' + encodeURIComponent(rTicket.value)
      + '&turnos=' + encodeURIComponent(rShifts.value)
      + (currentCur === 'usd' ? '&moneda=usd' : '');
    return base + qs + '#roi';
  }

  function copyTextSafe(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  /* ---------- 8. Moneda sincronizada + cotización USD/ARS en vivo ---------- */
  var curBtns = $all('.cur-btn');

  function formatFxStamp(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (e) {
      return '';
    }
  }

  function updateFxNotes() {
    var rateTxt = fmtNum(USD_ARS);
    var stamp = formatFxStamp(FX_META.updatedAt);
    var suffix = FX_META.live
      ? (' (' + (FX_META.source || 'Dólar oficial venta') + (stamp ? ' · ' + stamp : '') + ')')
      : ' (cotización de referencia)';
    $all('.fx-rate-note').forEach(function (el) {
      el.textContent = '1 USD = ARS ' + rateTxt + suffix;
    });
  }

  function setCurrency(cur) {
    currentCur = cur === 'usd' ? 'usd' : 'ars';
    syncPlanCosts();
    curBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.cur === currentCur)); });
    $all('.price[data-usd]').forEach(function (el) {
      var usd = +el.dataset.usd;
      var ars = roundArs(usd * USD_ARS);
      el.dataset.ars = String(ars);
      el.textContent = currentCur === 'usd' ? fmtUSD(usd) : fmtARS(ars);
    });
    $all('.plan-alt[data-usd-alt]').forEach(function (el) {
      var usd = +el.dataset.usdAlt;
      var suffix = el.textContent.indexOf('sucursal') > -1 ? ', por sucursal' : '';
      el.textContent = currentCur === 'usd'
        ? 'ARS ' + fmtNum(roundArs(usd * USD_ARS)) + '/mes en pesos' + suffix
        : 'USD ' + usd + '/mes de referencia' + suffix;
    });
    updateFxNotes();
    calcROI();
  }
  curBtns.forEach(function (b) { b.addEventListener('click', function () { setCurrency(b.dataset.cur); }); });

  function applyLiveFx(data) {
    if (!data || !isFinite(+data.rate) || +data.rate < 100) return;
    USD_ARS = +data.rate;
    FX_META = {
      rate: USD_ARS,
      source: String(data.source || 'Dólar oficial venta'),
      updatedAt: String(data.updatedAt || ''),
      live: !!data.live
    };
    setCurrency(currentCur);
  }

  function loadLiveFx() {
    try {
      var raw = sessionStorage.getItem(FX_CACHE_KEY);
      if (raw) {
        var cached = JSON.parse(raw);
        if (cached && cached.ts && (Date.now() - cached.ts < FX_CACHE_MS) && cached.data) {
          applyLiveFx(cached.data);
          return;
        }
      }
    } catch (e) { /* sin acción */ }

    if (location.protocol === 'file:' || !window.fetch) {
      setCurrency(currentCur);
      return;
    }

    fetch('api/exchange-rate', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok) return;
        applyLiveFx(data);
        try {
          sessionStorage.setItem(FX_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
        } catch (e) { /* sin acción */ }
      })
      .catch(function () { /* mantiene referencia por defecto */ });
  }

  if (rTables && rTicket && rShifts) {
    applyRoiUrlParams();
    [rTables, rTicket, rShifts].forEach(function (inp) { inp.addEventListener('input', calcROI); });
  }
  setCurrency(currentCur);
  loadLiveFx();

  if (rTables && rTicket && rShifts) {

    var roiCta = $('#roi-cta');
    if (roiCta) roiCta.addEventListener('click', function () {
      if (!roiState) return;
      prefillLead({
        plan: roiState.plan,
        tables: roiState.tables,
        message: 'Estimación realizada con la calculadora ROI: ' + roiState.tables + ' mesas, ticket promedio ' + fmtMoney(roiState.ticket) +
          ', ' + roiState.shifts + ' turnos pico por semana. Contribución neta estimada: ' + roiState.netDisplay + '/mes.'
      });
    });

    if (roiCopyBtn) {
      roiCopyBtn.addEventListener('click', function () {
        var shareUrl = buildRoiShareUrl();
        try {
          var rel = '?mesas=' + encodeURIComponent(rTables.value)
            + '&ticket=' + encodeURIComponent(rTicket.value)
            + '&turnos=' + encodeURIComponent(rShifts.value)
            + (currentCur === 'usd' ? '&moneda=usd' : '') + '#roi';
          history.replaceState(null, '', location.pathname + rel);
        } catch (err) { /* sin acción */ }
        copyTextSafe(shareUrl).then(function () {
          var prev = roiCopyBtn.textContent;
          roiCopyBtn.textContent = '✔ Enlace copiado al portapapeles';
          setTimeout(function () { roiCopyBtn.textContent = prev; }, 2600);
        }).catch(function () {
          window.prompt('Copie este enlace personalizado:', shareUrl);
        });
      });
    }
  }

  /* ---------- 9. Acordeón FAQ ---------- */
  $all('.acc-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      btn.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
      btn.closest('.acc-item').classList.toggle('is-open', !open);
      if (!open) { panel.classList.remove('is-anim'); void panel.offsetWidth; panel.classList.add('is-anim'); }
    });
  });

  /* ---------- 10. Formulario de piloto y leads ---------- */
  var form = $('#lead-form');
  var done = $('#lead-done');
  var errBox = $('#lf-error');
  var submitBtn = $('#lf-submit');

  function prefillLead(opts) {
    var sel = $('#lf-plan');
    if (opts.plan && sel) {
      $all('option', sel).forEach(function (o) { if (o.value === opts.plan) sel.value = o.value; });
    }
    if (opts.tables) { var t = $('#lf-tables'); if (t && !t.value) t.value = opts.tables; }
    if (opts.message) { var m = $('#lf-msg'); if (m && !m.value.trim()) m.value = opts.message; }
  }
  $all('.plan-cta[data-plan]').forEach(function (a) {
    a.addEventListener('click', function () { prefillLead({ plan: a.dataset.plan }); });
  });

  // Precargar plan, mesas o resumen ROI cuando se llega desde planes.html
  if (form && 'URLSearchParams' in window) {
    var lqs = new URLSearchParams(location.search);
    var qPlan = lqs.get('plan');
    var qMesasLead = lqs.get('mesas');
    var qMsgLead = lqs.get('msg');
    if (qPlan || qMesasLead || qMsgLead) {
      prefillLead({ plan: qPlan || '', tables: qMesasLead || '', message: qMsgLead || '' });
    }
  }

  function readLead() {
    var fd = new FormData(form);
    var get = function (k) { return String(fd.get(k) || '').trim(); };
    return {
      name: get('name'),
      restaurantName: get('restaurantName'),
      zone: get('zone'),
      tablesCount: get('tablesCount'),
      contact: get('contact'),
      planInterest: get('planInterest'),
      message: get('message')
    };
  }

  function leadSummaryText(lead) {
    var lines = ['Hola SaleListo, deseo solicitar la prueba piloto de 14 días.'];
    lines.push('Nombre: ' + lead.name);
    lines.push('Establecimiento: ' + lead.restaurantName);
    if (lead.zone) lines.push('Zona: ' + lead.zone);
    if (lead.tablesCount) lines.push('Mesas: ' + lead.tablesCount);
    lines.push('Contacto: ' + lead.contact);
    if (lead.planInterest) lines.push('Plan de interés: ' + lead.planInterest);
    if (lead.message) lines.push('Detalle: ' + lead.message);
    return lines.join('\n');
  }
  function waLink(text) { return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text); }
  function mailLink(lead, text) {
    return 'mailto:' + SALES_EMAIL + '?subject=' + encodeURIComponent('Solicitud de prueba piloto · ' + lead.restaurantName) +
      '&body=' + encodeURIComponent(text);
  }

  function validate(lead) {
    var missing = [];
    [['lf-name', lead.name], ['lf-resto', lead.restaurantName], ['lf-contact', lead.contact]].forEach(function (p) {
      var el = document.getElementById(p[0]);
      var bad = !p[1];
      el.setAttribute('aria-invalid', String(bad));
      if (bad) missing.push(el);
    });
    var contactEl = $('#lf-contact');
    if (lead.contact && !/@/.test(lead.contact) && lead.contact.replace(/\D/g, '').length < 8) {
      contactEl.setAttribute('aria-invalid', 'true');
      missing.push(contactEl);
      return { ok: false, msg: 'Verifique el dato de contacto: ingrese un número de WhatsApp con código de área o un correo electrónico válido.', first: contactEl };
    }
    if (missing.length) return { ok: false, msg: 'Complete su nombre, el nombre del establecimiento y un medio de contacto.', first: missing[0] };
    return { ok: true };
  }

  // Sin window.open asíncrono (evita bloqueo silencioso de popups en mobile Safari/Chrome)
  function showDone(lead, savedOnServer) {
    var text = leadSummaryText(lead);
    var wa = waLink(text);
    var doneWa = $('#done-wa');
    doneWa.href = wa;
    doneWa.textContent = '💬 Contactar por WhatsApp';
    $('#done-mail').href = mailLink(lead, text);
    $('#done-title').textContent = savedOnServer ? 'Solicitud registrada.' : 'Solicitud preparada para envío.';
    $('#done-text').textContent = savedOnServer
      ? 'Su consulta fue registrada correctamente. Si lo desea, puede iniciar contacto directo por WhatsApp.'
      : 'Seleccione el botón inferior para remitir el resumen de su solicitud por WhatsApp.';
    var sum = $('#done-summary');
    sum.innerHTML = '';
    [['Establecimiento', lead.restaurantName], ['Zona', lead.zone], ['Mesas', lead.tablesCount], ['Contacto', lead.contact], ['Plan', lead.planInterest]]
      .forEach(function (r) {
        if (!r[1]) return;
        var row = document.createElement('div');
        var k = document.createElement('span'); k.textContent = r[0];
        var v = document.createElement('b'); v.textContent = r[1];
        row.appendChild(k); row.appendChild(v); sum.appendChild(row);
      });
    form.hidden = true;
    done.hidden = false;
    done.focus({ preventScroll: true });
    done.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    return wa;
  }

  if (form) {
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) e.target.setAttribute('aria-invalid', 'false');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lead = readLead();
      var v = validate(lead);
      if (!v.ok) {
        errBox.textContent = v.msg;
        errBox.hidden = false;
        if (v.first) v.first.focus();
        return;
      }
      errBox.hidden = true;
      submitBtn.disabled = true;
      var original = submitBtn.textContent;
      submitBtn.textContent = 'Enviando...';

      var isFile = location.protocol === 'file:';
      var payload = {
        name: lead.name.slice(0, 80),
        restaurantName: lead.restaurantName.slice(0, 100),
        zone: lead.zone.slice(0, 80),
        tablesCount: lead.tablesCount,
        contact: lead.contact.slice(0, 120),
        planInterest: lead.planInterest,
        message: lead.message.slice(0, 800)
      };

      var finish = function (saved) {
        submitBtn.disabled = false;
        submitBtn.textContent = original;
        showDone(lead, saved);
      };

      if (isFile || !window.fetch) { finish(false); return; }

      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
      fetch('api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        clearTimeout(timer);
        return res.json().catch(function () { return {}; }).then(function (data) {
          // 400 (validación) o 429 (límite antispam): mostrar mensaje claro en el formulario
          if (res.status === 400 || res.status === 429) {
            submitBtn.disabled = false;
            submitBtn.textContent = original;
            errBox.textContent = String((data && data.error) || (res.status === 429
              ? 'Se han registrado múltiples envíos consecutivos. Intente nuevamente en unos minutos o comuníquese por WhatsApp.'
              : 'Verifique los datos ingresados e intente nuevamente.'));
            errBox.hidden = false;
            return;
          }
          finish(!!(res.ok && data && data.ok));
        });
      }).catch(function () {
        clearTimeout(timer);
        finish(false);
      });
    });

    $('#done-reset').addEventListener('click', function () {
      form.reset();
      done.hidden = true;
      form.hidden = false;
      $('#lf-name').focus();
    });
  }

  /* ---------- 11. Año del footer ---------- */
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
