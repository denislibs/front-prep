---
title: "Web Worker: выносим работу с главного потока"
---

# Web Worker: выносим работу с главного потока

Главный поток браузера один, и он делает всё: разбирает HTML, считает стили, выполняет ваш JavaScript, обрабатывает клики и рисует кадры. Пока он занят одним делом, он не делает ничего другого — это подробно разобрано в статье [как работает браузер](./browser-rendering-event-loop). Разбор двадцатимегабайтного JSON на 400 миллисекунд означает, что 400 миллисекунд страница не реагирует ни на что: ни на клик, ни на скролл, ни на анимацию спиннера, который вы так заботливо показали.

Web Worker — способ завести второй поток и убрать тяжёлое туда. Звучит просто, но у этого есть цена: воркер не видит DOM, общается только сообщениями, а сами сообщения бывают дороже, чем работа, которую вы вынесли. Эта статья — про то, где выигрыш реален, где мнимый, и как написать обёртку, с которой воркером приятно пользоваться.

## Часть 1. Что именно решает воркер

### Одна очередь на всё

Событийный цикл главного потока обрабатывает задачи по одной, до конца. Функция, которая считает три секунды, — это одна задача длиной три секунды. За это время браузер не нарисует ни одного кадра и не обработает ни одного события: они честно лежат в очереди и ждут.

```js
// Классический замораживатель: 300–800 мс на среднем ноутбуке
function hashAll(items) {
  return items.map((item) => expensiveHash(JSON.stringify(item)));
}

button.addEventListener('click', () => {
  spinner.hidden = false;        // спиннер даже не появится на экране:
  const result = hashAll(data);  // кадр не будет нарисован до конца этой строки
  render(result);
});
```

Спиннер здесь не покажется вообще. Мы изменили DOM, но отрисовка происходит после завершения задачи — а задача завершится только после `hashAll`.

Есть два способа это исправить. Первый — нарезать работу на куски и отдавать управление между ними (`setTimeout`, `scheduler.yield`, `requestIdleCallback`). Он не требует воркера, но и не убирает работу с главного потока: она просто размазывается, кадры всё равно становятся длиннее, а суммарное время растёт из-за накладных расходов на нарезку.

Второй — вынести всё в другой поток. Тогда главный поток свободен полностью: анимации идут плавно, интерфейс отзывчив, а результат приезжает сообщением.

<figure class="diagram">
<svg viewBox="0 0 780 300" role="img" aria-label="Временная шкала: тяжёлая задача на главном потоке блокирует кадры, та же задача в воркере — нет">
  <style>
    .tl-box { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-divider); stroke-width: 1.5; }
    .tl-busy { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-brand-1); stroke-width: 2; }
    .tl-t { fill: var(--vp-c-text-1); font: 700 13px/1 ui-sans-serif, system-ui, sans-serif; }
    .tl-s { fill: var(--vp-c-text-2); font: 400 11px/1 ui-sans-serif, system-ui, sans-serif; }
    .tl-m { fill: var(--vp-c-text-3); font: 400 10px/1 ui-monospace, monospace; }
    .tl-tick { stroke: var(--vp-c-divider); stroke-width: 1; }
    .tl-a { stroke: var(--vp-c-text-3); stroke-width: 1.5; fill: none; }
  </style>
  <defs>
    <marker id="ww-ah1" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0 1 L7 4 L0 7" fill="none" stroke="var(--vp-c-text-3)" stroke-width="1.5"/>
    </marker>
  </defs>

  <text class="tl-t" x="20" y="24">Без воркера</text>
  <text class="tl-s" x="20" y="48">главный поток</text>
  <rect class="tl-box" x="130" y="34" width="40" height="26" rx="2"/>
  <text class="tl-m" x="150" y="51" text-anchor="middle">клик</text>
  <rect class="tl-busy" x="172" y="34" width="410" height="26" rx="2"/>
  <text class="tl-s" x="377" y="51" text-anchor="middle">расчёт, 400 мс — очередь стоит</text>
  <rect class="tl-box" x="584" y="34" width="90" height="26" rx="2"/>
  <text class="tl-m" x="629" y="51" text-anchor="middle">рендер</text>

  <text class="tl-s" x="20" y="88">кадры</text>
  <path class="tl-tick" d="M130 76 V96 M156 76 V96 M582 76 V96 M608 76 V96 M634 76 V96"/>
  <text class="tl-m" x="360" y="92" text-anchor="middle">ни одного кадра — интерфейс заморожен</text>

  <path class="tl-a" d="M20 118 H760" marker-end="url(#ww-ah1)"/>
  <text class="tl-m" x="740" y="136">время</text>

  <text class="tl-t" x="20" y="180">С воркером</text>
  <text class="tl-s" x="20" y="204">главный поток</text>
  <rect class="tl-box" x="130" y="190" width="40" height="26" rx="2"/>
  <text class="tl-m" x="150" y="207" text-anchor="middle">клик</text>
  <rect class="tl-box" x="172" y="190" width="60" height="26" rx="2"/>
  <text class="tl-m" x="202" y="207" text-anchor="middle">post</text>
  <rect class="tl-box" x="584" y="190" width="90" height="26" rx="2"/>
  <text class="tl-m" x="629" y="207" text-anchor="middle">рендер</text>

  <text class="tl-s" x="20" y="244">воркер</text>
  <rect class="tl-busy" x="234" y="230" width="348" height="26" rx="2"/>
  <text class="tl-s" x="408" y="247" text-anchor="middle">тот же расчёт, 400 мс</text>

  <text class="tl-s" x="20" y="284">кадры</text>
  <path class="tl-tick" d="M130 272 V292 M182 272 V292 M234 272 V292 M286 272 V292 M338 272 V292 M390 272 V292 M442 272 V292 M494 272 V292 M546 272 V292 M598 272 V292 M650 272 V292"/>
  <text class="tl-m" x="390" y="288" text-anchor="middle">кадры идут ровно, спиннер крутится</text>
