# Лайвкодинг

_Задач: 65_

Сначала решай сам и проговаривай вслух, только потом смотри решение.

## Утилиты

### debounce(fn, ms) — спрашивают часто

Верни функцию, которая вызовет `fn` только если с момента последнего вызова прошло `ms` миллисекунд.

Требования: аргументы пробрасываются в `fn`; контекст вызова сохраняется; бонусом — метод `cancel`.

**Подсказки:**

- Отложить вызов — это setTimeout.
- Каждый новый вызов должен отменять предыдущий отложенный: clearTimeout + хранение id.
- Хранить id между вызовами негде, кроме замыкания.
- Для this: возвращаем обычную функцию, внутри setTimeout — стрелку, вызываем через apply.

<details><summary>Решение</summary>

```js
function debounce(fn, ms) {
  let timer;
  function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  }
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
```

Возвращаем **обычную** функцию, чтобы у неё был свой `this` от места вызова, а внутри `setTimeout` — **стрелку**, чтобы она этот `this` унаследовала. В одной маленькой функции обе разновидности использованы осознанно, и про это любят спрашивать.

Готовься к продолжению: вариант с немедленным первым вызовом (leading edge) и вопрос «чем отличается от throttle».

</details>

### throttle(fn, ms) — спрашивают часто

Верни функцию, которая вызывает `fn` не чаще одного раза в `ms` миллисекунд. Последний вызов внутри окна терять не надо.

**Подсказки:**

- Запомнить время последнего вызова и сравнивать с текущим.
- Если окно ещё не истекло — поставить отложенный вызов на остаток окна, но только один.

<details><summary>Решение</summary>

```js
function throttle(fn, ms) {
  let lastTime = 0;
  let timer = null;
  return function (...args) {
    const now = Date.now();
    const remaining = ms - (now - lastTime);
    if (remaining <= 0) {
      lastTime = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}
```

Простейший вариант без trailing-вызова тоже принимается, но тогда сам скажи, что последний вызов в окне теряется — это ровно тот компромисс, который интервьюер хочет услышать проговорённым.

</details>

### EventEmitter — спрашивают часто

Класс с методами `on`, `off`, `once`, `emit`.

**Подсказки:**

- Map из события в Set колбэков: Set бесплатно даёт удаление и защиту от дублей.
- once — обёртка, которая сначала отписывается, потом вызывает оригинал.
- Хороший тон: пусть on возвращает функцию отписки.

<details><summary>Решение</summary>

```js
class EventEmitter {
  #listeners = new Map();

  on(event, cb) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(cb);
    return () => this.off(event, cb);
  }

  off(event, cb) {
    this.#listeners.get(event)?.delete(cb);
  }

  once(event, cb) {
    const wrapper = (...args) => { this.off(event, wrapper); cb(...args); };
    this.on(event, wrapper);
  }

  emit(event, ...args) {
    // копия — на случай отписки прямо во время emit
    [...(this.#listeners.get(event) ?? [])].forEach(cb => cb(...args));
  }
}
```

Копирование множества перед перебором в `emit` — тот самый нюанс, который отличает продуманное решение: без него отписка внутри обработчика ломает итерацию.

</details>

### memoize(fn)

Кешируй результаты вызова по аргументам.

**Подсказки:**

- Map быстрее объекта и не конфликтует с прототипными ключами.
- Ключ из аргументов — главная сложность задачи, обсуди ограничения выбранного способа.

<details><summary>Решение</summary>

```js
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (!cache.has(key)) cache.set(key, fn.apply(this, args));
    return cache.get(key);
  };
}
```

Сам назови слабые места `JSON.stringify`: не различает объекты с разным порядком ключей, теряет функции и `undefined`, падает на циклах. И скажи про неограниченный рост кеша — в реальном коде нужен предел размера или TTL.

Для функции одного объектного аргумента изящнее `WeakMap`: кеш не мешает сборке мусора.

</details>

### curry(fn)

Сделай так, чтобы `curry(sum)(1)(2)(3)` и `curry(sum)(1, 2)(3)` давали одинаковый результат.

**Подсказки:**

- fn.length — объявленная арность функции.
- Пока аргументов меньше — возвращаем функцию, накапливающую их дальше.

<details><summary>Решение</summary>

```js
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn.apply(this, args);
    return (...next) => curried.apply(this, [...args, ...next]);
  };
}
```

Ограничение, которое стоит назвать самому: `fn.length` не считает параметры со значениями по умолчанию и rest-параметр, поэтому для таких функций каррирование по арности не работает.

</details>

### Function.prototype.bind своими руками

Реализуй `myBind` с поддержкой частичного применения аргументов.

**Подсказки:**

- Сохранить исходную функцию в переменную — this внутри метода и есть она.
- Связанные аргументы идут перед аргументами вызова.

<details><summary>Решение</summary>

```js
Function.prototype.myBind = function (ctx, ...bound) {
  const fn = this;
  return function (...args) {
    // при вызове через new контекст должен игнорироваться
    const isNew = this instanceof fn;
    return fn.apply(isNew ? this : ctx, [...bound, ...args]);
  };
};
```

Проверка на `new` — необязательная часть, но именно она показывает, что ты понимаешь настоящую семантику `bind`, а не просто заучил обёртку над `apply`.

</details>

### deepEqual(a, b) — спрашивают часто

Реализуйте `deepEqual(a, b)` — глубокое сравнение двух значений без использования `JSON.stringify`.

Требования: примитивы сравниваются как `Object.is` (`NaN` равен `NaN`), поддержите массивы, обычные объекты, `Date`, `RegExp`, `Map`, `Set`. Разное количество ключей — не равны. Порядок ключей значения не имеет.

**Подсказки:**

- Начните с быстрого выхода: если значения строго равны — true. Дальше отсеките примитивы и null.
- JSON.stringify ломается на разном порядке ключей, undefined, NaN, циклах и Date — скажите это вслух.
- Сравните прототипы объектов: {} и new Foo() не должны считаться равными.
- Для Map/Set нужны отдельные ветки: у них данные не лежат в собственных ключах.

<details><summary>Решение</summary>

```js
function deepEqual(a, b) {
  // Object.is покрывает NaN === NaN и различает +0 / -0
  if (Object.is(a, b)) return true;

  // дальше интересны только объекты; null имеет typeof 'object'
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  // {} и new Foo() — разные сущности
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  if (a instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp) return a.source === b.source && a.flags === b.flags;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (a instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) return false;
    }
    return true;
  }

  if (a instanceof Set) {
    if (a.size !== b.size) return false;
    // строгое сравнение элементов Set: глубокое потребовало бы O(n^2) перебора
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}
```

Что оценивает интервьюер:

- Помните ли вы, что `typeof null === 'object'` — классическая ловушка.
- Понимаете ли, почему `JSON.stringify(a) === JSON.stringify(b)` — плохое решение: порядок ключей, `undefined`, функции, `NaN`, `Date`, циклические ссылки.
- Проговорите защиту от циклов: `WeakMap` с парами уже сравниваемых объектов — это плюс балл.

**Что сказать вслух:** «Символьные ключи я осознанно не сравниваю, в проде добавил бы `Object.getOwnPropertySymbols`. Для Set с объектами внутри честное сравнение — это задача о паросочетании, я бы уточнил требования».

</details>

### get(obj, path, def) и set(obj, path, value) — спрашивают часто

Реализуйте `get(obj, path, defaultValue)` и `set(obj, path, value)` как в lodash.

Путь — строка вида `'a.b[0].c'` или массив ключей. `get` возвращает `defaultValue`, если путь не существует или значение `undefined`. `set` создаёт недостающие звенья: массив, если следующий ключ числовой, иначе объект.

**Подсказки:**

- Сведите строку и массив к одному формату — общая функция toPath.
- Скобочную нотацию проще всего нормализовать регуляркой в точечную.
- В get важно отличать «нет ключа» от «значение null»: null возвращаем как есть, а undefined заменяем на дефолт.
- В set смотрите на СЛЕДУЮЩИЙ ключ, чтобы решить, создавать массив или объект.

<details><summary>Решение</summary>

```js
function toPath(path) {
  if (Array.isArray(path)) return path;
  return String(path)
    // ['key'] и [0] превращаем в .key и .0
    .replace(/\[["']?([^\]"']+)["']?\]/g, '.$1')
    .split('.')
    .filter(Boolean);
}

function get(obj, path, defaultValue) {
  const keys = toPath(path);
  let current = obj;
  for (const key of keys) {
    // == null покрывает и null, и undefined
    if (current == null) return defaultValue;
    current = current[key];
  }
  return current === undefined ? defaultValue : current;
}

function set(obj, path, value) {
  const keys = toPath(path);
  if (keys.length === 0) return obj;

  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === null || typeof current[key] !== 'object') {
      // следующий ключ числовой -> нужен массив, иначе объект
      current[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
  return obj;
}
```

Подводные камни:

- `get({ a: null }, 'a.b')` не должен падать — нужна проверка на `null` на каждом шаге.
- `get(obj, 'a', 0)` при `a === null` должен вернуть `null`, а не `0`: дефолт подставляется только для `undefined`.
- В `set` есть риск prototype pollution: ключи `__proto__`, `constructor`, `prototype` стоит блокировать. Скажите об этом — на senior это ждут.

**Плюс балл:** предложить иммутабельный вариант `setIn`, который возвращает новый объект и копирует только узлы на пути — именно так работают редьюсеры.

</details>

### pipe(...fns) и compose(...fns) — спрашивают часто

Реализуйте `pipe` (слева направо) и `compose` (справа налево).

Первая функция получает все аргументы, остальные — результат предыдущей. Вызов без функций возвращает первый аргумент. Дополнительно: сделайте асинхронный `pipeAsync`, который умеет ждать промежуточные промисы.

**Подсказки:**

- Это reduce по массиву функций, но первый шаг особенный — он принимает несколько аргументов.
- compose — это pipe с перевёрнутым массивом; не мутируйте исходный массив.
- Для асинхронной версии сведите всё к цепочке .then или к циклу с await.

<details><summary>Решение</summary>

```js
function pipe(...fns) {
  return function (...args) {
    if (fns.length === 0) return args[0];
    // первая функция принимает все аргументы, дальше — одно значение
    let result = fns[0].apply(this, args);
    for (let i = 1; i < fns.length; i++) {
      result = fns[i].call(this, result);
    }
    return result;
  };
}

function compose(...fns) {
  // slice, чтобы не мутировать переданный порядок
  return pipe(...fns.slice().reverse());
}

// асинхронная версия: каждый шаг может вернуть промис
function pipeAsync(...fns) {
  return async function (...args) {
    if (fns.length === 0) return args[0];
    let result = await fns[0].apply(this, args);
    for (let i = 1; i < fns.length; i++) {
      result = await fns[i].call(this, result);
    }
    return result;
  };
}
```

На что смотрит интервьюер: знаете ли вы `reduce` и понимаете ли разницу порядка. `compose(f, g)(x)` это `f(g(x))`, `pipe(f, g)(x)` это `g(f(x))` — путаница здесь встречается часто.

- Сохранение `this` через `apply/call` — деталь, которую замечают.
- Вариант в одну строку: `const pipe = (...fns) => x => fns.reduce((acc, fn) => fn(acc), x)` — но он теряет поддержку нескольких аргументов.

**Плюс балл:** упомянуть, что на этом построены middleware в Redux (`compose` из исходников) и трансформеры в RxJS.

</details>

### once(fn) — спрашивают часто

Реализуйте `once(fn)` — обёртку, которая вызывает `fn` ровно один раз, а при последующих вызовах возвращает закешированный результат.

Требования: сохранить `this` и аргументы первого вызова, не держать ссылку на `fn` после вызова (чтобы её мог собрать GC), добавить метод `reset()`.

**Подсказки:**

- Нужны два замыкания: флаг «уже вызвана» и сохранённый результат.
- Флаг важнее, чем проверка result !== undefined: функция могла легально вернуть undefined.
- Для сохранения контекста используйте обычную function и fn.apply(this, args).

<details><summary>Решение</summary>

```js
function once(fn) {
  let called = false;
  let result;
  let original = fn;

  function wrapper(...args) {
    if (!called) {
      called = true;
      result = original.apply(this, args);
      // отпускаем ссылку: замыкание не держит функцию и её область видимости
      original = null;
    }
    return result;
  }

  wrapper.reset = function () {
    called = false;
    result = undefined;
    original = fn;
  };

  return wrapper;
}
```

Разбор:

- Проверка через флаг, а не через `result`: функция может вернуть `undefined`, и наивная реализация будет вызывать её каждый раз.
- Если `fn` бросила исключение — считать ли вызов состоявшимся? Уточните у интервьюера; lodash считает, что да.
- Стрелочная функция в обёртке потеряет `this` — типичная ошибка.

**Что сказать вслух:** «Это же паттерн ленивой инициализации синглтона; для асинхронного случая я бы кешировал промис, чтобы параллельные вызовы не породили две загрузки».

</details>

### partial(fn, ...preset) с плейсхолдерами

Реализуйте частичное применение `partial(fn, ...preset)`: возвращает функцию, которая при вызове подставляет заранее заданные аргументы перед новыми.

Дополнительно поддержите плейсхолдер `_`: `partial(f, 1, _, 3)(2, 4)` должен вызвать `f(1, 2, 3, 4)`. Также сделайте `partialRight`.

**Подсказки:**

- Сохраните preset в замыкании и склейте с аргументами вызова.
- Плейсхолдер удобно сделать уникальным Symbol, чтобы его нельзя было подделать значением.
- Проходя по preset, каждый плейсхолдер заменяйте очередным аргументом из новых, а остаток дописывайте в конец.

<details><summary>Решение</summary>

```js
const _ = Symbol('placeholder');

function partial(fn, ...preset) {
  return function (...later) {
    const rest = later.slice(); // копия, из неё будем «выедать» плейсхолдеры
    const args = preset.map(function (arg) {
      return arg === _ ? rest.shift() : arg;
    });
    // всё, что не ушло в плейсхолдеры, дописываем справа
    return fn.apply(this, args.concat(rest));
  };
}

function partialRight(fn, ...preset) {
  return function (...later) {
    return fn.apply(this, later.concat(preset));
  };
}
```

Разбор: задача проверяет уверенность в rest/spread и в том, что `arguments` в стрелках не работает.

- Частая ошибка — мутировать массив `later` напрямую и потом использовать его же для «остатка».
- Отличие от `bind`: `partial` не фиксирует `this`, поэтому обёртка должна быть обычной функцией.
- Отличие от каррирования: `partial` вызывает функцию сразу, независимо от арности.

**Плюс балл:** упомянуть, что `Function.prototype.bind(null, a, b)` — это встроенный `partial` без плейсхолдеров.

</details>

### debounce с leading, trailing и maxWait — спрашивают часто

Расширьте `debounce(fn, wait, options)` опциями `leading`, `trailing` и `maxWait`.

`leading: true` — вызов на первом событии серии; `trailing: true` (по умолчанию) — вызов после паузы; `maxWait` — гарантированный вызов не реже, чем раз в `maxWait` мс при непрерывном потоке событий. Нужны методы `cancel()` и `flush()`.

**Подсказки:**

- Заведите два таймера: обычный на wait и отдельный на maxWait, который стартует один раз за серию.
- Храните последние аргументы и this отдельно: они нужны и для trailing, и для flush.
- Нужен флаг «в этой серии уже был leading-вызов», иначе при leading + trailing вы вызовете fn дважды на одном событии.
- cancel() должен сбрасывать оба таймера и отложенные аргументы, flush() — вызвать немедленно, если что-то отложено.

<details><summary>Решение</summary>

```js
function debounce(fn, wait, options) {
  const opts = options || {};
  const leading = opts.leading === true;
  const trailing = opts.trailing !== false; // по умолчанию true
  const maxWait = typeof opts.maxWait === 'number' ? opts.maxWait : null;

  let timer = null;     // таймер обычной паузы
  let maxTimer = null;  // таймер гарантированного вызова
  let lastArgs = null;
  let lastThis = null;
  let leadingDone = false; // был ли вызов по переднему фронту в текущей серии

  function clearTimers() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
  }

  function invokeNow() {
    const args = lastArgs;
    const ctx = lastThis;
    lastArgs = null;
    lastThis = null;
    return fn.apply(ctx, args);
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;

    const isSeriesStart = timer === null && maxTimer === null && !leadingDone;
    if (leading && isSeriesStart) {
      leadingDone = true;
      invokeNow(); // сразу «съедаем» аргументы, чтобы не продублировать их в trailing
    }

    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
      leadingDone = false;
      if (trailing && lastArgs) invokeNow();
    }, wait);

    if (maxWait !== null && maxTimer === null) {
      maxTimer = setTimeout(function () {
        maxTimer = null;
        if (timer) { clearTimeout(timer); timer = null; }
        leadingDone = false;
        if (lastArgs) invokeNow();
      }, maxWait);
    }
  }

  debounced.cancel = function () {
    clearTimers();
    lastArgs = null;
    lastThis = null;
    leadingDone = false;
  };

  debounced.flush = function () {
    clearTimers();
    leadingDone = false;
    if (lastArgs) return invokeNow();
  };

  return debounced;
}
```

Это тот самый вопрос, который любят задавать после базового debounce: «а теперь как в lodash».

- Главный подвох: при `leading: true, trailing: true` одиночное событие не должно вызывать функцию дважды. Отсюда обнуление `lastArgs` сразу после leading-вызова.
- `debounce` с `maxWait` фактически превращается в `throttle` — скажите это, интервьюеры это любят.
- Проговорите, зачем нужны `cancel` и `flush`: очистка в `useEffect` и отправка формы «прямо сейчас».

