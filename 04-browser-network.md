# Браузер, сеть, производительность, безопасность

## Что происходит после ввода URL (классика — рассказ на 2 минуты)

1. DNS-резолв (кеши: браузер → ОС → резолвер провайдера → рекурсивный поиск).
2. TCP handshake + TLS handshake (или QUIC/HTTP3 — поверх UDP, быстрее установка).
3. HTTP-запрос → ответ с HTML.
4. Парсинг HTML → DOM; CSS → CSSOM; `<script>` без async/defer блокирует парсер.
5. DOM + CSSOM → Render Tree → **Layout** (геометрия) → **Paint** (отрисовка слоёв) → **Composite** (сборка слоёв на GPU).
6. Догружаются ресурсы, выполняется JS, гидратация (если SSR).

**Критический путь рендеринга**: CSS блокирует рендер; JS блокирует парсинг и ждёт CSSOM. Отсюда: критический CSS инлайном, `defer` для скриптов, preload для важных ресурсов.

**Reflow vs repaint**: изменение геометрии → layout (дорого, каскадно); цвет → paint; `transform`/`opacity` → только composite (поэтому анимируем именно их). **Layout thrashing** — чередование чтения (offsetHeight) и записи стилей в цикле; лечится группировкой чтений/записей, rAF.

## Core Web Vitals

- **LCP** (< 2.5s) — отрисовка самого крупного элемента. Чинить: серверный рендер, оптимизация картинок (WebP/AVIF, `srcset`, priority/preload hero-image, без lazy на LCP-элементе!), CDN, критический CSS, быстрый TTFB.
- **INP** (< 200ms) — отзывчивость на взаимодействия (заменил FID). Чинить: резать длинные задачи (> 50ms) на куски, `useTransition`, дебаунс тяжёлых обработчиков, Web Workers, меньше JS.
- **CLS** (< 0.1) — сдвиги макета. Чинить: фиксированные размеры для картинок/рекламы/эмбедов (width/height, aspect-ratio), `font-display: swap` + подгонка fallback-шрифта, не вставлять контент над существующим.

Измерение: Lighthouse (лаборатория), CrUX/RUM (поле, реальные пользователи — важнее), Performance-панель DevTools.

## Оптимизация загрузки

- **Code splitting**: по роутам (Next делает сам), `React.lazy` + Suspense, динамический `import()` для тяжёлых виджетов.
- **Tree shaking** — вырезание неиспользуемых экспортов (ESM, sideEffects). Анализ бандла (webpack-bundle-analyzer), замена тяжёлых зависимостей (moment → dayjs/date-fns).
- Картинки — обычно самое тяжёлое: современные форматы, ленивая загрузка (`loading="lazy"`, IntersectionObserver), CDN-ресайз, `next/image`.
- `preload` (нужен сейчас), `prefetch` (понадобится потом), `preconnect` (ранний коннект к домену).
- Виртуализация длинных списков (react-window / TanStack Virtual).

## HTTP-кеширование

- `Cache-Control: max-age=...` — срок свежести; `no-cache` — можно хранить, но ревалидировать; `no-store` — не хранить; `immutable`, `stale-while-revalidate`.
- Ревалидация: `ETag`/`If-None-Match`, `Last-Modified`/`If-Modified-Since` → 304 без тела.
- Паттерн продакшена: статика с хешем в имени → `max-age=31536000, immutable`; HTML → `no-cache`.
- Service Worker — программируемый кеш (офлайн, PWA): cache-first для статики, network-first/stale-while-revalidate для данных.

## Сеть и realtime

- HTTP/1.1 — очередь запросов на соединение (head-of-line blocking) → HTTP/2 — мультиплексирование по одному соединению → HTTP/3 (QUIC) — убирает HOL на транспортном уровне, быстрее на плохих сетях.
- **Realtime**: короткий/длинный polling (просто, но накладно) → **SSE** (однонаправленный поток сервер→клиент, авто-reconnect, обычный HTTP — нотификации, стриминг LLM-ответов) → **WebSocket** (двунаправленный — чаты, курсоры, игры). Выбор объяснять от требований.

## Безопасность (спрашивают всегда)

**XSS** — исполнение чужого JS на твоей странице (stored / reflected / DOM-based). Защита: экранирование вывода (React делает по умолчанию; опасно — `dangerouslySetInnerHTML`, `href="javascript:..."`), санитизация HTML (DOMPurify), **CSP** (`script-src` без `unsafe-inline`, nonce), `HttpOnly` cookie — токен не достать из JS.

**CSRF** — чужой сайт отправляет запрос от имени залогиненного пользователя (браузер сам приложит cookie). Защита: `SameSite=Lax/Strict` cookie (сейчас основной механизм), CSRF-токены, проверка Origin.

**CORS** — не защита сервера, а ослабление same-origin policy браузера: сервер заголовками (`Access-Control-Allow-Origin` и др.) разрешает кросс-доменные запросы; preflight OPTIONS для «непростых» запросов. Уметь объяснить, почему «CORS-ошибка» — это про сервер, а не про фронт.

**Хранение токенов**: localStorage уязвим к XSS; `HttpOnly + Secure + SameSite` cookie — предпочтительно; access в памяти + refresh в HttpOnly cookie — типовая схема. Плюс: `iframe`-защита (`frame-ancestors`), Subresource Integrity для CDN-скриптов, secrets никогда не в клиентском бандле (`NEXT_PUBLIC_` — публично!).

## Хранилища в браузере

`localStorage` (синхронный, ~5MB, строки, общий для вкладок) / `sessionStorage` (на вкладку) / cookie (~4KB, ездят с каждым запросом — потому маленькие) / IndexedDB (асинхронная БД, большие объёмы, доступна в воркерах) / Cache API (для SW).

## Чек-лист

- [ ] Рассказать «от URL до пикселей» за 2 минуты
- [ ] LCP/INP/CLS: определение + по 3 способа улучшить каждый
- [ ] XSS vs CSRF — разница и защита (частый вопрос «чем отличаются»)
- [ ] Почему анимируем transform/opacity
- [ ] ETag vs max-age; паттерн кеширования статики с хешем
- [ ] SSE vs WebSocket vs polling — когда что