</svg>
<figcaption>Работа занимает столько же времени. Меняется то, свободен ли главный поток, пока она идёт.</figcaption>
</figure>

## Часть 2. Что воркер умеет и чего не умеет

Воркер — это отдельный поток со своим глобальным объектом (`DedicatedWorkerGlobalScope`, доступен как `self`), своим событийным циклом и своей кучей объектов. Общей памяти с главным потоком у него нет — кроме одного исключения, о котором в части 6.

**Есть:** `fetch`, `XMLHttpRequest`, `IndexedDB`, `Cache Storage`, `WebAssembly`, `crypto.subtle`, `postMessage`, таймеры, `OffscreenCanvas`, `WebSocket`, `importScripts`, `performance`, `Atomics`, `TextEncoder`/`TextDecoder`, `URL`, `Blob`, `FileReader`.

**Нет:** `window`, `document`, DOM целиком, `localStorage` и `sessionStorage` (они синхронные, а синхронный доступ к диску из потока запрещён), `alert`, прямого доступа к переменным страницы.

Отсутствие DOM — не недоработка, а условие безопасности. DOM не потокобезопасен: если бы два потока могли одновременно менять дерево, понадобились бы блокировки, а с ними — взаимные блокировки и гонки в каждом приложении. Вместо этого браузер оставил DOM за одним потоком, а обмен сделал через сообщения. Родственник воркера — [Service Worker](./service-worker) — устроен так же и по той же причине.

Из отсутствия DOM следует практическое правило: **в воркер выносят вычисления и данные, а не логику интерфейса**. Воркер парсит, считает, сжимает, ищет; главный поток рисует.

Отсутствие `localStorage` компенсируется `IndexedDB` — она асинхронная и в воркере работает (см. [хранилища в браузере](./storage-and-quotas)). Это, кстати, аргумент против `localStorage` даже на главном потоке: данные, лежащие в нём, недоступны воркеру.

## Часть 3. Создание и обмен сообщениями

```js
// main.js
const worker = new Worker(new URL('./parse.worker.js', import.meta.url), {
  type: 'module',   // современный вариант: внутри работает import
  name: 'parser',   // имя видно в DevTools — очень помогает при отладке
});

worker.postMessage({ type: 'parse', payload: rawText });

worker.addEventListener('message', (event) => {
  const { type, result } = event.data;
  if (type === 'done') render(result);
});

// Ошибки, не пойманные внутри воркера, приезжают сюда
worker.addEventListener('error', (event) => {
  console.error('воркер упал:', event.message, event.filename, event.lineno);
});

// Сообщение, которое воркер не смог сериализовать
worker.addEventListener('messageerror', (event) => {
  console.error('сообщение не клонировалось', event);
});

// Когда воркер больше не нужен — иначе поток и его память живут вечно
// worker.terminate();
```

```js
// parse.worker.js
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  if (type !== 'parse') return;

  const result = heavyParse(payload);
  self.postMessage({ type: 'done', result });
});
```

Несколько неочевидных вещей.

`new URL('./parse.worker.js', import.meta.url)` — не украшательство. Именно эта конструкция позволяет сборщикам (Vite, webpack 5, Rollup, Parcel) распознать воркер, собрать его отдельным файлом и подставить итоговый путь с хешем. Строковый литерал `new Worker('./parse.worker.js')` они не поймут, и в продакшене файл не найдётся.