**Плюс балл:** упомянуть, что для скролла и ресайза лучше `requestAnimationFrame`, а не таймеры.

</details>

### promisify(fn) и callbackify — спрашивают часто

Реализуйте `promisify(fn)`: превращает функцию с Node-style колбэком `(err, result)` в функцию, возвращающую промис.

Требования: сохранить `this`, поддержать колбэк с несколькими значениями (тогда резолвим массивом), корректно отвергать промис при ошибке. Дополнительно напишите обратное преобразование `callbackify`.

**Подсказки:**

- Возвращайте функцию, которая создаёт new Promise и передаёт свой колбэк последним аргументом.
- Ошибка — первый аргумент колбэка; проверяйте именно на truthy, а не на !== null.
- this нужно пробросить через fn.call(this, ...args, callback).
- Синхронное исключение из fn тоже стоит превратить в reject.

<details><summary>Решение</summary>

```js
function promisify(fn) {
  return function (...args) {
    const self = this;
    return new Promise(function (resolve, reject) {
      function callback(err, ...values) {
        if (err) {
          reject(err);
          return;
        }
        // Node-style колбэк может отдать несколько значений
        resolve(values.length > 1 ? values : values[0]);
      }
      try {
        fn.call(self, ...args, callback);
      } catch (error) {
        // синхронный throw внутри fn не должен ронять вызывающий код
        reject(error);
      }
    });
  };
}

function callbackify(asyncFn) {
  return function (...args) {
    const callback = args.pop();
    const self = this;
    Promise.resolve()
      .then(function () { return asyncFn.apply(self, args); })
      .then(function (value) { callback(null, value); },
            function (error) { callback(error); });
  };
}
```

Разбор:

- Колбэк должен идти последним аргументом — не забудьте про случай, когда у функции есть опциональные параметры.
- Частая ошибка — вызвать `callback` внутри `try` так, что исключение из `resolve`-обработчика попадёт в `catch`. В решении выше `try` оборачивает только вызов `fn`.
- В `callbackify` важно не вызывать `callback` дважды и не проглотить исключение из самого колбэка.

**Плюс балл:** вспомнить `util.promisify` и его символ `util.promisify.custom`, а также что промисификация не отменяет вызовов — для отмены нужен `AbortController`.

</details>

### rateLimit(fn, limit, interval)

Реализуйте `rateLimit(fn, limit, interval)`: обёртка, которая пропускает не более `limit` вызовов за окно `interval` мс, а лишние ставит в очередь и выполняет позже.

Обёртка возвращает промис с результатом `fn`. Порядок вызовов должен сохраняться. Условие: скользящее окно, а не «сброс счётчика раз в секунду».

**Подсказки:**

- Храните времена уже совершённых вызовов в массиве и выбрасывайте те, что старше interval.
- Отложенные вызовы держите в очереди из объектов { args, resolve, reject }.
- Когда лимит исчерпан, посчитайте, через сколько освободится самый старый слот, и поставьте один setTimeout.
- Не плодите таймеры на каждый вызов — держите ровно один активный таймер.

<details><summary>Решение</summary>

```js
function rateLimit(fn, limit, interval) {
  const timestamps = []; // времена реальных вызовов внутри окна
  const queue = [];
  let timer = null;

  function drain() {
    const now = Date.now();
    // выкидываем метки, вышедшие за окно
    while (timestamps.length > 0 && now - timestamps[0] >= interval) {
      timestamps.shift();
    }

    while (queue.length > 0 && timestamps.length < limit) {
      const task = queue.shift();
      timestamps.push(Date.now());
      try {
        task.resolve(fn.apply(task.ctx, task.args));
      } catch (error) {
        task.reject(error);
      }
    }

    if (queue.length > 0 && timer === null) {
      // ждём ровно до момента, когда освободится самый старый слот
      const waitMs = Math.max(0, interval - (Date.now() - timestamps[0]) + 1);
      timer = setTimeout(function () {
        timer = null;
        drain();
      }, waitMs);
    }
  }

  return function (...args) {
    const ctx = this;
    return new Promise(function (resolve, reject) {
      queue.push({ args: args, ctx: ctx, resolve: resolve, reject: reject });
      drain();
    });
  };
}
```

Разбор: задача любима в командах, которые бьются об лимиты внешних API.

- Отличие от `throttle`: throttle выбрасывает лишние вызовы, rate limiter их откладывает.
- Скользящее окно против фиксированного: при фиксированном можно получить `2 * limit` вызовов на стыке окон — назовите это.
- Обсудите backpressure: что делать, если очередь растёт бесконечно (ограничить длину и отклонять с ошибкой).

**Плюс балл:** упомянуть алгоритм token bucket и заголовки `Retry-After` / `429`.

</details>

## Асинхронность

### promisePool(tasks, limit) — спрашивают часто

Выполни массив асинхронных задач с ограничением на число одновременно выполняемых. Результаты вернуть в порядке исходного массива.

`tasks` — массив функций, возвращающих промисы.

**Подсказки:**

- Запустить N «воркеров», которые разбирают общую очередь.
- Индекс захватывать синхронно (index++), иначе два воркера возьмут одну задачу.
- Результат класть по своему индексу, чтобы сохранить порядок.

<details><summary>Решение</summary>

```js
async function promisePool(tasks, limit) {
  const results = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;               // синхронный захват — без гонок
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    worker
  );
  await Promise.all(workers);
  return results;
}
```

Обязательно объясни, почему `tasks` — это функции, а не готовые промисы: готовый промис уже запущен, ограничивать нечего.

Продолжение, к которому надо быть готовым: что делать с ошибками. Если обернуть тело воркера в try/catch и класть `{status, value}` — получится семантика `allSettled`, и одна упавшая задача не убьёт пул.

</details>

### retry(fn, retries, delay)

Повторяй асинхронную `fn` при ошибке до `retries` раз с задержкой. Бонус — экспоненциальный backoff.

**Подсказки:**

- Цикл с try/catch читается проще рекурсии.
- На последней попытке ошибку надо пробросить, а не проглотить.
- Backoff: delay * 2 ** attempt.

<details><summary>Решение</summary>

```js
async function retry(fn, retries = 3, delay = 500) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise(r => setTimeout(r, delay * 2 ** attempt));
    }
  }
}
```

Что добавит очков: повторять стоит не всё подряд. Сетевые сбои и 5xx — да, 4xx — нет, потому что повтор ничего не изменит. И джиттер (случайная добавка к задержке), чтобы клиенты не пошли на сервер синхронной волной.

</details>

### Promise.all своими руками — спрашивают часто

Реализуй `myPromiseAll(promises)` с семантикой оригинала.

**Подсказки:**

- Счётчик оставшихся: резолвим, когда дошёл до нуля.
- Результат класть по индексу, а не push — порядок обязан сохраниться.
- Пустой массив должен резолвиться сразу.
- Элементы могут быть не промисами — оборачивать в Promise.resolve.

<details><summary>Решение</summary>

```js
function myPromiseAll(items) {
  return new Promise((resolve, reject) => {
    const results = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return resolve([]);

    items.forEach((item, i) => {
      Promise.resolve(item).then(
        (value) => {
          results[i] = value;
          if (--remaining === 0) resolve(results);
        },
        reject   // первая ошибка реджектит весь результат
      );
    });
  });
}
```

Уточни вслух: реджект по первой ошибке **не отменяет** остальные операции — они продолжают выполняться, просто их результат уже никому не нужен.

</details>

### sleep(ms) и withTimeout(promise, ms) — спрашивают часто

Реализуйте `sleep(ms)` и `withTimeout(promise, ms, message)`, отклоняющий промис, если тот не завершился за отведённое время.

Требования: таймер обязательно очищается в любом исходе, исходный промис не удерживается в памяти, поддержите отмену через `AbortSignal`. Объясните, почему сам запрос при этом не отменяется.

**Подсказки:**

- sleep — это new Promise с setTimeout в resolve, но важно предусмотреть отмену.
- withTimeout — это Promise.race двух промисов: исходного и таймера-отклонителя.
- Ключевая деталь — clearTimeout в finally: без него висит таймер, а в Node процесс не завершается.
- Promise.race не отменяет проигравший промис: он продолжает выполняться. Отмена — отдельный механизм.

<details><summary>Решение</summary>

```js
function sleep(ms, signal) {
  return new Promise(function (resolve, reject) {
    if (signal && signal.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const id = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', function () {
        clearTimeout(id); // не оставляем висящий таймер
        reject(new Error('Aborted'));
      }, { once: true });
    }
  });
}

class TimeoutError extends Error {
  constructor(message) {
    super(message || 'Operation timed out');
    this.name = 'TimeoutError';
  }
}

function withTimeout(promise, ms, message) {
  let timerId;
  const timeout = new Promise(function (resolve, reject) {
    timerId = setTimeout(function () {
      reject(new TimeoutError(message));
    }, ms);
  });

  return Promise.race([promise, timeout])
    // finally выполняется в любом исходе: и при успехе, и при таймауте
    .finally(function () { clearTimeout(timerId); });
}

// правильный вариант с реальной отменой запроса
function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const id = setTimeout(function () { controller.abort(); }, ms);
  return fetch(url, { signal: controller.signal })
    .finally(function () { clearTimeout(id); });
}
```

Разбор: главный вопрос интервьюера — «отменится ли запрос по таймауту?».

- Ответ: нет. `Promise.race` лишь игнорирует результат проигравшего; сетевой запрос продолжается и трафик тратится. Настоящая отмена — только `AbortController`.
- `clearTimeout` в `finally` — не косметика: в Node незакрытый таймер держит event loop, и процесс не завершается.
- Свой класс ошибки вместо строки позволяет отличить таймаут от сетевой ошибки в `catch`.
- Упомяните готовые решения: `AbortSignal.timeout(ms)` и `AbortSignal.any` — это современный ответ.
- Хорошее продолжение: сочетать таймаут с ретраями, следя за общим бюджетом времени.

</details>

### mapSeries: последовательное выполнение промисов — спрашивают часто

Реализуйте `mapSeries(items, asyncFn)`: применяет асинхронную функцию к элементам строго по очереди, следующий стартует только после завершения предыдущего.

Сделайте два варианта: через `for...of` с `await` и через цепочку `reduce`. Объясните, почему `map` с async-колбэком запускает всё параллельно и почему `forEach` с `await` не работает.

**Подсказки:**

- Цикл for...of с await внутри действительно приостанавливает итерацию — в отличие от forEach.
- Классическая функциональная запись — reduce, строящий цепочку then.
- Соберите результаты в массив в том же порядке, что и вход.
- Обсудите поведение при ошибке: прервать всё или продолжить и собрать ошибки.

<details><summary>Решение</summary>

```js
// вариант 1: цикл — читаемый и обычно предпочтительный
async function mapSeries(items, asyncFn) {
  const results = [];
  let index = 0;
  for (const item of items) {
    // await внутри for...of реально останавливает итерацию
    results.push(await asyncFn(item, index++));
  }
  return results;
}

// вариант 2: та же логика цепочкой промисов
function mapSeriesReduce(items, asyncFn) {
  return items.reduce(function (chain, item, index) {
    return chain.then(function (acc) {
      return Promise.resolve(asyncFn(item, index)).then(function (value) {
        return acc.concat(value);
      });
    });
  }, Promise.resolve([]));
}

// продолжать при ошибках и вернуть результаты вместе с ними
async function mapSeriesSettled(items, asyncFn) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    try {
      results.push({ status: 'fulfilled', value: await asyncFn(items[i], i) });
    } catch (error) {
      results.push({ status: 'rejected', reason: error });
    }
  }
  return results;
}
```

Разбор: это вопрос-детектор понимания асинхронности.

- Асинхронный колбэк в `forEach` — самая частая ошибка на собесах: `forEach` не ждёт возвращённые промисы, функция завершится мгновенно, а ошибки станут unhandled rejection.
- `map` с async-колбэком плюс `Promise.all` запускает всё параллельно. Это часто и нужно — но не когда есть лимит API или важен порядок побочных эффектов.
- Когда нужна последовательность: зависимость шага от предыдущего результата, лимиты внешнего сервиса, миграции и записи в БД.
- Промежуточный вариант — ограниченный параллелизм: назовите его как компромисс между скоростью и нагрузкой.
- Плюс балл: упомянуть `for await...of` для асинхронных итераторов и постраничной выборки.

</details>

### Свои Promise.allSettled, race и any — спрашивают часто

Реализуйте `myAllSettled`, `myRace` и `myAny` без использования одноимённых встроенных методов.

Требования: работать с любым итерируемым, поддерживать не-промисы среди элементов, сохранять порядок результатов, `any` должен отклоняться с `AggregateError`, когда все промисы отклонены, и корректно вести себя на пустом входе.

**Подсказки:**

- Оберните каждый элемент в Promise.resolve — тогда обычные значения тоже работают.
- Порядок результатов задаётся индексом в исходном массиве, а не порядком завершения.
- Нужен счётчик завершённых: только когда он дошёл до длины, резолвим общий промис.
- Крайние случаи: allSettled на пустом входе резолвится сразу, any сразу отклоняется, race висит вечно.

<details><summary>Решение</summary>

```js
function myAllSettled(iterable) {
  const items = Array.from(iterable);
  return new Promise(function (resolve) {
    const results = new Array(items.length);
    let settledCount = 0;

    if (items.length === 0) {
      resolve([]); // пустой вход — сразу готово
      return;
    }

    items.forEach(function (item, index) {
      // Promise.resolve позволяет передавать и обычные значения
      Promise.resolve(item).then(
        function (value) {
          results[index] = { status: 'fulfilled', value: value };
        },
        function (reason) {
          results[index] = { status: 'rejected', reason: reason };
        }
      ).then(function () {
        settledCount++;
        // резолвим, только когда завершились все
        if (settledCount === items.length) resolve(results);
      });
    });
  });
}

function myRace(iterable) {
  const items = Array.from(iterable);
  return new Promise(function (resolve, reject) {
    // на пустом массиве промис никогда не завершится — это по спецификации
    for (const item of items) {
      Promise.resolve(item).then(resolve, reject);
    }
  });
}

function myAny(iterable) {
  const items = Array.from(iterable);
  return new Promise(function (resolve, reject) {
    const errors = new Array(items.length);
    let rejectedCount = 0;

    if (items.length === 0) {
      reject(new AggregateError([], 'All promises were rejected'));
      return;
    }

    items.forEach(function (item, index) {
      Promise.resolve(item).then(resolve, function (error) {
        errors[index] = error;
        rejectedCount++;
        // отклоняемся, только когда провалились абсолютно все
        if (rejectedCount === items.length) {
          reject(new AggregateError(errors, 'All promises were rejected'));
        }
      });
    });
  });
}
```

Разбор: этот набор реально дают в Яндексе и Т-Банке, часто именно `Promise.any`.

- Счётчик вместо проверки длины результата: массив с дырками имеет неверную длину, а `push` ломает порядок.
- Повторный вызов `resolve` безопасен — промис уже settled и игнорирует последующие вызовы. Скажите это вслух, это показывает понимание модели.
- Крайние случаи по спецификации: `all` и `allSettled` на пустом входе резолвятся немедленно, `any` отклоняется `AggregateError`, `race` зависает навсегда.
- Разница между ними: `all` падает на первой ошибке, `allSettled` ждёт всех, `any` ждёт первого успеха, `race` — первого любого результата.
- Ни один из них не отменяет оставшиеся операции — частый доп. вопрос.

</details>

### Батчинг вызовов за тик (dataloader)

Реализуйте `createBatcher(batchFn)`: множество вызовов `load(id)`, сделанных за один тик, объединяются в один вызов `batchFn(ids)`, а каждому вызывающему возвращается свой результат.

Требования: дедупликация одинаковых id внутри батча, ограничение размера батча, корректная передача ошибки всем ожидающим.

**Подсказки:**

- Накапливайте запросы в массиве, а сброс планируйте через микротаск.
- Для каждого id храните resolve и reject; после ответа раздайте результаты по порядку id.
- Дедупликация: если id уже в текущем батче, верните тот же промис.
- batchFn должна возвращать массив результатов той же длины и в том же порядке, что и массив id.

<details><summary>Решение</summary>

```js
function createBatcher(batchFn, options) {
  const opts = options || {};
  const maxBatchSize = opts.maxBatchSize || Infinity;

  let queue = [];              // элементы вида { id, resolve, reject }
  let pendingById = new Map(); // дедупликация внутри текущего батча
  let scheduled = false;

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    // микротаск: собираем все синхронные вызовы текущего тика
    queueMicrotask(flush);
  }

  async function flush() {
    scheduled = false;
    const batch = queue.slice(0, maxBatchSize);
    queue = queue.slice(maxBatchSize);
    pendingById = new Map();
    if (queue.length > 0) schedule(); // остаток уедет следующим батчем
    if (batch.length === 0) return;

    const ids = batch.map(function (task) { return task.id; });
    try {
      const results = await batchFn(ids);
      if (!Array.isArray(results) || results.length !== ids.length) {
        throw new Error('batchFn должна вернуть массив той же длины, что и ids');
      }
      batch.forEach(function (task, i) { task.resolve(results[i]); });
    } catch (error) {
      // ошибка батча — ошибка для всех его участников
      batch.forEach(function (task) { task.reject(error); });
    }
  }

  return function load(id) {
    // тот же id в этом же батче — тот же промис
    if (pendingById.has(id)) return pendingById.get(id);

    const promise = new Promise(function (resolve, reject) {
      queue.push({ id: id, resolve: resolve, reject: reject });
    });
    pendingById.set(id, promise);
    schedule();
    return promise;
  };
}

// использование:
// const loadUser = createBatcher(function (ids) { return fetchUsers(ids); });
// Promise.all([loadUser(1), loadUser(2), loadUser(1)]); // один запрос с ids [1, 2]
```

