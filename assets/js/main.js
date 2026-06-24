/* ЦЕХ 23 — интерактив. Только transform/opacity. Без addEventListener('scroll').
   Lenis синхронизируется со ScrollTrigger через единый gsap.ticker (а не нативный scroll). */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js'); // включаем CSS-скрытие .reveal/.hero-title только при живом JS

  // ── Флаги среды и единый «гейт деградации» ──
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined';
  var hasSplitText = typeof window.SplitText !== 'undefined';
  var hasLenis = typeof window.Lenis !== 'undefined';
  var forceStatic = /[?&]static\b/.test(window.location.search); // ?static=1 -> без анимаций
  var pointerFine = window.matchMedia('(pointer: fine)').matches;
  var isTouch = window.matchMedia('(hover: none)').matches || ('ontouchstart' in window);

  // motionOK — можно ли анимировать вообще; richOK — можно ли включать тяжёлые desktop-фичи
  var motionOK = hasGSAP && !reduceMotion && !forceStatic;
  var richOK = motionOK && pointerFine && !isTouch; // Lenis, кастом-курсор, tilt
  var lenis = null;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // Без анимаций (reduced-motion / нет GSAP / ?static) — просто показываем контент.
  function revealAllStatic() {
    document.querySelectorAll('.reveal, .hero-word, .hero-title, [data-split], .master-detail').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.filter = 'none';
    });
  }

  // ── Плавный скролл (Lenis) + синхронизация со ScrollTrigger через общий тикер ──
  function initLenis() {
    if (!richOK || !hasLenis) return null;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0); // никаких «скачков» после фриза вкладки
    return lenis;
  }

  // Якоря: при активном Lenis — плавная прокрутка с учётом фикс-навбара; иначе нативно.
  function setupAnchorScroll() {
    if (!lenis) return;
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      a.addEventListener('click', function (e) {
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -80 });
      });
    });
  }

  // ── Кастомный курсор: точка (быстрая) + кольцо (с инерцией) ──
  //    Только desktop/pointer:fine (richOK). На touch/RM — системный курсор не трогаем.
  function initCursor() {
    if (!richOK) return;
    var dot = document.getElementById('cursor-dot');
    var ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;
    root.classList.add('cursor-active'); // прячет системный курсор (CSS)

    // Только transform; точка следует почти мгновенно, кольцо — с лагом (quickTo).
    var dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
    var dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    var ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
    var ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });

    window.addEventListener('pointermove', function (e) {
      dotX(e.clientX); dotY(e.clientY);
      ringX(e.clientX); ringY(e.clientY);
    });

    // Hover-состояние кольца над интерактивом и фото-группами.
    document.querySelectorAll('a, button, [data-magnetic], .group').forEach(function (el) {
      el.addEventListener('pointerenter', function () { ring.classList.add('is-hover'); });
      el.addEventListener('pointerleave', function () { ring.classList.remove('is-hover'); });
    });
  }

  // ── Брендовый прелоадер: показываем только при живом JS+motion, гарантированно снимаем ──
  function runPreloader(onDone) {
    var pre = document.getElementById('preloader');
    var done = false;
    function finish() {
      if (done) return; done = true;
      if (pre) pre.style.display = 'none';
      if (lenis) lenis.start();
      if (onDone) onDone();
    }
    if (!pre || !motionOK) { finish(); return; }

    if (lenis) lenis.stop(); // не скроллим под заставкой
    var word = pre.querySelector('[data-preloader-word]');
    var tl = gsap.timeline({ onComplete: finish });
    if (word) {
      tl.from(word, { yPercent: 40, opacity: 0, duration: 0.7, ease: 'expo.out' })
        .to(word, { letterSpacing: '0.04em', duration: 0.5, ease: 'power2.out' }, '-=0.1');
    }
    tl.to(pre, { yPercent: -100, duration: 0.8, ease: 'power3.inOut' }, '+=0.2');

    // Страховка: если onComplete почему-то не наступит — всё равно снимаем оверлей.
    setTimeout(finish, 2500);
  }

  // SplitText считает переносы строк точно только после загрузки веб-шрифтов —
  // иначе разбивка идёт по системному фоллбэку и «прыгает». Ждём document.fonts.ready.
  function whenFontsReady(fn) {
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(fn);
    else fn();
  }

  // ── Вход hero (SplitText-слова + clear-blur у остальных элементов) ──
  function heroIntro() {
    if (!motionOK) return;
    var title = document.querySelector('#hero .hero-title');
    // Заголовок держим скрытым (CSS) до построения таймлайна, чтобы не было вспышки до сплита.
    function build() {
      var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      if (title) gsap.set(title, { opacity: 1 });

      if (hasSplitText && title) {
        var split = new SplitText(title, { type: 'lines,words', linesClass: 'split-line' });
        tl.from(split.words, { yPercent: 110, opacity: 0, duration: 1.05, stagger: 0.06 });
      } else if (title) {
        tl.from(title, { yPercent: 8, opacity: 0, duration: 1.0 });
      }
      tl.to('#hero .reveal', { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.9, stagger: 0.12 }, '-=0.7');
    }
    if (hasSplitText) whenFontsReady(build); else build();
  }

  // ── Строчные ревилы заголовков секций (SplitText по входу во вьюпорт) ──
  function splitHeadings() {
    if (!motionOK) return;
    var nodes = document.querySelectorAll('[data-split]');
    if (!hasSplitText) { gsap.set(nodes, { opacity: 1 }); return; } // нет плагина — просто показать

    whenFontsReady(function () {
      nodes.forEach(function (el) {
        gsap.set(el, { opacity: 1 });
        var split = new SplitText(el, { type: 'lines', linesClass: 'split-line' });
        gsap.from(split.lines, {
          yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true }
        });
        // переразбивка строк при ресайзе, чтобы переносы не «рвались»
        ScrollTrigger.addEventListener('refreshInit', function () { split.revert(); });
      });
    });
  }

  // ── Счётчики статов ──
  function runCounters() {
    var nodes = document.querySelectorAll('[data-count]');
    nodes.forEach(function (node) {
      var target = parseFloat(node.getAttribute('data-count'));
      var decimals = parseInt(node.getAttribute('data-decimal') || '0', 10);
      var format = function (v) { return decimals ? (v / Math.pow(10, decimals)).toFixed(decimals) : Math.round(v).toString(); };

      if (!motionOK) { node.textContent = format(target); return; }

      var obj = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 1.6, ease: 'power2.out',
        scrollTrigger: { trigger: node, start: 'top 85%', once: true },
        onUpdate: function () { node.textContent = format(obj.v); }
      });
    });
  }

  // ── Pointer-tilt карточек услуг: лёгкий 3D-наклон к курсору (только transform) ──
  //    Только desktop/pointer:fine (richOK). Амплитуда ограничена — текст остаётся читаем.
  function setupTilt() {
    if (!richOK) return;
    document.querySelectorAll('#services article').forEach(function (card) {
      gsap.set(card, { transformPerspective: 700, transformStyle: 'preserve-3d' });
      var rx = gsap.quickTo(card, 'rotationX', { duration: 0.4, ease: 'power3' });
      var ry = gsap.quickTo(card, 'rotationY', { duration: 0.4, ease: 'power3' });
      var sc = gsap.quickTo(card, 'scale', { duration: 0.4, ease: 'power3' });

      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;  // -0.5..0.5
        var py = (e.clientY - r.top) / r.height - 0.5;
        rx(-py * 12); // наклон ±6°
        ry(px * 12);
        sc(1.02);
      });
      card.addEventListener('pointerleave', function () { rx(0); ry(0); sc(1); });
    });
  }

  // ── Магнитные кнопки (вне React-цикла, на transform) ──
  function setupMagnetic() {
    if (!richOK) return;
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

  // ── Появление секций на скролле (batch, без отдельных слушателей scroll) ──
  function scrollReveals() {
    if (!motionOK) return;
    var items = Array.prototype.filter.call(
      document.querySelectorAll('.reveal'),
      function (el) { return !el.closest('#hero'); } // hero-овые .reveal — в heroIntro
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

  // ── Scroll-spy: подсветка пункта меню по активной секции (без scroll-листенеров) ──
  function setupNavSpy() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    function activate(link) {
      nav.querySelectorAll('a.is-active').forEach(function (a) { a.classList.remove('is-active'); });
      link.classList.add('is-active');
    }
    ['services', 'masters', 'atmosphere', 'reviews'].forEach(function (id) {
      var sec = document.getElementById(id);
      var link = nav.querySelector('a[href="#' + id + '"]');
      if (!sec || !link) return;
      ScrollTrigger.create({
        trigger: sec,
        start: 'top center',
        end: 'bottom center',
        onToggle: function (self) { if (self.isActive) activate(link); }
      });
    });
  }

  // ── Индикатор прогресса чтения: scaleX полосы от 0 до 1 по всему скроллу ──
  function setupProgress() {
    var bar = document.getElementById('scroll-progress');
    if (!bar) return;
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: {
        trigger: document.documentElement,
        start: 'top top', end: 'bottom bottom',
        scrub: true, invalidateOnRefresh: true
      }
    });
  }

  // ── Параллакс-глубина: помеченные [data-parallax] двигаются медленнее скролла ──
  //    Только transform (yPercent). Овэрскан элемента задаётся в разметке, чтобы
  //    сдвиг не оголял края. На <768px/RM — выключено (фон статичен).
  function setupParallax() {
    if (!motionOK || window.innerWidth < 768) return;
    document.querySelectorAll('[data-parallax]').forEach(function (el) {
      var speed = parseFloat(el.getAttribute('data-parallax-speed')) || 0.5;
      var shift = speed * 12; // амплитуда в % высоты элемента; overscan в CSS покрывает
      gsap.fromTo(el,
        { yPercent: -shift },
        {
          yPercent: shift, ease: 'none',
          scrollTrigger: {
            trigger: el.closest('section') || el,
            start: 'top bottom', end: 'bottom top',
            scrub: true, invalidateOnRefresh: true
          }
        });
    });
  }

  // ── Закреплённый горизонтальный пан галереи + контр-движение картинок (глубина) ──
  function horizontalPan() {
    var wrap = document.getElementById('pan-wrap');
    var track = document.getElementById('pan-track');
    if (!wrap || !track || !motionOK) return; // мобила/RM — нативный scroll-snap
    if (window.innerWidth < 768) return;

    wrap.classList.add('is-pinned');
    var getDistance = function () { return Math.max(0, track.scrollWidth - window.innerWidth + 32); };

    if (getDistance() <= 0) { wrap.classList.remove('is-pinned'); return; }

    // Картинки чуть масштабируем — это даёт запас под контр-сдвиг по X без оголения краёв.
    var imgs = track.querySelectorAll('.pan-item img');
    gsap.set(imgs, { scale: 1.08 });

    // Один таймлайн под общий пин-скраб: трек едет влево, картинки внутри слегка против.
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: wrap,
        start: 'top top',
        end: function () { return '+=' + getDistance(); },
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true
      }
    });
    tl.to(track, { x: function () { return -getDistance(); }, ease: 'none' }, 0);
    tl.fromTo(imgs, { xPercent: -3 }, { xPercent: 3, ease: 'none' }, 0);
  }

  // ── Форма записи: валидация + состояние успеха ──
  function bookingForm() {
    var form = document.getElementById('booking-form');
    if (!form) return;
    var success = document.getElementById('form-success');
    var btnLabel = form.querySelector('[data-submit-label]');
    var summaryUpdate; // присваивается ниже из liveSummary(); зовётся после reset

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
        if (summaryUpdate) summaryUpdate(); // сводка к дефолтам сразу после reset
        if (btnLabel) btnLabel.textContent = 'Записаться';
        if (success) { success.classList.remove('hidden'); success.classList.add('flex'); }
      }, 700);
    });

    // Чистим ошибку при вводе
    ['name', 'phone'].forEach(function (n) {
      var f = form.elements[n];
      if (f) f.addEventListener('input', function () { setError(n, false); });
    });

    maskPhone(form.elements['phone']);
    summaryUpdate = liveSummary(form);
  }

  // ── Маска телефона: +7 (___) ___-__-__ (валидация «≥10 цифр» остаётся рабочей) ──
  function maskPhone(input) {
    if (!input) return;
    function format(d) {
      d = d.slice(0, 10);
      var out = '+7';
      if (d.length > 0) out += ' (' + d.slice(0, 3);
      if (d.length >= 3) out += ')';
      if (d.length > 3) out += ' ' + d.slice(3, 6);
      if (d.length > 6) out += '-' + d.slice(6, 8);
      if (d.length > 8) out += '-' + d.slice(8, 10);
      return out;
    }
    input.addEventListener('input', function () {
      var raw = input.value.replace(/\D/g, '');
      if (raw.length && (raw[0] === '7' || raw[0] === '8')) raw = raw.slice(1); // отбрасываем код страны
      input.value = raw.length ? format(raw) : '';
    });
  }

  // ── Живая сводка заявки: услуга + мастер + цена, пересчёт при смене селектов ──
  function liveSummary(form) {
    var serviceSel = form.elements['service'];
    var masterSel = form.elements['master'];
    var outService = form.querySelector('[data-summary-service]');
    var outMaster = form.querySelector('[data-summary-master]');
    var outPrice = form.querySelector('[data-summary-price]');
    if (!serviceSel || !outService) return;
    function update() {
      var opt = serviceSel.options[serviceSel.selectedIndex];
      var price = opt && opt.getAttribute('data-price');
      outService.textContent = serviceSel.value;
      if (outMaster && masterSel) outMaster.textContent = masterSel.value;
      if (outPrice && price) outPrice.textContent = price + ' ₽';
    }
    serviceSel.addEventListener('change', update);
    if (masterSel) masterSel.addEventListener('change', update);
    update();
    return update; // submit-хендлер зовёт это синхронно после form.reset()
  }

  // ── Кнопка «наверх»: видимость по скроллу (ScrollTrigger), клик — плавно вверх ──
  function setupBackToTop() {
    var btn = document.getElementById('back-to-top');
    if (!btn) return;
    if (motionOK) {
      ScrollTrigger.create({
        start: 'top -400', // показываем, когда прокрутили вниз
        onToggle: function (self) { btn.classList.toggle('is-visible', self.isActive); }
      });
    }
    btn.addEventListener('click', function () {
      if (lenis) lenis.scrollTo(0); else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Мобильный sticky-CTA: показываем после hero, прячем над секцией записи ──
  function setupStickyCTA() {
    var cta = document.getElementById('sticky-cta');
    if (!cta || !motionOK) return;
    var pastHero = false, bookingVisible = false;
    function apply() { cta.classList.toggle('is-shown', pastHero && !bookingVisible); }
    ScrollTrigger.create({
      start: 'top -500',
      onToggle: function (self) { pastHero = self.isActive; apply(); }
    });
    var booking = document.getElementById('booking');
    if (booking) {
      ScrollTrigger.create({
        trigger: booking, start: 'top bottom', end: 'bottom top',
        onToggle: function (self) { bookingVisible = self.isActive; apply(); }
      });
    }
  }

  // ── Подстраховка для картинок: отсутствующие assets/img -> seeded-плейсхолдер picsum ──
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
    var pre = document.getElementById('preloader');

    if (motionOK) {
      gsap.registerPlugin(ScrollTrigger);
      if (hasSplitText) gsap.registerPlugin(SplitText);

      initLenis();
      setupAnchorScroll();
      initCursor();

      scrollReveals();
      splitHeadings();
      navCondense();
      setupNavSpy();
      setupProgress();
      horizontalPan();
      setupParallax();
      setupTilt();
      setupBackToTop();
      setupStickyCTA();
      runCounters();
      setupMagnetic();

      runPreloader(function () { heroIntro(); });

      // Пересчёт после полной загрузки картинок (размеры влияют на пин/батч)
      window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    } else {
      if (pre) pre.style.display = 'none';
      revealAllStatic();
      runCounters(); // статически проставит финальные числа
    }

    bookingForm();
  });
})();