`worker.terminate()` убивает поток немедленно, посреди любой операции. Никаких «дай доделать» — если воркер писал в IndexedDB, транзакция оборвётся. Внутри воркера есть `self.close()` — вежливый вариант: воркер завершит текущую задачу и закроется.

Воркер — не бесплатный объект. Каждый экземпляр — это отдельная реализация движка JavaScript со своей кучей: порядка нескольких мегабайт памяти и десятки миллисекунд на запуск. Плодить их по одному на задачу нельзя (см. часть 8).

### Ошибки не проваливаются сами

Исключение внутри обработчика `message` не превратится в отклонённый промис на главном потоке — оно придёт событием `error`, и то не всегда содержательно (для кросс-доменных скриптов текст будет `Script error`). Ловите ошибки внутри воркера и передавайте их явно:

```js
// parse.worker.js — передаём ошибку структурой, а не полагаемся на event error
self.addEventListener('message', async (event) => {
  const { id, type, payload } = event.data;
  try {
    const result = await handlers[type](payload);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    // Объект Error клонируется, но подклассы теряют прототип и свои поля
    self.postMessage({
      id,
      ok: false,
      error: { name: err.name, message: err.message, stack: err.stack },
    });
  }
});
```

Про то, как ошибки ведут себя в асинхронном коде вообще, — в статье [ошибки и отладка](./errors-and-debugging).

## Часть 4. Структурное клонирование

`postMessage` не передаёт ссылку на объект. Он **копирует** его алгоритмом **структурного клонирования** (structured clone). Это не `JSON.parse(JSON.stringify(x))` — алгоритм умнее.

**Копируется:** примитивы, обычные объекты и массивы, `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer` и типизированные массивы, `Blob`, `File`, `FileList`, `ImageData`, `Error`, циклические ссылки (в отличие от JSON — они сохранятся корректно).

**Не копируется, бросает `DataCloneError`:** функции, символы, DOM-узлы, классы с методами (прототип теряется — приедет обычный объект с полями), геттеры (вычислятся в обычные свойства), `WeakMap` и `WeakSet`.

```js
class User {
  constructor(name) { this.name = name; }
  greet() { return `Привет, ${this.name}`; }
}

worker.postMessage(new User('Аня'));
// В воркере приедет { name: 'Аня' } — обычный объект.
// event.data.greet больше не существует, instanceof User — false.

worker.postMessage({ done: () => {} });
// DataCloneError: функция не клонируется
```

Прототип теряется — это ловит почти каждый на первом воркере. Если вам нужны методы, передавайте данные и восстанавливайте объект на той стороне: `Object.assign(new User(), event.data)`. Подробнее о том, как устроены прототипы, — в статье [прототипы и классы](./prototypes-and-classes).

### Копирование стоит времени

Главное, что нужно понимать про клонирование: **оно синхронное и происходит на потоке отправителя**. Отправляете из главного потока массив на 50 мегабайт — главный поток замирает на время сериализации. Вы вынесли расчёт, но подвесили интерфейс на самой передаче.

Порядок величин на обычном ноутбуке (замеряйте у себя, цифры зависят от машины и формы данных):

- массив из миллиона чисел (`Array`, около 8 МБ полезных данных) — десятки миллисекунд туда и столько же обратно;
- `Float64Array` того же размера — заметно быстрее: у типизированного массива плотное непрерывное представление, копируется он почти как `memcpy`;
- дерево из сотен тысяч мелких объектов — сотни миллисекунд: каждый объект обходится отдельно.

Отсюда практическое следствие: **форма данных важнее их объёма**. Миллион чисел в `Float64Array` передаётся кратно быстрее, чем сто тысяч объектов вида `{ x, y }`. Если планируете гонять данные между потоками, храните их в типизированных массивах с самого начала.

Замерить у себя можно так:

```js
function measureClone(data, label) {
  const t0 = performance.now();
  // structuredClone — тот же алгоритм, что у postMessage, но синхронно и на месте
  structuredClone(data);
  console.log(label, (performance.now() - t0).toFixed(1), 'мс');
}

const objects = Array.from({ length: 200_000 }, (_, i) => ({ x: i, y: i * 2 }));
const typed = new Float64Array(400_000);

measureClone(objects, 'массив объектов');
measureClone(typed, 'Float64Array');
```

## Часть 5. Передаваемые объекты

Есть способ передать данные **без копирования вообще** — отдать владение. Такие объекты называются **передаваемыми** (transferable): `ArrayBuffer`, `MessagePort`, `ImageBitmap`, `OffscreenCanvas`, `ReadableStream`, `WritableStream`.