Разбор: задача проверяет понимание event loop и продуктовый опыт одновременно.

- Почему микротаск, а не `setTimeout`: микротаски выполняются до следующего рендера, поэтому батч собирается в том же тике и не добавляет задержки кадра.
- Контракт `batchFn` — самое хрупкое место: длина и порядок результатов должны совпадать с ids. Явная проверка спасает от плавающих багов.
- Дедупликация одинаковых id — то, ради чего технику и внедряют (проблема N+1 в списках).
- Скажите, что это принцип работы DataLoader из GraphQL-стека, и упомяните риски кеша: устаревшие данные и необходимость инвалидации.

</details>

### async/await через генераторы (мини-co)

Реализуйте функцию `run(generatorFn)`, которая выполняет генератор, где `yield` возвращает промисы, — то есть воспроизводит поведение `async/await`.

Требования: результат разрешённого промиса возвращается обратно в генератор через `next(value)`, ошибка пробрасывается внутрь через `throw(error)` и ловится обычным `try/catch`, функция возвращает промис с итоговым значением.

**Подсказки:**

- Генератор приостанавливается на yield и возобновляется вызовом next со значением — это и есть механика await.
- Рекурсивный шаг: вызвать next, дождаться промиса, снова вызвать next с результатом.
- Ошибку промиса надо отдать внутрь генератора методом throw, чтобы сработал try/catch в теле.
- Обязательно оборачивайте вызовы next и throw в try/catch: синхронное исключение тоже нужно превратить в reject.

<details><summary>Решение</summary>

```js
function run(generatorFn) {
  return function (...args) {
    const iterator = generatorFn.apply(this, args);

    return new Promise(function (resolve, reject) {
      // шаг выполнения: продвигаем генератор и разбираем результат
      function step(method, value) {
        let result;
        try {
          result = iterator[method](value); // 'next' или 'throw'
        } catch (error) {
          // синхронное исключение внутри генератора
          reject(error);
          return;
        }

        if (result.done) {
          resolve(result.value);
          return;
        }

        // Promise.resolve позволяет yield-ить и обычные значения
        Promise.resolve(result.value).then(
          function (nextValue) { step('next', nextValue); },
          // ошибку отдаём ВНУТРЬ генератора, чтобы её поймал try/catch в теле
          function (error) { step('throw', error); }
        );
      }

      step('next', undefined);
    });
  };
}

// использование:
// const loadUser = run(function* (id) {
//   try {
//     const user = yield api.getUser(id);
//     const posts = yield api.getPosts(user.id);
//     return { user: user, posts: posts };
//   } catch (error) {
//     return null;
//   }
// });
```

Разбор: задача на понимание, а не на память.

- Главная идея: `await` — это сахар над «приостановить генератор до разрешения промиса и вернуть значение обратно через `next`». Сформулируйте это одной фразой в начале.
- Метод `throw` у итератора — ключевой момент: именно он позволяет ловить асинхронные ошибки обычным `try/catch` внутри генератора.
- Три места, где нужен перехват: синхронное исключение при вызове `next`, отклонённый промис, исключение из `throw`.
- Скажите, что так работала библиотека co и что Babel компилирует `async/await` в генератор плюс похожий раннер (regenerator).
- Продолжение, которое любят: чем это отличается от redux-saga — там `yield` возвращает не промисы, а описания эффектов, отсюда тестируемость.

</details>

## Данные

### deepClone(obj) — спрашивают часто

Глубокое копирование объекта. Учти массивы, `Date`, `Map`, `Set` и циклические ссылки.

**Подсказки:**

- Примитивы и null возвращаем как есть — это база рекурсии.
- Циклы: WeakMap «оригинал → копия», проверять до обхода полей.
- Копию класть в WeakMap ДО рекурсивного обхода, иначе цикл всё равно зациклится.

<details><summary>Решение</summary>

```js
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value);

  if (value instanceof Map) {
    const m = new Map(); seen.set(value, m);
    value.forEach((v, k) => m.set(deepClone(k, seen), deepClone(v, seen)));
    return m;
  }
  if (value instanceof Set) {
    const s = new Set(); seen.set(value, s);
    value.forEach(v => s.add(deepClone(v, seen)));
    return s;
  }

  const result = Array.isArray(value) ? [] : {};
  seen.set(value, result);
  for (const key of Object.keys(value)) {
    result[key] = deepClone(value[key], seen);
  }
  return result;
}
```

Сначала скажи про нативный `structuredClone` — это плюс к ответу. Тебя всё равно попросят написать руками, но интервьюер увидит, что ты знаешь платформу.

</details>

### LRU-кеш

Кеш фиксированной ёмкости: `get` и `put` за O(1). При переполнении вытесняется наименее недавно использованный элемент.

**Подсказки:**

- Map хранит порядок вставки — это и есть порядок свежести.
- get должен переставлять элемент в конец: delete + set.
- Самый старый ключ — первый: map.keys().next().value.

<details><summary>Решение</summary>

```js
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return -1;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);   // переставить в конец = освежить
    return value;
  }

  put(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      this.map.delete(this.map.keys().next().value);  // вытеснить самый старый
    }
    this.map.set(key, value);
  }
}
```

Классическое решение — двусвязный список плюс хеш-таблица. Скажи, что знаешь его, но `Map` в JS уже даёт нужный порядок, поэтому городить список незачем.

</details>

### flatten, chunk, groupBy

Три маленькие утилиты: развернуть вложенный массив на заданную глубину, разбить массив на куски по N, сгруппировать элементы по ключу.

**Подсказки:**

- flatten проще всего через reduce с рекурсией.
- chunk — Array.from по числу кусков плюс slice.
- groupBy — reduce с накоплением в объект.

<details><summary>Решение</summary>

```js
const flatten = (arr, depth = 1) =>
  depth <= 0
    ? arr.slice()
    : arr.reduce((acc, item) =>
        acc.concat(Array.isArray(item) ? flatten(item, depth - 1) : item), []);

const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size));

const groupBy = (arr, keyFn) =>
  arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
```

На глубоко вложенных структурах рекурсия может переполнить стек — если спросят, покажи итеративный вариант flatten через стек и `pop`.

</details>

### Свои map, filter, reduce, forEach — спрашивают часто

Реализуйте `Array.prototype.myMap`, `myFilter`, `myReduce`, `myForEach` без использования одноимённых встроенных методов.

Требования по спецификации: поддержка второго аргумента `thisArg`, корректная работа с разреженными массивами (дырки пропускаются), `reduce` без начального значения на пустом массиве бросает `TypeError`, длина фиксируется до начала обхода.

**Подсказки:**

- Приведите this к объекту через Object(this) и возьмите длину как this.length >>> 0.
- Дырки в массиве проверяются через оператор in: (i in arr).
- Колбэк получает три аргумента: значение, индекс и сам массив.
- В reduce без initial первым аккумулятором становится первый существующий элемент, а индекс сдвигается.

<details><summary>Решение</summary>

```js
Array.prototype.myMap = function (callback, thisArg) {
  if (typeof callback !== 'function') throw new TypeError(callback + ' is not a function');
  const arr = Object(this);
  const len = arr.length >>> 0; // приведение к uint32, как в спецификации
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    // дырки разреженного массива остаются дырками
    if (i in arr) result[i] = callback.call(thisArg, arr[i], i, arr);
  }
  return result;
};

Array.prototype.myFilter = function (callback, thisArg) {
  if (typeof callback !== 'function') throw new TypeError(callback + ' is not a function');
  const arr = Object(this);
  const len = arr.length >>> 0;
  const result = [];
  for (let i = 0; i < len; i++) {
    if (i in arr && callback.call(thisArg, arr[i], i, arr)) result.push(arr[i]);
  }
  return result;
};

Array.prototype.myForEach = function (callback, thisArg) {
  if (typeof callback !== 'function') throw new TypeError(callback + ' is not a function');
  const arr = Object(this);
  const len = arr.length >>> 0;
  for (let i = 0; i < len; i++) {
    if (i in arr) callback.call(thisArg, arr[i], i, arr);
  }
  return undefined;
};

Array.prototype.myReduce = function (callback, initialValue) {
  if (typeof callback !== 'function') throw new TypeError(callback + ' is not a function');
  const arr = Object(this);
  const len = arr.length >>> 0;
  let i = 0;
  let acc;

  if (arguments.length >= 2) {
    acc = initialValue;
  } else {
    // ищем первый существующий элемент
    while (i < len && !(i in arr)) i++;
    if (i >= len) throw new TypeError('Reduce of empty array with no initial value');
    acc = arr[i++];
  }

  for (; i < len; i++) {
    if (i in arr) acc = callback(acc, arr[i], i, arr);
  }
  return acc;
};
```

Разбор: задача выглядит тривиальной, но отличников видно по деталям.

- `arguments.length >= 2` вместо `initialValue !== undefined` — иначе `reduce(fn, undefined)` сломается.
- Длина считывается один раз: элементы, добавленные во время обхода, не посещаются.
- Проверка `i in arr` — единственный способ отличить дырку от `undefined`.
- Определять методы на прототипе нужно через `Object.defineProperty` с `enumerable: false`, иначе они всплывут в `for...in`. Скажите это вслух.

**Частый доп. вопрос:** реализуйте `map` через `reduce` и наоборот.

</details>

### uniqueBy(arr, keyFn) и uniqueWith(arr, isEqual) — спрашивают часто

Реализуйте `uniqueBy(arr, keyFn)` — удаление дубликатов по вычисляемому ключу с сохранением порядка первого вхождения.

Дополнительно `uniqueWith(arr, isEqual)` — дедупликация по произвольному компаратору. Обсудите сложность обоих вариантов и поведение с `NaN` и объектами-ключами.

**Подсказки:**

- Set даёт O(1) на проверку, но работает только со строгим равенством по значению.
- Для составного ключа keyFn может возвращать строку или примитив — этого достаточно для Set.
- Произвольный компаратор нельзя ускорить хешом, здесь честный O(n^2) — проговорите это.
- Set корректно считает NaN равным NaN, в отличие от indexOf.

<details><summary>Решение</summary>

```js
function uniqueBy(arr, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of arr) {
    const key = keyFn ? keyFn(item) : item;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item); // сохраняем первое вхождение
    }
  }
  return result;
}

// произвольный компаратор: O(n^2), зато любая логика равенства
function uniqueWith(arr, isEqual) {
  const result = [];
  outer: for (const item of arr) {
    for (const kept of result) {
      if (isEqual(kept, item)) continue outer;
    }
    result.push(item);
  }
  return result;
}

// пример составного ключа
// uniqueBy(users, function (u) { return u.city + '|' + u.role; });
```

Разбор:

- `[...new Set(arr)]` — правильный ответ для примитивов, скажите его первым, но добавьте, что для объектов он бесполезен: сравниваются ссылки.
- Составной ключ конкатенацией опасен коллизиями (`'a|b'` vs `'a' + '|b'`); безопаснее `JSON.stringify([a, b])` или вложенные Map.
- `Set` использует SameValueZero: `NaN` дедуплицируется, `+0` и `-0` считаются равными.

**Плюс балл:** предложить вариант «оставить последнее вхождение» и объяснить, что он делается обходом с конца или перезаписью в Map.

</details>

### intersection, difference, union по ключу

Реализуйте `intersection(a, b, keyFn)`, `difference(a, b, keyFn)`, `union(a, b, keyFn)` и `symmetricDifference`.

Наивная реализация через `includes` даёт O(n*m) — сделайте за O(n+m). Порядок элементов сохраняется как в первом массиве, дубликаты внутри одного массива схлопываются.

**Подсказки:**

- Постройте Set из ключей второго массива — это превращает поиск в O(1).
- keyFn по умолчанию — тождественная функция, тогда работает и для примитивов.
- Для union нужно ещё дедуплицировать результат — переиспользуйте логику uniqueBy.
- symmetricDifference = difference(a, b) + difference(b, a).

<details><summary>Решение</summary>

```js
function toKeySet(arr, keyFn) {
  const set = new Set();
  for (const item of arr) set.add(keyFn(item));
  return set;
}

const identity = function (x) { return x; };

function intersection(a, b, keyFn) {
  const key = keyFn || identity;
  const bKeys = toKeySet(b, key);
  const seen = new Set();
  const result = [];
  for (const item of a) {
    const k = key(item);
    if (bKeys.has(k) && !seen.has(k)) {
      seen.add(k);
      result.push(item);
    }
  }
  return result;
}

function difference(a, b, keyFn) {
  const key = keyFn || identity;
  const bKeys = toKeySet(b, key);
  const seen = new Set();
  const result = [];
  for (const item of a) {
    const k = key(item);
    if (!bKeys.has(k) && !seen.has(k)) {
      seen.add(k);
      result.push(item);
    }
  }
  return result;
}

function union(a, b, keyFn) {
  const key = keyFn || identity;
  const seen = new Set();
  const result = [];
  for (const item of a.concat(b)) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      result.push(item);
    }
  }
  return result;
}

function symmetricDifference(a, b, keyFn) {
  return difference(a, b, keyFn).concat(difference(b, a, keyFn));
}
```

Разбор: главный сигнал — заметили ли вы квадратичную сложность наивного решения и предложили ли хеш-структуру.

- Проговорите память: Set занимает O(m), это осознанный размен времени на память.
- Для сравнения объектов по нескольким полям keyFn должен давать стабильный ключ — `JSON.stringify` зависит от порядка полей.
- В современных браузерах есть нативные `Set.prototype.intersection/difference/union` — упомянуть их будет плюсом.

</details>

### sortBy(arr, rules) — сортировка по нескольким полям — спрашивают часто

Реализуйте `sortBy(arr, rules)`, где правила — массив вида `['age', { key: 'name', desc: true }, u => u.score]`.

Требования: сортировка не мутирует исходный массив, сравнение стабильное, строки сравниваются через `localeCompare`, `null` и `undefined` уезжают в конец независимо от направления.

**Подсказки:**

- Приведите разнородные правила к единому виду { getter, direction } до сортировки.
- Сравнивайте поля по очереди: первое ненулевое сравнение решает исход.
- Стабильность гарантируется декорированием элементов исходным индексом (schwartzian transform).
- Числа нельзя сравнивать через localeCompare, а строки — через минус: нужна общая функция compare с проверкой типов.

<details><summary>Решение</summary>

```js
function isEmpty(value) {
  return value === null || value === undefined;
}

function compareValues(a, b) {
  if (a === b) return 0;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b, 'ru');
  }
  return a < b ? -1 : 1;
}

function normalizeRule(rule) {
  if (typeof rule === 'function') return { get: rule, dir: 1 };
  if (typeof rule === 'string') return { get: function (o) { return o[rule]; }, dir: 1 };
  const get = typeof rule.key === 'function'
    ? rule.key
    : function (o) { return o[rule.key]; };
  return { get: get, dir: rule.desc ? -1 : 1 };
}

function sortBy(arr, rules) {
  const normalized = rules.map(normalizeRule);
  return arr
    // декорируем индексом, чтобы гарантировать стабильность
    .map(function (item, index) { return { item: item, index: index }; })
    .sort(function (a, b) {
      for (const rule of normalized) {
        const valueA = rule.get(a.item);
        const valueB = rule.get(b.item);

        // пустые значения всегда уезжают в конец, направление на них не влияет
        const emptyA = isEmpty(valueA);
        const emptyB = isEmpty(valueB);
        if (emptyA || emptyB) {
          if (emptyA && emptyB) continue;
          return emptyA ? 1 : -1;
        }

        const result = compareValues(valueA, valueB);
        if (result !== 0) return result * rule.dir;
      }
      return a.index - b.index; // равные элементы сохраняют исходный порядок
    })
    .map(function (entry) { return entry.item; });
}
```

Разбор:

- `Array.prototype.sort` мутирует массив — это ловушка номер один. В современных движках есть `toSorted()`.
- С ES2019 `sort` обязан быть стабильным, но декорирование индексом всё равно показывает, что вы понимаете проблему; к тому же оно спасает при «в конец» для пустых значений.
- `['10', '9'].sort()` даёт лексикографический порядок — классический вопрос про компаратор по умолчанию.
- `localeCompare` для больших массивов медленный: предложите `Intl.Collator` с переиспользуемым инстансом.

</details>

### buildTree(items) — плоский список в дерево — спрашивают часто

Дан плоский массив `[{ id, parentId, title }]`. Соберите вложенное дерево: у каждого узла появляется массив `children`, корни — узлы без родителя.

Требования: одна итерация по массиву (линейная сложность), порядок детей сохраняется, элементы с несуществующим `parentId` считаются корнями, исходные объекты не мутируются.

**Подсказки:**

- Наивное решение с рекурсивным filter по parentId — это O(n^2). Сначала сделайте индекс.
- Первый проход: положите копии узлов в Map по id. Второй: свяжите детей с родителями.
- Родителя можно встретить позже ребёнка — именно поэтому нужны два прохода, а не один.
- Не забудьте про висячие ссылки: parentId указывает на узел вне выборки.

<details><summary>Решение</summary>

```js
function buildTree(items, options) {
  const opts = options || {};
  const idKey = opts.idKey || 'id';
  const parentKey = opts.parentKey || 'parentId';
  const childrenKey = opts.childrenKey || 'children';

  const byId = new Map();
  // первый проход: индекс из копий, чтобы не мутировать вход
  for (const item of items) {
    const copy = Object.assign({}, item);
    copy[childrenKey] = [];
    byId.set(item[idKey], copy);
  }

  const roots = [];
  // второй проход: связываем детей с родителями
  for (const item of items) {
    const node = byId.get(item[idKey]);
    const parent = byId.get(item[parentKey]);
    if (parent && parent !== node) {
      parent[childrenKey].push(node);
    } else {
      // нет родителя или он вне выборки — это корень
      roots.push(node);
    }
  }
  return roots;
}
```

