/* ЦЕХ 23 — интерактив. Только transform/opacity. Без addEventListener('scroll'). */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js'); // включаем CSS-скрытие .reveal только при живом JS

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined';
  var forceStatic = /[?&]static\b/.test(window.location.search); // ?static=1 -> без анимаций (для скриншотов/отладки)

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // Без анимаций (reduced-motion или нет GSAP) — просто показываем контент.
  function revealAllStatic() {
    document.querySelectorAll('.reveal, .hero-word').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.filter = 'none';
    });
  }

  // ── Счётчики статов ──
  function runCounters() {
    var nodes = document.querySelectorAll('[data-count]');
    nodes.forEach(function (node) {
      var target = parseFloat(node.getAttribute('data-count'));
      var decimals = parseInt(node.getAttribute('data-decimal') || '0', 10);
      var format = function (v) { return decimals ? (v / Math.pow(10, decimals)).toFixed(decimals) : Math.round(v).toString(); };

      if (reduceMotion || !hasGSAP) { node.textContent = format(target); return; }

      var obj = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 1.6, ease: 'power2.out',
        scrollTrigger: { trigger: node, start: 'top 85%', once: true },
        onUpdate: function () { node.textContent = format(obj.v); }
      });
    });
  }

  // ── Магнитные кнопки (вне React-цикла, на transform) ──
  function setupMagnetic() {
    if (reduceMotion || !hasGSAP) return;
    document.querySelectorAll('[data-magnetic]').forEach(function (btn) {
      var inner = btn.querySelector('[data-magnet-inner]');
      var xTo = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3' });
      var yTo = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3' });
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var mx = e.clientX - r.left - r.width / 2;
        var my = e.clientY - r.top - r.height / 2;
        xTo(mx * 0.3); yTo(my * 0.4);
        if (inner) gsap.to(inner, { x: mx * 0.15, y: my * 0.2, duration: 0.4, ease: 'power3' });
      });
      btn.addEventListener('pointerleave', function () {
        xTo(0); yTo(0);
        if (inner) gsap.to(inner, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1,0.4)' });
      });
    });
  }

  // ── Вход hero (stagger слов + clear-blur у остальных элементов) ──
  function heroIntro() {
    if (reduceMotion || !hasGSAP) return;
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('#hero .hero-word', { y: 0, opacity: 1, duration: 1.1, stagger: 0.08 })
      .to('#hero .reveal', { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.9, stagger: 0.12 }, '-=0.7');
  }

  // ── Появление секций на скролле (batch, без отдельных слушателей scroll) ──
  function scrollReveals() {
    if (reduceMotion || !hasGSAP) return;
    // hero-овые .reveal анимируются в heroIntro — исключаем их
    var items = Array.prototype.filter.call(
      document.querySelectorAll('.reveal'),
      function (el) { return !el.closest('#hero'); }
    );
    ScrollTrigger.batch(items, {
      start: 'top 88%',
      onEnter: function (els) {
        gsap.to(els, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.8, stagger: 0.08, ease: 'power3.out', overwrite: true });
      }
    });
  }

  // ── Навбар: сжать/уплотнить при скролле (feedback) ──
  function navCondense() {
    var nav = document.getElementById('nav');
    if (!nav || !hasGSAP) return;
    ScrollTrigger.create({
      start: 'top -80',
      onUpdate: function (self) {
        var down = self.scroll() > 80;
        nav.classList.toggle('mt-2', down);
        nav.classList.toggle('mt-4', !down);
        nav.classList.toggle('bg-ink-900/85', down);
        nav.classList.toggle('bg-ink-900/60', !down);
      }
    });
  }

  // ── Закреплённый горизонтальный пан галереи (скелет 5.B скилла) ──
  function horizontalPan() {
    var wrap = document.getElementById('pan-wrap');
    var track = document.getElementById('pan-track');
    if (!wrap || !track || reduceMotion || !hasGSAP) return; // мобила/RM — нативный scroll-snap
    if (window.innerWidth < 768) return;

    wrap.classList.add('is-pinned');
    var getDistance = function () { return Math.max(0, track.scrollWidth - window.innerWidth + 32); };

    if (getDistance() <= 0) { wrap.classList.remove('is-pinned'); return; }

    gsap.to(track, {
      x: function () { return -getDistance(); },
      ease: 'none',
      scrollTrigger: {
        trigger: wrap,
        start: 'top top',
        end: function () { return '+=' + getDistance(); },
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true
      }
    });
  }

  // ── Форма записи: валидация + состояние успеха ──
  function bookingForm() {
    var form = document.getElementById('booking-form');
    if (!form) return;
    var success = document.getElementById('form-success');
    var btnLabel = form.querySelector('[data-submit-label]');

    function setError(name, show) {
      var msg = form.querySelector('[data-error-for="' + name + '"]');
      var field = form.elements[name];
      if (msg) msg.classList.toggle('hidden', !show);
      if (field) field.classList.toggle('border-ember', show);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements['name'];
      var phone = form.elements['phone'];
      var ok = true;

      if (!name.value.trim()) { setError('name', true); ok = false; } else setError('name', false);
      var digits = (phone.value.match(/\d/g) || []).length;
      if (digits < 10) { setError('phone', true); ok = false; } else setError('phone', false);
      if (!ok) return;

      // Имитация отправки (бэкенда нет; здесь подключается виджет YClients).
      if (btnLabel) btnLabel.textContent = 'Отправляем...';
      setTimeout(function () {
        form.reset();
        if (btnLabel) btnLabel.textContent = 'Записаться';
        if (success) { success.classList.remove('hidden'); success.classList.add('flex'); }
      }, 700);
    });

    // Чистим ошибку при вводе
    ['name', 'phone'].forEach(function (n) {
      var f = form.elements[n];
      if (f) f.addEventListener('input', function () { setError(n, false); });
    });
  }

  // ── Подстраховка для картинок: если файл из assets/img отсутствует,
  //    временно подставляем seeded-плейсхолдер picsum (разрешён скиллом).
  //    На финальных фото Unsplash не срабатывает. ──
  function setupImageFallback() {
    document.querySelectorAll('img[src^="assets/img/"]').forEach(function (img) {
      function swap() {
        if (img.dataset.fallback) return;
        img.dataset.fallback = '1';
        var name = (img.getAttribute('src').split('/').pop() || 'img').replace(/\.\w+$/, '');
        img.src = 'https://picsum.photos/seed/cex23-' + name + '/1200/900';
      }
      if (img.complete && img.naturalWidth === 0) swap();
      img.addEventListener('error', swap);
    });
  }

  ready(function () {
    setupImageFallback();
    if (hasGSAP && !reduceMotion && !forceStatic) {
      gsap.registerPlugin(ScrollTrigger);
      heroIntro();
      scrollReveals();
      navCondense();
      horizontalPan();
      runCounters();
      setupMagnetic();
      // Пересчёт после полной загрузки картинок (размеры влияют на пин/батч)
      window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    } else {
      revealAllStatic();
      runCounters(); // статически проставит финальные числа
    }
    bookingForm();
  });
})();