```js
const buffer = new ArrayBuffer(64 * 1024 * 1024);  // 64 МБ

// Второй аргумент — список того, что передаём во владение
worker.postMessage({ type: 'process', buffer }, [buffer]);

console.log(buffer.byteLength);  // 0 — буфер отсоединён (detached)
new Uint8Array(buffer);          // TypeError: буфер больше не наш
```

Механика простая: браузер не копирует байты, а переписывает указатель на область памяти из одного потока в другой. Время передачи перестаёт зависеть от размера — оно постоянно, доли миллисекунды хоть на мегабайт, хоть на гигабайт.

Плата — **буфер становится непригоден у отправителя**. Он «отсоединён»: `byteLength` равен нулю, любое чтение или запись бросает ошибку. Это не баг, а суть операции: владелец ровно один, гонок быть не может.

<figure class="diagram">
<svg viewBox="0 0 760 300" role="img" aria-label="Сравнение копирования буфера и передачи владения буфером">
  <style>
    .tr-box { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-divider); stroke-width: 1.5; }
    .tr-hot { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-brand-1); stroke-width: 2; }
    .tr-dead { fill: none; stroke: var(--vp-c-divider); stroke-width: 1.5; stroke-dasharray: 5 4; }
    .tr-t { fill: var(--vp-c-text-1); font: 700 13px/1 ui-sans-serif, system-ui, sans-serif; }
    .tr-s { fill: var(--vp-c-text-2); font: 400 11px/1 ui-sans-serif, system-ui, sans-serif; }
    .tr-a { stroke: var(--vp-c-text-3); stroke-width: 1.5; fill: none; }
  </style>
  <defs>
    <marker id="ww-ah2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0 1 L7 4 L0 7" fill="none" stroke="var(--vp-c-text-3)" stroke-width="1.5"/>
    </marker>
  </defs>

  <text class="tr-t" x="20" y="26">Копирование: postMessage(data)</text>
  <text class="tr-s" x="20" y="60">главный поток</text>
  <rect class="tr-hot" x="140" y="44" width="150" height="42" rx="2"/>
  <text class="tr-s" x="215" y="70" text-anchor="middle">буфер 64 МБ</text>
  <path class="tr-a" d="M294 65 H436" marker-end="url(#ww-ah2)"/>
  <text class="tr-s" x="365" y="56" text-anchor="middle">байты копируются</text>
  <rect class="tr-hot" x="440" y="44" width="150" height="42" rx="2"/>
  <text class="tr-s" x="515" y="70" text-anchor="middle">копия 64 МБ</text>
  <text class="tr-s" x="612" y="70">воркер</text>
  <text class="tr-s" x="140" y="112">Итого 128 МБ памяти, время растёт с размером,</text>
  <text class="tr-s" x="140" y="130">отправитель заблокирован на время копии.</text>

  <text class="tr-t" x="20" y="186">Передача владения: postMessage(data, [buffer])</text>
  <text class="tr-s" x="20" y="220">главный поток</text>
  <rect class="tr-dead" x="140" y="204" width="150" height="42" rx="2"/>
  <text class="tr-s" x="215" y="230" text-anchor="middle">отсоединён, 0 байт</text>
  <path class="tr-a" d="M294 225 H436" marker-end="url(#ww-ah2)"/>
  <text class="tr-s" x="365" y="216" text-anchor="middle">переезжает указатель</text>
  <rect class="tr-hot" x="440" y="204" width="150" height="42" rx="2"/>
  <text class="tr-s" x="515" y="230" text-anchor="middle">буфер 64 МБ</text>
  <text class="tr-s" x="612" y="230">воркер</text>
  <text class="tr-s" x="140" y="272">Итого 64 МБ, время постоянное. Цена: у отправителя данных больше нет.</text>
</svg>
<figcaption>Передача владения бесплатна по времени, но односторонняя: буфер уходит навсегда, пока его не вернут обратно.</figcaption>
</figure>

### Рабочий приём: маятник буферов

Раз буфер уходит, его нужно возвращать. Типичный шаблон обработки данных — воркер отдаёт тот же буфер назад:

```js
// main.js
async function processInWorker(worker, buffer) {
  return new Promise((resolve) => {
    worker.addEventListener('message', function onDone(event) {
      worker.removeEventListener('message', onDone);
      resolve(event.data.buffer);   // получаем буфер обратно во владение
    });
    worker.postMessage({ buffer }, [buffer]);
  });
}

let buf = new ArrayBuffer(32 * 1024 * 1024);
buf = await processInWorker(worker, buf);   // важно переприсвоить: старая ссылка мертва
```