Разбор: эту задачу дают, чтобы отличить «пишу как в туториале» от «думаю про сложность».

- Ожидаемый ответ — O(n) через `Map`. Рекурсия с `filter` внутри — O(n^2), назовите это сами.
- Отдельно проговорите защиту от циклов (`a.parent = b, b.parent = a`): при построении дерева получится потерянная компонента, при обходе — бесконечная рекурсия.
- Ссылка на самого себя (`parentId === id`) — реальный кейс из грязных данных.
- Мутация входных объектов часто ломает React: скажите, что делаете копии сознательно.

**Частое продолжение:** сортировка детей по `order` и подсчёт глубины.

</details>

### flattenTree(nodes) — дерево в плоский список — спрашивают часто

Разверните дерево с `children` в плоский массив, добавив каждому узлу `depth` и `parentId`.

Порядок — как при обходе в глубину (pre-order), поле `children` в результат не попадает. Сделайте вариант без рекурсии, чтобы не переполнить стек на глубоких деревьях.

**Подсказки:**

- Pre-order обход: сначала узел, потом его дети слева направо.
- Итеративный вариант — стек; чтобы сохранить порядок, кладите детей в обратном порядке.
- Глубину и parentId удобно нести вместе с узлом в элементе стека.
- Уберите children из результата через деструктуризацию с rest.

<details><summary>Решение</summary>

```js
function flattenTree(nodes, options) {
  const opts = options || {};
  const childrenKey = opts.childrenKey || 'children';
  const idKey = opts.idKey || 'id';

  const result = [];
  // стек кадров: узел + метаданные обхода
  const stack = [];
  for (let i = nodes.length - 1; i >= 0; i--) {
    stack.push({ node: nodes[i], depth: 0, parentId: null });
  }

  while (stack.length > 0) {
    const frame = stack.pop();
    const node = frame.node;
    const children = node[childrenKey] || [];

    const flatNode = Object.assign({}, node);
    delete flatNode[childrenKey];
    flatNode.depth = frame.depth;
    flatNode.parentId = frame.parentId;
    result.push(flatNode);

    // в обратном порядке, чтобы pop доставал первого ребёнка первым
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ node: children[i], depth: frame.depth + 1, parentId: node[idKey] });
    }
  }
  return result;
}
```

Разбор:

- Рекурсивная версия короче, но интервьюер почти всегда спрашивает «а если дерево глубиной 100000?» — итеративный обход это ответ.
- Ключевая деталь итеративного pre-order: обратный порядок при добавлении детей в стек.
- Если нужен BFS-порядок — берём очередь и `shift` (или индекс-указатель, чтобы не платить O(n) за shift).

**Зачем это в проде:** виртуальный скролл умеет рендерить только плоский список, поэтому дерево разворачивают с учётом свёрнутых узлов. Скажите это — сразу видно опыт.

</details>

### findPath(root, predicate) — путь до узла в дереве — спрашивают часто

Найдите путь от корня до первого узла, удовлетворяющего предикату: массив узлов `[root, ..., target]` или `null`.

Реализуйте два варианта: DFS (короткий, рекурсивный) и BFS (найдёт ближайший к корню узел). Дерево может быть лесом — на входе массив корней.

**Подсказки:**

- DFS: рекурсивно спускаемся, а найденный путь собираем на возврате из рекурсии.
- Не копируйте путь на каждом шаге — можно push перед спуском и pop после (backtracking).
- BFS нужен, если требуется САМЫЙ КОРОТКИЙ путь; несите путь в элементах очереди.
- Не забудьте про случай, когда предикат подходит самому корню.

<details><summary>Решение</summary>

```js
// DFS с backtracking: путь строится на месте, без лишних копий
function findPath(roots, predicate, childrenKey) {
  const key = childrenKey || 'children';
  const path = [];

  function walk(node) {
    path.push(node);
    if (predicate(node)) return true;
    const children = node[key] || [];
    for (const child of children) {
      if (walk(child)) return true;
    }
    path.pop(); // ветка не подошла — откатываемся
    return false;
  }

  const list = Array.isArray(roots) ? roots : [roots];
  for (const root of list) {
    if (walk(root)) return path.slice();
  }
  return null;
}

// BFS: находит узел, ближайший к корню
function findPathBfs(roots, predicate, childrenKey) {
  const key = childrenKey || 'children';
  const list = Array.isArray(roots) ? roots : [roots];
  const queue = list.map(function (node) { return [node]; });
  let head = 0; // указатель вместо shift, чтобы не платить O(n)

  while (head < queue.length) {
    const path = queue[head++];
    const node = path[path.length - 1];
    if (predicate(node)) return path;
    for (const child of node[key] || []) {
      queue.push(path.concat(child));
    }
  }
  return null;
}
```

Разбор:

- Backtracking (`push` / `pop`) вместо конкатенации массивов — сигнал, что вы думаете про аллокации.
- Ключевой вопрос интервьюера: «в чём разница DFS и BFS здесь?» Ответ: DFS находит первый по порядку обхода, BFS — ближайший к корню.
- Не забудьте вернуть `path.slice()`: массив переиспользуется и после выхода будет пустым.
- В BFS `shift` на массиве — O(n); указатель `head` делает обход честным O(n).

</details>

### formatNumber(value, options)

Реализуйте форматирование числа с разделителями разрядов: `1234567.891` → `'1 234 567,89'`.

Параметры: разделитель групп, десятичный разделитель, число знаков после запятой. Учтите отрицательные числа, числа меньше тысячи, `NaN` и `Infinity`.

**Подсказки:**

- Отделите знак и дробную часть, группируйте только целую.
- Группы считаются справа налево — идите по строке и вставляйте разделитель, когда до конца остаётся кратное трём число цифр.
- toFixed решает округление, но возвращает строку и врёт на больших числах — упомяните это.
- В проде правильный ответ — Intl.NumberFormat; скажите это, но реализуйте руками.

<details><summary>Решение</summary>

```js
function formatNumber(value, options) {
  const opts = options || {};
  const groupSep = opts.groupSep === undefined ? ' ' : opts.groupSep;
  const decimalSep = opts.decimalSep === undefined ? ',' : opts.decimalSep;
  const digits = opts.digits;

  const num = Number(value);
  if (!isFinite(num)) return String(value); // NaN, Infinity отдаём как есть

  const abs = Math.abs(num);
  const fixed = digits === undefined ? String(abs) : abs.toFixed(digits);
  const parts = fixed.split('.');
  const intPart = parts[0];
  const fracPart = parts[1];

  let grouped = '';
  for (let i = 0; i < intPart.length; i++) {
    // вставляем разделитель, когда до конца осталось кратное 3 цифр
    if (i > 0 && (intPart.length - i) % 3 === 0) grouped += groupSep;
    grouped += intPart[i];
  }

  const sign = num < 0 ? '-' : '';
  return sign + grouped + (fracPart ? decimalSep + fracPart : '');
}
```

Разбор:

- Альтернатива циклу — регулярка `/\B(?=(\d{3})+(?!\d))/g`. Уметь объяснить lookahead — заметный плюс.
- Правильный продовый ответ: `new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 })`. Начните с него, потом реализуйте руками — так вы показываете и кругозор, и алгоритм.
- В вёрстке цен используют неразрывный пробел `\u00A0`, иначе число переносится по строке.
- Числа больше `Number.MAX_SAFE_INTEGER` теряют точность — для денег используйте копейки в целых или BigInt.

</details>

### plural(count, forms) — склонение слов — спрашивают часто

Реализуйте `plural(count, ['товар', 'товара', 'товаров'])`, возвращающий правильную форму слова для русского языка.

Проверьте на 1, 2, 5, 11, 12, 21, 101, 111, 0 и отрицательных числах. Дополнительно сделайте `pluralize(count, forms)`, возвращающий строку «5 товаров».

**Подсказки:**

- Правило зависит от последней цифры и от того, не попадает ли число в диапазон 11-19.
- Числа 11-14 — исключение: у них всегда форма множественного числа (11 товаров, а не 11 товар).
- Берите остаток от 100, потом остаток от 10.
- Не забудьте Math.abs: отрицательные значения склоняются так же.

<details><summary>Решение</summary>

```js
function plural(count, forms) {
  const n = Math.abs(count) % 100;
  const lastDigit = n % 10;

  // 11-19 — особый случай, всегда третья форма
  if (n > 10 && n < 20) return forms[2];
  if (lastDigit === 1) return forms[0];   // 1, 21, 101
  if (lastDigit > 1 && lastDigit < 5) return forms[1]; // 2-4, 22-24
  return forms[2];                         // 0, 5-9, 25-29
}

function pluralize(count, forms) {
  return count + ' ' + plural(count, forms);
}

// plural(1,  f) -> 'товар'
// plural(3,  f) -> 'товара'
// plural(11, f) -> 'товаров'
// plural(21, f) -> 'товар'
// plural(0,  f) -> 'товаров'
```

Разбор: короткая задача, но ошибку на 11-14 допускают почти все.

- Проверьте себя на 111 и 112: это те же 11 и 12 по остатку от 100.
- Дробные числа в русском языке склоняются по правилу «1,5 товара» — упомянуть это будет плюсом.
- Правильный продовый ответ — `new Intl.PluralRules('ru-RU')` с категориями `one / few / many / other`. Обязательно назовите его.

**Что сказать вслух:** «В реальном проекте я бы не изобретал правило, а взял Intl.PluralRules или i18n-библиотеку, потому что в других локалях форм может быть шесть».

</details>

### transliterate(str) и slugify(str)

Реализуйте транслитерацию кириллицы в латиницу и функцию `slugify`, превращающую заголовок в URL-фрагмент.

Требования: регистр сохраняется в транслитерации, в слаге всё приводится к нижнему регистру, любые не-буквенно-цифровые символы схлопываются в один дефис, дефисы по краям срезаются, пустые строки обрабатываются корректно.

**Подсказки:**

- Достаточно таблицы для строчных букв: для заглавных ищите по нижнему регистру и восстанавливайте регистр первой буквы.
- Буквы щ, ю, я дают несколько латинских символов — это нормально.
- Символы ъ и ь превращаются в пустую строку.
- Слаг: транслитерация, потом lowercase, потом замена всего лишнего на дефисы и обрезка краёв.

<details><summary>Решение</summary>

```js
const TRANSLIT_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e',
  ю: 'yu', я: 'ya'
};

function transliterate(str) {
  let result = '';
  for (const char of String(str)) {
    const lower = char.toLowerCase();
    const mapped = TRANSLIT_MAP[lower];
    if (mapped === undefined) {
      result += char; // латиница, цифры, знаки — как есть
    } else if (char === lower) {
      result += mapped;
    } else {
      // восстанавливаем регистр: Щ -> Sch
      result += mapped.charAt(0).toUpperCase() + mapped.slice(1);
    }
  }
  return result;
}

function slugify(str) {
  return transliterate(String(str))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // всё лишнее схлопываем в один дефис
    .replace(/^-+|-+$/g, '');    // срезаем дефисы по краям
}
```

Разбор:

- Итерация `for...of` по строке идёт по code points, а не по code units — это важно для эмодзи и суррогатных пар. Скажите об этом.
- Схлопывание нескольких символов в один дефис (`+` в регулярке) — то, что отличает рабочий slugify от учебного.
- Для латиницы с диакритикой правильнее `str.normalize('NFD').replace(/\p{Diacritic}/gu, '')` — упомяните Unicode-нормализацию.
- Обсудите коллизии слагов: два разных заголовка могут дать один слаг, в проде добавляют id.

</details>

### parseQuery(qs) и stringifyQuery(obj) — спрашивают часто

Реализуйте разбор query string в объект и обратную сериализацию, не используя `URLSearchParams`.

Требования: ведущий `?` отбрасывается, значения декодируются (`%20`, `+`), повторяющиеся ключи собираются в массив, ключ без значения даёт пустую строку, `undefined` и `null` при сериализации пропускаются.

**Подсказки:**

- Разбейте по & и для каждой пары найдите ПЕРВЫЙ знак = — значение может содержать = внутри.
- Плюс в query string означает пробел, decodeURIComponent сам этого не делает.
- Для повторяющихся ключей: первый раз кладём значение, второй — превращаем в массив.
- Используйте Object.create(null) или hasOwnProperty, иначе ключ __proto__ ломает объект.

<details><summary>Решение</summary>

```js
function parseQuery(queryString) {
  const result = Object.create(null); // защита от __proto__ в ключах
  const input = String(queryString).replace(/^[?#]/, '');
  if (!input) return result;

  for (const pair of input.split('&')) {
    if (!pair) continue;
    const eqIndex = pair.indexOf('='); // именно первый =, значение может содержать свои
    const rawKey = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
    const rawValue = eqIndex === -1 ? '' : pair.slice(eqIndex + 1);

    const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));

    if (key in result) {
      // повторяющийся ключ превращается в массив
      if (Array.isArray(result[key])) result[key].push(value);
      else result[key] = [result[key], value];
    } else {
      result[key] = value;
    }
  }
  return result;
}

function stringifyQuery(obj) {
  const parts = [];
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined || value === null) continue; // пропускаем пустые
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(item));
    }
  }
  return parts.join('&');
}
```

Разбор:

- `split('=')` вместо `indexOf('=')` — самая частая ошибка: значение `a=b=c` обрежется.
- `decodeURIComponent` бросает `URIError` на битой строке вроде `%E0%A4%A` — оберните в try/catch.
- Prototype pollution через `?__proto__[x]=1` — реальная уязвимость; `Object.create(null)` её закрывает. Это senior-сигнал.
- Разные бэкенды по-разному кодируют массивы: `a=1&a=2`, `a[]=1`, `a=1,2`. Уточните формат у интервьюера.

**Плюс балл:** сказать, что в проде это `new URLSearchParams(location.search)` и `qs` для вложенных структур.

</details>

### template(str, data) — шаблонизатор строк

Реализуйте `template('Привет, {{ user.name }}!', data)`: подставляет значения по пути из объекта.

Требования: лишние пробелы внутри скобок игнорируются, отсутствующее значение заменяется пустой строкой (или дефолтом из опций), поддержите путь с точками. Обсудите экранирование HTML.

**Подсказки:**

- Одна регулярка с группой захвата плюс replace с функцией-заменителем.
- Путь резолвится тем же reduce, что и в задаче про get.
- Не используйте new Function и eval — скажите, почему это дыра в безопасности.
- Значения из данных нужно экранировать, иначе получите XSS при вставке в innerHTML.

<details><summary>Решение</summary>

```js
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function template(str, data, options) {
  const opts = options || {};
  const fallback = opts.fallback === undefined ? '' : opts.fallback;
  const escape = opts.escape !== false; // по умолчанию экранируем

  // {{ путь.через.точку }} с любыми пробелами внутри
  return String(str).replace(/\{\{\s*([\w.$]+)\s*\}\}/g, function (match, path) {
    const value = path.split('.').reduce(function (acc, key) {
      return acc === null || acc === undefined ? undefined : acc[key];
    }, data);

    if (value === undefined || value === null) return fallback;
    return escape ? escapeHtml(value) : String(value);
  });
}
```

Разбор:

- Главный сигнал для senior — вы сами подняли тему XSS. Шаблонизатор, который вставляет данные в HTML без экранирования, это готовая уязвимость.
- Вариант через `new Function('with(data){ return ...}')` быстрый, но исполняет произвольный код и не работает под CSP. Скажите, почему отказались.
- Обратите внимание на второй аргумент `replace`: функция получает совпадение и группы, а `$1` в строке-замене здесь не подошёл бы, потому что нужен резолв пути.
- Расширения, о которых спросят: условия, циклы, фильтры вида `{{ price | money }}`.

</details>

## React

### useDebounce и usePrevious — спрашивают часто

Напиши хук, возвращающий значение с задержкой, и хук, возвращающий значение из предыдущего рендера.

**Подсказки:**

- Вся суть useDebounce — в cleanup: он отменяет предыдущий таймер.
- usePrevious: ref обновляется в эффекте, то есть уже после рендера, поэтому во время рендера в нём лежит прошлое значение.

<details><summary>Решение</summary>

```js
function useDebounce(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; });  // после рендера
  return ref.current;                         // значение прошлого рендера
}
```

В `usePrevious` у эффекта намеренно нет массива зависимостей — он должен срабатывать после каждого рендера.

</details>

### useFetch с отменой — спрашивают часто

Хук загрузки данных: состояния загрузки, успеха и ошибки, отмена при размонтировании и при смене URL.

**Подсказки:**

- AbortController создаётся внутри эффекта, abort вызывается в cleanup.
- AbortError нужно отфильтровать — это не ошибка загрузки, а наша собственная отмена.
- fetch не бросает на 4xx и 5xx — проверять res.ok вручную.

<details><summary>Решение</summary>

```js
function useFetch(url) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', data: null, error: null });

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then((data) => setState({ status: 'success', data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setState({ status: 'error', data: null, error });
        }
      });

    return () => controller.abort();
  }, [url]);

  return state;
}
```

Два момента, за которые здесь и ставят балл: `fetch` реджектится только на сетевой ошибке, поэтому `res.ok` проверяем сами; и отмена в cleanup решает не только утечку, но и гонку — ответ на старый URL не затрёт новый.

Финальная реплика: в продакшене это TanStack Query, а не свой хук — там уже есть кеш, дедупликация и повторы.

</details>

### Компонент Autocomplete — спрашивают часто

