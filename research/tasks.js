const TASKS_EXTRA = [
  { id: 'tx1',
    title: 'deepEqual(a, b)',
    must: true,
    cat: 'Утилиты',
    why: 'Проверяет рекурсию, типы и знание краевых случаев',
    prompt: `<p>Реализуйте <code>deepEqual(a, b)</code> — глубокое сравнение двух значений без использования <code>JSON.stringify</code>.</p>
    <p>Требования: примитивы сравниваются как <code>Object.is</code> (<code>NaN</code> равен <code>NaN</code>), поддержите массивы, обычные объекты, <code>Date</code>, <code>RegExp</code>, <code>Map</code>, <code>Set</code>. Разное количество ключей — не равны. Порядок ключей значения не имеет.</p>`,
    hints: ['Начните с быстрого выхода: если значения строго равны — true. Дальше отсеките примитивы и null.',
      'JSON.stringify ломается на разном порядке ключей, undefined, NaN, циклах и Date — скажите это вслух.',
      'Сравните прототипы объектов: {} и new Foo() не должны считаться равными.',
      'Для Map/Set нужны отдельные ветки: у них данные не лежат в собственных ключах.'],
    code: `function deepEqual(a, b) {
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
}`,
    notes: `<p>Что оценивает интервьюер:</p>
    <ul>
      <li>Помните ли вы, что <code>typeof null === 'object'</code> — классическая ловушка.</li>
      <li>Понимаете ли, почему <code>JSON.stringify(a) === JSON.stringify(b)</code> — плохое решение: порядок ключей, <code>undefined</code>, функции, <code>NaN</code>, <code>Date</code>, циклические ссылки.</li>
      <li>Проговорите защиту от циклов: <code>WeakMap</code> с парами уже сравниваемых объектов — это плюс балл.</li>
    </ul>
    <p><strong>Что сказать вслух:</strong> «Символьные ключи я осознанно не сравниваю, в проде добавил бы <code>Object.getOwnPropertySymbols</code>. Для Set с объектами внутри честное сравнение — это задача о паросочетании, я бы уточнил требования».</p>` },

  { id: 'tx2',
    title: 'get(obj, path, def) и set(obj, path, value)',
    must: true,
    cat: 'Утилиты',
    why: 'Парсинг пути + безопасный доступ, как в lodash',
    prompt: `<p>Реализуйте <code>get(obj, path, defaultValue)</code> и <code>set(obj, path, value)</code> как в lodash.</p>
    <p>Путь — строка вида <code>'a.b[0].c'</code> или массив ключей. <code>get</code> возвращает <code>defaultValue</code>, если путь не существует или значение <code>undefined</code>. <code>set</code> создаёт недостающие звенья: массив, если следующий ключ числовой, иначе объект.</p>`,
    hints: ['Сведите строку и массив к одному формату — общая функция toPath.',
      'Скобочную нотацию проще всего нормализовать регуляркой в точечную.',
      'В get важно отличать «нет ключа» от «значение null»: null возвращаем как есть, а undefined заменяем на дефолт.',
      'В set смотрите на СЛЕДУЮЩИЙ ключ, чтобы решить, создавать массив или объект.'],
    code: `function toPath(path) {
  if (Array.isArray(path)) return path;
  return String(path)
    // ['key'] и [0] превращаем в .key и .0
    .replace(/\\[["']?([^\\]"']+)["']?\\]/g, '.$1')
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
      current[key] = /^\\d+$/.test(keys[i + 1]) ? [] : {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
  return obj;
}`,
    notes: `<p>Подводные камни:</p>
    <ul>
      <li><code>get({ a: null }, 'a.b')</code> не должен падать — нужна проверка на <code>null</code> на каждом шаге.</li>
      <li><code>get(obj, 'a', 0)</code> при <code>a === null</code> должен вернуть <code>null</code>, а не <code>0</code>: дефолт подставляется только для <code>undefined</code>.</li>
      <li>В <code>set</code> есть риск prototype pollution: ключи <code>__proto__</code>, <code>constructor</code>, <code>prototype</code> стоит блокировать. Скажите об этом — на senior это ждут.</li>
    </ul>
    <p><strong>Плюс балл:</strong> предложить иммутабельный вариант <code>setIn</code>, который возвращает новый объект и копирует только узлы на пути — именно так работают редьюсеры.</p>` },

  { id: 'tx3',
    title: 'pipe(...fns) и compose(...fns)',
    must: true,
    cat: 'Утилиты',
    why: 'Базовая проверка функционального мышления',
    prompt: `<p>Реализуйте <code>pipe</code> (слева направо) и <code>compose</code> (справа налево).</p>
    <p>Первая функция получает все аргументы, остальные — результат предыдущей. Вызов без функций возвращает первый аргумент. Дополнительно: сделайте асинхронный <code>pipeAsync</code>, который умеет ждать промежуточные промисы.</p>`,
    hints: ['Это reduce по массиву функций, но первый шаг особенный — он принимает несколько аргументов.',
      'compose — это pipe с перевёрнутым массивом; не мутируйте исходный массив.',
      'Для асинхронной версии сведите всё к цепочке .then или к циклу с await.'],
    code: `function pipe(...fns) {
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
}`,
    notes: `<p>На что смотрит интервьюер: знаете ли вы <code>reduce</code> и понимаете ли разницу порядка. <code>compose(f, g)(x)</code> это <code>f(g(x))</code>, <code>pipe(f, g)(x)</code> это <code>g(f(x))</code> — путаница здесь встречается часто.</p>
    <ul>
      <li>Сохранение <code>this</code> через <code>apply/call</code> — деталь, которую замечают.</li>
      <li>Вариант в одну строку: <code>const pipe = (...fns) =&gt; x =&gt; fns.reduce((acc, fn) =&gt; fn(acc), x)</code> — но он теряет поддержку нескольких аргументов.</li>
    </ul>
    <p><strong>Плюс балл:</strong> упомянуть, что на этом построены middleware в Redux (<code>compose</code> из исходников) и трансформеры в RxJS.</p>` },

  { id: 'tx4',
    title: 'once(fn)',
    must: true,
    cat: 'Утилиты',
    why: 'Мини-задача на замыкания, часто как разогрев',
    prompt: `<p>Реализуйте <code>once(fn)</code> — обёртку, которая вызывает <code>fn</code> ровно один раз, а при последующих вызовах возвращает закешированный результат.</p>
    <p>Требования: сохранить <code>this</code> и аргументы первого вызова, не держать ссылку на <code>fn</code> после вызова (чтобы её мог собрать GC), добавить метод <code>reset()</code>.</p>`,
    hints: ['Нужны два замыкания: флаг «уже вызвана» и сохранённый результат.',
      'Флаг важнее, чем проверка result !== undefined: функция могла легально вернуть undefined.',
      'Для сохранения контекста используйте обычную function и fn.apply(this, args).'],
    code: `function once(fn) {
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Проверка через флаг, а не через <code>result</code>: функция может вернуть <code>undefined</code>, и наивная реализация будет вызывать её каждый раз.</li>
      <li>Если <code>fn</code> бросила исключение — считать ли вызов состоявшимся? Уточните у интервьюера; lodash считает, что да.</li>
      <li>Стрелочная функция в обёртке потеряет <code>this</code> — типичная ошибка.</li>
    </ul>
    <p><strong>Что сказать вслух:</strong> «Это же паттерн ленивой инициализации синглтона; для асинхронного случая я бы кешировал промис, чтобы параллельные вызовы не породили две загрузки».</p>` },

  { id: 'tx5',
    title: 'partial(fn, ...preset) с плейсхолдерами',
    must: false,
    cat: 'Утилиты',
    why: 'Проверка работы с аргументами и замыканиями',
    prompt: `<p>Реализуйте частичное применение <code>partial(fn, ...preset)</code>: возвращает функцию, которая при вызове подставляет заранее заданные аргументы перед новыми.</p>
    <p>Дополнительно поддержите плейсхолдер <code>_</code>: <code>partial(f, 1, _, 3)(2, 4)</code> должен вызвать <code>f(1, 2, 3, 4)</code>. Также сделайте <code>partialRight</code>.</p>`,
    hints: ['Сохраните preset в замыкании и склейте с аргументами вызова.',
      'Плейсхолдер удобно сделать уникальным Symbol, чтобы его нельзя было подделать значением.',
      'Проходя по preset, каждый плейсхолдер заменяйте очередным аргументом из новых, а остаток дописывайте в конец.'],
    code: `const _ = Symbol('placeholder');

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
}`,
    notes: `<p>Разбор: задача проверяет уверенность в rest/spread и в том, что <code>arguments</code> в стрелках не работает.</p>
    <ul>
      <li>Частая ошибка — мутировать массив <code>later</code> напрямую и потом использовать его же для «остатка».</li>
      <li>Отличие от <code>bind</code>: <code>partial</code> не фиксирует <code>this</code>, поэтому обёртка должна быть обычной функцией.</li>
      <li>Отличие от каррирования: <code>partial</code> вызывает функцию сразу, независимо от арности.</li>
    </ul>
    <p><strong>Плюс балл:</strong> упомянуть, что <code>Function.prototype.bind(null, a, b)</code> — это встроенный <code>partial</code> без плейсхолдеров.</p>` },

  { id: 'tx6',
    title: 'debounce с leading, trailing и maxWait',
    must: true,
    cat: 'Утилиты',
    why: 'Продвинутая версия самой частой задачи на собесах',
    prompt: `<p>Расширьте <code>debounce(fn, wait, options)</code> опциями <code>leading</code>, <code>trailing</code> и <code>maxWait</code>.</p>
    <p><code>leading: true</code> — вызов на первом событии серии; <code>trailing: true</code> (по умолчанию) — вызов после паузы; <code>maxWait</code> — гарантированный вызов не реже, чем раз в <code>maxWait</code> мс при непрерывном потоке событий. Нужны методы <code>cancel()</code> и <code>flush()</code>.</p>`,
    hints: ['Заведите два таймера: обычный на wait и отдельный на maxWait, который стартует один раз за серию.',
      'Храните последние аргументы и this отдельно: они нужны и для trailing, и для flush.',
      'Нужен флаг «в этой серии уже был leading-вызов», иначе при leading + trailing вы вызовете fn дважды на одном событии.',
      'cancel() должен сбрасывать оба таймера и отложенные аргументы, flush() — вызвать немедленно, если что-то отложено.'],
    code: `function debounce(fn, wait, options) {
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
}`,
    notes: `<p>Это тот самый вопрос, который любят задавать после базового debounce: «а теперь как в lodash».</p>
    <ul>
      <li>Главный подвох: при <code>leading: true, trailing: true</code> одиночное событие не должно вызывать функцию дважды. Отсюда обнуление <code>lastArgs</code> сразу после leading-вызова.</li>
      <li><code>debounce</code> с <code>maxWait</code> фактически превращается в <code>throttle</code> — скажите это, интервьюеры это любят.</li>
      <li>Проговорите, зачем нужны <code>cancel</code> и <code>flush</code>: очистка в <code>useEffect</code> и отправка формы «прямо сейчас».</li>
    </ul>
    <p><strong>Плюс балл:</strong> упомянуть, что для скролла и ресайза лучше <code>requestAnimationFrame</code>, а не таймеры.</p>` },

  { id: 'tx7',
    title: 'promisify(fn) и callbackify',
    must: true,
    cat: 'Утилиты',
    why: 'Мост между колбэками и промисами, спрашивают часто',
    prompt: `<p>Реализуйте <code>promisify(fn)</code>: превращает функцию с Node-style колбэком <code>(err, result)</code> в функцию, возвращающую промис.</p>
    <p>Требования: сохранить <code>this</code>, поддержать колбэк с несколькими значениями (тогда резолвим массивом), корректно отвергать промис при ошибке. Дополнительно напишите обратное преобразование <code>callbackify</code>.</p>`,
    hints: ['Возвращайте функцию, которая создаёт new Promise и передаёт свой колбэк последним аргументом.',
      'Ошибка — первый аргумент колбэка; проверяйте именно на truthy, а не на !== null.',
      'this нужно пробросить через fn.call(this, ...args, callback).',
      'Синхронное исключение из fn тоже стоит превратить в reject.'],
    code: `function promisify(fn) {
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Колбэк должен идти последним аргументом — не забудьте про случай, когда у функции есть опциональные параметры.</li>
      <li>Частая ошибка — вызвать <code>callback</code> внутри <code>try</code> так, что исключение из <code>resolve</code>-обработчика попадёт в <code>catch</code>. В решении выше <code>try</code> оборачивает только вызов <code>fn</code>.</li>
      <li>В <code>callbackify</code> важно не вызывать <code>callback</code> дважды и не проглотить исключение из самого колбэка.</li>
    </ul>
    <p><strong>Плюс балл:</strong> вспомнить <code>util.promisify</code> и его символ <code>util.promisify.custom</code>, а также что промисификация не отменяет вызовов — для отмены нужен <code>AbortController</code>.</p>` },

  { id: 'tx8',
    title: 'rateLimit(fn, limit, interval)',
    must: false,
    cat: 'Утилиты',
    why: 'Реальная задача: не больше N запросов в секунду',
    prompt: `<p>Реализуйте <code>rateLimit(fn, limit, interval)</code>: обёртка, которая пропускает не более <code>limit</code> вызовов за окно <code>interval</code> мс, а лишние ставит в очередь и выполняет позже.</p>
    <p>Обёртка возвращает промис с результатом <code>fn</code>. Порядок вызовов должен сохраняться. Условие: скользящее окно, а не «сброс счётчика раз в секунду».</p>`,
    hints: ['Храните времена уже совершённых вызовов в массиве и выбрасывайте те, что старше interval.',
      'Отложенные вызовы держите в очереди из объектов { args, resolve, reject }.',
      'Когда лимит исчерпан, посчитайте, через сколько освободится самый старый слот, и поставьте один setTimeout.',
      'Не плодите таймеры на каждый вызов — держите ровно один активный таймер.'],
    code: `function rateLimit(fn, limit, interval) {
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
}`,
    notes: `<p>Разбор: задача любима в командах, которые бьются об лимиты внешних API.</p>
    <ul>
      <li>Отличие от <code>throttle</code>: throttle выбрасывает лишние вызовы, rate limiter их откладывает.</li>
      <li>Скользящее окно против фиксированного: при фиксированном можно получить <code>2 * limit</code> вызовов на стыке окон — назовите это.</li>
      <li>Обсудите backpressure: что делать, если очередь растёт бесконечно (ограничить длину и отклонять с ошибкой).</li>
    </ul>
    <p><strong>Плюс балл:</strong> упомянуть алгоритм token bucket и заголовки <code>Retry-After</code> / <code>429</code>.</p>` },

  { id: 'tx9',
    title: 'Свои map, filter, reduce, forEach',
    must: true,
    cat: 'Данные',
    why: 'Проверяет знание спецификации, а не только синтаксиса',
    prompt: `<p>Реализуйте <code>Array.prototype.myMap</code>, <code>myFilter</code>, <code>myReduce</code>, <code>myForEach</code> без использования одноимённых встроенных методов.</p>
    <p>Требования по спецификации: поддержка второго аргумента <code>thisArg</code>, корректная работа с разреженными массивами (дырки пропускаются), <code>reduce</code> без начального значения на пустом массиве бросает <code>TypeError</code>, длина фиксируется до начала обхода.</p>`,
    hints: ['Приведите this к объекту через Object(this) и возьмите длину как this.length >>> 0.',
      'Дырки в массиве проверяются через оператор in: (i in arr).',
      'Колбэк получает три аргумента: значение, индекс и сам массив.',
      'В reduce без initial первым аккумулятором становится первый существующий элемент, а индекс сдвигается.'],
    code: `Array.prototype.myMap = function (callback, thisArg) {
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
};`,
    notes: `<p>Разбор: задача выглядит тривиальной, но отличников видно по деталям.</p>
    <ul>
      <li><code>arguments.length >= 2</code> вместо <code>initialValue !== undefined</code> — иначе <code>reduce(fn, undefined)</code> сломается.</li>
      <li>Длина считывается один раз: элементы, добавленные во время обхода, не посещаются.</li>
      <li>Проверка <code>i in arr</code> — единственный способ отличить дырку от <code>undefined</code>.</li>
      <li>Определять методы на прототипе нужно через <code>Object.defineProperty</code> с <code>enumerable: false</code>, иначе они всплывут в <code>for...in</code>. Скажите это вслух.</li>
    </ul>
    <p><strong>Частый доп. вопрос:</strong> реализуйте <code>map</code> через <code>reduce</code> и наоборот.</p>` },

  { id: 'tx10',
    title: 'uniqueBy(arr, keyFn) и uniqueWith(arr, isEqual)',
    must: true,
    cat: 'Данные',
    why: 'Дедупликация объектов — ежедневная реальная задача',
    prompt: `<p>Реализуйте <code>uniqueBy(arr, keyFn)</code> — удаление дубликатов по вычисляемому ключу с сохранением порядка первого вхождения.</p>
    <p>Дополнительно <code>uniqueWith(arr, isEqual)</code> — дедупликация по произвольному компаратору. Обсудите сложность обоих вариантов и поведение с <code>NaN</code> и объектами-ключами.</p>`,
    hints: ['Set даёт O(1) на проверку, но работает только со строгим равенством по значению.',
      'Для составного ключа keyFn может возвращать строку или примитив — этого достаточно для Set.',
      'Произвольный компаратор нельзя ускорить хешом, здесь честный O(n^2) — проговорите это.',
      'Set корректно считает NaN равным NaN, в отличие от indexOf.'],
    code: `function uniqueBy(arr, keyFn) {
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
// uniqueBy(users, function (u) { return u.city + '|' + u.role; });`,
    notes: `<p>Разбор:</p>
    <ul>
      <li><code>[...new Set(arr)]</code> — правильный ответ для примитивов, скажите его первым, но добавьте, что для объектов он бесполезен: сравниваются ссылки.</li>
      <li>Составной ключ конкатенацией опасен коллизиями (<code>'a|b'</code> vs <code>'a' + '|b'</code>); безопаснее <code>JSON.stringify([a, b])</code> или вложенные Map.</li>
      <li><code>Set</code> использует SameValueZero: <code>NaN</code> дедуплицируется, <code>+0</code> и <code>-0</code> считаются равными.</li>
    </ul>
    <p><strong>Плюс балл:</strong> предложить вариант «оставить последнее вхождение» и объяснить, что он делается обходом с конца или перезаписью в Map.</p>` },

  { id: 'tx11',
    title: 'intersection, difference, union по ключу',
    must: false,
    cat: 'Данные',
    why: 'Операции над множествами, часто в фильтрах и диффах',
    prompt: `<p>Реализуйте <code>intersection(a, b, keyFn)</code>, <code>difference(a, b, keyFn)</code>, <code>union(a, b, keyFn)</code> и <code>symmetricDifference</code>.</p>
    <p>Наивная реализация через <code>includes</code> даёт O(n*m) — сделайте за O(n+m). Порядок элементов сохраняется как в первом массиве, дубликаты внутри одного массива схлопываются.</p>`,
    hints: ['Постройте Set из ключей второго массива — это превращает поиск в O(1).',
      'keyFn по умолчанию — тождественная функция, тогда работает и для примитивов.',
      'Для union нужно ещё дедуплицировать результат — переиспользуйте логику uniqueBy.',
      'symmetricDifference = difference(a, b) + difference(b, a).'],
    code: `function toKeySet(arr, keyFn) {
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
}`,
    notes: `<p>Разбор: главный сигнал — заметили ли вы квадратичную сложность наивного решения и предложили ли хеш-структуру.</p>
    <ul>
      <li>Проговорите память: Set занимает O(m), это осознанный размен времени на память.</li>
      <li>Для сравнения объектов по нескольким полям keyFn должен давать стабильный ключ — <code>JSON.stringify</code> зависит от порядка полей.</li>
      <li>В современных браузерах есть нативные <code>Set.prototype.intersection/difference/union</code> — упомянуть их будет плюсом.</li>
    </ul>` },

  { id: 'tx12',
    title: 'sortBy(arr, rules) — сортировка по нескольким полям',
    must: true,
    cat: 'Данные',
    why: 'Таблицы с мультисортировкой — типовая продуктовая задача',
    prompt: `<p>Реализуйте <code>sortBy(arr, rules)</code>, где правила — массив вида <code>['age', { key: 'name', desc: true }, u =&gt; u.score]</code>.</p>
    <p>Требования: сортировка не мутирует исходный массив, сравнение стабильное, строки сравниваются через <code>localeCompare</code>, <code>null</code> и <code>undefined</code> уезжают в конец независимо от направления.</p>`,
    hints: ['Приведите разнородные правила к единому виду { getter, direction } до сортировки.',
      'Сравнивайте поля по очереди: первое ненулевое сравнение решает исход.',
      'Стабильность гарантируется декорированием элементов исходным индексом (schwartzian transform).',
      'Числа нельзя сравнивать через localeCompare, а строки — через минус: нужна общая функция compare с проверкой типов.'],
    code: `function isEmpty(value) {
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li><code>Array.prototype.sort</code> мутирует массив — это ловушка номер один. В современных движках есть <code>toSorted()</code>.</li>
      <li>С ES2019 <code>sort</code> обязан быть стабильным, но декорирование индексом всё равно показывает, что вы понимаете проблему; к тому же оно спасает при «в конец» для пустых значений.</li>
      <li><code>['10', '9'].sort()</code> даёт лексикографический порядок — классический вопрос про компаратор по умолчанию.</li>
      <li><code>localeCompare</code> для больших массивов медленный: предложите <code>Intl.Collator</code> с переиспользуемым инстансом.</li>
    </ul>` },

  { id: 'tx13',
    title: 'buildTree(items) — плоский список в дерево',
    must: true,
    cat: 'Данные',
    why: 'Самая частая реальная задача: категории, комментарии, меню',
    prompt: `<p>Дан плоский массив <code>[{ id, parentId, title }]</code>. Соберите вложенное дерево: у каждого узла появляется массив <code>children</code>, корни — узлы без родителя.</p>
    <p>Требования: одна итерация по массиву (линейная сложность), порядок детей сохраняется, элементы с несуществующим <code>parentId</code> считаются корнями, исходные объекты не мутируются.</p>`,
    hints: ['Наивное решение с рекурсивным filter по parentId — это O(n^2). Сначала сделайте индекс.',
      'Первый проход: положите копии узлов в Map по id. Второй: свяжите детей с родителями.',
      'Родителя можно встретить позже ребёнка — именно поэтому нужны два прохода, а не один.',
      'Не забудьте про висячие ссылки: parentId указывает на узел вне выборки.'],
    code: `function buildTree(items, options) {
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
}`,
    notes: `<p>Разбор: эту задачу дают, чтобы отличить «пишу как в туториале» от «думаю про сложность».</p>
    <ul>
      <li>Ожидаемый ответ — O(n) через <code>Map</code>. Рекурсия с <code>filter</code> внутри — O(n^2), назовите это сами.</li>
      <li>Отдельно проговорите защиту от циклов (<code>a.parent = b, b.parent = a</code>): при построении дерева получится потерянная компонента, при обходе — бесконечная рекурсия.</li>
      <li>Ссылка на самого себя (<code>parentId === id</code>) — реальный кейс из грязных данных.</li>
      <li>Мутация входных объектов часто ломает React: скажите, что делаете копии сознательно.</li>
    </ul>
    <p><strong>Частое продолжение:</strong> сортировка детей по <code>order</code> и подсчёт глубины.</p>` },

  { id: 'tx14',
    title: 'flattenTree(nodes) — дерево в плоский список',
    must: true,
    cat: 'Данные',
    why: 'Обратная задача: рендер дерева в виртуальном списке',
    prompt: `<p>Разверните дерево с <code>children</code> в плоский массив, добавив каждому узлу <code>depth</code> и <code>parentId</code>.</p>
    <p>Порядок — как при обходе в глубину (pre-order), поле <code>children</code> в результат не попадает. Сделайте вариант без рекурсии, чтобы не переполнить стек на глубоких деревьях.</p>`,
    hints: ['Pre-order обход: сначала узел, потом его дети слева направо.',
      'Итеративный вариант — стек; чтобы сохранить порядок, кладите детей в обратном порядке.',
      'Глубину и parentId удобно нести вместе с узлом в элементе стека.',
      'Уберите children из результата через деструктуризацию с rest.'],
    code: `function flattenTree(nodes, options) {
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Рекурсивная версия короче, но интервьюер почти всегда спрашивает «а если дерево глубиной 100000?» — итеративный обход это ответ.</li>
      <li>Ключевая деталь итеративного pre-order: обратный порядок при добавлении детей в стек.</li>
      <li>Если нужен BFS-порядок — берём очередь и <code>shift</code> (или индекс-указатель, чтобы не платить O(n) за shift).</li>
    </ul>
    <p><strong>Зачем это в проде:</strong> виртуальный скролл умеет рендерить только плоский список, поэтому дерево разворачивают с учётом свёрнутых узлов. Скажите это — сразу видно опыт.</p>` },

  { id: 'tx15',
    title: 'findPath(root, predicate) — путь до узла в дереве',
    must: true,
    cat: 'Данные',
    why: 'Хлебные крошки и раскрытие дерева до элемента',
    prompt: `<p>Найдите путь от корня до первого узла, удовлетворяющего предикату: массив узлов <code>[root, ..., target]</code> или <code>null</code>.</p>
    <p>Реализуйте два варианта: DFS (короткий, рекурсивный) и BFS (найдёт ближайший к корню узел). Дерево может быть лесом — на входе массив корней.</p>`,
    hints: ['DFS: рекурсивно спускаемся, а найденный путь собираем на возврате из рекурсии.',
      'Не копируйте путь на каждом шаге — можно push перед спуском и pop после (backtracking).',
      'BFS нужен, если требуется САМЫЙ КОРОТКИЙ путь; несите путь в элементах очереди.',
      'Не забудьте про случай, когда предикат подходит самому корню.'],
    code: `// DFS с backtracking: путь строится на месте, без лишних копий
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Backtracking (<code>push</code> / <code>pop</code>) вместо конкатенации массивов — сигнал, что вы думаете про аллокации.</li>
      <li>Ключевой вопрос интервьюера: «в чём разница DFS и BFS здесь?» Ответ: DFS находит первый по порядку обхода, BFS — ближайший к корню.</li>
      <li>Не забудьте вернуть <code>path.slice()</code>: массив переиспользуется и после выхода будет пустым.</li>
      <li>В BFS <code>shift</code> на массиве — O(n); указатель <code>head</code> делает обход честным O(n).</li>
    </ul>` },

  { id: 'tx16',
    title: 'formatNumber(value, options)',
    must: false,
    cat: 'Данные',
    why: 'Формат цен без Intl — проверка работы со строками',
    prompt: `<p>Реализуйте форматирование числа с разделителями разрядов: <code>1234567.891</code> → <code>'1 234 567,89'</code>.</p>
    <p>Параметры: разделитель групп, десятичный разделитель, число знаков после запятой. Учтите отрицательные числа, числа меньше тысячи, <code>NaN</code> и <code>Infinity</code>.</p>`,
    hints: ['Отделите знак и дробную часть, группируйте только целую.',
      'Группы считаются справа налево — идите по строке и вставляйте разделитель, когда до конца остаётся кратное трём число цифр.',
      'toFixed решает округление, но возвращает строку и врёт на больших числах — упомяните это.',
      'В проде правильный ответ — Intl.NumberFormat; скажите это, но реализуйте руками.'],
    code: `function formatNumber(value, options) {
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Альтернатива циклу — регулярка <code>/\\B(?=(\\d{3})+(?!\\d))/g</code>. Уметь объяснить lookahead — заметный плюс.</li>
      <li>Правильный продовый ответ: <code>new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 })</code>. Начните с него, потом реализуйте руками — так вы показываете и кругозор, и алгоритм.</li>
      <li>В вёрстке цен используют неразрывный пробел <code>\\u00A0</code>, иначе число переносится по строке.</li>
      <li>Числа больше <code>Number.MAX_SAFE_INTEGER</code> теряют точность — для денег используйте копейки в целых или BigInt.</li>
    </ul>` },

  { id: 'tx17',
    title: 'plural(count, forms) — склонение слов',
    must: true,
    cat: 'Данные',
    why: 'Русская локаль: 1 товар, 2 товара, 5 товаров',
    prompt: `<p>Реализуйте <code>plural(count, ['товар', 'товара', 'товаров'])</code>, возвращающий правильную форму слова для русского языка.</p>
    <p>Проверьте на 1, 2, 5, 11, 12, 21, 101, 111, 0 и отрицательных числах. Дополнительно сделайте <code>pluralize(count, forms)</code>, возвращающий строку «5 товаров».</p>`,
    hints: ['Правило зависит от последней цифры и от того, не попадает ли число в диапазон 11-19.',
      'Числа 11-14 — исключение: у них всегда форма множественного числа (11 товаров, а не 11 товар).',
      'Берите остаток от 100, потом остаток от 10.',
      'Не забудьте Math.abs: отрицательные значения склоняются так же.'],
    code: `function plural(count, forms) {
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
// plural(0,  f) -> 'товаров'`,
    notes: `<p>Разбор: короткая задача, но ошибку на 11-14 допускают почти все.</p>
    <ul>
      <li>Проверьте себя на 111 и 112: это те же 11 и 12 по остатку от 100.</li>
      <li>Дробные числа в русском языке склоняются по правилу «1,5 товара» — упомянуть это будет плюсом.</li>
      <li>Правильный продовый ответ — <code>new Intl.PluralRules('ru-RU')</code> с категориями <code>one / few / many / other</code>. Обязательно назовите его.</li>
    </ul>
    <p><strong>Что сказать вслух:</strong> «В реальном проекте я бы не изобретал правило, а взял Intl.PluralRules или i18n-библиотеку, потому что в других локалях форм может быть шесть».</p>` },

  { id: 'tx18',
    title: 'transliterate(str) и slugify(str)',
    must: false,
    cat: 'Данные',
    why: 'ЧПУ-адреса: реальная задача из любого проекта',
    prompt: `<p>Реализуйте транслитерацию кириллицы в латиницу и функцию <code>slugify</code>, превращающую заголовок в URL-фрагмент.</p>
    <p>Требования: регистр сохраняется в транслитерации, в слаге всё приводится к нижнему регистру, любые не-буквенно-цифровые символы схлопываются в один дефис, дефисы по краям срезаются, пустые строки обрабатываются корректно.</p>`,
    hints: ['Достаточно таблицы для строчных букв: для заглавных ищите по нижнему регистру и восстанавливайте регистр первой буквы.',
      'Буквы щ, ю, я дают несколько латинских символов — это нормально.',
      'Символы ъ и ь превращаются в пустую строку.',
      'Слаг: транслитерация, потом lowercase, потом замена всего лишнего на дефисы и обрезка краёв.'],
    code: `const TRANSLIT_MAP = {
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Итерация <code>for...of</code> по строке идёт по code points, а не по code units — это важно для эмодзи и суррогатных пар. Скажите об этом.</li>
      <li>Схлопывание нескольких символов в один дефис (<code>+</code> в регулярке) — то, что отличает рабочий slugify от учебного.</li>
      <li>Для латиницы с диакритикой правильнее <code>str.normalize('NFD').replace(/\\p{Diacritic}/gu, '')</code> — упомяните Unicode-нормализацию.</li>
      <li>Обсудите коллизии слагов: два разных заголовка могут дать один слаг, в проде добавляют id.</li>
    </ul>` },

  { id: 'tx19',
    title: 'parseQuery(qs) и stringifyQuery(obj)',
    must: true,
    cat: 'Данные',
    why: 'Работа с URL руками, без URLSearchParams',
    prompt: `<p>Реализуйте разбор query string в объект и обратную сериализацию, не используя <code>URLSearchParams</code>.</p>
    <p>Требования: ведущий <code>?</code> отбрасывается, значения декодируются (<code>%20</code>, <code>+</code>), повторяющиеся ключи собираются в массив, ключ без значения даёт пустую строку, <code>undefined</code> и <code>null</code> при сериализации пропускаются.</p>`,
    hints: ['Разбейте по & и для каждой пары найдите ПЕРВЫЙ знак = — значение может содержать = внутри.',
      'Плюс в query string означает пробел, decodeURIComponent сам этого не делает.',
      'Для повторяющихся ключей: первый раз кладём значение, второй — превращаем в массив.',
      'Используйте Object.create(null) или hasOwnProperty, иначе ключ __proto__ ломает объект.'],
    code: `function parseQuery(queryString) {
  const result = Object.create(null); // защита от __proto__ в ключах
  const input = String(queryString).replace(/^[?#]/, '');
  if (!input) return result;

  for (const pair of input.split('&')) {
    if (!pair) continue;
    const eqIndex = pair.indexOf('='); // именно первый =, значение может содержать свои
    const rawKey = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
    const rawValue = eqIndex === -1 ? '' : pair.slice(eqIndex + 1);

    const key = decodeURIComponent(rawKey.replace(/\\+/g, ' '));
    const value = decodeURIComponent(rawValue.replace(/\\+/g, ' '));

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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li><code>split('=')</code> вместо <code>indexOf('=')</code> — самая частая ошибка: значение <code>a=b=c</code> обрежется.</li>
      <li><code>decodeURIComponent</code> бросает <code>URIError</code> на битой строке вроде <code>%E0%A4%A</code> — оберните в try/catch.</li>
      <li>Prototype pollution через <code>?__proto__[x]=1</code> — реальная уязвимость; <code>Object.create(null)</code> её закрывает. Это senior-сигнал.</li>
      <li>Разные бэкенды по-разному кодируют массивы: <code>a=1&amp;a=2</code>, <code>a[]=1</code>, <code>a=1,2</code>. Уточните формат у интервьюера.</li>
    </ul>
    <p><strong>Плюс балл:</strong> сказать, что в проде это <code>new URLSearchParams(location.search)</code> и <code>qs</code> для вложенных структур.</p>` },

  { id: 'tx20',
    title: 'template(str, data) — шаблонизатор строк',
    must: false,
    cat: 'Данные',
    why: 'Регулярки + доступ по пути + мысли про XSS',
    prompt: `<p>Реализуйте <code>template('Привет, {{ user.name }}!', data)</code>: подставляет значения по пути из объекта.</p>
    <p>Требования: лишние пробелы внутри скобок игнорируются, отсутствующее значение заменяется пустой строкой (или дефолтом из опций), поддержите путь с точками. Обсудите экранирование HTML.</p>`,
    hints: ['Одна регулярка с группой захвата плюс replace с функцией-заменителем.',
      'Путь резолвится тем же reduce, что и в задаче про get.',
      'Не используйте new Function и eval — скажите, почему это дыра в безопасности.',
      'Значения из данных нужно экранировать, иначе получите XSS при вставке в innerHTML.'],
    code: `function escapeHtml(str) {
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
  return String(str).replace(/\\{\\{\\s*([\\w.$]+)\\s*\\}\\}/g, function (match, path) {
    const value = path.split('.').reduce(function (acc, key) {
      return acc === null || acc === undefined ? undefined : acc[key];
    }, data);

    if (value === undefined || value === null) return fallback;
    return escape ? escapeHtml(value) : String(value);
  });
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Главный сигнал для senior — вы сами подняли тему XSS. Шаблонизатор, который вставляет данные в HTML без экранирования, это готовая уязвимость.</li>
      <li>Вариант через <code>new Function('with(data){ return ...}')</code> быстрый, но исполняет произвольный код и не работает под CSP. Скажите, почему отказались.</li>
      <li>Обратите внимание на второй аргумент <code>replace</code>: функция получает совпадение и группы, а <code>$1</code> в строке-замене здесь не подошёл бы, потому что нужен резолв пути.</li>
      <li>Расширения, о которых спросят: условия, циклы, фильтры вида <code>{{ price | money }}</code>.</li>
    </ul>` },

  { id: 'tx21',
    title: 'delegate(root, selector, type, handler)',
    must: true,
    cat: 'DOM',
    why: 'Делегирование — главный вопрос по событиям',
    prompt: `<p>Реализуйте делегирование событий: один слушатель на контейнере обрабатывает события от потомков, подходящих под селектор.</p>
    <p>Требования: <code>this</code> и второй аргумент хендлера — найденный элемент, поиск не поднимается выше <code>root</code>, функция возвращает отписку. Поддержите события, которые не всплывают (<code>focus</code>, <code>blur</code>) через фазу перехвата.</p>`,
    hints: ['Слушатель вешается один раз на контейнер, а нужный элемент ищется от event.target вверх.',
      'closest(selector) делает подъём за вас, но нужно проверить, что найденный элемент внутри root.',
      'event.target может быть текстовым узлом или элементом внутри кнопки — поэтому подъём обязателен.',
      'focus и blur не всплывают: либо capture: true, либо focusin/focusout.'],
    code: `function delegate(root, selector, type, handler, options) {
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
}`,
    notes: `<p>Разбор: интервьюер проверяет понимание всплытия и разницы <code>target</code> / <code>currentTarget</code>.</p>
    <ul>
      <li><code>event.target</code> — где произошло событие, <code>event.currentTarget</code> — где висит слушатель. Путаница здесь стоит дорого.</li>
      <li>Зачем делегирование: один слушатель вместо тысячи, работает для динамически добавленных элементов, меньше утечек памяти.</li>
      <li><code>closest</code> может выйти за пределы <code>root</code> — отсюда проверка <code>root.contains</code>.</li>
      <li>Для <code>removeEventListener</code> флаг <code>capture</code> должен совпадать с тем, что был при добавлении, иначе слушатель не снимется.</li>
    </ul>
    <p><strong>Плюс балл:</strong> упомянуть, что React до 17 вешал все события на <code>document</code>, а с 17 — на корень приложения, и почему это ломало смешанные приложения.</p>` },

  { id: 'tx22',
    title: 'Свой querySelectorAll: обход DOM без рекурсии',
    must: false,
    cat: 'DOM',
    why: 'Проверяет знание структуры DOM и обходов',
    prompt: `<p>Напишите <code>queryAll(root, predicate)</code> — возвращает все элементы поддерева в порядке документа, для которых предикат истинен. Использовать <code>querySelectorAll</code> и <code>getElementsBy*</code> нельзя.</p>
    <p>Сделайте итеративный вариант (без переполнения стека) и вариант через <code>TreeWalker</code>. Сам <code>root</code> в результат не включается.</p>`,
    hints: ['children содержит только элементы, childNodes — ещё текстовые узлы и комментарии.',
      'Итеративный pre-order обход: стек, детей кладём в обратном порядке.',
      'Порядок документа = pre-order обход дерева.',
      'В браузере для этого есть document.createTreeWalker с NodeFilter.SHOW_ELEMENT.'],
    code: `function queryAll(root, predicate) {
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Разница <code>children</code> / <code>childNodes</code> — то, ради чего задачу и дают.</li>
      <li>Порядок документа при обходе стеком получается только при обратном добавлении детей — объясните это вслух.</li>
      <li>Обсудите живые и статические коллекции: <code>getElementsByClassName</code> возвращает живой <code>HTMLCollection</code> (меняется при изменении DOM), <code>querySelectorAll</code> — статический <code>NodeList</code>. Это классический доп. вопрос.</li>
      <li>Shadow DOM обычным обходом не пробивается — нужен <code>element.shadowRoot</code>.</li>
    </ul>` },

  { id: 'tx23',
    title: 'createFocusTrap(container) — ловушка фокуса',
    must: true,
    cat: 'DOM',
    why: 'A11y модалок: спрашивают на senior почти всегда',
    prompt: `<p>Реализуйте ловушку фокуса для модального окна: Tab по кругу перемещается только внутри контейнера, Shift+Tab идёт в обратную сторону.</p>
    <p>При активации фокус переходит на первый доступный элемент, при деактивации — возвращается на элемент, который был активен до открытия. Учтите скрытые и <code>disabled</code> элементы, а также <code>Escape</code>.</p>`,
    hints: ['Соберите список фокусируемых элементов селектором, но пересчитывайте его при каждом Tab: DOM мог измениться.',
      'Отфильтруйте невидимые элементы: offsetParent === null или нулевые размеры.',
      'На Tab с последнего элемента нужно preventDefault и ручной перевод фокуса на первый.',
      'Запомните document.activeElement до открытия и верните фокус туда при закрытии.'],
    code: `const FOCUSABLE_SELECTOR = [
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
}`,
    notes: `<p>Разбор: это задача про доступность, и оценивают именно её понимание.</p>
    <ul>
      <li>Обязательно упомяните <code>aria-modal="true"</code>, <code>role="dialog"</code>, <code>aria-labelledby</code> и <code>inert</code> для фона.</li>
      <li>Возврат фокуса при закрытии — то, что забывают чаще всего, а для пользователей клавиатуры это критично.</li>
      <li>Список фокусируемых элементов надо пересчитывать: содержимое модалки динамическое.</li>
      <li>Скажите, что нативный <code>&lt;dialog&gt;</code> с <code>showModal()</code> даёт ловушку фокуса из коробки — это правильный современный ответ.</li>
    </ul>` },

  { id: 'tx24',
    title: 'Ленивая загрузка картинок через IntersectionObserver',
    must: true,
    cat: 'DOM',
    why: 'Классическая задача про производительность',
    prompt: `<p>Реализуйте ленивую загрузку изображений: <code>&lt;img data-src="..."&gt;</code> подгружается, когда приближается к вьюпорту.</p>
    <p>Требования: загрузка начинается заранее (за 200px до появления), после загрузки элемент перестаёт наблюдаться, есть фоллбэк для браузеров без <code>IntersectionObserver</code>, функция возвращает cleanup и умеет подхватывать новые элементы.</p>`,
    hints: ['IntersectionObserver вместо слушателя scroll: браузер сам считает пересечения вне главного потока.',
      'rootMargin позволяет начать загрузку заранее, до реального попадания во вьюпорт.',
      'После подстановки src обязательно unobserve, иначе наблюдатель будет держать элемент.',
      'Не забудьте про нативный loading="lazy" — с него стоит начать ответ.'],
    code: `function lazyLoadImages(root, options) {
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Первым делом скажите про <code>loading="lazy"</code> и <code>decoding="async"</code>: если задача решается платформой, надо это назвать.</li>
      <li>Почему не <code>scroll</code> + <code>getBoundingClientRect</code>: обработчик скролла дёргается на каждый кадр и вызывает layout thrashing (принудительный reflow при чтении геометрии).</li>
      <li><code>rootMargin</code> — ключевая деталь UX: без него картинка появляется уже пустой.</li>
      <li>Обязательно проговорите резервирование места (<code>width</code>/<code>height</code> или <code>aspect-ratio</code>) — иначе ломается CLS.</li>
      <li><code>observer.disconnect()</code> в cleanup — иначе утечка при переходе между страницами SPA.</li>
    </ul>` },

  { id: 'tx25',
    title: 'Виртуальный скролл (упрощённый)',
    must: false,
    cat: 'DOM',
    why: 'Список на 100000 строк — типовой senior-вопрос',
    prompt: `<p>Реализуйте виртуальный список: в DOM находятся только видимые элементы, скроллбар при этом соответствует полной длине списка.</p>
    <p>Дано: контейнер фиксированной высоты, массив элементов, фиксированная высота строки. Нужно посчитать видимый диапазон, добавить overscan и позиционировать элементы. Обсудите случай переменной высоты.</p>`,
    hints: ['Высота внутреннего «распорки» = количество элементов * высота строки — она и создаёт скроллбар.',
      'Индекс первого видимого = Math.floor(scrollTop / itemHeight).',
      'Видимые элементы смещаются одним transform: translateY на startIndex * itemHeight.',
      'Overscan в несколько элементов сверху и снизу убирает мигание при быстром скролле.'],
    code: `function createVirtualList(config) {
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
}`,
    notes: `<p>Разбор: интервьюер хочет услышать формулы и понимание кадра рендера.</p>
    <ul>
      <li>Три ключевые величины: полная высота (скроллбар), <code>startIndex</code>, смещение окна. Проговорите их до кода.</li>
      <li><code>requestAnimationFrame</code> + флаг <code>ticking</code> — правильный throttle для скролла, привязанный к кадру.</li>
      <li>Переменная высота: нужен массив накопленных смещений и бинарный поиск по нему, плюс измерение после рендера (как в react-virtual). Скажите это даже если не пишете.</li>
      <li>Проблемы, о которых стоит упомянуть: потеря фокуса и выделения при переиспользовании узлов, Ctrl+F по странице не находит невидимые строки, доступность требует <code>aria-setsize</code> / <code>aria-posinset</code>.</li>
      <li><code>content-visibility: auto</code> — нативная альтернатива для простых случаев.</li>
    </ul>` },

  { id: 'tx26',
    title: 'createStore(reducer) — мини-Redux',
    must: true,
    cat: 'DOM',
    why: 'Проверяет понимание подписок и однонаправленного потока',
    prompt: `<p>Реализуйте <code>createStore(reducer, preloadedState)</code> с методами <code>getState</code>, <code>dispatch</code>, <code>subscribe</code>.</p>
    <p>Требования: <code>subscribe</code> возвращает функцию отписки, отписка во время оповещения не ломает обход, вложенный <code>dispatch</code> внутри редьюсера запрещён, при инициализации редьюсер вызывается служебным экшеном. Дополнительно добавьте поддержку middleware.</p>`,
    hints: ['Состояние и список подписчиков живут в замыкании — наружу торчат только три метода.',
      'Перед обходом подписчиков сделайте копию массива: подписчик может отписаться прямо в колбэке.',
      'Флаг isDispatching защищает от dispatch внутри редьюсера — редьюсер должен быть чистым.',
      'Middleware — это функции вида store => next => action => ..., их складывают через compose.'],
    code: `function createStore(reducer, preloadedState) {
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Копия массива подписчиков перед обходом — деталь, ради которой задачу и дают. Без неё отписка в колбэке пропускает следующего слушателя.</li>
      <li>Объясните, почему редьюсер должен быть чистым: предсказуемость, time-travel debugging, тестируемость.</li>
      <li>Служебный <code>@@INIT</code> нужен, чтобы редьюсер вернул значение по умолчанию из <code>state = initialState</code>.</li>
      <li>В <code>api.dispatch</code> нужна именно обёртка-стрелка, а не прямая ссылка: иначе middleware получит недособранный dispatch.</li>
    </ul>
    <p><strong>Плюс балл:</strong> сравнить с <code>useSyncExternalStore</code>, который решает проблему tearing в конкурентном React.</p>` },

  { id: 'tx27',
    title: 'mini-VDOM: h, render и diff',
    must: false,
    cat: 'DOM',
    why: 'Показывает, понимаете ли вы, как работает React внутри',
    prompt: `<p>Реализуйте минимальный виртуальный DOM: функцию <code>h(type, props, ...children)</code>, <code>createDom(vnode)</code> и <code>patch(parent, oldVNode, newVNode)</code>.</p>
    <p><code>patch</code> должен: создавать узел, если старого нет; удалять, если нового нет; заменять при разном типе; иначе обновлять атрибуты и рекурсивно сверять детей. Обсудите роль ключей.</p>`,
    hints: ['VNode — обычный объект { type, props, children }; текстовые узлы удобно хранить как строки или числа.',
      'Атрибуты обновляйте диффом: удалите те, что исчезли, и запишите изменившиеся.',
      'Обработчики событий (props, начинающиеся с on) вешаются через addEventListener, а не setAttribute.',
      'Детей сравнивайте по индексу; объясните, почему без key перестановка приводит к лишним перерисовкам.'],
    code: `function h(type, props, ...children) {
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
}`,
    notes: `<p>Разбор: задача редкая, но если её дали — оценивают именно рассуждения, а не полноту.</p>
    <ul>
      <li>Главный вопрос-продолжение: «зачем нужны key?». Ответ: без ключей diff сравнивает детей по позиции, поэтому вставка в начало списка перерисовывает всё; ключи позволяют сопоставить узлы по идентичности и переиспользовать DOM и состояние.</li>
      <li>Скажите, почему <code>index</code> в качестве key — антипаттерн: при перестановке состояние компонента прилипает не к тому элементу.</li>
      <li>Идти по детям с конца — трюк, чтобы удаление не смещало индексы у ещё не обработанных узлов.</li>
      <li>Реальный React использует эвристику O(n): разные типы — поддерево пересоздаётся целиком, полный алгоритм сравнения деревьев был бы O(n^3).</li>
    </ul>` },

  { id: 'tx28',
    title: 'createRouter — свой роутер на History API',
    must: false,
    cat: 'DOM',
    why: 'SPA-навигация без библиотек, спрашивают на senior',
    prompt: `<p>Реализуйте клиентский роутер: регистрация путей вида <code>'/users/:id'</code>, метод <code>navigate(path)</code> и рендер при переходах.</p>
    <p>Требования: работать с <code>pushState</code> и кнопкой «Назад» (<code>popstate</code>), извлекать параметры пути и query, перехватывать клики по внутренним ссылкам, поддерживать маршрут 404.</p>`,
    hints: ['Шаблон пути превращается в регулярку: сегмент :name заменяется на группу захвата.',
      'popstate НЕ срабатывает на ваш собственный pushState — рендер надо вызывать вручную.',
      'Перехватывайте клики делегированием на document и пропускайте внешние ссылки, target=_blank и клики с модификаторами.',
      'Порядок регистрации важен: более специфичные маршруты должны проверяться раньше.'],
    code: `function compileRoute(pattern) {
  const paramNames = [];
  // :id -> группа захвата, остальные спецсимволы экранируем
  const regexSource = pattern
    .replace(/[.*+?^$()|[\\]\\\\]/g, '\\\\$&')
    .replace(/\\/:([\\w]+)/g, function (match, name) {
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
}`,
    notes: `<p>Разбор: самая частая ошибка — ожидать <code>popstate</code> после собственного <code>pushState</code>. Он срабатывает только на навигацию пользователя (назад/вперёд).</p>
    <ul>
      <li>Перечислите случаи, когда клик нельзя перехватывать: внешний домен, <code>target="_blank"</code>, <code>download</code>, Ctrl/Cmd-клик (открытие в новой вкладке), средняя кнопка мыши.</li>
      <li><code>pushState</code> против <code>replaceState</code>: второй не добавляет запись в историю, нужен для фильтров и табов.</li>
      <li>Скажите про восстановление скролла (<code>history.scrollRestoration</code>) и фокус на заголовке после перехода — это a11y.</li>
      <li>Hash-роутер проще (работает без настройки сервера), но History API требует, чтобы сервер отдавал index.html на любой путь.</li>
    </ul>` },

  { id: 'tx29',
    title: 'useLocalStorage(key, initialValue)',
    must: true,
    cat: 'React',
    why: 'Самый частый «напишите свой хук» на собесе',
    prompt: `<p>Напишите хук <code>useLocalStorage(key, initialValue)</code> с API как у <code>useState</code>.</p>
    <p>Требования: ленивая инициализация из хранилища, поддержка функционального обновления <code>setValue(prev =&gt; ...)</code>, устойчивость к битому JSON и к недоступному <code>localStorage</code> (SSR, приватный режим), синхронизация между вкладками через событие <code>storage</code>.</p>`,
    hints: ['Чтение из localStorage дорогое — делайте его в ленивом инициализаторе useState, а не на каждый рендер.',
      'JSON.parse может бросить исключение на битых данных: оборачивайте в try/catch и падайте на initialValue.',
      'Для функционального апдейта используйте setState(prev => ...) и записывайте в хранилище уже вычисленное значение.',
      'Событие storage приходит только в ДРУГИХ вкладках — для текущей нужно обновлять состояние самому.'],
    code: `import { useCallback, useEffect, useState } from 'react';

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
}`,
    notes: `<p>Разбор — что отличает senior-ответ:</p>
    <ul>
      <li>Ленивая инициализация <code>useState(() =&gt; ...)</code>: без стрелки чтение из storage происходит на каждом рендере.</li>
      <li>SSR: обращение к <code>window</code> на сервере — ошибка. Проговорите гидратацию: первый рендер на клиенте должен совпасть с серверным, иначе hydration mismatch. Аккуратный вариант — читать storage в <code>useEffect</code> после монтирования.</li>
      <li><code>localStorage</code> может бросать: приватный режим, переполненная квота, отключённые cookies.</li>
      <li>Событие <code>storage</code> в текущей вкладке не приходит — это ловушка, на которую ловят.</li>
      <li>Побочный вопрос: чем <code>localStorage</code> хуже <code>IndexedDB</code> — синхронный API блокирует главный поток, лимит около 5 МБ, только строки.</li>
    </ul>` },

  { id: 'tx30',
    title: 'useEventListener(type, handler, target)',
    must: true,
    cat: 'React',
    why: 'Проверяет ref для колбэка и корректный cleanup',
    prompt: `<p>Напишите хук, подписывающий обработчик на событие DOM-элемента, <code>window</code> или <code>document</code>.</p>
    <p>Требования: пересоздание подписки при смене типа события или цели, но НЕ при смене колбэка; корректная отписка; поддержка <code>ref</code> в качестве цели; поддержка опций (<code>passive</code>, <code>capture</code>).</p>`,
    hints: ['Если положить handler в зависимости useEffect, подписка будет пересоздаваться на каждый рендер.',
      'Свежий колбэк храните в ref и обновляйте его в отдельном эффекте (паттерн latest ref).',
      'Цель может быть ref-объектом: разворачивайте target.current внутри эффекта.',
      'Возвращайте функцию отписки с теми же опциями, что были при подписке.'],
    code: `import { useEffect, useLayoutEffect, useRef } from 'react';

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
// useEventListener('keydown', onKeyDown); // по умолчанию window`,
    notes: `<p>Разбор: это задача про то, понимаете ли вы природу зависимостей эффекта.</p>
    <ul>
      <li>Паттерн latest ref — ключевой момент. Без него инлайновая стрелка в пропсах пересоздаёт подписку каждый рендер (add/remove на каждый рендер).</li>
      <li>Почему <code>useLayoutEffect</code> для обновления ref: чтобы свежий колбэк был доступен до того, как сработает событие в том же кадре.</li>
      <li>Обязателен cleanup: без него при размонтировании остаётся висящий слушатель и утечка через замыкание.</li>
      <li>Объект <code>options</code> в зависимостях нестабилен по ссылке — либо сериализуйте, либо требуйте мемоизации от вызывающего. Проговорите этот компромисс.</li>
      <li>Ссылка на React 19: <code>useEffectEvent</code> решает ровно эту задачу штатно — упомянуть будет плюсом.</li>
    </ul>` },

  { id: 'tx31',
    title: 'Компонент Tabs с поддержкой клавиатуры',
    must: true,
    cat: 'React',
    why: 'Компонент + a11y: любимая задача на senior',
    prompt: `<p>Реализуйте компонент <code>Tabs</code>: список вкладок и панель с содержимым активной вкладки.</p>
    <p>Требования a11y: правильные роли (<code>tablist</code>, <code>tab</code>, <code>tabpanel</code>), связка через <code>aria-controls</code> / <code>aria-labelledby</code>, навигация стрелками, Home/End, паттерн roving tabindex (в табуляцию попадает только активная вкладка). Отключённые вкладки пропускаются.</p>`,
    hints: ['Из всего списка вкладок tabIndex={0} должен быть только у активной, у остальных -1 — это и есть roving tabindex.',
      'Стрелки влево/вправо переключают вкладку по кругу, Home и End — на первую и последнюю.',
      'После смены вкладки с клавиатуры нужно программно перевести фокус на новую вкладку.',
      'id панели и вкладки связывайте через useId, чтобы несколько Tabs на странице не конфликтовали.'],
    code: `import { useId, useRef, useState } from 'react';

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
}`,
    notes: `<p>Разбор: код тут простой, оценивают знание паттерна и деталей.</p>
    <ul>
      <li>Roving tabindex — то самое слово, которое хочет услышать интервьюер: Tab выводит из группы вкладок, а стрелки переключают внутри неё.</li>
      <li><code>useId</code> вместо счётчика или <code>Math.random</code>: стабильно при SSR и не конфликтует между инстансами.</li>
      <li><code>hidden</code> вместо размонтирования сохраняет состояние панелей (введённый текст, позицию скролла) — обсудите компромисс с ленивым рендером тяжёлых вкладок.</li>
      <li>Частое продолжение: сделать Tabs через compound components (<code>Tabs.List</code>, <code>Tabs.Tab</code>, <code>Tabs.Panel</code>) на контексте — расскажите, что контекст даёт гибкую вёрстку без прокидывания пропсов.</li>
      <li>Ещё продолжение: синхронизация активной вкладки с URL через query-параметр.</li>
    </ul>` },

  { id: 'tx32',
    title: 'Modal через createPortal',
    must: true,
    cat: 'React',
    why: 'Порталы, focus, body scroll lock, Escape',
    prompt: `<p>Реализуйте модальное окно через <code>createPortal</code>.</p>
    <p>Требования: рендер в отдельный узел вне корня приложения, закрытие по Escape и по клику на подложку (но не по клику внутри контента), блокировка скролла body, возврат фокуса на элемент-открывашку, корректные ARIA-атрибуты. Все эффекты должны корректно очищаться.</p>`,
    hints: ['Портал рендерит в другой DOM-узел, но события всплывают по дереву React, а не DOM — это важно.',
      'Слушатель Escape вешайте на document в useEffect и снимайте в cleanup.',
      'Клик по подложке ловите сравнением event.target === event.currentTarget, иначе закроется и по клику внутри.',
      'Блокировку скролла делайте с сохранением прежнего значения overflow, чтобы вложенные модалки не сломали друг друга.'],
    code: `import { useEffect, useRef } from 'react';
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Ключевой вопрос: «всплывают ли события из портала в родительский компонент?» Да — React использует дерево компонентов, а не DOM. Это удивляет многих и часто ломает клик-аутсайд.</li>
      <li>Блокировка скролла через <code>overflow: hidden</code> на iOS не работает как ожидается и вызывает прыжок из-за исчезнувшего скроллбара — упомяните компенсацию <code>padding-right</code>.</li>
      <li>Возврат фокуса и <code>aria-modal</code> — обязательная часть, за неё дают баллы.</li>
      <li>Хорошее продолжение: добавить focus trap (см. отдельную задачу) и <code>inert</code> на фон.</li>
      <li>Скажите, что нативный <code>&lt;dialog&gt;</code> закрывает большинство этих задач штатно.</li>
    </ul>` },

  { id: 'tx33',
    title: 'Бесконечный скролл + useIntersectionObserver',
    must: true,
    cat: 'React',
    why: 'Пагинация по скроллу — задача почти в каждом продукте',
    prompt: `<p>Реализуйте хук <code>useIntersectionObserver</code> и на его основе бесконечный скролл: при появлении элемента-сентинела подгружается следующая страница.</p>
    <p>Требования: нет повторных запросов при повторном пересечении и во время загрузки, есть состояние <code>hasMore</code>, обработка ошибок, отмена запроса при размонтировании, наблюдатель пересоздаётся при смене узла.</p>`,
    hints: ['Ref через useState вместо useRef: так компонент узнаёт о появлении узла и пересоздаст observer.',
      'Флаг isLoading нужно проверять внутри колбэка, иначе за один экран улетит несколько запросов.',
      'AbortController в cleanup эффекта отменяет запрос при размонтировании.',
      'Сентинел должен быть отдельным элементом ПОД списком, а не последним элементом списка.'],
    code: `import { useCallback, useEffect, useRef, useState } from 'react';

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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Callback ref через <code>useState</code> вместо <code>useRef</code> — важная деталь: обычный ref не вызывает ререндер, и эффект не узнает, что узел появился.</li>
      <li>Защита от дублей: без флага <code>isLoading</code> сентинел, оставшийся во вьюпорте, выстрелит несколько раз подряд.</li>
      <li><code>rootMargin</code> подгружает данные заранее, чтобы пользователь не видел пустоту.</li>
      <li>Обязательно проговорите доступность: бесконечный скролл ломает футер и навигацию клавиатурой, поэтому кнопка «Загрузить ещё» как фоллбэк — хороший тон.</li>
      <li>Для очень длинных списков сочетайте с виртуализацией, иначе DOM всё равно распухнет.</li>
    </ul>` },

  { id: 'tx34',
    title: 'Форма с валидацией без библиотек',
    must: true,
    cat: 'React',
    why: 'Проверяет управляемые инпуты, UX ошибок и a11y',
    prompt: `<p>Сделайте форму (email, пароль, подтверждение пароля) с валидацией на своих хуках, без react-hook-form.</p>
    <p>Требования: ошибка показывается после потери фокуса или после сабмита, а не с первого символа; кросс-полевая проверка совпадения паролей; блокировка кнопки во время отправки; ошибки связаны с полями через <code>aria-describedby</code> и <code>aria-invalid</code>; обработка ошибки сервера.</p>`,
    hints: ['Храните три структуры: values, touched и submitted — от них зависит, показывать ли ошибку.',
      'Правила валидации опишите декларативно как объект «поле -> список проверок», иначе логика расползётся.',
      'Валидировать весь объект целиком проще, чем поле по отдельности: тогда правило «пароли совпадают» естественно выражается.',
      'На сабмите пометьте все поля как touched, чтобы пользователь увидел все ошибки сразу.'],
    code: `import { useCallback, useMemo, useState } from 'react';

function validate(values) {
  const errors = {};
  if (!values.email) errors.email = 'Укажите email';
  // простая, намеренно нестрогая проверка: полная регулярка для email бессмысленна
  else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(values.email)) errors.email = 'Неверный формат email';

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
}`,
    notes: `<p>Разбор: интервьюер проверяет продуктовое мышление, а не знание API.</p>
    <ul>
      <li>Момент показа ошибки — главный UX-вопрос: ошибка при вводе первого символа email раздражает. Отсюда <code>touched</code> и <code>submitted</code>.</li>
      <li>Кнопку сабмита лучше не блокировать по невалидности: пользователь не понимает, почему она серая. Блокируем только на время отправки — обоснуйте свой выбор.</li>
      <li>A11y: <code>label htmlFor</code>, <code>aria-invalid</code>, <code>aria-describedby</code>, <code>role="alert"</code> для озвучивания ошибки.</li>
      <li>Производительность: управляемая форма ререндерит всё на каждый символ; для больших форм упомяните неуправляемые поля с <code>ref</code> (как делает react-hook-form) или локальное состояние на поле.</li>
      <li>Валидация email регуляркой — заведомо приблизительна, единственная надёжная проверка это письмо с подтверждением. Скажите это.</li>
    </ul>` },

  { id: 'tx35',
    title: 'Секундомер: start, pause, reset, lap',
    must: true,
    cat: 'React',
    why: 'Таймеры в эффектах — где ошибаются почти все',
    prompt: `<p>Реализуйте секундомер с кнопками старт, пауза, сброс и «круг», отображающий время с точностью до сотых.</p>
    <p>Требования: точность не должна плыть (нельзя просто прибавлять интервал), корректная очистка таймера, работа после сворачивания вкладки, отсутствие лишних ререндеров.</p>`,
    hints: ['setInterval дрейфует: браузер не гарантирует точную периодичность, а в фоне троттлит до 1 раза в секунду.',
      'Считайте время не счётчиком тиков, а разницей Date.now() и момента старта.',
      'При паузе сохраняйте накопленное время, при возобновлении сдвигайте точку отсчёта.',
      'Идентификатор таймера держите в ref и обязательно чистите в cleanup эффекта.'],
    code: `import { useEffect, useRef, useState } from 'react';

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
}`,
    notes: `<p>Разбор: короткая задача с длинным списком граблей.</p>
    <ul>
      <li>Главная ошибка кандидатов — <code>setElapsed(e =&gt; e + 50)</code>. Такой счётчик уезжает: интервалы не точны, а фоновая вкладка троттлится до 1 Гц. Считать надо от <code>Date.now()</code>.</li>
      <li>Забытый <code>clearInterval</code> в cleanup — второй по частоте промах; при быстром переключении получится несколько параллельных таймеров.</li>
      <li>Накопленное время в <code>ref</code>, а не в состоянии: оно не должно вызывать ререндер.</li>
      <li>Для плавной анимации вместо <code>setInterval</code> лучше <code>requestAnimationFrame</code>; для точности между сессиями — <code>performance.now()</code>, который монотонен и не зависит от перевода часов.</li>
      <li>Частое продолжение: «а сделайте обратный отсчёт» и «что будет, если пользователь свернёт вкладку на час».</li>
    </ul>` },

  { id: 'tx36',
    title: 'Todo с фильтрами (all / active / done)',
    must: true,
    cat: 'React',
    why: 'Классический стартовый компонент на лайвкодинге',
    prompt: `<p>Реализуйте список задач: добавление, отметка выполнения, удаление, редактирование по двойному клику, фильтры «все / активные / выполненные», счётчик оставшихся и очистка выполненных.</p>
    <p>Требования: состояние через <code>useReducer</code>, иммутабельные обновления, стабильные ключи, отсутствие лишних вычислений при рендере.</p>`,
    hints: ['useReducer вместо россыпи useState: у сущности много переходов, они просятся в один редьюсер.',
      'Фильтрацию оборачивайте в useMemo — она зависит от списка и фильтра.',
      'В качестве key нельзя брать индекс: при удалении из середины состояние строк съедет.',
      'Все обновления иммутабельные: map/filter, а не push и мутация полей.'],
    code: `import { useMemo, useReducer, useState } from 'react';

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
}`,
    notes: `<p>Разбор: задача-разогрев, но по ней читают вашу инженерную культуру.</p>
    <ul>
      <li>Ключ по индексу — красный флаг. Объясните, что React сопоставляет элементы по ключу, и при удалении из середины состояние (например, режим редактирования) прилипнет не к той строке.</li>
      <li><code>useReducer</code> вместо пяти <code>useState</code> показывает, что вы думаете о переходах состояния, а не о переменных.</li>
      <li>Держите в состоянии минимум: <code>activeCount</code> и отфильтрованный список — производные значения, их нельзя дублировать в состоянии.</li>
      <li>Хорошее продолжение: сохранение в localStorage, оптимистичное обновление при работе с сервером, отмена последнего действия.</li>
    </ul>` },

  { id: 'tx37',
    title: 'Звёздный рейтинг с половинками и клавиатурой',
    must: false,
    cat: 'React',
    why: 'Компонент на 15 минут с ловушками по a11y',
    prompt: `<p>Реализуйте компонент рейтинга: N звёзд, подсветка при наведении, выбор кликом, режим только для чтения.</p>
    <p>Требования: доступность (роль <code>radiogroup</code> или нативные радиокнопки, управление стрелками), поддержка контролируемого и неконтролируемого режимов, сброс подсветки при уходе мыши.</p>`,
    hints: ['Нужны два значения: выбранное (value) и наведённое (hover). Отображается hover, если он есть, иначе value.',
      'Сброс hover делайте на onMouseLeave контейнера, а не каждой звезды.',
      'Для доступности проще всего использовать нативные input type=radio, визуально скрытые через CSS.',
      'Компонент должен работать и как контролируемый (передан value), и как неконтролируемый — паттерн useControllableState.'],
    code: `import { useState } from 'react';

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
            {star <= shown ? '\\u2605' : '\\u2606'}
          </span>
        </label>
      ))}
      <span className="visually-hidden">{current + ' из ' + max}</span>
    </div>
  );
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Главная идея — разделение <code>value</code> и <code>hover</code>: показываем hover, когда он есть, иначе выбранное значение.</li>
      <li>Нативные радиокнопки дают клавиатуру, скринридер и работу в форме бесплатно. Реализация на <code>div</code> с <code>onClick</code> — типичный недоделанный вариант, и это замечают.</li>
      <li>Паттерн controlled/uncontrolled — senior-сигнал: покажите, что понимаете, зачем компоненту оба режима.</li>
      <li><code>visually-hidden</code> (clip-path, а не <code>display: none</code>) — важная деталь: <code>display: none</code> убирает элемент из дерева доступности.</li>
      <li>Продолжение: половинки звёзд через два инпута на звезду или через clip-path по позиции курсора.</li>
    </ul>` },

  { id: 'tx38',
    title: 'ErrorBoundary своими руками',
    must: true,
    cat: 'React',
    why: 'Единственное место, где до сих пор нужен класс',
    prompt: `<p>Реализуйте компонент <code>ErrorBoundary</code>, который перехватывает ошибки рендера в поддереве, показывает фоллбэк и логирует ошибку.</p>
    <p>Требования: сброс состояния при смене <code>resetKeys</code>, передача фоллбэку функции сброса, логирование в <code>componentDidCatch</code>. Объясните, какие ошибки граница НЕ ловит.</p>`,
    hints: ['Границы ошибок можно написать только классом: хуковой альтернативы нет до сих пор.',
      'Статический getDerivedStateFromError переводит компонент в состояние ошибки при рендере.',
      'componentDidCatch получает второй аргумент с componentStack — его и надо отправлять в мониторинг.',
      'Граница НЕ ловит ошибки в обработчиках событий, в асинхронном коде, в SSR и свои собственные ошибки.'],
    code: `import { Component } from 'react';

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
}`,
    notes: `<p>Разбор: обязательный вопрос — «что граница НЕ ловит».</p>
    <ul>
      <li>Не ловит: ошибки в обработчиках событий, в <code>setTimeout</code> и промисах, при серверном рендеринге, а также ошибки самой границы. Для асинхронных ошибок нужен свой try/catch или проброс через состояние.</li>
      <li>Разница методов: <code>getDerivedStateFromError</code> — фаза рендера, должен быть чистым; <code>componentDidCatch</code> — фаза коммита, здесь логируют.</li>
      <li>Если фоллбэк не сбрасывается, пользователь остаётся с ошибкой навсегда — отсюда <code>resetKeys</code>.</li>
      <li>Гранулярность: одна граница на всё приложение означает белый экран из-за упавшего виджета. Обсудите границы вокруг независимых блоков.</li>
      <li>Скажите про React 19: <code>onCaughtError</code> и <code>onUncaughtError</code> в <code>createRoot</code>, а также про связку Suspense + ErrorBoundary для загрузки данных.</li>
    </ul>` },

  { id: 'tx39',
    title: 'twoSum(nums, target)',
    must: true,
    cat: 'Алгоритмы',
    why: 'Разогрев: проверяет мысль хеш вместо перебора',
    prompt: `<p>Дан массив чисел и целевая сумма. Верните индексы двух элементов, дающих в сумме <code>target</code>, или <code>null</code>.</p>
    <p>Требования: один проход, O(n) по времени. Один и тот же элемент нельзя использовать дважды. Обсудите вариант для отсортированного массива и вариант «найти все пары».</p>`,
    hints: ['Наивное решение — два вложенных цикла, O(n^2). Скажите это и сразу предложите улучшение.',
      'Идите по массиву и для каждого числа спрашивайте: видел ли я уже target - x?',
      'В Map кладите значение -> индекс, и проверяйте дополнение ДО того, как положить текущий элемент.',
      'Для отсортированного массива есть решение двумя указателями за O(n) без дополнительной памяти.'],
    code: `function twoSum(nums, target) {
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
}`,
    notes: `<p>Разбор: задачу дают не ради ответа, а ради рассуждения.</p>
    <ul>
      <li>Правильный сценарий: назвать наивное O(n^2), объяснить, почему O(n) достижимо, и написать код — именно в таком порядке.</li>
      <li>Ключевая деталь: проверять дополнение перед добавлением текущего элемента, иначе <code>[3]</code> с <code>target = 6</code> вернёт <code>[0, 0]</code>.</li>
      <li>Проговорите размен: O(n) памяти на Map ради O(n) времени.</li>
      <li>Уточняющие вопросы вслух: массив отсортирован? нужны индексы или значения? может быть несколько ответов? есть ли отрицательные числа?</li>
    </ul>` },

  { id: 'tx40',
    title: 'isValidBrackets(str)',
    must: true,
    cat: 'Алгоритмы',
    why: 'Каноническая задача на стек',
    prompt: `<p>Проверьте, сбалансированы ли скобки <code>()</code>, <code>[]</code>, <code>{}</code> в строке.</p>
    <p>Требования: правильный порядок закрытия, обработка пустой строки и лишних закрывающих скобок. Дополнительно: вариант, игнорирующий прочие символы, и вариант с возвратом позиции первой ошибки.</p>`,
    hints: ['Открывающие скобки кладём в стек, закрывающие сверяем с вершиной.',
      'Не забудьте проверить, что стек пуст в конце: строка из трёх открывающих скобок несбалансирована.',
      'Закрывающая скобка при пустом стеке — сразу false.',
      'Соответствие скобок удобно держать в объекте: закрывающая -> открывающая.'],
    code: `const PAIRS = { ')': '(', ']': '[', '}': '{' };

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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Две проверки, которые забывают: закрывающая скобка при пустом стеке и непустой стек в конце. Прогоните вслух на входах вида <code>)(</code> и <code>((</code>.</li>
      <li>Сложность O(n) по времени и O(n) по памяти в худшем случае.</li>
      <li>Продолжения, которые часто просят: игнорировать скобки внутри строковых литералов, поддержать HTML-теги, посчитать минимальное число вставок для балансировки.</li>
    </ul>` },

  { id: 'tx41',
    title: 'Строковая разминка: палиндром, первый уникальный, анаграмма',
    must: true,
    cat: 'Алгоритмы',
    why: 'Три мини-задачи, с которых начинают лайвкодинг',
    prompt: `<p>Реализуйте три функции: <code>isPalindrome(str)</code> (игнорируя регистр и не-буквы), <code>firstUniqueChar(str)</code> (индекс первого неповторяющегося символа) и <code>isAnagram(a, b)</code>.</p>
    <p>Требования: без сортировки там, где можно за O(n); обсудите работу с юникодом и почему переворот строки — не лучшее решение для палиндрома.</p>`,
    hints: ['Палиндром: два указателя навстречу вместо переворота строки — O(1) памяти.',
      'Первый уникальный символ: два прохода — сначала считаем частоты, потом ищем первый с частотой 1.',
      'Анаграмма: сортировка даёт O(n log n), карта частот — O(n).',
      'Проверяйте длину строк ДО подсчёта: разная длина сразу означает не-анаграмму.'],
    code: `function isPalindrome(str) {
  const s = str.toLowerCase();
  let left = 0;
  let right = s.length - 1;
  const isLetterOrDigit = function (ch) { return /[\\p{L}\\p{N}]/u.test(ch); };

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
}`,
    notes: `<p>Разбор: это разогрев, здесь важна скорость и аккуратность, а не изобретательность.</p>
    <ul>
      <li>Палиндром через разворот строки — рабочий ответ, но O(n) памяти; два указателя лучше, назовите разницу.</li>
      <li><code>split('')</code> ломает эмодзи и суррогатные пары, а <code>for...of</code> идёт по code points. Это сильный сигнал знания языка.</li>
      <li>Анаграмма сортировкой — O(n log n), картой частот — O(n). Приведите оба варианта и обоснуйте выбор.</li>
      <li>Уточняющие вопросы: учитывать ли регистр, пробелы, диакритику? Для юникода может понадобиться <code>normalize('NFC')</code>.</li>
    </ul>` },

  { id: 'tx42',
    title: 'lengthOfLongestSubstring(s) — скользящее окно',
    must: true,
    cat: 'Алгоритмы',
    why: 'Главная medium-задача на sliding window',
    prompt: `<p>Найдите длину самой длинной подстроки без повторяющихся символов.</p>
    <p>Требования: один проход, O(n). Дополнительно верните саму подстроку. Проверьте на пустой строке и на входах <code>bbbbb</code>, <code>pwwkew</code>, <code>abba</code>.</p>`,
    hints: ['Держите окно с границами left и right и структуру символов внутри окна.',
      'При встрече дубликата двигайте левую границу вправо, пока дубликат не исчезнет.',
      'Ускорение: храните в Map последний индекс символа и прыгайте левой границей сразу.',
      'Тест abba ловит главную ошибку: левая граница не должна ехать назад.'],
    code: `function lengthOfLongestSubstring(s) {
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
}`,
    notes: `<p>Разбор: ключевая проверка — понимаете ли вы инвариант окна.</p>
    <ul>
      <li>Инвариант: в текущем окне нет повторов. Сформулируйте его вслух до кода — это половина решения.</li>
      <li>Главная ловушка — строка <code>abba</code>: у второй буквы <code>a</code> прошлый индекс меньше текущей левой границы, поэтому границу двигать нельзя. Отсюда сравнение с <code>left</code>.</li>
      <li>Сложность O(n) по времени, O(min(n, размер алфавита)) по памяти.</li>
      <li>Задача — шаблон для целого семейства: минимальное окно с подстрокой, подмассив с заданной суммой, максимум K различных символов. Скажите, что узнали паттерн.</li>
    </ul>` },

  { id: 'tx43',
    title: 'mergeIntervals(intervals)',
    must: true,
    cat: 'Алгоритмы',
    why: 'Частая medium: сортировка плюс жадное слияние',
    prompt: `<p>Дан массив интервалов вида <code>[[1,3],[2,6],[8,10]]</code>. Объедините пересекающиеся и верните отсортированный результат.</p>
    <p>Требования: не мутировать вход; определиться, считаются ли касающиеся интервалы пересекающимися. Дополнительно: вставка нового интервала в уже отсортированный список.</p>`,
    hints: ['Сначала отсортируйте по началу интервала — без этого задача не решается жадно.',
      'Идите слева направо: если начало текущего не больше конца последнего в результате, интервалы сливаются.',
      'При слиянии конец берите как максимум из двух: интервал может быть вложенным.',
      'Уточните у интервьюера, слипаются ли касающиеся интервалы — это меняет знак сравнения.'],
    code: `function mergeIntervals(intervals) {
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Первый шаг — сортировка по началу. Если кандидат начинает без неё, решение почти наверняка развалится.</li>
      <li>Ловушка вложенности: интервал <code>[2,3]</code> внутри <code>[1,10]</code>. Без <code>Math.max</code> конец сожмётся до 3.</li>
      <li>Сложность O(n log n) из-за сортировки, дальше линейно.</li>
      <li>Мутация входного массива через <code>sort</code> — практичный минус, который замечают в продуктовых командах.</li>
      <li>Где встречается в реальности: слияние занятых слотов в календаре, объединение диапазонов подсветки в редакторе.</li>
    </ul>` },

  { id: 'tx44',
    title: 'binarySearch и lowerBound',
    must: true,
    cat: 'Алгоритмы',
    why: 'Проверяет аккуратность с границами',
    prompt: `<p>Реализуйте бинарный поиск в отсортированном массиве и поиск позиции для вставки (нижняя граница).</p>
    <p>Требования: без рекурсии, корректная работа с пустым массивом и с элементами вне диапазона, поддержка компаратора для массива объектов. Обсудите вычисление середины.</p>`,
    hints: ['Определитесь с инвариантом: полуинтервал или отрезок — и не смешивайте их в одном цикле.',
      'Середину считайте как left + (right - left) / 2: в других языках это защита от переполнения.',
      'Lower bound возвращает первую позицию, куда можно вставить элемент, не нарушив порядок.',
      'Проверьте на пустом массиве и на элементе больше всех — самые частые падения.'],
    code: `function binarySearch(arr, target, compare) {
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
}`,
    notes: `<p>Разбор: задача про дисциплину, а не про идею.</p>
    <ul>
      <li>Сформулируйте инвариант до кода: ответ всегда лежит внутри текущих границ. Тогда они не поплывут.</li>
      <li>Классические падения: бесконечный цикл, если писать <code>left = mid</code> вместо <code>mid + 1</code>; пропуск последнего элемента при неверном условии цикла.</li>
      <li>Про среднюю точку: в JS числа double и переполнения нет, но привычка писать безопасно — плюс, и это отсылка к известному багу в стандартной библиотеке Java.</li>
      <li>Где нужно во фронтенде: поиск строки по накопленным смещениям в виртуальном скролле, вставка в отсортированный список, поиск ближайшей точки на графике.</li>
    </ul>` },

  { id: 'tx45',
    title: 'topKFrequent(items, k)',
    must: true,
    cat: 'Алгоритмы',
    why: 'Подсчёт частот и выбор топа, очень частая medium',
    prompt: `<p>Верните <code>k</code> самых часто встречающихся элементов массива.</p>
    <p>Требования: обсудите сложность. Сортировка даёт O(n log n) — предложите bucket sort за O(n). Определите порядок для элементов с одинаковой частотой.</p>`,
    hints: ['Первый шаг всегда одинаковый: карта частот за один проход.',
      'Сортировка пар элемент-частота — рабочее решение, но не оптимальное.',
      'Частота не может превышать длину массива — значит, элементы можно разложить по корзинам-индексам.',
      'Проход по корзинам с конца даёт элементы в порядке убывания частоты за O(n).'],
    code: `function countBy(items, keyFn) {
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
}`,
    notes: `<p>Разбор:</p>
    <ul>
      <li>Ожидаемая траектория ответа: карта частот, потом сортировка O(n log n), потом улучшение до O(n) через корзины или до O(n log k) через кучу.</li>
      <li>Куча размера k — правильный ответ, когда k мало, а n огромно, или когда данные приходят потоком. Назовите этот случай.</li>
      <li>Ключ Map может быть объектом — тогда сравнение по ссылке; для группировки по значению нужен keyFn.</li>
      <li>Уточните стабильность: при равных частотах порядок не определён, а продуктовые требования часто просят алфавитный.</li>
      <li>Смежная задача, которую дают следом: группировка анаграмм — тот же приём, ключ это отсортированные буквы слова.</li>
    </ul>` },

  { id: 'tx46',
    title: 'sleep(ms) и withTimeout(promise, ms)',
    must: true,
    cat: 'Асинхронность',
    why: 'База промисов плюс тема утечек и отмены',
    prompt: `<p>Реализуйте <code>sleep(ms)</code> и <code>withTimeout(promise, ms, message)</code>, отклоняющий промис, если тот не завершился за отведённое время.</p>
    <p>Требования: таймер обязательно очищается в любом исходе, исходный промис не удерживается в памяти, поддержите отмену через <code>AbortSignal</code>. Объясните, почему сам запрос при этом не отменяется.</p>`,
    hints: ['sleep — это new Promise с setTimeout в resolve, но важно предусмотреть отмену.',
      'withTimeout — это Promise.race двух промисов: исходного и таймера-отклонителя.',
      'Ключевая деталь — clearTimeout в finally: без него висит таймер, а в Node процесс не завершается.',
      'Promise.race не отменяет проигравший промис: он продолжает выполняться. Отмена — отдельный механизм.'],
    code: `function sleep(ms, signal) {
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
}`,
    notes: `<p>Разбор: главный вопрос интервьюера — «отменится ли запрос по таймауту?».</p>
    <ul>
      <li>Ответ: нет. <code>Promise.race</code> лишь игнорирует результат проигравшего; сетевой запрос продолжается и трафик тратится. Настоящая отмена — только <code>AbortController</code>.</li>
      <li><code>clearTimeout</code> в <code>finally</code> — не косметика: в Node незакрытый таймер держит event loop, и процесс не завершается.</li>
      <li>Свой класс ошибки вместо строки позволяет отличить таймаут от сетевой ошибки в <code>catch</code>.</li>
      <li>Упомяните готовые решения: <code>AbortSignal.timeout(ms)</code> и <code>AbortSignal.any</code> — это современный ответ.</li>
      <li>Хорошее продолжение: сочетать таймаут с ретраями, следя за общим бюджетом времени.</li>
    </ul>` },

  { id: 'tx47',
    title: 'mapSeries: последовательное выполнение промисов',
    must: true,
    cat: 'Асинхронность',
    why: 'Проверяет разницу параллельного и последовательного',
    prompt: `<p>Реализуйте <code>mapSeries(items, asyncFn)</code>: применяет асинхронную функцию к элементам строго по очереди, следующий стартует только после завершения предыдущего.</p>
    <p>Сделайте два варианта: через <code>for...of</code> с <code>await</code> и через цепочку <code>reduce</code>. Объясните, почему <code>map</code> с async-колбэком запускает всё параллельно и почему <code>forEach</code> с <code>await</code> не работает.</p>`,
    hints: ['Цикл for...of с await внутри действительно приостанавливает итерацию — в отличие от forEach.',
      'Классическая функциональная запись — reduce, строящий цепочку then.',
      'Соберите результаты в массив в том же порядке, что и вход.',
      'Обсудите поведение при ошибке: прервать всё или продолжить и собрать ошибки.'],
    code: `// вариант 1: цикл — читаемый и обычно предпочтительный
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
}`,
    notes: `<p>Разбор: это вопрос-детектор понимания асинхронности.</p>
    <ul>
      <li>Асинхронный колбэк в <code>forEach</code> — самая частая ошибка на собесах: <code>forEach</code> не ждёт возвращённые промисы, функция завершится мгновенно, а ошибки станут unhandled rejection.</li>
      <li><code>map</code> с async-колбэком плюс <code>Promise.all</code> запускает всё параллельно. Это часто и нужно — но не когда есть лимит API или важен порядок побочных эффектов.</li>
      <li>Когда нужна последовательность: зависимость шага от предыдущего результата, лимиты внешнего сервиса, миграции и записи в БД.</li>
      <li>Промежуточный вариант — ограниченный параллелизм: назовите его как компромисс между скоростью и нагрузкой.</li>
      <li>Плюс балл: упомянуть <code>for await...of</code> для асинхронных итераторов и постраничной выборки.</li>
    </ul>` },

  { id: 'tx48',
    title: 'Свои Promise.allSettled, race и any',
    must: true,
    cat: 'Асинхронность',
    why: 'Полифилы промисов дают в Яндексе и Т-Банке',
    prompt: `<p>Реализуйте <code>myAllSettled</code>, <code>myRace</code> и <code>myAny</code> без использования одноимённых встроенных методов.</p>
    <p>Требования: работать с любым итерируемым, поддерживать не-промисы среди элементов, сохранять порядок результатов, <code>any</code> должен отклоняться с <code>AggregateError</code>, когда все промисы отклонены, и корректно вести себя на пустом входе.</p>`,
    hints: ['Оберните каждый элемент в Promise.resolve — тогда обычные значения тоже работают.',
      'Порядок результатов задаётся индексом в исходном массиве, а не порядком завершения.',
      'Нужен счётчик завершённых: только когда он дошёл до длины, резолвим общий промис.',
      'Крайние случаи: allSettled на пустом входе резолвится сразу, any сразу отклоняется, race висит вечно.'],
    code: `function myAllSettled(iterable) {
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
}`,
    notes: `<p>Разбор: этот набор реально дают в Яндексе и Т-Банке, часто именно <code>Promise.any</code>.</p>
    <ul>
      <li>Счётчик вместо проверки длины результата: массив с дырками имеет неверную длину, а <code>push</code> ломает порядок.</li>
      <li>Повторный вызов <code>resolve</code> безопасен — промис уже settled и игнорирует последующие вызовы. Скажите это вслух, это показывает понимание модели.</li>
      <li>Крайние случаи по спецификации: <code>all</code> и <code>allSettled</code> на пустом входе резолвятся немедленно, <code>any</code> отклоняется <code>AggregateError</code>, <code>race</code> зависает навсегда.</li>
      <li>Разница между ними: <code>all</code> падает на первой ошибке, <code>allSettled</code> ждёт всех, <code>any</code> ждёт первого успеха, <code>race</code> — первого любого результата.</li>
      <li>Ни один из них не отменяет оставшиеся операции — частый доп. вопрос.</li>
    </ul>` },

  { id: 'tx49',
    title: 'Батчинг вызовов за тик (dataloader)',
    must: false,
    cat: 'Асинхронность',
    why: 'Убирает N+1 запросов, реальная продовая техника',
    prompt: `<p>Реализуйте <code>createBatcher(batchFn)</code>: множество вызовов <code>load(id)</code>, сделанных за один тик, объединяются в один вызов <code>batchFn(ids)</code>, а каждому вызывающему возвращается свой результат.</p>
    <p>Требования: дедупликация одинаковых id внутри батча, ограничение размера батча, корректная передача ошибки всем ожидающим.</p>`,
    hints: ['Накапливайте запросы в массиве, а сброс планируйте через микротаск.',
      'Для каждого id храните resolve и reject; после ответа раздайте результаты по порядку id.',
      'Дедупликация: если id уже в текущем батче, верните тот же промис.',
      'batchFn должна возвращать массив результатов той же длины и в том же порядке, что и массив id.'],
    code: `function createBatcher(batchFn, options) {
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
// Promise.all([loadUser(1), loadUser(2), loadUser(1)]); // один запрос с ids [1, 2]`,
    notes: `<p>Разбор: задача проверяет понимание event loop и продуктовый опыт одновременно.</p>
    <ul>
      <li>Почему микротаск, а не <code>setTimeout</code>: микротаски выполняются до следующего рендера, поэтому батч собирается в том же тике и не добавляет задержки кадра.</li>
      <li>Контракт <code>batchFn</code> — самое хрупкое место: длина и порядок результатов должны совпадать с ids. Явная проверка спасает от плавающих багов.</li>
      <li>Дедупликация одинаковых id — то, ради чего технику и внедряют (проблема N+1 в списках).</li>
      <li>Скажите, что это принцип работы DataLoader из GraphQL-стека, и упомяните риски кеша: устаревшие данные и необходимость инвалидации.</li>
    </ul>` },

  { id: 'tx50',
    title: 'async/await через генераторы (мини-co)',
    must: false,
    cat: 'Асинхронность',
    why: 'Показывает, как устроен async под капотом',
    prompt: `<p>Реализуйте функцию <code>run(generatorFn)</code>, которая выполняет генератор, где <code>yield</code> возвращает промисы, — то есть воспроизводит поведение <code>async/await</code>.</p>
    <p>Требования: результат разрешённого промиса возвращается обратно в генератор через <code>next(value)</code>, ошибка пробрасывается внутрь через <code>throw(error)</code> и ловится обычным <code>try/catch</code>, функция возвращает промис с итоговым значением.</p>`,
    hints: ['Генератор приостанавливается на yield и возобновляется вызовом next со значением — это и есть механика await.',
      'Рекурсивный шаг: вызвать next, дождаться промиса, снова вызвать next с результатом.',
      'Ошибку промиса надо отдать внутрь генератора методом throw, чтобы сработал try/catch в теле.',
      'Обязательно оборачивайте вызовы next и throw в try/catch: синхронное исключение тоже нужно превратить в reject.'],
    code: `function run(generatorFn) {
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
// });`,
    notes: `<p>Разбор: задача на понимание, а не на память.</p>
    <ul>
      <li>Главная идея: <code>await</code> — это сахар над «приостановить генератор до разрешения промиса и вернуть значение обратно через <code>next</code>». Сформулируйте это одной фразой в начале.</li>
      <li>Метод <code>throw</code> у итератора — ключевой момент: именно он позволяет ловить асинхронные ошибки обычным <code>try/catch</code> внутри генератора.</li>
      <li>Три места, где нужен перехват: синхронное исключение при вызове <code>next</code>, отклонённый промис, исключение из <code>throw</code>.</li>
      <li>Скажите, что так работала библиотека co и что Babel компилирует <code>async/await</code> в генератор плюс похожий раннер (regenerator).</li>
      <li>Продолжение, которое любят: чем это отличается от redux-saga — там <code>yield</code> возвращает не промисы, а описания эффектов, отсюда тестируемость.</li>
    </ul>` },
];