```js
// worker.js
self.addEventListener('message', (event) => {
  const { buffer } = event.data;
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i++) view[i] = transform(view[i]);
  // Возвращаем владение обратно
  self.postMessage({ buffer }, [buffer]);
});
```

Обратите внимание: `buf = await ...`. Забыть переприсвоить — самая частая ошибка: код продолжит держать отсоединённую ссылку и упадёт при первом обращении.

Типизированный массив передать нельзя — передаётся его буфер. Если из одного `ArrayBuffer` сделано несколько представлений (`Uint8Array`, `Float32Array` на разные участки), после передачи **все** они станут нерабочими: буфер один.

```js
const pixels = new Uint8ClampedArray(width * height * 4);
// Передаём .buffer, а не сам массив
worker.postMessage({ pixels, width, height }, [pixels.buffer]);
```

## Часть 6. SharedArrayBuffer и заголовки

`SharedArrayBuffer` — буфер, который **виден обоим потокам одновременно**. Не копия и не переезд, а настоящая общая память: записал байт в одном потоке — второй его видит.

```js
// main.js
const shared = new SharedArrayBuffer(1024 * 1024);
const view = new Int32Array(shared);
worker.postMessage({ shared });   // клонируется дескриптор, память общая

// Атомарные операции — единственный безопасный способ работы с общей памятью
Atomics.store(view, 0, 42);
Atomics.add(view, 1, 1);
const value = Atomics.load(view, 0);
```

Зачем `Atomics`: обычные чтение и запись из двух потоков — это гонка. Процессор и компилятор вправе переупорядочить операции, а запись многобайтового значения может быть увидена наполовину. `Atomics` даёт неделимые операции и барьеры памяти. Есть также `Atomics.wait` (заблокировать поток до сигнала — **только в воркере**, на главном потоке запрещено) и `Atomics.notify`.

Использовать это стоит редко: ради счётчика прогресса, кольцевого буфера аудио, обмена с многопоточным WebAssembly. Для обычной передачи данных `postMessage` проще и безопаснее.

### Почему нужны специальные заголовки

`SharedArrayBuffer` был отключён во всех браузерах после атак Spectre в 2018 году. Суть проблемы: общая память плюс атомарные операции дают таймер очень высокой точности, а с ним можно измерять время доступа к кешу процессора и по крупицам вытаскивать данные из чужой памяти в том же процессе.

Решение — **изоляция от чужого происхождения** (cross-origin isolation). Страница получает `SharedArrayBuffer`, только если пообещала не тянуть к себе чужие ресурсы без разрешения:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Проверить: `self.crossOriginIsolated === true`.

Цена ощутимая, и её надо знать заранее. `COEP: require-corp` означает, что **любой** сторонний ресурс — картинка с CDN, iframe с видео, скрипт аналитики, шрифт — должен прислать `Cross-Origin-Resource-Policy: cross-origin` или пройти CORS. Иначе он просто не загрузится. `COOP: same-origin` рвёт связь с окнами, открытыми через `window.open`, — ломаются всплывающие окна OAuth и виджеты оплаты.

Практический вывод: включать изоляцию ради `SharedArrayBuffer` стоит, только если она вам действительно необходима (обычно — многопоточный WebAssembly или обработка видео). Для 95% задач хватает `postMessage` с передаваемыми объектами.

## Часть 7. Обёртка над сообщениями своими руками

Сырой `postMessage` неудобен: обмен «сообщение туда, событие обратно» никак не связывает запрос с ответом. Если отправить три запроса, три ответа приедут в один обработчик, и различить их нечем. Решение — свой протокол с идентификаторами и промисом на каждый запрос. Это, по сути, мини-версия библиотеки Comlink.

```js
// worker-rpc.js — сторона главного потока
export function createRpc(worker) {
  const pending = new Map();
  let nextId = 1;

  worker.addEventListener('message', (event) => {
    const { id, ok, result, error } = event.data;
    const entry = pending.get(id);
    if (!entry) return;                 // ответ на отменённый запрос — игнорируем
    pending.delete(id);
    clearTimeout(entry.timer);
    if (ok) entry.resolve(result);
    else entry.reject(Object.assign(new Error(error.message), error));
  });

  worker.addEventListener('error', (event) => {
    // Воркер умер — все ожидающие промисы надо отклонить, иначе await зависнет навсегда
    const err = new Error('worker crashed: ' + event.message);
    for (const entry of pending.values()) entry.reject(err);
    pending.clear();
  });

  function call(method, payload, { transfer = [], timeoutMs = 30_000 } = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} не ответил за ${timeoutMs} мс`));
      }, timeoutMs);

      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ id, method, payload }, transfer);
    });
  }

  // Синтаксический сахар: rpc.parseCsv(text) вместо rpc.call('parseCsv', text)
  const proxy = new Proxy({ call }, {
    get: (target, prop) =>
      prop in target ? target[prop] : (payload, opts) => call(prop, payload, opts),
  });

  return proxy;
}
```

```js
// rpc.worker.js — сторона воркера
const methods = {
  async parseCsv(text) { /* ... */ },
  async hashAll(items) { /* ... */ },
};