Поле ввода с подсказками: дебаунс запроса, отмена предыдущего, навигация с клавиатуры, состояния загрузки и пустого результата.

**Подсказки:**

- Собери из готовых кусков: useDebounce плюс эффект с AbortController.
- Клавиатура: ArrowUp / ArrowDown двигают активный индекс, Enter выбирает, Escape закрывает.
- Не забудь про доступность — это отличает senior-ответ.

<details><summary>Решение</summary>

```js
function Autocomplete({ search, onSelect }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(-1);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length < 2) { setItems([]); return; }
    const controller = new AbortController();
    search(debouncedQuery, controller.signal)
      .then((res) => { setItems(res); setActive(-1); })
      .catch((e) => { if (e.name !== 'AbortError') setItems([]); });
    return () => controller.abort();
  }, [debouncedQuery, search]);

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, items.length - 1));
    if (e.key === 'ArrowUp')   setActive((i) => Math.max(i - 1, 0));
    if (e.key === 'Enter' && items[active]) onSelect(items[active]);
    if (e.key === 'Escape') setItems([]);
  }

  return (
    <div role="combobox" aria-expanded={items.length > 0}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        aria-activedescendant={active >= 0 ? 'opt-' + active : undefined}
      />
      <ul role="listbox">
        {items.map((item, i) => (
          <li
            key={item.id}
            id={'opt-' + i}
            role="option"
            aria-selected={i === active}
            onMouseDown={() => onSelect(item)}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Проговори улучшения, даже если не успел их написать: кеш «запрос → результаты», минимальная длина запроса, подсветка совпадения, состояния «ничего не найдено» и «ошибка», `onMouseDown` вместо `onClick` (иначе blur закроет список раньше выбора).

</details>

### useLocalStorage(key, initialValue) — спрашивают часто

Напишите хук `useLocalStorage(key, initialValue)` с API как у `useState`.

Требования: ленивая инициализация из хранилища, поддержка функционального обновления `setValue(prev => ...)`, устойчивость к битому JSON и к недоступному `localStorage` (SSR, приватный режим), синхронизация между вкладками через событие `storage`.

**Подсказки:**

- Чтение из localStorage дорогое — делайте его в ленивом инициализаторе useState, а не на каждый рендер.
- JSON.parse может бросить исключение на битых данных: оборачивайте в try/catch и падайте на initialValue.
- Для функционального апдейта используйте setState(prev => ...) и записывайте в хранилище уже вычисленное значение.
- Событие storage приходит только в ДРУГИХ вкладках — для текущей нужно обновлять состояние самому.

<details><summary>Решение</summary>

```js
import { useCallback, useEffect, useState } from 'react';

function readValue(key, initialValue) {
  // на сервере window нет — сразу отдаём начальное значение
  if (typeof window === 'undefined') return initialValue;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? initialValue : JSON.parse(raw);
  } catch (error) {
    // битый JSON или заблокированное хранилище
    return initialValue;
  }
}

export function useLocalStorage(key, initialValue) {
  // ленивый инициализатор: обращаемся к storage один раз
  const [value, setValue] = useState(function () {
    return readValue(key, initialValue);
  });

  const setStoredValue = useCallback(function (update) {
    setValue(function (prev) {
      const next = typeof update === 'function' ? update(prev) : update;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch (error) {
        // QuotaExceededError или приватный режим Safari — состояние всё равно обновляем
      }
      return next;
    });
  }, [key]);

  const remove = useCallback(function () {
    try { window.localStorage.removeItem(key); } catch (error) {}
    setValue(initialValue);
  }, [key, initialValue]);

  // синхронизация между вкладками
  useEffect(function () {
    function onStorage(event) {
      if (event.key !== key || event.storageArea !== window.localStorage) return;
      setValue(event.newValue === null ? initialValue : JSON.parse(event.newValue));
    }
    window.addEventListener('storage', onStorage);
    return function () { window.removeEventListener('storage', onStorage); };
  }, [key, initialValue]);

  // ключ поменялся — перечитываем
  useEffect(function () {
    setValue(readValue(key, initialValue));
  }, [key]);

  return [value, setStoredValue, remove];
}
```

Разбор — что отличает senior-ответ:

- Ленивая инициализация `useState(() => ...)`: без стрелки чтение из storage происходит на каждом рендере.
- SSR: обращение к `window` на сервере — ошибка. Проговорите гидратацию: первый рендер на клиенте должен совпасть с серверным, иначе hydration mismatch. Аккуратный вариант — читать storage в `useEffect` после монтирования.
- `localStorage` может бросать: приватный режим, переполненная квота, отключённые cookies.
- Событие `storage` в текущей вкладке не приходит — это ловушка, на которую ловят.
- Побочный вопрос: чем `localStorage` хуже `IndexedDB` — синхронный API блокирует главный поток, лимит около 5 МБ, только строки.

</details>

### useEventListener(type, handler, target) — спрашивают часто

Напишите хук, подписывающий обработчик на событие DOM-элемента, `window` или `document`.

Требования: пересоздание подписки при смене типа события или цели, но НЕ при смене колбэка; корректная отписка; поддержка `ref` в качестве цели; поддержка опций (`passive`, `capture`).

**Подсказки:**

- Если положить handler в зависимости useEffect, подписка будет пересоздаваться на каждый рендер.
- Свежий колбэк храните в ref и обновляйте его в отдельном эффекте (паттерн latest ref).
- Цель может быть ref-объектом: разворачивайте target.current внутри эффекта.
- Возвращайте функцию отписки с теми же опциями, что были при подписке.

<details><summary>Решение</summary>

```js
import { useEffect, useLayoutEffect, useRef } from 'react';

// на сервере useLayoutEffect предупреждает — подменяем его
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useEventListener(eventType, handler, target, options) {
  const savedHandler = useRef(handler);

  // всегда держим свежий колбэк, не пересоздавая подписку
  useIsomorphicLayoutEffect(function () {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(function () {
    const element = target && 'current' in target ? target.current : (target || window);
    if (!element || !element.addEventListener) return undefined;

    function listener(event) {
      savedHandler.current(event);
    }

    element.addEventListener(eventType, listener, options);
    return function () {
      element.removeEventListener(eventType, listener, options);
    };
    // handler намеренно не в зависимостях — он живёт в ref
  }, [eventType, target, JSON.stringify(options || null)]);
}

// использование:
// const ref = useRef(null);
// useEventListener('click', (e) => console.log(e), ref);
// useEventListener('keydown', onKeyDown); // по умолчанию window
```

Разбор: это задача про то, понимаете ли вы природу зависимостей эффекта.

- Паттерн latest ref — ключевой момент. Без него инлайновая стрелка в пропсах пересоздаёт подписку каждый рендер (add/remove на каждый рендер).
- Почему `useLayoutEffect` для обновления ref: чтобы свежий колбэк был доступен до того, как сработает событие в том же кадре.
- Обязателен cleanup: без него при размонтировании остаётся висящий слушатель и утечка через замыкание.
- Объект `options` в зависимостях нестабилен по ссылке — либо сериализуйте, либо требуйте мемоизации от вызывающего. Проговорите этот компромисс.
- Ссылка на React 19: `useEffectEvent` решает ровно эту задачу штатно — упомянуть будет плюсом.

</details>

### Компонент Tabs с поддержкой клавиатуры — спрашивают часто

Реализуйте компонент `Tabs`: список вкладок и панель с содержимым активной вкладки.

Требования a11y: правильные роли (`tablist`, `tab`, `tabpanel`), связка через `aria-controls` / `aria-labelledby`, навигация стрелками, Home/End, паттерн roving tabindex (в табуляцию попадает только активная вкладка). Отключённые вкладки пропускаются.

**Подсказки:**

- Из всего списка вкладок tabIndex={0} должен быть только у активной, у остальных -1 — это и есть roving tabindex.
- Стрелки влево/вправо переключают вкладку по кругу, Home и End — на первую и последнюю.
- После смены вкладки с клавиатуры нужно программно перевести фокус на новую вкладку.
- id панели и вкладки связывайте через useId, чтобы несколько Tabs на странице не конфликтовали.

<details><summary>Решение</summary>

```js
import { useId, useRef, useState } from 'react';

export function Tabs({ items, defaultIndex = 0 }) {
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const baseId = useId();
  const tabRefs = useRef([]);

  const tabId = (i) => baseId + '-tab-' + i;
  const panelId = (i) => baseId + '-panel-' + i;

  function focusTab(index) {
    setActiveIndex(index);
    // фокус переносим вручную: активная вкладка должна получить фокус
    const node = tabRefs.current[index];
    if (node) node.focus();
  }

  // ищем следующую не-disabled вкладку по кругу
  function findEnabled(start, step) {
    const count = items.length;
    for (let i = 1; i <= count; i++) {
      const index = (start + step * i + count * count) % count;
      if (!items[index].disabled) return index;
    }
    return start;
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowRight') { event.preventDefault(); focusTab(findEnabled(activeIndex, 1)); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); focusTab(findEnabled(activeIndex, -1)); }
    else if (event.key === 'Home') { event.preventDefault(); focusTab(findEnabled(-1, 1)); }
    else if (event.key === 'End') { event.preventDefault(); focusTab(findEnabled(items.length, -1)); }
  }

  return (
    <div>
      <div role="tablist" aria-label="Разделы" onKeyDown={onKeyDown}>
        {items.map((item, i) => (
          <button
            key={item.id}
            ref={(el) => { tabRefs.current[i] = el; }}
            id={tabId(i)}
            role="tab"
            type="button"
            aria-selected={i === activeIndex}
            aria-controls={panelId(i)}
            disabled={item.disabled}
            // roving tabindex: в табуляцию попадает только активная вкладка
            tabIndex={i === activeIndex ? 0 : -1}
            onClick={() => setActiveIndex(i)}
          >
            {item.title}
          </button>
        ))}
      </div>

      {items.map((item, i) => (
        <div
          key={item.id}
          id={panelId(i)}
          role="tabpanel"
          aria-labelledby={tabId(i)}
          hidden={i !== activeIndex}
          tabIndex={0}
        >
          {i === activeIndex ? item.content : null}
        </div>
      ))}
    </div>
  );
}
```

Разбор: код тут простой, оценивают знание паттерна и деталей.

- Roving tabindex — то самое слово, которое хочет услышать интервьюер: Tab выводит из группы вкладок, а стрелки переключают внутри неё.
- `useId` вместо счётчика или `Math.random`: стабильно при SSR и не конфликтует между инстансами.
- `hidden` вместо размонтирования сохраняет состояние панелей (введённый текст, позицию скролла) — обсудите компромисс с ленивым рендером тяжёлых вкладок.
- Частое продолжение: сделать Tabs через compound components (`Tabs.List`, `Tabs.Tab`, `Tabs.Panel`) на контексте — расскажите, что контекст даёт гибкую вёрстку без прокидывания пропсов.
- Ещё продолжение: синхронизация активной вкладки с URL через query-параметр.

</details>

### Modal через createPortal — спрашивают часто

Реализуйте модальное окно через `createPortal`.

Требования: рендер в отдельный узел вне корня приложения, закрытие по Escape и по клику на подложку (но не по клику внутри контента), блокировка скролла body, возврат фокуса на элемент-открывашку, корректные ARIA-атрибуты. Все эффекты должны корректно очищаться.

**Подсказки:**

- Портал рендерит в другой DOM-узел, но события всплывают по дереву React, а не DOM — это важно.
- Слушатель Escape вешайте на document в useEffect и снимайте в cleanup.
- Клик по подложке ловите сравнением event.target === event.currentTarget, иначе закроется и по клику внутри.
- Блокировку скролла делайте с сохранением прежнего значения overflow, чтобы вложенные модалки не сломали друг друга.

<details><summary>Решение</summary>

```js
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function Modal({ isOpen, onClose, title, children }) {
  const contentRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(function () {
    if (!isOpen) return undefined;

    previouslyFocused.current = document.activeElement;

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);

    // блокируем скролл, запомнив прежнее значение
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // фокус внутрь модалки
    if (contentRef.current) contentRef.current.focus();

    return function () {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      // возвращаем фокус туда, откуда открыли
      const node = previouslyFocused.current;
      if (node && node.focus) node.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay"
      // закрываем только по клику именно по подложке
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={contentRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <h2>{title}</h2>
        {children}
        <button type="button" onClick={onClose}>Закрыть</button>
      </div>
    </div>,
    document.body
  );
}
```

Разбор:

- Ключевой вопрос: «всплывают ли события из портала в родительский компонент?» Да — React использует дерево компонентов, а не DOM. Это удивляет многих и часто ломает клик-аутсайд.
- Блокировка скролла через `overflow: hidden` на iOS не работает как ожидается и вызывает прыжок из-за исчезнувшего скроллбара — упомяните компенсацию `padding-right`.
- Возврат фокуса и `aria-modal` — обязательная часть, за неё дают баллы.
- Хорошее продолжение: добавить focus trap (см. отдельную задачу) и `inert` на фон.
- Скажите, что нативный `<dialog>` закрывает большинство этих задач штатно.

</details>

### Бесконечный скролл + useIntersectionObserver — спрашивают часто

Реализуйте хук `useIntersectionObserver` и на его основе бесконечный скролл: при появлении элемента-сентинела подгружается следующая страница.

Требования: нет повторных запросов при повторном пересечении и во время загрузки, есть состояние `hasMore`, обработка ошибок, отмена запроса при размонтировании, наблюдатель пересоздаётся при смене узла.

**Подсказки:**

- Ref через useState вместо useRef: так компонент узнаёт о появлении узла и пересоздаст observer.
- Флаг isLoading нужно проверять внутри колбэка, иначе за один экран улетит несколько запросов.
- AbortController в cleanup эффекта отменяет запрос при размонтировании.
- Сентинел должен быть отдельным элементом ПОД списком, а не последним элементом списка.

<details><summary>Решение</summary>

```js
import { useCallback, useEffect, useRef, useState } from 'react';

export function useIntersectionObserver(options) {
  // именно состояние, а не ref: нужно перезапустить эффект при появлении узла
  const [node, setNode] = useState(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(function () {
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(function (entries) {
      setIsIntersecting(entries[0].isIntersecting);
    }, options);
    observer.observe(node);
    return function () { observer.disconnect(); };
  }, [node, options && options.rootMargin, options && options.threshold]);

  return [setNode, isIntersecting];
}

export function useInfiniteList(fetchPage) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const [sentinelRef, isIntersecting] = useIntersectionObserver({ rootMargin: '300px' });

  const loadMore = useCallback(async function () {
    // защита от параллельных загрузок и лишних запросов в конце списка
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await fetchPage(page, controller.signal);
      setItems(function (prev) { return prev.concat(result.items); });
      setHasMore(result.hasMore);
      setPage(function (p) { return p + 1; });
    } catch (err) {
      if (err.name !== 'AbortError') setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, page, hasMore, isLoading]);

  useEffect(function () {
    if (isIntersecting) loadMore();
  }, [isIntersecting, loadMore]);

  // отменяем запрос при размонтировании
  useEffect(function () {
    return function () { if (abortRef.current) abortRef.current.abort(); };
  }, []);

  return { items, hasMore, isLoading, error, sentinelRef, retry: loadMore };
}
```

Разбор:

- Callback ref через `useState` вместо `useRef` — важная деталь: обычный ref не вызывает ререндер, и эффект не узнает, что узел появился.
- Защита от дублей: без флага `isLoading` сентинел, оставшийся во вьюпорте, выстрелит несколько раз подряд.
- `rootMargin` подгружает данные заранее, чтобы пользователь не видел пустоту.
- Обязательно проговорите доступность: бесконечный скролл ломает футер и навигацию клавиатурой, поэтому кнопка «Загрузить ещё» как фоллбэк — хороший тон.
- Для очень длинных списков сочетайте с виртуализацией, иначе DOM всё равно распухнет.

</details>

### Форма с валидацией без библиотек — спрашивают часто

Сделайте форму (email, пароль, подтверждение пароля) с валидацией на своих хуках, без react-hook-form.

Требования: ошибка показывается после потери фокуса или после сабмита, а не с первого символа; кросс-полевая проверка совпадения паролей; блокировка кнопки во время отправки; ошибки связаны с полями через `aria-describedby` и `aria-invalid`; обработка ошибки сервера.

**Подсказки:**

- Храните три структуры: values, touched и submitted — от них зависит, показывать ли ошибку.
- Правила валидации опишите декларативно как объект «поле -> список проверок», иначе логика расползётся.
- Валидировать весь объект целиком проще, чем поле по отдельности: тогда правило «пароли совпадают» естественно выражается.
- На сабмите пометьте все поля как touched, чтобы пользователь увидел все ошибки сразу.

<details><summary>Решение</summary>

```js
import { useCallback, useMemo, useState } from 'react';

function validate(values) {
  const errors = {};
  if (!values.email) errors.email = 'Укажите email';
  // простая, намеренно нестрогая проверка: полная регулярка для email бессмысленна
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Неверный формат email';

  if (!values.password) errors.password = 'Укажите пароль';
  else if (values.password.length < 8) errors.password = 'Минимум 8 символов';

  // кросс-полевая проверка
  if (values.confirm !== values.password) errors.confirm = 'Пароли не совпадают';

  return errors;
}

export function SignUpForm({ onSubmit }) {
  const [values, setValues] = useState({ email: '', password: '', confirm: '' });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  const errors = useMemo(function () { return validate(values); }, [values]);
  const isValid = Object.keys(errors).length === 0;

  const handleChange = useCallback(function (event) {
    const field = event.target.name;
    const value = event.target.value;
    setValues(function (prev) {
      const next = Object.assign({}, prev);
      next[field] = value;
      return next;
    });
  }, []);

  const handleBlur = useCallback(function (event) {
    const field = event.target.name;
    setTouched(function (prev) {
      const next = Object.assign({}, prev);
      next[field] = true;
      return next;
    });
  }, []);

  // ошибку показываем только после blur или после попытки отправки
  function errorFor(field) {
    return (touched[field] || submitted) ? errors[field] : undefined;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setServerError(err.message || 'Не удалось отправить форму');
    } finally {
      setIsSubmitting(false);
    }
  }

  const fields = [
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'password', label: 'Пароль', type: 'password' },
    { name: 'confirm', label: 'Повторите пароль', type: 'password' }
  ];

  return (
    <form onSubmit={handleSubmit} noValidate>
      {fields.map((field) => {
        const message = errorFor(field.name);
        return (
          <div key={field.name}>
            <label htmlFor={field.name}>{field.label}</label>
            <input
              id={field.name}
              name={field.name}
              type={field.type}
              value={values[field.name]}
              onChange={handleChange}
              onBlur={handleBlur}
              aria-invalid={message ? 'true' : 'false'}
              aria-describedby={message ? field.name + '-error' : undefined}
            />
            {message ? (
              <p id={field.name + '-error'} role="alert">{message}</p>
            ) : null}
          </div>
        );
      })}

      {serverError ? <p role="alert">{serverError}</p> : null}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Отправляем...' : 'Зарегистрироваться'}
      </button>
    </form>
  );
}
```

Разбор: интервьюер проверяет продуктовое мышление, а не знание API.

- Момент показа ошибки — главный UX-вопрос: ошибка при вводе первого символа email раздражает. Отсюда `touched` и `submitted`.
- Кнопку сабмита лучше не блокировать по невалидности: пользователь не понимает, почему она серая. Блокируем только на время отправки — обоснуйте свой выбор.
- A11y: `label htmlFor`, `aria-invalid`, `aria-describedby`, `role="alert"` для озвучивания ошибки.
- Производительность: управляемая форма ререндерит всё на каждый символ; для больших форм упомяните неуправляемые поля с `ref` (как делает react-hook-form) или локальное состояние на поле.
- Валидация email регуляркой — заведомо приблизительна, единственная надёжная проверка это письмо с подтверждением. Скажите это.

</details>

### Секундомер: start, pause, reset, lap — спрашивают часто

Реализуйте секундомер с кнопками старт, пауза, сброс и «круг», отображающий время с точностью до сотых.

Требования: точность не должна плыть (нельзя просто прибавлять интервал), корректная очистка таймера, работа после сворачивания вкладки, отсутствие лишних ререндеров.

**Подсказки:**

- setInterval дрейфует: браузер не гарантирует точную периодичность, а в фоне троттлит до 1 раза в секунду.
- Считайте время не счётчиком тиков, а разницей Date.now() и момента старта.
- При паузе сохраняйте накопленное время, при возобновлении сдвигайте точку отсчёта.
- Идентификатор таймера держите в ref и обязательно чистите в cleanup эффекта.

<details><summary>Решение</summary>

```js
import { useEffect, useRef, useState } from 'react';

export function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);   // накопленные миллисекунды
  const [isRunning, setIsRunning] = useState(false);
  const [laps, setLaps] = useState([]);
  const startRef = useRef(0);      // момент последнего старта
  const accumulatedRef = useRef(0); // время, набранное до текущего старта

  useEffect(function () {
    if (!isRunning) return undefined;

    startRef.current = Date.now();
    const id = setInterval(function () {
      // считаем от реального времени, а не суммой тиков — иначе накапливается дрейф
      setElapsed(accumulatedRef.current + (Date.now() - startRef.current));
    }, 50);

    return function () {
      clearInterval(id);
      accumulatedRef.current += Date.now() - startRef.current;
    };
  }, [isRunning]);

  function reset() {
    setIsRunning(false);
    accumulatedRef.current = 0;
    setElapsed(0);
    setLaps([]);
  }

  function addLap() {
    setLaps(function (prev) { return prev.concat(elapsed); });
  }

  return (
    <div>
      <output>{format(elapsed)}</output>
      <button type="button" onClick={() => setIsRunning((v) => !v)}>
        {isRunning ? 'Пауза' : 'Старт'}
      </button>
      <button type="button" onClick={addLap} disabled={!isRunning}>Круг</button>
      <button type="button" onClick={reset}>Сброс</button>
      <ol>
        {laps.map((lap, i) => <li key={i}>{format(lap)}</li>)}
      </ol>
    </div>
  );
}

