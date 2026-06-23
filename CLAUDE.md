# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Что это

Одностраничный лендинг барбершопа «ЦЕХ 23» (Краснодар). Статический сайт без бэкенда и без шага сборки — открывается прямо из `index.html`. Весь текст интерфейса на русском.

## Запуск и разработка

Сборки нет. Локально достаточно отдать каталог любым статик-сервером, чтобы пути к `assets/` и CDN работали:

```bash
python -m http.server 8000   # затем http://localhost:8000
```

Отладочные query-параметры (читаются в `assets/js/main.js`):
- `?static=1` — полностью отключает GSAP-анимации (для скриншотов/отладки), контент сразу видим.

Прогрессивная деградация — ключевой инвариант: без JS или при `prefers-reduced-motion` страница должна оставаться полностью читаемой. Тесты/линтеров нет.

## Архитектура

Три файла несут всё:
- `index.html` — вся разметка и контент секций (hero → стат-бэнд/marquee → услуги-bento → мастера → атмосфера → шаги визита → отзывы → запись → footer).
- `assets/css/styles.css` — только то, что не выражается утилитами Tailwind (зерно, marquee-кейфреймы, scroll-snap, reveal-стартовые состояния).
- `assets/js/main.js` — весь интерактив, одна IIFE.

Внешние зависимости подключаются через CDN прямо в `<head>`/конце `<body>`, локальных пакетов нет:
- **Tailwind play-CDN** — конфиг темы инлайн в `index.html` (`tailwind.config`). Кастомные токены: цвета `ink.*`/`bone`/`muted`/`ember.*`, шрифты `font-display` (Unbounded) и `font-sans` (Manrope), радиусы `rounded-card`/`rounded-input`, `max-w-shell` (1400px). Любой новый кастомный класс надо добавлять в этот инлайн-конфиг.
- **GSAP 3.12.5 + ScrollTrigger** — анимации.
- **Phosphor Icons** (`ph ph-*`, `ph-fill ph-*`).

### Как работает JS (assets/js/main.js)

Одна IIFE, навешивает `html.js` в самом начале — CSS прячет `.reveal`/`.hero-word` **только** при наличии этого класса, поэтому упавший JS не оставит пустую страницу. На старте читаются `reduceMotion`, `hasGSAP`, `forceStatic` (`?static`); если любой повод отказаться от анимации — вызывается `revealAllStatic()` + статические счётчики, иначе запускается полный набор: `heroIntro`, `scrollReveals` (батч через `ScrollTrigger.batch`, без ручных scroll-листенеров), `navCondense`, `horizontalPan` (пин-секция «Атмосфера», на <768px и RM откатывается на нативный scroll-snap), `runCounters`, `setupMagnetic`.

Перформанс-инварианты, которых придерживается код (сохраняйте их):
- анимировать только `transform`/`opacity`;
- никаких `addEventListener('scroll')` — позиция скролла только через ScrollTrigger;
- зерно (`.grain`) — `position: fixed`, не на скролл-контейнере.

Форма записи (`bookingForm`) — клиентская валидация (имя + ≥10 цифр телефона) и имитация отправки; реального бэкенда нет. Точка интеграции онлайн-записи (YClients) помечена `TODO` в `index.html` рядом с кнопкой сабмита.

### Изображения

Продакшен-фото лежат в `assets/img/` (см. `assets/img/attribution.txt` — обязательная атрибуция Unsplash, продублирована в `#photo-credits` футера). Сейчас в разметке `<img src>` указывают на удалённые URL Unsplash. `setupImageFallback()` подменяет отсутствующие локальные `assets/img/*` на seeded-плейсхолдеры picsum — срабатывает только для путей вида `assets/img/...`.

## Заметки

- `unsplash.txt` содержит ключи Unsplash API — не коммитить в публичные репозитории и не включать в клиентский код.
- Не git-репозиторий.