self.addEventListener('message', async (event) => {
  const { id, method, payload } = event.data;
  const fn = methods[method];

  if (!fn) {
    self.postMessage({ id, ok: false, error: { message: `нет метода ${method}` } });
    return;
  }

  try {
    const result = await fn(payload);
    // Если результат — буфер, отдаём его владением, а не копией
    const transfer = result instanceof ArrayBuffer ? [result] : [];
    self.postMessage({ id, ok: true, result }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: { name: err.name, message: err.message } });
  }
});
```

Использование:

```js
const rpc = createRpc(new Worker(new URL('./rpc.worker.js', import.meta.url), { type: 'module' }));
const rows = await rpc.parseCsv(fileText);
```

Что здесь важно, помимо удобства:

**Таймаут.** Без него зависший воркер оставляет вечно висящие промисы, а вместе с ними — утечку памяти: замыкания `resolve` и `reject` держат ссылки на всё, что было в области видимости (см. [память и утечки](./memory-and-leaks)).

**Обработка падения.** Если воркер упал, никто не пришлёт ответ. Отклонить все ожидающие промисы обязательно.

**`Proxy` для сахара.** Он же — главный трюк Comlink: обращение к несуществующему свойству превращается в вызов метода. Об устройстве `Proxy` — в статье [функции и паттерны](./functions-and-patterns).

Если по каналу нужно передавать данные в обе стороны непрерывно (стрим прогресса), удобнее `MessageChannel`: он создаёт пару портов, один из которых можно передать воркеру как transferable, и дальше общаться по выделенному каналу, не мешая основному.

## Часть 8. Пул воркеров

Один воркер обрабатывает задачи по очереди — у него тоже один поток. Если задач много и они независимы, нужен пул.

### Сколько заводить

`navigator.hardwareConcurrency` — число логических ядер. Заводить столько же воркеров нельзя: главный поток тоже нуждается в ядре, и браузер выполняет свою работу.

```js
const size = Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, 8));
```

Верхний потолок нужен: на 32-ядерном сервере разработчика 31 воркер съест сотню мегабайт памяти впустую. Нижняя граница — на случай, если браузер не отдаёт реальное число (Safari занижает его из соображений приватности, возвращая ограниченное значение).

### Пул с очередью и отменой

```js
export class WorkerPool {
  #idle = [];
  #busy = new Set();
  #queue = [];

  constructor(url, size = navigator.hardwareConcurrency - 1 || 3) {
    for (let i = 0; i < size; i++) {
      this.#idle.push(new Worker(url, { type: 'module' }));
    }
  }

  run(payload, { signal, transfer = [] } = {}) {
    return new Promise((resolve, reject) => {
      const task = { payload, transfer, resolve, reject, signal };

      if (signal) {
        if (signal.aborted) return reject(signal.reason);
        signal.addEventListener('abort', () => {
          // Задача ещё в очереди — просто выкидываем, воркер не тронут
          const i = this.#queue.indexOf(task);
          if (i !== -1) {
            this.#queue.splice(i, 1);
            reject(signal.reason);
          }
          // Если уже выполняется — отменить нельзя, см. ниже
        }, { once: true });
      }

      this.#queue.push(task);
      this.#pump();
    });
  }