function format(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const hundredths = String(Math.floor((ms % 1000) / 10)).padStart(2, '0');
  return minutes + ':' + seconds + '.' + hundredths;
}
```

Разбор: короткая задача с длинным списком граблей.

- Главная ошибка кандидатов — `setElapsed(e => e + 50)`. Такой счётчик уезжает: интервалы не точны, а фоновая вкладка троттлится до 1 Гц. Считать надо от `Date.now()`.
- Забытый `clearInterval` в cleanup — второй по частоте промах; при быстром переключении получится несколько параллельных таймеров.
- Накопленное время в `ref`, а не в состоянии: оно не должно вызывать ререндер.
- Для плавной анимации вместо `setInterval` лучше `requestAnimationFrame`; для точности между сессиями — `performance.now()`, который монотонен и не зависит от перевода часов.
- Частое продолжение: «а сделайте обратный отсчёт» и «что будет, если пользователь свернёт вкладку на час».

</details>

### Todo с фильтрами (all / active / done) — спрашивают часто

Реализуйте список задач: добавление, отметка выполнения, удаление, редактирование по двойному клику, фильтры «все / активные / выполненные», счётчик оставшихся и очистка выполненных.

Требования: состояние через `useReducer`, иммутабельные обновления, стабильные ключи, отсутствие лишних вычислений при рендере.

**Подсказки:**

- useReducer вместо россыпи useState: у сущности много переходов, они просятся в один редьюсер.
- Фильтрацию оборачивайте в useMemo — она зависит от списка и фильтра.
- В качестве key нельзя брать индекс: при удалении из середины состояние строк съедет.
- Все обновления иммутабельные: map/filter, а не push и мутация полей.

<details><summary>Решение</summary>

```js
import { useMemo, useReducer, useState } from 'react';

const initialState = { todos: [], filter: 'all' };

function reducer(state, action) {
  switch (action.type) {
    case 'add': {
      const text = action.text.trim();
      if (!text) return state; // пустые задачи не добавляем
      const todo = { id: crypto.randomUUID(), text, done: false };
      return Object.assign({}, state, { todos: state.todos.concat(todo) });
    }
    case 'toggle':
      return Object.assign({}, state, {
        todos: state.todos.map(function (t) {
          return t.id === action.id ? Object.assign({}, t, { done: !t.done }) : t;
        })
      });
    case 'edit':
      return Object.assign({}, state, {
        todos: state.todos.map(function (t) {
          return t.id === action.id ? Object.assign({}, t, { text: action.text }) : t;
        })
      });
    case 'remove':
      return Object.assign({}, state, {
        todos: state.todos.filter(function (t) { return t.id !== action.id; })
      });
    case 'clearCompleted':
      return Object.assign({}, state, {
        todos: state.todos.filter(function (t) { return !t.done; })
      });
    case 'setFilter':
      return Object.assign({}, state, { filter: action.filter });
    default:
      return state;
  }
}

export function TodoApp() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [draft, setDraft] = useState('');

  // пересчитываем только при изменении списка или фильтра
  const visible = useMemo(function () {
    if (state.filter === 'active') return state.todos.filter(function (t) { return !t.done; });
    if (state.filter === 'done') return state.todos.filter(function (t) { return t.done; });
    return state.todos;
  }, [state.todos, state.filter]);

  const activeCount = useMemo(function () {
    return state.todos.reduce(function (n, t) { return t.done ? n : n + 1; }, 0);
  }, [state.todos]);

  function submit(event) {
    event.preventDefault();
    dispatch({ type: 'add', text: draft });
    setDraft('');
  }

  return (
    <div>
      <form onSubmit={submit}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Что нужно сделать?"
          aria-label="Новая задача"
        />
        <button type="submit">Добавить</button>
      </form>

      <ul>
        {visible.map((todo) => (
          <li key={todo.id}>
            <label>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => dispatch({ type: 'toggle', id: todo.id })}
              />
              <span style={{ textDecoration: todo.done ? 'line-through' : 'none' }}>{todo.text}</span>
            </label>
            <button type="button" onClick={() => dispatch({ type: 'remove', id: todo.id })}>
              Удалить
            </button>
          </li>
        ))}
      </ul>

      <p>Осталось: {activeCount}</p>
      {['all', 'active', 'done'].map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={state.filter === f}
          onClick={() => dispatch({ type: 'setFilter', filter: f })}
        >
          {f}
        </button>
      ))}
      <button type="button" onClick={() => dispatch({ type: 'clearCompleted' })}>
        Очистить выполненные
      </button>
    </div>
  );
}
```

Разбор: задача-разогрев, но по ней читают вашу инженерную культуру.

- Ключ по индексу — красный флаг. Объясните, что React сопоставляет элементы по ключу, и при удалении из середины состояние (например, режим редактирования) прилипнет не к той строке.
- `useReducer` вместо пяти `useState` показывает, что вы думаете о переходах состояния, а не о переменных.
- Держите в состоянии минимум: `activeCount` и отфильтрованный список — производные значения, их нельзя дублировать в состоянии.
- Хорошее продолжение: сохранение в localStorage, оптимистичное обновление при работе с сервером, отмена последнего действия.

</details>

### Звёздный рейтинг с половинками и клавиатурой

Реализуйте компонент рейтинга: N звёзд, подсветка при наведении, выбор кликом, режим только для чтения.

Требования: доступность (роль `radiogroup` или нативные радиокнопки, управление стрелками), поддержка контролируемого и неконтролируемого режимов, сброс подсветки при уходе мыши.

**Подсказки:**

- Нужны два значения: выбранное (value) и наведённое (hover). Отображается hover, если он есть, иначе value.
- Сброс hover делайте на onMouseLeave контейнера, а не каждой звезды.
- Для доступности проще всего использовать нативные input type=radio, визуально скрытые через CSS.
- Компонент должен работать и как контролируемый (передан value), и как неконтролируемый — паттерн useControllableState.

<details><summary>Решение</summary>

```js
import { useState } from 'react';

export function StarRating({ max = 5, value, defaultValue = 0, onChange, readOnly = false }) {
  const [internal, setInternal] = useState(defaultValue);
  const [hovered, setHovered] = useState(0);

  // контролируемый режим, если value передан снаружи
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const shown = hovered || current; // при наведении показываем hover

  function select(next) {
    if (readOnly) return;
    if (!isControlled) setInternal(next);
    if (onChange) onChange(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Оценка"
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <label key={star}>
          <input
            type="radio"
            name="rating"
            value={star}
            checked={current === star}
            disabled={readOnly}
            onChange={() => select(star)}
            // визуально скрыто в CSS, но доступно клавиатуре и скринридеру
            className="visually-hidden"
          />
          <span
            aria-hidden="true"
            onMouseEnter={() => { if (!readOnly) setHovered(star); }}
            style={{ color: star <= shown ? '#f5a623' : '#ccc', cursor: readOnly ? 'default' : 'pointer' }}
          >
            {star <= shown ? '\u2605' : '\u2606'}
          </span>
        </label>
      ))}
      <span className="visually-hidden">{current + ' из ' + max}</span>
    </div>
  );
}
```

Разбор:

- Главная идея — разделение `value` и `hover`: показываем hover, когда он есть, иначе выбранное значение.
- Нативные радиокнопки дают клавиатуру, скринридер и работу в форме бесплатно. Реализация на `div` с `onClick` — типичный недоделанный вариант, и это замечают.
- Паттерн controlled/uncontrolled — senior-сигнал: покажите, что понимаете, зачем компоненту оба режима.
- `visually-hidden` (clip-path, а не `display: none`) — важная деталь: `display: none` убирает элемент из дерева доступности.
- Продолжение: половинки звёзд через два инпута на звезду или через clip-path по позиции курсора.

</details>

### ErrorBoundary своими руками — спрашивают часто

Реализуйте компонент `ErrorBoundary`, который перехватывает ошибки рендера в поддереве, показывает фоллбэк и логирует ошибку.

Требования: сброс состояния при смене `resetKeys`, передача фоллбэку функции сброса, логирование в `componentDidCatch`. Объясните, какие ошибки граница НЕ ловит.

**Подсказки:**

- Границы ошибок можно написать только классом: хуковой альтернативы нет до сих пор.
- Статический getDerivedStateFromError переводит компонент в состояние ошибки при рендере.
- componentDidCatch получает второй аргумент с componentStack — его и надо отправлять в мониторинг.
- Граница НЕ ловит ошибки в обработчиках событий, в асинхронном коде, в SSR и свои собственные ошибки.

<details><summary>Решение</summary>

```js
import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  // вызывается на фазе рендера: переводим дерево в состояние ошибки
  static getDerivedStateFromError(error) {
    return { error: error };
  }

  // вызывается на фазе коммита: здесь можно делать сайд-эффекты
  componentDidCatch(error, errorInfo) {
    if (this.props.onError) this.props.onError(error, errorInfo);
    // отправка в Sentry и т.п.: errorInfo.componentStack показывает дерево компонентов
  }

  componentDidUpdate(prevProps) {
    const keys = this.props.resetKeys;
    const prevKeys = prevProps.resetKeys;
    if (!this.state.error || !keys || !prevKeys) return;
    // сбрасываем ошибку, если изменились ключи (например, сменился маршрут)
    const changed = keys.length !== prevKeys.length ||
      keys.some(function (key, i) { return key !== prevKeys[i]; });
    if (changed) this.reset();
  }

  reset() {
    this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      const fallback = this.props.fallback;
      if (typeof fallback === 'function') {
        return fallback({ error: this.state.error, reset: this.reset });
      }
      return fallback || <p role="alert">Что-то пошло не так</p>;
    }
    return this.props.children;
  }
}
```

Разбор: обязательный вопрос — «что граница НЕ ловит».

- Не ловит: ошибки в обработчиках событий, в `setTimeout` и промисах, при серверном рендеринге, а также ошибки самой границы. Для асинхронных ошибок нужен свой try/catch или проброс через состояние.
- Разница методов: `getDerivedStateFromError` — фаза рендера, должен быть чистым; `componentDidCatch` — фаза коммита, здесь логируют.
- Если фоллбэк не сбрасывается, пользователь остаётся с ошибкой навсегда — отсюда `resetKeys`.
- Гранулярность: одна граница на всё приложение означает белый экран из-за упавшего виджета. Обсудите границы вокруг независимых блоков.
- Скажите про React 19: `onCaughtError` и `onUncaughtError` в `createRoot`, а также про связку Suspense + ErrorBoundary для загрузки данных.

</details>

## DOM

### delegate(root, selector, type, handler) — спрашивают часто

Реализуйте делегирование событий: один слушатель на контейнере обрабатывает события от потомков, подходящих под селектор.

Требования: `this` и второй аргумент хендлера — найденный элемент, поиск не поднимается выше `root`, функция возвращает отписку. Поддержите события, которые не всплывают (`focus`, `blur`) через фазу перехвата.

**Подсказки:**

- Слушатель вешается один раз на контейнер, а нужный элемент ищется от event.target вверх.
- closest(selector) делает подъём за вас, но нужно проверить, что найденный элемент внутри root.
- event.target может быть текстовым узлом или элементом внутри кнопки — поэтому подъём обязателен.
- focus и blur не всплывают: либо capture: true, либо focusin/focusout.

<details><summary>Решение</summary>

```js
function delegate(root, selector, type, handler, options) {
  const opts = options || {};

  function listener(event) {
    // поднимаемся от цели вверх, но не выше root
    let node = event.target;
    while (node && node !== root) {
      if (node.nodeType === 1 && node.matches(selector)) {
        handler.call(node, event, node);
        return;
      }
      node = node.parentNode;
    }
  }

  // focus/blur не всплывают — слушаем на фазе перехвата
  const useCapture = opts.capture === true || type === 'focus' || type === 'blur';
  root.addEventListener(type, listener, { capture: useCapture, passive: opts.passive });

  return function off() {
    root.removeEventListener(type, listener, { capture: useCapture });
  };
}

// компактный вариант через closest
function delegateShort(root, selector, type, handler) {
  root.addEventListener(type, function (event) {
    const target = event.target.closest(selector);
    // contains защищает от срабатывания на элементах вне контейнера (например, в портале)
    if (target && root.contains(target)) handler.call(target, event, target);
  });
}
```

Разбор: интервьюер проверяет понимание всплытия и разницы `target` / `currentTarget`.

- `event.target` — где произошло событие, `event.currentTarget` — где висит слушатель. Путаница здесь стоит дорого.
- Зачем делегирование: один слушатель вместо тысячи, работает для динамически добавленных элементов, меньше утечек памяти.
- `closest` может выйти за пределы `root` — отсюда проверка `root.contains`.
- Для `removeEventListener` флаг `capture` должен совпадать с тем, что был при добавлении, иначе слушатель не снимется.

**Плюс балл:** упомянуть, что React до 17 вешал все события на `document`, а с 17 — на корень приложения, и почему это ломало смешанные приложения.

</details>

### Свой querySelectorAll: обход DOM без рекурсии

Напишите `queryAll(root, predicate)` — возвращает все элементы поддерева в порядке документа, для которых предикат истинен. Использовать `querySelectorAll` и `getElementsBy*` нельзя.

Сделайте итеративный вариант (без переполнения стека) и вариант через `TreeWalker`. Сам `root` в результат не включается.

**Подсказки:**

- children содержит только элементы, childNodes — ещё текстовые узлы и комментарии.
- Итеративный pre-order обход: стек, детей кладём в обратном порядке.
- Порядок документа = pre-order обход дерева.
- В браузере для этого есть document.createTreeWalker с NodeFilter.SHOW_ELEMENT.

<details><summary>Решение</summary>

```js
function queryAll(root, predicate) {
  const result = [];
  const stack = [];
  // кладём детей в обратном порядке, чтобы pop давал порядок документа
  for (let i = root.children.length - 1; i >= 0; i--) {
    stack.push(root.children[i]);
  }

  while (stack.length > 0) {
    const node = stack.pop();
    if (predicate(node)) result.push(node);
    for (let i = node.children.length - 1; i >= 0; i--) {
      stack.push(node.children[i]);
    }
  }
  return result;
}

