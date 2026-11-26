/* SaleListo · Landing Page Comercial
   Interacciones: navbar, aparición al scroll, videos de ambiente, player del Video Demo Conceptual 16:9,
   pestañas de producto, simulación de balanceo y formulario de cotización personalizada. */
(function () {
  'use strict';

  var WA_NUMBER = '541138436571';
  var SALES_EMAIL = 'ventas@salelisto.com';
  var WA_DEFAULT_TEXT = 'Hola SaleListo, quiero solicitar una cotización personalizada para mi local.';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var hasIO = 'IntersectionObserver' in window;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function noop() {}
  function playSafe(v) {
    try {
      var p = v.play();
      return (p && typeof p.then === 'function') ? p : Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }
  function waLink(text) { return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text); }

  /* ---------- 0. Anclas heredadas de versiones anteriores -> formulario #contacto ---------- */
  var LEGACY_HASH = /^#(pilot[o]|planes|r[o]i)$/i;
  function fixLegacyHash() {
    if (!LEGACY_HASH.test(location.hash)) return;
    var target = document.getElementById('contacto');
    if (!target) { location.replace('/#contacto'); return; }
    try { history.replaceState(null, '', location.pathname + location.search + '#contacto'); } catch (e) { /* sin acción */ }
    target.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  fixLegacyHash();
  window.addEventListener('hashchange', fixLegacyHash);

  /* ---------- 1. Navbar ---------- */
  var nav = $('#nav');
  var burger = $('#nav-burger');
  var waFloat = $('.wa-float');
  if (waFloat) waFloat.href = waLink(WA_DEFAULT_TEXT);

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
      if (el.getBoundingClientRect().top < vh * 1.25) el.classList.add('is-in');
      else pending.push(el);
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

  /* ---------- 3. Videos de ambiente (hero y pasos) ---------- */
  function markMissing(video) {
    var host = video.closest('.media-frame, .hero-media');
    if (host) host.classList.add('media-missing');
  }
  function watchErrors(video, onError) {
    var cb = onError || function () { markMissing(video); };
    var srcs = $all('source', video);
    var last = srcs[srcs.length - 1];
    if (last) last.addEventListener('error', cb);
    video.addEventListener('error', cb);
  }

  var heroBg = $('.hero-media .bg-video');
  if (heroBg) {
    watchErrors(heroBg);
    if (reduceMotion) { heroBg.removeAttribute('autoplay'); heroBg.pause(); }
  }

  var lazyVideos = $all('.lazy-video');
  function loadVideo(v) {
    if (v.dataset.loaded) return;
    $all('source[data-src]', v).forEach(function (s) { s.src = s.getAttribute('data-src'); });
    watchErrors(v);
    v.dataset.loaded = '1';
    v.load();
  }

  if (hasIO) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) {
          loadVideo(v);
          if (!reduceMotion) playSafe(v).catch(noop);
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { rootMargin: '200px 0px', threshold: 0.1 });
    lazyVideos.forEach(function (v) { vo.observe(v); });
    if (heroBg && !reduceMotion) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) playSafe(heroBg).catch(noop); else heroBg.pause(); });
      }).observe(heroBg);
    }
  } else {
    lazyVideos.forEach(function (v) { loadVideo(v); if (!reduceMotion) playSafe(v).catch(noop); });
  }

  /* ---------- 4. Player del Video Demo Conceptual 16:9 ---------- */
  // Estados: idle (vista previa silenciosa con botón grande) · watching (el visitante tomó el control) · ended
  var demoApi = null;
  var dvPlayer = $('#dv-player');
  var dv = $('#demo-conceptual-video');
  if (dvPlayer && dv) demoApi = initDemoPlayer(dvPlayer, dv);

  function initDemoPlayer(player, video) {
    var big = $('#dv-big', player);
    var playBtn = $('#dv-play', player);
    var soundBtn = $('#dv-sound', player);
    var soundLabel = $('.dv-sound-label', soundBtn);
    var fsBtn = $('#dv-fs', player);
    var seek = $('#dv-seek', player);
    var timeEl = $('#dv-time', player);
    var endBox = $('#dv-end', player);
    var replayBtn = $('#dv-replay', player);
    var mode = 'idle';
    var hideTimer = null;
    var seeking = false;
    var DEFAULT_DURATION = 35;

    function fmt(t) {
      t = Math.max(0, Math.floor(t || 0));
      return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
    }
    function duration() {
      var d = video.duration;
      return (isFinite(d) && d > 0) ? d : DEFAULT_DURATION;
    }

    function setMode(m) {
      mode = m;
      player.classList.toggle('is-idle', m === 'idle');
      player.classList.toggle('is-watching', m === 'watching');
      player.classList.toggle('is-ended', m === 'ended');
      endBox.hidden = m !== 'ended';
      big.tabIndex = m === 'idle' ? 0 : -1;
      big.setAttribute('aria-hidden', String(m !== 'idle'));
      video.loop = m === 'idle';
      if (m !== 'watching') showUi(true);
    }

    function syncPlay() {
      var paused = video.paused;
      player.classList.toggle('is-playing', !paused);
      playBtn.classList.toggle('is-paused', paused);
      playBtn.setAttribute('aria-label', paused ? 'Reproducir video' : 'Pausar video');
      if (paused) showUi(true); else scheduleHide();
    }

    function syncSound() {
      var on = !video.muted;
      player.classList.toggle('is-muted', !on);
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.setAttribute('aria-label', on ? 'Silenciar audio' : 'Activar audio');
      soundLabel.textContent = on ? 'Silenciar' : 'Activar audio';
    }

    function syncTime() {
      var d = duration();
      var cur = Math.min(video.currentTime || 0, d);
      if (!seeking) seek.value = String(Math.round(cur / d * 1000));
      seek.style.setProperty('--p', (Number(seek.value) / 10) + '%');
      seek.setAttribute('aria-valuetext', fmt(cur) + ' de ' + fmt(d));
      timeEl.textContent = fmt(cur) + ' / ' + fmt(d);
    }

    function showUi(stay) {
      player.classList.add('show-ui');
      clearTimeout(hideTimer);
      if (!stay) scheduleHide();
    }
    function scheduleHide() {
      clearTimeout(hideTimer);
      if (mode !== 'watching' || video.paused) return;
      hideTimer = setTimeout(function () {
        if (!player.contains(document.activeElement) || document.activeElement === video) player.classList.remove('show-ui');
      }, 2600);
    }

    function takeControl() { if (mode !== 'watching') setMode('watching'); }

    // Reproduce desde el inicio con audio (gesto del usuario: el navegador lo permite)
    function playWithAudio(fromStart) {
      if (fromStart) { try { video.currentTime = 0; } catch (e) { /* sin acción */ } }
      video.muted = false;
      setMode('watching');
      syncSound();
      playSafe(video).catch(function () {
        // Si el navegador bloquea el audio, seguir silenciado y dejar visible "Activar audio"
        video.muted = true;
        syncSound();
        playSafe(video).catch(noop);
      });
      showUi();
    }

    function togglePlay() {
      if (mode === 'ended') { playWithAudio(true); return; }
      takeControl();
      if (video.paused) playSafe(video).catch(noop); else video.pause();
    }

    // Activa o silencia el audio SIN reiniciar el video
    function toggleSound() {
      takeControl();
      video.muted = !video.muted;
      syncSound();
      if (!video.muted && video.paused && !video.ended) playSafe(video).catch(noop);
      showUi();
    }

    function seekTo(ratio) {
      takeControl();
      var d = duration();
      try { video.currentTime = Math.max(0, Math.min(d - 0.05, ratio * d)); } catch (e) { /* sin acción */ }
      syncTime();
    }
    function seekBy(sec) { seekTo(((video.currentTime || 0) + sec) / duration()); }

    function isFs() { return document.fullscreenElement === player || document.webkitFullscreenElement === player; }
    function nativeFs() {
      if (video.webkitEnterFullscreen) { try { video.webkitEnterFullscreen(); } catch (e) { /* sin acción */ } }
    }
    function toggleFs() {
      takeControl();
      if (isFs()) {
        var exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
        return;
      }
      var req = player.requestFullscreen || player.webkitRequestFullscreen;
      if (!req) { nativeFs(); return; }
      try {
        var r = req.call(player);
        if (r && typeof r.catch === 'function') r.catch(nativeFs);
      } catch (e) { nativeFs(); }
    }
    function syncFs() {
      var on = isFs();
      player.classList.toggle('is-fs', on);
      fsBtn.setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Ver en pantalla completa');
    }

    // Eventos de controles
    big.addEventListener('click', function () { playWithAudio(true); });
    replayBtn.addEventListener('click', function () { playWithAudio(true); });
    playBtn.addEventListener('click', togglePlay);
    soundBtn.addEventListener('click', toggleSound);
    fsBtn.addEventListener('click', toggleFs);
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);

    seek.addEventListener('input', function () {
      seeking = true;
      seek.style.setProperty('--p', (Number(seek.value) / 10) + '%');
      seekTo(Number(seek.value) / 1000);
    });
    seek.addEventListener('change', function () { seeking = false; syncTime(); });
    seek.addEventListener('pointerup', function () { seeking = false; });

    // Clic o toque sobre la imagen del video (en táctil, el primer toque solo muestra los controles)
    var touchUiVisible = true;
    var lastTouch = 0;
    video.addEventListener('click', function () {
      if (mode === 'idle') { playWithAudio(true); return; }
      if (Date.now() - lastTouch < 800 && !touchUiVisible) { showUi(); return; }
      togglePlay();
    });
    player.addEventListener('mousemove', function () { if (Date.now() - lastTouch > 800) showUi(); });
    player.addEventListener('touchstart', function () {
      lastTouch = Date.now();
      touchUiVisible = player.classList.contains('show-ui');
      showUi();
    }, { passive: true });
    player.addEventListener('focusin', function () { showUi(); });

    player.addEventListener('keydown', function (e) {
      var k = e.key;
      if (e.target === seek && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End')) return;
      if (k === 'k' || k === 'K') { e.preventDefault(); togglePlay(); }
      else if (k === 'm' || k === 'M') { e.preventDefault(); toggleSound(); }
      else if (k === 'f' || k === 'F') { e.preventDefault(); toggleFs(); }
      else if (k === 'ArrowRight') { e.preventDefault(); seekBy(5); }
      else if (k === 'ArrowLeft') { e.preventDefault(); seekBy(-5); }
    });

    // Eventos del video
    video.addEventListener('play', syncPlay);
    video.addEventListener('pause', syncPlay);
    video.addEventListener('timeupdate', syncTime);
    video.addEventListener('durationchange', syncTime);
    video.addEventListener('loadedmetadata', syncTime);
    video.addEventListener('volumechange', syncSound);
    video.addEventListener('ended', function () {
      if (mode === 'watching') {
        setMode('ended');
        if (isFs()) { var exit = document.exitFullscreen || document.webkitExitFullscreen; if (exit) exit.call(document); }
      }
    });
    watchErrors(video, function () { player.classList.add('is-missing'); });

    // Vista previa silenciosa al entrar en pantalla (solo desktop y sin ahorro de datos); pausa al salir
    var allowPreview = !reduceMotion && !isMobile && !saveData;
    if (hasIO) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) {
            if (!video.paused) video.pause();
          } else if (en.intersectionRatio >= 0.35 && mode === 'idle' && allowPreview && video.paused) {
            video.muted = true;
            syncSound();
            playSafe(video).catch(noop);
          }
        });
      }, { threshold: [0, 0.35] }).observe(player);
    } else if (allowPreview) {
      playSafe(video).catch(noop);
    }

    setMode('idle');
    syncPlay();
    syncSound();
    syncTime();

    return { playWithAudio: playWithAudio };
  }

  // CTA "Ver demo en video": desplaza hasta el player y arranca con audio (dentro del gesto del clic)
  $all('[data-play-demo]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (demoApi) demoApi.playWithAudio(true);
    });
  });

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

  /* ---------- 7. Formulario de cotización personalizada ---------- */
  var form = $('#lead-form');
  var done = $('#lead-done');
  var errBox = $('#lf-error');
  var submitBtn = $('#lf-submit');

  function readLead() {
    var fd = new FormData(form);
    var get = function (k) { return String(fd.get(k) || '').trim(); };
    return {
      name: get('name'),
      restaurantName: get('restaurantName'),
      contact: get('contact'),
      message: get('message')
    };
  }

  function leadSummaryText(lead) {
    var lines = [WA_DEFAULT_TEXT];
    lines.push('Nombre: ' + lead.name);
    lines.push('Local: ' + lead.restaurantName);
    lines.push('Contacto: ' + lead.contact);
    if (lead.message) lines.push('Comentario: ' + lead.message);
    return lines.join('\n');
  }
  function mailLink(lead, text) {
    return 'mailto:' + SALES_EMAIL + '?subject=' + encodeURIComponent('Cotización personalizada · ' + lead.restaurantName) +
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
      return { ok: false, msg: 'Revisá el dato de contacto: ingresá un WhatsApp con código de área o un correo electrónico válido.', first: contactEl };
    }
    if (missing.length) return { ok: false, msg: 'Completá tu nombre, el nombre del local y un WhatsApp o correo de contacto.', first: missing[0] };
    return { ok: true };
  }

  // Sin window.open asíncrono (evita bloqueo silencioso de popups en mobile Safari/Chrome)
  function showDone(lead, savedOnServer) {
    var text = leadSummaryText(lead);
    var doneWa = $('#done-wa');
    doneWa.href = waLink(text);
    doneWa.textContent = '💬 Escribir por WhatsApp';
    $('#done-mail').href = mailLink(lead, text);
    $('#done-title').textContent = savedOnServer ? '¡Gracias! Recibimos tu consulta.' : 'Tu consulta está lista para enviar.';
    $('#done-text').textContent = savedOnServer
      ? 'Nuestro equipo te va a contactar en el día con tu cotización personalizada. Si preferís, escribinos ahora por WhatsApp.'
      : 'Tocá el botón de WhatsApp para enviarnos el resumen y te respondemos en el día con tu cotización personalizada.';
    var sum = $('#done-summary');
    sum.innerHTML = '';
    [['Local', lead.restaurantName], ['Contacto', lead.contact], ['Comentario', lead.message]].forEach(function (r) {
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

      var payload = {
        name: lead.name.slice(0, 80),
        restaurantName: lead.restaurantName.slice(0, 100),
        contact: lead.contact.slice(0, 120),
        message: lead.message.slice(0, 800)
      };

      var finish = function (saved) {
        submitBtn.disabled = false;
        submitBtn.textContent = original;
        showDone(lead, saved);
      };

      if (location.protocol === 'file:' || !window.fetch) { finish(false); return; }

      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
      fetch('/api/leads', {
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
              ? 'Recibimos varias consultas seguidas. Probá de nuevo en unos minutos o escribinos por WhatsApp.'
              : 'Revisá los datos ingresados y volvé a intentar.'));
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

  /* ---------- 8. Año del footer ---------- */
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