  #pump() {
    while (this.#queue.length && this.#idle.length) {
      const task = this.#queue.shift();
      const worker = this.#idle.pop();
      this.#busy.add(worker);

      const onMessage = (event) => {
        cleanup();
        event.data.ok ? task.resolve(event.data.result)
                      : task.reject(new Error(event.data.error));
      };
      const onError = (event) => {
        cleanup();
        task.reject(new Error(event.message));
      };
      const cleanup = () => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        this.#busy.delete(worker);
        this.#idle.push(worker);
        this.#pump();
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage(task.payload, task.transfer);
    }
  }

  destroy() {
    for (const w of [...this.#idle, ...this.#busy]) w.terminate();
    this.#idle = [];
    this.#busy.clear();
    for (const t of this.#queue) t.reject(new Error('пул уничтожен'));
    this.#queue = [];
  }
}
```

### Про отмену честно

Отменить **уже запущенную** задачу в воркере невозможно: синхронный расчёт нельзя прервать снаружи. Варианты, все с ценой:

1. **Убить воркер** (`terminate`) и создать новый. Работает всегда, стоит десятки миллисекунд на запуск замены и теряет прогретое состояние воркера (загруженные словари, скомпилированный WebAssembly).
2. **Нарезать работу внутри воркера** на куски и проверять флаг отмены между ними. Флаг приходит сообщением — но воркер увидит его, только когда вернёт управление своему циклу событий. Значит, работа обязана быть нарезанной.
3. **Разделяемый флаг** через `SharedArrayBuffer`: воркер читает `Atomics.load` прямо в горячем цикле и выходит. Единственный способ прервать «настоящий» тяжёлый цикл, но требует изоляции происхождения из части 6.

Отдельно: если задачу можно отменить, чаще всего её стоит и **дедуплицировать**. Пользователь набирает в поиске — не запускайте пять расчётов, отменяйте предыдущий.

## Часть 9. Когда воркер не нужен

Накладные расходы воркера складываются из трёх частей: запуск (десятки миллисекунд однократно), клонирование данных туда, клонирование результата обратно. Если сама работа занимает меньше этой суммы, вы сделали хуже.

Ориентир: **если задача укладывается в 5–10 миллисекунд, воркер не нужен**. Она и так не создаст пропущенного кадра.

Плохие кандидаты:

- Форматирование сотни строк, сортировка массива из тысячи элементов, любая работа с DOM — вынести всё равно не выйдет, DOM в воркере нет.
- Задачи, где данные больше результата в разы: передали 100 МБ, чтобы получить число. Копирование сожрёт весь выигрыш — если только не использовать передачу владения.
- Ожидание сети. `fetch` и так асинхронный, главный поток он не блокирует. Выносить сам запрос в воркер бессмысленно; выносить разбор большого ответа — осмысленно, причём вместе с запросом: пусть воркер сам сходит в сеть и вернёт уже разобранное, тогда сырой текст вообще не попадёт на главный поток.

Хорошие кандидаты:

- **Разбор большого JSON.** `JSON.parse` синхронный и на десятках мегабайт даёт сотни миллисекунд. Пусть воркер сделает `fetch` и `parse`, а вернёт готовую структуру — или, ещё лучше, уже сведённые данные, а не всё дерево.
- **Поиск и индексация.** Полнотекстовый индекс по клиентским данным строится долго, а держать его в воркере естественно: главный поток шлёт строку, получает список идентификаторов.
- **Обработка изображений.** Свёртки, ресайз, распознавание. Плюс здесь `OffscreenCanvas`: canvas можно передать воркеру во владение, и тогда воркер рисует сам, вообще не трогая главный поток.
- **Шифрование и хеширование.** `crypto.subtle` доступен в воркере, а вычисление хеша большого файла — типичная длинная задача.
- **Парсинг CSV и других форматов.** Особенно с потоковым чтением: воркер читает `ReadableStream` файла кусками и шлёт разобранные строки пачками, а не одним гигантским массивом.

Про последнее: **шлите пачками**. Одно сообщение на строку CSV — это миллион сообщений, и каждое пройдёт через событийный цикл главного потока. Пачка из тысячи строк — тысяча сообщений, что уже приемлемо.

## Часть 10. Модульные воркеры и сборка

Исторически воркеры были «классическими»: один файл, зависимости через `importScripts` (синхронный, без дерева зависимостей). Сегодня есть модульные:

```js
new Worker(new URL('./w.js', import.meta.url), { type: 'module' });
```

Внутри работают обычные `import` и `export`, а `importScripts` — запрещён. Сборщики это понимают: Vite и webpack 5 видят конструкцию `new URL(..., import.meta.url)` внутри `new Worker`, собирают отдельный бандл и подставляют финальный путь. Про механику модулей и сборки — в статье [модули и сборка](./modules-and-bundling).

Тонкости, которые всплывают на практике:

**Общий код дублируется.** Утилита, импортированная и в главный бандл, и в воркер, попадёт в оба файла. Общего кеша модулей у потоков нет — это разные реализации движка. Иногда это неприятно для размера бандла, но исправить нельзя.

**Воркер обязан быть с того же origin.** Скрипт с CDN напрямую в `new Worker` не передать. Обход — скачать текст и создать `Blob`:

```js
const code = await fetch(cdnUrl).then((r) => r.text());
const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
const worker = new Worker(blobUrl);
URL.revokeObjectURL(blobUrl);   // ссылку можно отозвать сразу после создания
```

Цена приёма: относительные `import` внутри такого воркера сломаются (базовый URL стал `blob:`), и Content Security Policy должна разрешать `worker-src blob:`.

**Разработка.** В Vite модульные воркеры работают в дев-режиме из коробки; в некоторых старых конфигурациях webpack требуется указать `worker` в правилах. Отлаживаются воркеры отдельно: в DevTools вкладка Sources содержит раздел с потоками, точки останова там ставятся обычным образом, а `console.log` из воркера попадает в общую консоль с пометкой.

**Тесты.** В Node и в jsdom `Worker` отсутствует. Практичный подход: вынести чистую логику в обычный модуль и тестировать её напрямую, а воркер оставить тонкой оболочкой из двадцати строк, которая только принимает сообщения и вызывает эту логику. Тогда покрывать тестами воркер отдельно не нужно.

## Что спросят на интервью

**Зачем нужен Web Worker?** Чтобы убрать долгие вычисления с главного потока: он один и, пока считает, не рисует кадры и не обрабатывает ввод.

**Что недоступно в воркере?** DOM, `window`, `document`, `localStorage`, `alert`. Доступны `fetch`, `IndexedDB`, Cache Storage, WebAssembly, `crypto`, таймеры, `OffscreenCanvas`.

**Почему в воркере нет DOM?** DOM не потокобезопасен. Дать двум потокам менять дерево — значит ввести блокировки и получить гонки; вместо этого DOM оставили одному потоку, а обмен сделали сообщениями.

**Как передаются данные и что теряется?** Структурным клонированием. Функции и символы бросают `DataCloneError`, DOM-узлы не передаются, у экземпляров классов теряется прототип, геттеры превращаются в обычные свойства. Циклические ссылки, `Map`, `Set`, `Date`, `Blob` — сохраняются.

**Чем структурное клонирование лучше JSON?** Понимает `Map`, `Set`, `Date`, `RegExp`, `ArrayBuffer`, `Blob` и циклические ссылки; не превращает `undefined` в потерянный ключ.

**Что такое Transferable и в чём подвох?** Объект передаётся во владение без копирования: время не зависит от размера. Подвох — у отправителя он становится отсоединённым: `byteLength` равен нулю, доступ бросает ошибку. Передавать нужно `.buffer` типизированного массива, и все его представления тоже умирают.

**Чем `SharedArrayBuffer` отличается от `ArrayBuffer` и почему требует заголовков?** Он виден обоим потокам одновременно, это настоящая общая память; работать с ней нужно через `Atomics`. Требует изоляции происхождения (`COOP: same-origin` и `COEP: require-corp`) из-за Spectre — иначе через тайминги можно читать чужую память.

**Сколько воркеров заводить?** Ориентир — `navigator.hardwareConcurrency` минус один, с верхним потолком. Каждый воркер стоит несколько мегабайт памяти и десятки миллисекунд запуска, поэтому нужен пул с очередью, а не воркер на задачу.

**Как отменить задачу в воркере?** Убить воркер (`terminate`) и создать новый; либо нарезать работу и проверять флаг между кусками; либо читать флаг из `SharedArrayBuffer` через `Atomics` прямо в цикле.

**Когда воркер вреден?** Когда работа короче накладных расходов на запуск и передачу данных — примерно до 5–10 мс. И когда данных передаётся много, а результат маленький.

**Как связать запрос с ответом?** Свой протокол: идентификатор сообщения, `Map` ожидающих промисов, таймаут, отклонение всех ожидающих при падении воркера. Это то, что делает Comlink.

## Коротко, для повторения

1. Главный поток один. Воркер не ускоряет работу, а освобождает поток, пока она идёт.
2. В воркере нет DOM и `window` — по причине потокобезопасности. Есть `fetch`, IndexedDB, WebAssembly, `crypto`.
3. `postMessage` копирует данные структурным клонированием: функции бросают ошибку, прототипы теряются.
4. Копирование синхронное и на потоке отправителя. Форма данных важнее объёма: типизированные массивы дешевле деревьев из мелких объектов.
5. Transferable отдаёт владение буфером: время постоянное, но у отправителя буфер отсоединяется. Возвращайте буфер обратно и переприсваивайте ссылку.
6. `SharedArrayBuffer` — настоящая общая память, только через `Atomics` и только при изоляции происхождения; цена изоляции — сломанные сторонние ресурсы и всплывающие окна.
7. Пишите обёртку: идентификаторы сообщений, промис на запрос, таймаут, отклонение всех при падении воркера.
8. Пул размером примерно `hardwareConcurrency - 1` с очередью. Отмена запущенной задачи — только terminate, нарезка или разделяемый флаг.
9. Работа короче 5–10 мс — воркер не нужен, накладные расходы съедят выигрыш.
10. Модульный воркер создаётся через `new URL('./w.js', import.meta.url)` — именно эту форму понимают сборщики. Логику держите в обычном модуле, воркер — тонкая оболочка.