// getElementsByClassName своими руками
function getByClass(root, className) {
  return queryAll(root, function (el) { return el.classList.contains(className); });
}

// вариант через встроенный обходчик
function queryAllWalker(root, predicate) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
  const result = [];
  let node = walker.nextNode();
  while (node) {
    if (predicate(node)) result.push(node);
    node = walker.nextNode();
  }
  return result;
}
```

Разбор:

- Разница `children` / `childNodes` — то, ради чего задачу и дают.
- Порядок документа при обходе стеком получается только при обратном добавлении детей — объясните это вслух.
- Обсудите живые и статические коллекции: `getElementsByClassName` возвращает живой `HTMLCollection` (меняется при изменении DOM), `querySelectorAll` — статический `NodeList`. Это классический доп. вопрос.
- Shadow DOM обычным обходом не пробивается — нужен `element.shadowRoot`.

</details>

### createFocusTrap(container) — ловушка фокуса — спрашивают часто

Реализуйте ловушку фокуса для модального окна: Tab по кругу перемещается только внутри контейнера, Shift+Tab идёт в обратную сторону.

При активации фокус переходит на первый доступный элемент, при деактивации — возвращается на элемент, который был активен до открытия. Учтите скрытые и `disabled` элементы, а также `Escape`.

**Подсказки:**

- Соберите список фокусируемых элементов селектором, но пересчитывайте его при каждом Tab: DOM мог измениться.
- Отфильтруйте невидимые элементы: offsetParent === null или нулевые размеры.
- На Tab с последнего элемента нужно preventDefault и ручной перевод фокуса на первый.
- Запомните document.activeElement до открытия и верните фокус туда при закрытии.

<details><summary>Решение</summary>

```js
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(',');

function createFocusTrap(container, onEscape) {
  let previouslyFocused = null;

  function getFocusable() {
    // пересчитываем каждый раз: содержимое модалки может меняться
    return Array.prototype.filter.call(
      container.querySelectorAll(FOCUSABLE_SELECTOR),
      function (el) {
        // отсекаем визуально скрытые элементы
        return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
      }
    );
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && onEscape) {
      onEscape(event);
      return;
    }
    if (event.key !== 'Tab') return;

    const items = getFocusable();
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !container.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return {
    activate: function () {
      previouslyFocused = document.activeElement;
      document.addEventListener('keydown', onKeyDown, true);
      const items = getFocusable();
      (items[0] || container).focus();
    },
    deactivate: function () {
      document.removeEventListener('keydown', onKeyDown, true);
      // возвращаем фокус туда, откуда открыли — иначе скринридер теряется
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    }
  };
}
```

Разбор: это задача про доступность, и оценивают именно её понимание.

- Обязательно упомяните `aria-modal="true"`, `role="dialog"`, `aria-labelledby` и `inert` для фона.
- Возврат фокуса при закрытии — то, что забывают чаще всего, а для пользователей клавиатуры это критично.
- Список фокусируемых элементов надо пересчитывать: содержимое модалки динамическое.
- Скажите, что нативный `<dialog>` с `showModal()` даёт ловушку фокуса из коробки — это правильный современный ответ.

</details>

### Ленивая загрузка картинок через IntersectionObserver — спрашивают часто

Реализуйте ленивую загрузку изображений: `<img data-src="...">` подгружается, когда приближается к вьюпорту.

Требования: загрузка начинается заранее (за 200px до появления), после загрузки элемент перестаёт наблюдаться, есть фоллбэк для браузеров без `IntersectionObserver`, функция возвращает cleanup и умеет подхватывать новые элементы.

**Подсказки:**

- IntersectionObserver вместо слушателя scroll: браузер сам считает пересечения вне главного потока.
- rootMargin позволяет начать загрузку заранее, до реального попадания во вьюпорт.
- После подстановки src обязательно unobserve, иначе наблюдатель будет держать элемент.
- Не забудьте про нативный loading="lazy" — с него стоит начать ответ.

<details><summary>Решение</summary>

```js
function lazyLoadImages(root, options) {
  const opts = options || {};
  const scope = root || document;
  const selector = 'img[data-src]';

  function load(img) {
    img.src = img.dataset.src;
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    delete img.dataset.src;
    delete img.dataset.srcset;
  }

  const images = Array.prototype.slice.call(scope.querySelectorAll(selector));

  // фоллбэк: старые браузеры просто грузят всё сразу
  if (typeof IntersectionObserver === 'undefined') {
    images.forEach(load);
    return function () {};
  }

  const observer = new IntersectionObserver(function (entries) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      load(entry.target);
      // элемент загружен — наблюдать за ним больше незачем
      observer.unobserve(entry.target);
    }
  }, {
    root: opts.root || null,
    rootMargin: opts.rootMargin || '200px 0px', // грузим заранее
    threshold: 0.01
  });

  images.forEach(function (img) { observer.observe(img); });

  return {
    // для контента, добавленного после инициализации
    observeNew: function () {
      scope.querySelectorAll(selector).forEach(function (img) { observer.observe(img); });
    },
    destroy: function () { observer.disconnect(); }
  };
}
```

Разбор:

- Первым делом скажите про `loading="lazy"` и `decoding="async"`: если задача решается платформой, надо это назвать.
- Почему не `scroll` + `getBoundingClientRect`: обработчик скролла дёргается на каждый кадр и вызывает layout thrashing (принудительный reflow при чтении геометрии).
- `rootMargin` — ключевая деталь UX: без него картинка появляется уже пустой.
- Обязательно проговорите резервирование места (`width`/`height` или `aspect-ratio`) — иначе ломается CLS.
- `observer.disconnect()` в cleanup — иначе утечка при переходе между страницами SPA.

</details>

### Виртуальный скролл (упрощённый)

Реализуйте виртуальный список: в DOM находятся только видимые элементы, скроллбар при этом соответствует полной длине списка.

Дано: контейнер фиксированной высоты, массив элементов, фиксированная высота строки. Нужно посчитать видимый диапазон, добавить overscan и позиционировать элементы. Обсудите случай переменной высоты.

**Подсказки:**

- Высота внутреннего «распорки» = количество элементов * высота строки — она и создаёт скроллбар.
- Индекс первого видимого = Math.floor(scrollTop / itemHeight).
- Видимые элементы смещаются одним transform: translateY на startIndex * itemHeight.
- Overscan в несколько элементов сверху и снизу убирает мигание при быстром скролле.

<details><summary>Решение</summary>

```js
function createVirtualList(config) {
  const container = config.container;      // высота задана в CSS, overflow: auto
  const items = config.items;
  const itemHeight = config.itemHeight;
  const renderItem = config.renderItem;    // (item, index) -> HTMLElement
  const overscan = config.overscan === undefined ? 3 : config.overscan;

  // распорка задаёт полную высоту, чтобы скроллбар был честным
  const spacer = document.createElement('div');
  spacer.style.height = items.length * itemHeight + 'px';
  spacer.style.position = 'relative';

  const viewport = document.createElement('div');
  viewport.style.position = 'absolute';
  viewport.style.top = '0';
  viewport.style.left = '0';
  viewport.style.right = '0';

  spacer.appendChild(viewport);
  container.innerHTML = '';
  container.appendChild(spacer);

  let lastStart = -1;
  let ticking = false;

  function render() {
    const scrollTop = container.scrollTop;
    const visibleCount = Math.ceil(container.clientHeight / itemHeight);
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);

    if (start === lastStart) return; // диапазон не изменился — ничего не перерисовываем
    lastStart = start;

    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const node = renderItem(items[i], i);
      node.style.height = itemHeight + 'px';
      fragment.appendChild(node);
    }
    viewport.innerHTML = '';
    viewport.appendChild(fragment);
    // сдвигаем окно вместо позиционирования каждого элемента
    viewport.style.transform = 'translateY(' + start * itemHeight + 'px)';
  }

  function onScroll() {
    // читаем и пишем DOM ровно раз за кадр
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      render();
    });
  }

  container.addEventListener('scroll', onScroll, { passive: true });
  render();

  return function destroy() {
    container.removeEventListener('scroll', onScroll);
  };
}
```

Разбор: интервьюер хочет услышать формулы и понимание кадра рендера.

- Три ключевые величины: полная высота (скроллбар), `startIndex`, смещение окна. Проговорите их до кода.
- `requestAnimationFrame` + флаг `ticking` — правильный throttle для скролла, привязанный к кадру.
- Переменная высота: нужен массив накопленных смещений и бинарный поиск по нему, плюс измерение после рендера (как в react-virtual). Скажите это даже если не пишете.
- Проблемы, о которых стоит упомянуть: потеря фокуса и выделения при переиспользовании узлов, Ctrl+F по странице не находит невидимые строки, доступность требует `aria-setsize` / `aria-posinset`.
- `content-visibility: auto` — нативная альтернатива для простых случаев.

</details>

### createStore(reducer) — мини-Redux — спрашивают часто

Реализуйте `createStore(reducer, preloadedState)` с методами `getState`, `dispatch`, `subscribe`.

Требования: `subscribe` возвращает функцию отписки, отписка во время оповещения не ломает обход, вложенный `dispatch` внутри редьюсера запрещён, при инициализации редьюсер вызывается служебным экшеном. Дополнительно добавьте поддержку middleware.

**Подсказки:**

- Состояние и список подписчиков живут в замыкании — наружу торчат только три метода.
- Перед обходом подписчиков сделайте копию массива: подписчик может отписаться прямо в колбэке.
- Флаг isDispatching защищает от dispatch внутри редьюсера — редьюсер должен быть чистым.
- Middleware — это функции вида store => next => action => ..., их складывают через compose.

<details><summary>Решение</summary>

```js
function createStore(reducer, preloadedState) {
  let state = preloadedState;
  let listeners = [];
  let isDispatching = false;

  function getState() {
    if (isDispatching) throw new Error('Нельзя читать состояние во время работы редьюсера');
    return state;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Listener must be a function');
    listeners.push(listener);
    let subscribed = true;
    return function unsubscribe() {
      if (!subscribed) return; // защита от двойной отписки
      subscribed = false;
      listeners = listeners.filter(function (l) { return l !== listener; });
    };
  }

  function dispatch(action) {
    if (!action || typeof action.type === 'undefined') {
      throw new Error('Action must have a type');
    }
    if (isDispatching) throw new Error('Reducers may not dispatch actions');

    try {
      isDispatching = true;
      state = reducer(state, action);
    } finally {
      isDispatching = false;
    }

    // копия: подписчик может отписаться прямо во время оповещения
    for (const listener of listeners.slice()) listener();
    return action;
  }

  // прогоняем редьюсер, чтобы получить начальное состояние из его дефолта
  dispatch({ type: '@@INIT' });

  return { getState: getState, dispatch: dispatch, subscribe: subscribe };
}

// middleware: store => next => action => ...
function applyMiddleware(store, middlewares) {
  let dispatch = store.dispatch;
  const api = {
    getState: store.getState,
    dispatch: function (action) { return dispatch(action); }
  };
  // оборачиваем справа налево, чтобы первый middleware был внешним
  for (const mw of middlewares.slice().reverse()) {
    dispatch = mw(api)(dispatch);
  }
  return Object.assign({}, store, { dispatch: dispatch });
}
```

Разбор:

- Копия массива подписчиков перед обходом — деталь, ради которой задачу и дают. Без неё отписка в колбэке пропускает следующего слушателя.
- Объясните, почему редьюсер должен быть чистым: предсказуемость, time-travel debugging, тестируемость.
- Служебный `@@INIT` нужен, чтобы редьюсер вернул значение по умолчанию из `state = initialState`.
- В `api.dispatch` нужна именно обёртка-стрелка, а не прямая ссылка: иначе middleware получит недособранный dispatch.

**Плюс балл:** сравнить с `useSyncExternalStore`, который решает проблему tearing в конкурентном React.

</details>

### mini-VDOM: h, render и diff

Реализуйте минимальный виртуальный DOM: функцию `h(type, props, ...children)`, `createDom(vnode)` и `patch(parent, oldVNode, newVNode)`.

`patch` должен: создавать узел, если старого нет; удалять, если нового нет; заменять при разном типе; иначе обновлять атрибуты и рекурсивно сверять детей. Обсудите роль ключей.

**Подсказки:**

- VNode — обычный объект { type, props, children }; текстовые узлы удобно хранить как строки или числа.
- Атрибуты обновляйте диффом: удалите те, что исчезли, и запишите изменившиеся.
- Обработчики событий (props, начинающиеся с on) вешаются через addEventListener, а не setAttribute.
- Детей сравнивайте по индексу; объясните, почему без key перестановка приводит к лишним перерисовкам.

<details><summary>Решение</summary>

```js
function h(type, props, ...children) {
  return {
    type: type,
    props: props || {},
    // flat, чтобы h(...) с массивами внутри работал
    children: children.flat(Infinity).filter(function (c) { return c !== null && c !== false && c !== undefined; })
  };
}

function createDom(vnode) {
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return document.createTextNode(String(vnode));
  }
  const el = document.createElement(vnode.type);
  updateProps(el, {}, vnode.props);
  for (const child of vnode.children) el.appendChild(createDom(child));
  return el;
}

function updateProps(el, oldProps, newProps) {
  // удаляем то, чего больше нет
  for (const key of Object.keys(oldProps)) {
    if (key in newProps) continue;
    if (key.startsWith('on')) el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
    else el.removeAttribute(key);
  }
  // ставим новое и изменившееся
  for (const key of Object.keys(newProps)) {
    if (oldProps[key] === newProps[key]) continue;
    if (key.startsWith('on')) {
      const eventName = key.slice(2).toLowerCase();
      if (oldProps[key]) el.removeEventListener(eventName, oldProps[key]);
      el.addEventListener(eventName, newProps[key]);
    } else if (key === 'value') {
      el.value = newProps[key]; // value как атрибут не обновляет поле ввода
    } else {
      el.setAttribute(key, newProps[key]);
    }
  }
}

function isSameType(a, b) {
  const aText = typeof a === 'string' || typeof a === 'number';
  const bText = typeof b === 'string' || typeof b === 'number';
  if (aText || bText) return aText && bText;
  return a.type === b.type;
}

function patch(parent, oldVNode, newVNode, index) {
  const i = index || 0;
  const existing = parent.childNodes[i];

  if (oldVNode === undefined || oldVNode === null) {
    parent.appendChild(createDom(newVNode));
    return;
  }
  if (newVNode === undefined || newVNode === null) {
    if (existing) parent.removeChild(existing);
    return;
  }
  if (!isSameType(oldVNode, newVNode)) {
    parent.replaceChild(createDom(newVNode), existing);
    return;
  }
  if (typeof newVNode === 'string' || typeof newVNode === 'number') {
    if (String(oldVNode) !== String(newVNode)) existing.textContent = String(newVNode);
    return;
  }

  updateProps(existing, oldVNode.props, newVNode.props);

  // сверяем детей по индексу; идём с конца, чтобы удаление не сдвигало индексы
  const maxLen = Math.max(oldVNode.children.length, newVNode.children.length);
  for (let j = maxLen - 1; j >= 0; j--) {
    patch(existing, oldVNode.children[j], newVNode.children[j], j);
  }
}
```

Разбор: задача редкая, но если её дали — оценивают именно рассуждения, а не полноту.

- Главный вопрос-продолжение: «зачем нужны key?». Ответ: без ключей diff сравнивает детей по позиции, поэтому вставка в начало списка перерисовывает всё; ключи позволяют сопоставить узлы по идентичности и переиспользовать DOM и состояние.
- Скажите, почему `index` в качестве key — антипаттерн: при перестановке состояние компонента прилипает не к тому элементу.
- Идти по детям с конца — трюк, чтобы удаление не смещало индексы у ещё не обработанных узлов.
- Реальный React использует эвристику O(n): разные типы — поддерево пересоздаётся целиком, полный алгоритм сравнения деревьев был бы O(n^3).

</details>

### createRouter — свой роутер на History API

Реализуйте клиентский роутер: регистрация путей вида `'/users/:id'`, метод `navigate(path)` и рендер при переходах.

Требования: работать с `pushState` и кнопкой «Назад» (`popstate`), извлекать параметры пути и query, перехватывать клики по внутренним ссылкам, поддерживать маршрут 404.

**Подсказки:**

- Шаблон пути превращается в регулярку: сегмент :name заменяется на группу захвата.
- popstate НЕ срабатывает на ваш собственный pushState — рендер надо вызывать вручную.
- Перехватывайте клики делегированием на document и пропускайте внешние ссылки, target=_blank и клики с модификаторами.
- Порядок регистрации важен: более специфичные маршруты должны проверяться раньше.

<details><summary>Решение</summary>

```js
function compileRoute(pattern) {
  const paramNames = [];
  // :id -> группа захвата, остальные спецсимволы экранируем
  const regexSource = pattern
    .replace(/[.*+?^$()|[\]\\]/g, '\\$&')
    .replace(/\/:([\w]+)/g, function (match, name) {
      paramNames.push(name);
      return '/([^/]+)';
    });
  return { regex: new RegExp('^' + regexSource + '/?$'), paramNames: paramNames };
}

function createRouter(routes, options) {
  const opts = options || {};
  const compiled = routes.map(function (route) {
    return Object.assign({}, route, compileRoute(route.path));
  });

  function match(pathname) {
    for (const route of compiled) {
      const found = pathname.match(route.regex);
      if (!found) continue;
      const params = {};
      route.paramNames.forEach(function (name, i) { params[name] = decodeURIComponent(found[i + 1]); });
      return { route: route, params: params };
    }
    return null;
  }

  function render() {
    const matched = match(location.pathname);
    const query = Object.fromEntries(new URLSearchParams(location.search));
    if (matched) matched.route.handler({ params: matched.params, query: query });
    else if (opts.notFound) opts.notFound({ params: {}, query: query });
  }

  function navigate(path, state) {
    if (path === location.pathname + location.search) return;
    history.pushState(state || null, '', path);
    // popstate не срабатывает на собственный pushState — рендерим сами
    render();
  }

  function onClick(event) {
    // игнорируем клики с модификаторами и не левой кнопкой
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a');
    if (!link || !link.href) return;
    if (link.target === '_blank' || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return; // внешняя ссылка — отдаём браузеру

    event.preventDefault();
    navigate(url.pathname + url.search);
  }

  document.addEventListener('click', onClick);
  window.addEventListener('popstate', render);
  render();

  return {
    navigate: navigate,
    destroy: function () {
      document.removeEventListener('click', onClick);
      window.removeEventListener('popstate', render);
    }
  };
}
```

Разбор: самая частая ошибка — ожидать `popstate` после собственного `pushState`. Он срабатывает только на навигацию пользователя (назад/вперёд).

- Перечислите случаи, когда клик нельзя перехватывать: внешний домен, `target="_blank"`, `download`, Ctrl/Cmd-клик (открытие в новой вкладке), средняя кнопка мыши.
- `pushState` против `replaceState`: второй не добавляет запись в историю, нужен для фильтров и табов.
- Скажите про восстановление скролла (`history.scrollRestoration`) и фокус на заголовке после перехода — это a11y.
- Hash-роутер проще (работает без настройки сервера), но History API требует, чтобы сервер отдавал index.html на любой путь.

</details>

## Алгоритмы

### twoSum(nums, target) — спрашивают часто

Дан массив чисел и целевая сумма. Верните индексы двух элементов, дающих в сумме `target`, или `null`.

Требования: один проход, O(n) по времени. Один и тот же элемент нельзя использовать дважды. Обсудите вариант для отсортированного массива и вариант «найти все пары».

**Подсказки:**

- Наивное решение — два вложенных цикла, O(n^2). Скажите это и сразу предложите улучшение.
- Идите по массиву и для каждого числа спрашивайте: видел ли я уже target - x?
- В Map кладите значение -> индекс, и проверяйте дополнение ДО того, как положить текущий элемент.
- Для отсортированного массива есть решение двумя указателями за O(n) без дополнительной памяти.

<details><summary>Решение</summary>

```js
function twoSum(nums, target) {
  const seen = new Map(); // значение -> индекс
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    // проверяем ДО записи: иначе элемент найдёт сам себя при target = 2 * nums[i]
    if (seen.has(complement)) return [seen.get(complement), i];
    seen.set(nums[i], i);
  }
  return null;
}

// вариант для отсортированного массива: два указателя, O(1) памяти
function twoSumSorted(sortedNums, target) {
  let left = 0;
  let right = sortedNums.length - 1;
  while (left < right) {
    const sum = sortedNums[left] + sortedNums[right];
    if (sum === target) return [left, right];
    if (sum < target) left++; // нужна сумма больше — двигаем левую границу
    else right--;
  }
  return null;
}
```

Разбор: задачу дают не ради ответа, а ради рассуждения.

- Правильный сценарий: назвать наивное O(n^2), объяснить, почему O(n) достижимо, и написать код — именно в таком порядке.
- Ключевая деталь: проверять дополнение перед добавлением текущего элемента, иначе `[3]` с `target = 6` вернёт `[0, 0]`.
- Проговорите размен: O(n) памяти на Map ради O(n) времени.
- Уточняющие вопросы вслух: массив отсортирован? нужны индексы или значения? может быть несколько ответов? есть ли отрицательные числа?

</details>

### isValidBrackets(str) — спрашивают часто

Проверьте, сбалансированы ли скобки `()`, `[]`, `{}` в строке.

Требования: правильный порядок закрытия, обработка пустой строки и лишних закрывающих скобок. Дополнительно: вариант, игнорирующий прочие символы, и вариант с возвратом позиции первой ошибки.

**Подсказки:**

- Открывающие скобки кладём в стек, закрывающие сверяем с вершиной.
- Не забудьте проверить, что стек пуст в конце: строка из трёх открывающих скобок несбалансирована.
- Закрывающая скобка при пустом стеке — сразу false.
- Соответствие скобок удобно держать в объекте: закрывающая -> открывающая.

<details><summary>Решение</summary>

```js
const PAIRS = { ')': '(', ']': '[', '}': '{' };

function isValidBrackets(str) {
  const stack = [];
  for (const char of str) {
    if (char === '(' || char === '[' || char === '{') {
      stack.push(char);
    } else if (PAIRS[char]) {
      // pop на пустом стеке даёт undefined и корректно проваливает сравнение
      if (stack.pop() !== PAIRS[char]) return false;
    }
    // прочие символы игнорируем
  }
  // остались незакрытые скобки?
  return stack.length === 0;
}

// расширение: позиция первой ошибки или -1
function findBracketError(str) {
  const stack = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(' || char === '[' || char === '{') {
      stack.push({ char: char, index: i });
    } else if (PAIRS[char]) {
      const top = stack.pop();
      if (!top || top.char !== PAIRS[char]) return i;
    }
  }
  return stack.length === 0 ? -1 : stack[0].index;
}
```

Разбор:

- Две проверки, которые забывают: закрывающая скобка при пустом стеке и непустой стек в конце. Прогоните вслух на входах вида `)(` и `((`.
- Сложность O(n) по времени и O(n) по памяти в худшем случае.
- Продолжения, которые часто просят: игнорировать скобки внутри строковых литералов, поддержать HTML-теги, посчитать минимальное число вставок для балансировки.

</details>

### Строковая разминка: палиндром, первый уникальный, анаграмма — спрашивают часто

Реализуйте три функции: `isPalindrome(str)` (игнорируя регистр и не-буквы), `firstUniqueChar(str)` (индекс первого неповторяющегося символа) и `isAnagram(a, b)`.

Требования: без сортировки там, где можно за O(n); обсудите работу с юникодом и почему переворот строки — не лучшее решение для палиндрома.

**Подсказки:**

- Палиндром: два указателя навстречу вместо переворота строки — O(1) памяти.
- Первый уникальный символ: два прохода — сначала считаем частоты, потом ищем первый с частотой 1.
- Анаграмма: сортировка даёт O(n log n), карта частот — O(n).
- Проверяйте длину строк ДО подсчёта: разная длина сразу означает не-анаграмму.

<details><summary>Решение</summary>

```js
function isPalindrome(str) {
  const s = str.toLowerCase();
  let left = 0;
  let right = s.length - 1;
  const isLetterOrDigit = function (ch) { return /[\p{L}\p{N}]/u.test(ch); };

  while (left < right) {
    // пропускаем всё, что не буква и не цифра
    while (left < right && !isLetterOrDigit(s[left])) left++;
    while (left < right && !isLetterOrDigit(s[right])) right--;
    if (s[left] !== s[right]) return false;
    left++;
    right--;
  }
  return true;
}

function firstUniqueChar(str) {
  const counts = new Map();
  for (const char of str) {
    counts.set(char, (counts.get(char) || 0) + 1);
  }
  for (let i = 0; i < str.length; i++) {
    if (counts.get(str[i]) === 1) return i;
  }
  return -1;
}

function isAnagram(a, b) {
  if (a.length !== b.length) return false; // быстрый выход
  const counts = new Map();
  for (const char of a) counts.set(char, (counts.get(char) || 0) + 1);
  for (const char of b) {
    const left = counts.get(char);
    if (!left) return false; // символа нет или он уже израсходован
    counts.set(char, left - 1);
  }
  return true;
}
```

Разбор: это разогрев, здесь важна скорость и аккуратность, а не изобретательность.

- Палиндром через разворот строки — рабочий ответ, но O(n) памяти; два указателя лучше, назовите разницу.
- `split('')` ломает эмодзи и суррогатные пары, а `for...of` идёт по code points. Это сильный сигнал знания языка.
- Анаграмма сортировкой — O(n log n), картой частот — O(n). Приведите оба варианта и обоснуйте выбор.
- Уточняющие вопросы: учитывать ли регистр, пробелы, диакритику? Для юникода может понадобиться `normalize('NFC')`.

</details>

### lengthOfLongestSubstring(s) — скользящее окно — спрашивают часто

Найдите длину самой длинной подстроки без повторяющихся символов.

Требования: один проход, O(n). Дополнительно верните саму подстроку. Проверьте на пустой строке и на входах `bbbbb`, `pwwkew`, `abba`.

**Подсказки:**

- Держите окно с границами left и right и структуру символов внутри окна.
- При встрече дубликата двигайте левую границу вправо, пока дубликат не исчезнет.
- Ускорение: храните в Map последний индекс символа и прыгайте левой границей сразу.
- Тест abba ловит главную ошибку: левая граница не должна ехать назад.

<details><summary>Решение</summary>

```js
function lengthOfLongestSubstring(s) {
  const lastIndex = new Map(); // символ -> последний индекс
  let left = 0;
  let best = 0;
  let bestStart = 0;

  for (let right = 0; right < s.length; right++) {
    const char = s[right];
    if (lastIndex.has(char) && lastIndex.get(char) >= left) {
      // прыгаем сразу за предыдущее вхождение, но никогда не назад
      left = lastIndex.get(char) + 1;
    }
    lastIndex.set(char, right);

    const length = right - left + 1;
    if (length > best) {
      best = length;
      bestStart = left;
    }
  }
  return { length: best, substring: s.slice(bestStart, bestStart + best) };
}
```

Разбор: ключевая проверка — понимаете ли вы инвариант окна.

- Инвариант: в текущем окне нет повторов. Сформулируйте его вслух до кода — это половина решения.
- Главная ловушка — строка `abba`: у второй буквы `a` прошлый индекс меньше текущей левой границы, поэтому границу двигать нельзя. Отсюда сравнение с `left`.
- Сложность O(n) по времени, O(min(n, размер алфавита)) по памяти.
- Задача — шаблон для целого семейства: минимальное окно с подстрокой, подмассив с заданной суммой, максимум K различных символов. Скажите, что узнали паттерн.

</details>

### mergeIntervals(intervals) — спрашивают часто

Дан массив интервалов вида `[[1,3],[2,6],[8,10]]`. Объедините пересекающиеся и верните отсортированный результат.

Требования: не мутировать вход; определиться, считаются ли касающиеся интервалы пересекающимися. Дополнительно: вставка нового интервала в уже отсортированный список.

**Подсказки:**

- Сначала отсортируйте по началу интервала — без этого задача не решается жадно.
- Идите слева направо: если начало текущего не больше конца последнего в результате, интервалы сливаются.
- При слиянии конец берите как максимум из двух: интервал может быть вложенным.
- Уточните у интервьюера, слипаются ли касающиеся интервалы — это меняет знак сравнения.

<details><summary>Решение</summary>

```js
function mergeIntervals(intervals) {
  if (intervals.length === 0) return [];

  // копия перед сортировкой: sort мутирует массив
  const sorted = intervals.slice().sort(function (a, b) { return a[0] - b[0]; });
  const result = [sorted[0].slice()];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = result[result.length - 1];

    if (current[0] <= last[1]) {
      // пересекаются: расширяем конец, max нужен для вложенных интервалов
      last[1] = Math.max(last[1], current[1]);
    } else {
      result.push(current.slice());
    }
  }
  return result;
}

// вставка интервала в отсортированный непересекающийся список, O(n)
function insertInterval(sortedIntervals, newInterval) {
  const result = [];
  let start = newInterval[0];
  let end = newInterval[1];
  let i = 0;

  while (i < sortedIntervals.length && sortedIntervals[i][1] < start) {
    result.push(sortedIntervals[i++]); // целиком левее — просто копируем
  }
  while (i < sortedIntervals.length && sortedIntervals[i][0] <= end) {
    start = Math.min(start, sortedIntervals[i][0]);
    end = Math.max(end, sortedIntervals[i][1]);
    i++;
  }
  result.push([start, end]);
  while (i < sortedIntervals.length) result.push(sortedIntervals[i++]);
  return result;
}
```

Разбор:

- Первый шаг — сортировка по началу. Если кандидат начинает без неё, решение почти наверняка развалится.
- Ловушка вложенности: интервал `[2,3]` внутри `[1,10]`. Без `Math.max` конец сожмётся до 3.
- Сложность O(n log n) из-за сортировки, дальше линейно.
- Мутация входного массива через `sort` — практичный минус, который замечают в продуктовых командах.
- Где встречается в реальности: слияние занятых слотов в календаре, объединение диапазонов подсветки в редакторе.

</details>

### binarySearch и lowerBound — спрашивают часто

Реализуйте бинарный поиск в отсортированном массиве и поиск позиции для вставки (нижняя граница).

Требования: без рекурсии, корректная работа с пустым массивом и с элементами вне диапазона, поддержка компаратора для массива объектов. Обсудите вычисление середины.

**Подсказки:**

- Определитесь с инвариантом: полуинтервал или отрезок — и не смешивайте их в одном цикле.
- Середину считайте как left + (right - left) / 2: в других языках это защита от переполнения.
- Lower bound возвращает первую позицию, куда можно вставить элемент, не нарушив порядок.
- Проверьте на пустом массиве и на элементе больше всех — самые частые падения.

<details><summary>Решение</summary>

```js
function binarySearch(arr, target, compare) {
  const cmp = compare || function (a, b) { return a < b ? -1 : (a > b ? 1 : 0); };
  let left = 0;
  let right = arr.length - 1; // работаем на отрезке, границы включительно

  while (left <= right) {
    // так безопаснее при больших индексах
    const mid = left + Math.floor((right - left) / 2);
    const result = cmp(arr[mid], target);
    if (result === 0) return mid;
    if (result < 0) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

// первая позиция, куда можно вставить target без нарушения порядка
function lowerBound(arr, target, compare) {
  const cmp = compare || function (a, b) { return a < b ? -1 : (a > b ? 1 : 0); };
  let left = 0;
  let right = arr.length; // полуинтервал: правая граница не включена

  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (cmp(arr[mid], target) < 0) left = mid + 1;
    else right = mid;
  }
  return left;
}
```

Разбор: задача про дисциплину, а не про идею.

- Сформулируйте инвариант до кода: ответ всегда лежит внутри текущих границ. Тогда они не поплывут.
- Классические падения: бесконечный цикл, если писать `left = mid` вместо `mid + 1`; пропуск последнего элемента при неверном условии цикла.
- Про среднюю точку: в JS числа double и переполнения нет, но привычка писать безопасно — плюс, и это отсылка к известному багу в стандартной библиотеке Java.
- Где нужно во фронтенде: поиск строки по накопленным смещениям в виртуальном скролле, вставка в отсортированный список, поиск ближайшей точки на графике.

</details>

### topKFrequent(items, k) — спрашивают часто

Верните `k` самых часто встречающихся элементов массива.

Требования: обсудите сложность. Сортировка даёт O(n log n) — предложите bucket sort за O(n). Определите порядок для элементов с одинаковой частотой.

**Подсказки:**

- Первый шаг всегда одинаковый: карта частот за один проход.
- Сортировка пар элемент-частота — рабочее решение, но не оптимальное.
- Частота не может превышать длину массива — значит, элементы можно разложить по корзинам-индексам.
- Проход по корзинам с конца даёт элементы в порядке убывания частоты за O(n).

<details><summary>Решение</summary>

```js
function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn ? keyFn(item) : item;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

// O(n log n): просто и понятно
function topKFrequentSort(items, k) {
  const counts = countBy(items);
  return Array.from(counts.entries())
    .sort(function (a, b) { return b[1] - a[1]; })
    .slice(0, k)
    .map(function (entry) { return entry[0]; });
}

// O(n) через корзины: частота не может быть больше длины массива
function topKFrequent(items, k) {
  const counts = countBy(items);
  const buckets = new Array(items.length + 1);

  for (const [value, count] of counts) {
    if (!buckets[count]) buckets[count] = [];
    buckets[count].push(value);
  }

  const result = [];
  // идём от самой большой частоты к меньшей
  for (let count = buckets.length - 1; count >= 1 && result.length < k; count--) {
    if (!buckets[count]) continue;
    for (const value of buckets[count]) {
      result.push(value);
      if (result.length === k) break;
    }
  }
  return result;
}
```

Разбор:

- Ожидаемая траектория ответа: карта частот, потом сортировка O(n log n), потом улучшение до O(n) через корзины или до O(n log k) через кучу.
- Куча размера k — правильный ответ, когда k мало, а n огромно, или когда данные приходят потоком. Назовите этот случай.
- Ключ Map может быть объектом — тогда сравнение по ссылке; для группировки по значению нужен keyFn.
- Уточните стабильность: при равных частотах порядок не определён, а продуктовые требования часто просят алфавитный.
- Смежная задача, которую дают следом: группировка анаграмм — тот же приём, ключ это отсортированные буквы слова.

</details>
