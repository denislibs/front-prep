const DECK_JS_EXTRA = [
  { id: 'jsx1',
    q: 'Опиши один полный «оборот» event loop в браузере: где именно в нём находится requestAnimationFrame относительно задач и микрозадач?',
    a: `<p>Один оборот выглядит так: взять <strong>одну</strong> макрозадачу из одной из task-очередей, выполнить её, затем полностью <strong>дренировать</strong> очередь микрозадач (включая микрозадачи, порождённые внутри неё). Дальше браузер решает, нужен ли ему кадр отрисовки прямо сейчас.</p>
    <p>Если кадр нужен — запускается шаг «update the rendering»: сначала resize/scroll события и IntersectionObserver, затем <strong>все callbacks requestAnimationFrame</strong>, затем ResizeObserver, затем style, layout, paint, composite. После каждого rAF-колбэка микрозадачи тоже дренируются.</p>
    <p>Ключевой вывод: rAF — это не макрозадача и не микрозадача, а отдельная фаза <strong>перед рендером</strong>. Отрисовка происходит между макрозадачами, но никогда посередине дренажа микрозадач. Поэтому setTimeout(fn, 0) может выполниться несколько раз без единой перерисовки, а rAF выполняется максимум раз в кадр и не выполняется вовсе на скрытой вкладке.</p>
    <p>Практический вывод: любые визуальные мутации DOM и чтение геометрии лучше делать внутри rAF, а тяжёлую логику — вне его, иначе кадр не успеет уложиться в свои ~16.7 мс.</p>`,
    code: `console.log('sync');
setTimeout(() => console.log('macro'), 0);
requestAnimationFrame(() => console.log('raf'));
Promise.resolve().then(() => console.log('micro'));
// sync, micro, затем raf и macro — их взаимный порядок
// зависит от того, был ли запланирован кадр; типично: raf ближе к рендеру,
// а macro может успеть раньше на «холодном» тике`,
    tip: 'Скажите вслух, что requestIdleCallback идёт после paint, а rAF — до, и что на фоновой вкладке rAF замораживается, а setTimeout только троттлится до 1 раза в секунду.' },

  { id: 'jsx2',
    q: 'Что такое microtask starvation и как безопасно разбивать длинную работу, не заморозив UI?',
    a: `<p>Микрозадачи дренируются <strong>до конца</strong>, а не по одной. Если микрозадача планирует новую микрозадачу, цикл никогда не выйдет к рендеру: вкладка живая, но не отвечает и не перерисовывается — это starvation. Рекурсивный <code>queueMicrotask</code> или бесконечная цепочка <code>.then</code> вешают страницу намертво.</p>
    <p>Значит, для yield-а обратно браузеру нужна <strong>макрозадача</strong>, а не микрозадача. Варианты по возрастанию качества: <code>setTimeout(fn, 0)</code> (есть clamping в 4 мс после 5 вложенных вызовов), <code>MessageChannel</code> (быстрее, без clamping), <code>scheduler.postTask</code> с приоритетом и <code>await scheduler.yield()</code> — они дают шедулеру право отдать кадр рендеру и пользовательскому вводу.</p>
    <p>Правильный паттерн — chunking по времени, а не по количеству элементов: обрабатываем пачку, смотрим на <code>performance.now()</code>, и как только съели бюджет (обычно 5 мс), отдаём управление. Так задача не превращается в long task и не убивает INP.</p>
    <p>Если работа реально тяжёлая и не требует DOM — её место в Worker, а не в chunking на главном потоке.</p>`,
    code: `async function processAll(items, work) {
  const BUDGET = 5;
  let start = performance.now();
  for (let i = 0; i < items.length; i++) {
    work(items[i]);
    if (performance.now() - start > BUDGET) {
      await (globalThis.scheduler && scheduler.yield
        ? scheduler.yield()
        : new Promise(r => setTimeout(r, 0)));
      start = performance.now();
    }
  }
}`,
    tip: 'Отдельные очки: упомянуть, что await внутри цикла сам по себе НЕ отдаёт управление рендеру, если промис резолвится синхронно — это всё ещё микрозадача.' },

  { id: 'jsx3',
    q: 'Что такое long task, как он связан с INP и где тут requestIdleCallback?',
    a: `<p>Long task — задача главного потока длиннее 50 мс. Пока она идёт, браузер не может обработать клик и не может нарисовать кадр, поэтому long tasks напрямую бьют по <strong>INP</strong> (Interaction to Next Paint) — метрике, которая измеряет время от взаимодействия до следующей отрисовки, включая input delay, processing и presentation delay.</p>
    <p><code>requestIdleCallback</code> запускается в остаток кадра <strong>после</strong> style/layout/paint и получает объект с <code>timeRemaining()</code>. Он хорош для неприоритетной работы: аналитика, префетч, прогрев кешей. Но у него нет гарантий: при загруженном потоке он может не вызваться долго, поэтому всегда задают <code>timeout</code>.</p>
    <p>Сильный ответ добавляет измерения: <code>PerformanceObserver</code> с типом <code>longtask</code> и <code>long-animation-frame</code> (LoAF) показывает не только длительность, но и виновный скрипт. Для оптимизации INP чаще всего помогает не мемоизация, а откладывание некритичной работы за первый paint после взаимодействия.</p>`,
    code: `new PerformanceObserver(list => {
  for (const e of list.getEntries()) {
    console.log('LoAF', e.duration, e.scripts && e.scripts.map(s => s.sourceURL));
  }
}).observe({ type: 'long-animation-frame', buffered: true });

requestIdleCallback(deadline => {
  while (deadline.timeRemaining() > 0 && queue.length) doOne(queue.pop());
}, { timeout: 2000 });`,
    tip: 'Назовите правило «сначала покажи результат, потом досчитывай»: обновить UI, дождаться paint через rAF + setTimeout, и уже потом делать тяжёлую работу — это самый дешёвый способ починить INP.' },

  { id: 'jsx4',
    q: 'Чем отличаются queueMicrotask, Promise.resolve().then, process.nextTick и MutationObserver как способы отложить код?',
    a: `<p>Все четыре планируют работу в микрозадачи, но по-разному. <code>queueMicrotask</code> — прямой доступ к очереди микрозадач без создания промиса: дешевле и, главное, исключение из него всплывает как обычная ошибка в <code>window.onerror</code>, а не теряется в отклонённом промисе.</p>
    <p><code>Promise.resolve().then(fn)</code> делает то же, но оборачивает результат в промис и глотает исключение в rejection. Плюс, если резолвить промисом, добавляются лишние тики (thenable раскручивается через дополнительные микрозадачи).</p>
    <p>В Node <code>process.nextTick</code> — <strong>отдельная</strong> очередь с приоритетом <strong>выше</strong> микрозадач промисов; она дренируется перед ними после каждой фазы. Рекурсивный nextTick голодит промисы и I/O, поэтому в прикладном коде его использовать не стоит.</p>
    <p><code>MutationObserver</code> тоже доставляет колбэки как микрозадачи, но батчит записи — раньше это был единственный кроссбраузерный способ получить микрозадачу, сейчас это исторический факт.</p>`,
    code: `process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('promise'));
queueMicrotask(() => console.log('qmt'));
// Node: nextTick, promise, qmt
// promise и qmt идут в одной очереди в порядке постановки`,
    tip: 'Скажите, что для «просто отложить на микрозадачу» правильный выбор — queueMicrotask, потому что он не превращает баг в unhandled rejection.' },

  { id: 'jsx5',
    q: 'Зачем нужны Symbol, если есть строковые ключи? И чем Symbol() отличается от Symbol.for()?',
    a: `<p>Symbol — примитив, гарантированно уникальный: два <code>Symbol('id')</code> никогда не равны. Это даёт ключи, которые не могут случайно столкнуться с чужими. Символьные свойства не попадают в <code>for...in</code>, <code>Object.keys</code>, <code>JSON.stringify</code> — они «полускрытые», их видно только через <code>Object.getOwnPropertySymbols</code> и <code>Reflect.ownKeys</code>.</p>
    <p>Типовой кейс — навесить метаданные на чужой объект: библиотека кладёт свой служебный ключ в объект пользователя и уверена, что ничего не сломает и что сериализация объекта не потащит мусор.</p>
    <p><code>Symbol.for('id')</code> работает через <strong>глобальный реестр символов</strong>, общий для всех realm-ов страницы (включая iframes и Workers в рамках одного агента). Один и тот же ключ всегда даёт один и тот же символ, а <code>Symbol.keyFor</code> возвращает строку обратно. Это способ договориться между независимыми копиями библиотеки.</p>
    <p>Важно: Symbol — не механизм приватности. Данные достижимы через рефлексию, для настоящей приватности есть <code>#</code>-поля и WeakMap.</p>`,
    code: `const meta = Symbol('meta');
const user = { name: 'Ann', [meta]: { dirty: true } };
JSON.stringify(user); // '{"name":"Ann"}'
Object.keys(user);    // ['name']
Object.getOwnPropertySymbols(user); // [Symbol(meta)]

Symbol('a') === Symbol('a');         // false
Symbol.for('a') === Symbol.for('a'); // true`,
    tip: 'Упомяните, что Symbol нельзя неявно привести к строке — String(sym) работает, а sym + \'\' бросает TypeError; это спасает от случайной конкатенации.' },

  { id: 'jsx6',
    q: 'Какие well-known symbols ты реально применял и что они меняют в поведении объекта?',
    a: `<p>Well-known symbols — точки расширения протоколов языка. <code>Symbol.iterator</code> делает объект итерируемым для <code>for...of</code>, spread и деструктуризации; <code>Symbol.asyncIterator</code> — то же для <code>for await</code>, и на нём строятся стримы и пагинация.</p>
    <p><code>Symbol.toPrimitive</code> перехватывает приведение к примитиву, <code>Symbol.toStringTag</code> меняет вывод <code>Object.prototype.toString</code>, <code>Symbol.hasInstance</code> переопределяет <code>instanceof</code>.</p>
    <p>Есть и менее очевидные: <code>Symbol.species</code> задаёт, какой конструктор используют методы вроде <code>map</code> и <code>slice</code> у наследников; <code>Symbol.split</code>/<code>match</code>/<code>replace</code> позволяют подсунуть свой объект туда, где ждут RegExp; <code>Symbol.unscopables</code> — историческая заплатка для <code>with</code>.</p>
    <p>На практике из них в проде живут <code>iterator</code>, <code>asyncIterator</code> и <code>toStringTag</code>; остальные — инструмент авторов библиотек, и злоупотребление ими делает код нечитаемым, потому что меняет базовые операции языка на расстоянии.</p>`,
    code: `class Range {
  constructor(from, to) { this.from = from; this.to = to; }
  *[Symbol.iterator]() { for (let i = this.from; i <= this.to; i++) yield i; }
  get [Symbol.toStringTag]() { return 'Range'; }
}
[...new Range(1, 4)];                       // [1,2,3,4]
Object.prototype.toString.call(new Range(1, 2)); // '[object Range]'`,
    tip: 'Хороший ответ заканчивается предостережением: переопределять Symbol.hasInstance или Symbol.species в продуктовом коде — почти всегда плохая идея, это ломает ожидания читателя.' },

  { id: 'jsx7',
    q: 'Как объект приводится к примитиву? Расскажи про Symbol.toPrimitive, valueOf и toString и про hint.',
    a: `<p>Алгоритм ToPrimitive получает <strong>hint</strong>: <code>'number'</code>, <code>'string'</code> или <code>'default'</code>. Hint <code>string</code> — при шаблонных литералах, <code>String(obj)</code>, ключе объекта; <code>number</code> — при унарном плюсе, арифметике кроме бинарного <code>+</code>, сравнениях <code>&lt;</code>/<code>&gt;</code>; <code>default</code> — при бинарном <code>+</code> и при <code>==</code> с примитивом.</p>
    <p>Сначала ищется метод <code>Symbol.toPrimitive</code> — если он есть, вызывается он и обязан вернуть примитив, иначе TypeError. Если его нет, для hint <code>string</code> порядок <code>toString</code> → <code>valueOf</code>, для <code>number</code> и <code>default</code> — <code>valueOf</code> → <code>toString</code>. Берётся первый результат-примитив.</p>
    <p>Отсюда классика: <code>[] + []</code> даёт пустую строку, <code>[] + {}</code> даёт <code>'[object Object]'</code>, а <code>{} + []</code> в консоли даёт 0, потому что фигурные скобки парсятся как блок. И <code>new Date()</code> — единственный встроенный объект с hint-зависимым поведением: при <code>default</code> он ведёт себя как строка.</p>
    <p>Практический вывод: если делаете value-object (Money, Duration), реализуйте <code>Symbol.toPrimitive</code> явно — это документирует намерение и убирает неоднозначность.</p>`,
    code: `const money = {
  amount: 100, currency: 'USD',
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return this.amount;
    if (hint === 'string') return this.amount + ' ' + this.currency;
    return this.amount + ' ' + this.currency;
  }
};
+money;         // 100
String(money);  // '100 USD'
money + '';     // '100 USD'  (hint default)`,
    tip: 'Назовите отдельно, что у Date hint default ведёт себя как string — поэтому date1 + date2 склеивает строки, а date1 - date2 даёт миллисекунды.' },

  { id: 'jsx8',
    q: 'Разбери нетривиальные случаи приведения типов: почему NaN появляется там, где не ждали, и как ведут себя сравнения.',
    a: `<p>Бинарный <code>+</code> уникален: если после ToPrimitive хоть один операнд строка — идёт конкатенация, иначе ToNumber. Все остальные арифметические операторы всегда приводят к числу, поэтому <code>'5' * '2'</code> это 10, а <code>'5' + 2</code> это '52'.</p>
    <p>Реляционные операторы (<code>&lt;</code>, <code>&gt;</code>) сравнивают строки лексикографически по code unit, если <strong>оба</strong> операнда строки, иначе приводят к числам. Отсюда <code>'10' &lt; '9'</code> это true, а <code>'10' &lt; 9</code> это false.</p>
    <p>Ловушки, которые любят на собесе: <code>null &gt;= 0</code> это true, но <code>null &gt; 0</code> и <code>null == 0</code> оба false — потому что <code>==</code> для null/undefined работает по спецотдельному правилу, а <code>&gt;=</code> идёт через числа. <code>NaN</code> не равен ничему, включая себя. <code>ToNumber</code> от пустой строки и от пробелов даёт 0, а от <code>[]</code> тоже 0, потому что <code>[].toString()</code> это пустая строка.</p>
    <p>Правильный вывод: не «выучить таблицу», а не полагаться на неявные приведения — явные <code>Number()</code>, <code>String()</code>, <code>Boolean()</code> и <code>===</code> убирают весь класс проблем.</p>`,
    code: `[] + [];        // ''
[] + {};        // '[object Object]'
[1,2] + [3];    // '1,23'
null >= 0;      // true
null > 0;       // false
null == 0;      // false
'10' < '9';     // true
'10' < 9;       // false
[] == false;    // true  ([] -> '' -> 0, false -> 0)`,
    tip: 'Если попросят объяснить [] == false, разложите по шагам ToPrimitive и ToNumber — важен алгоритм, а не заученный ответ.' },

  { id: 'jsx9',
    q: 'Что такое Proxy, какие ловушки бывают и в каких реальных задачах ты его применял?',
    a: `<p>Proxy оборачивает target и перехватывает базовые операции через traps: <code>get</code>, <code>set</code>, <code>has</code>, <code>deleteProperty</code>, <code>ownKeys</code>, <code>getOwnPropertyDescriptor</code>, <code>defineProperty</code>, <code>apply</code>, <code>construct</code>, <code>getPrototypeOf</code> и другие — всего 13.</p>
    <p>Реальные кейсы: реактивность (Vue 3 отслеживает чтение/запись именно так), негативные индексы и «умные» коллекции, ленивые API-клиенты, где <code>api.users.list()</code> собирает URL из цепочки get-ов, валидация на запись, защита от чтения несуществующих ключей в конфиге, мокинг и трассировка в тестах, revocable-ссылки для отзыва доступа при выгрузке модуля.</p>
    <p>Главное отличие от <code>defineProperty</code>: Proxy перехватывает и <strong>новые</strong> ключи, и <code>delete</code>, и <code>in</code>, и работает с Map/Set/массивами без ручного обхода. Цена — накладные расходы на каждой операции (обычно в разы медленнее прямого доступа) и невозможность оптимизации в JIT, поэтому в горячих циклах Proxy не место.</p>
    <p>И ещё: Proxy обязан соблюдать <strong>инварианты</strong> — например, нельзя вернуть из get значение, отличное от non-writable non-configurable свойства target; иначе TypeError.</p>`,
    code: `function safeConfig(target) {
  return new Proxy(target, {
    get(t, key, receiver) {
      if (typeof key === 'string' && !(key in t)) {
        throw new Error('Unknown config key: ' + key);
      }
      return Reflect.get(t, key, receiver);
    }
  });
}
const cfg = safeConfig({ apiUrl: '/api' });
cfg.apiUrl;  // '/api'
cfg.apiURL;  // Error: Unknown config key: apiURL`,
    tip: 'Сильный сигнал — назвать конкретную цену: Proxy не «медленный в теории», а даёт мегаморфный доступ и мешает инлайн-кешам, поэтому его оборачивают вокруг границ, а не вокруг горячих данных.' },

  { id: 'jsx10',
    q: 'Зачем нужен Reflect, если есть Object.* и обычные операторы?',
    a: `<p>Reflect даёт функциональную форму всех внутренних операций объекта, ровно один к одному с ловушками Proxy. Это делает его естественным «дефолтным поведением» внутри traps: <code>Reflect.get(t, key, receiver)</code> вместо <code>t[key]</code>.</p>
    <p>Три практических отличия. Первое — <strong>receiver</strong>: только Reflect позволяет передать правильный <code>this</code> для геттеров на прототипе, без него прокси ломает наследование accessor-ов. Второе — <strong>возврат boolean вместо исключения</strong>: <code>Reflect.defineProperty</code> и <code>Reflect.set</code> возвращают false, а <code>Object.defineProperty</code> бросает; это удобнее для условной логики. Третье — <code>Reflect.ownKeys</code> возвращает и строковые, и символьные ключи, включая неперечисляемые, чего не делает ни один Object-метод в одиночку.</p>
    <p>Плюс <code>Reflect.construct(Target, args, newTarget)</code> позволяет вызвать конструктор с подменённым <code>new.target</code> — это единственный способ корректно наследоваться от встроенных типов в транспилированном коде.</p>`,
    code: `const handler = {
  get(target, key, receiver) {
    // правильно: геттер на прототипе получит receiver как this
    return Reflect.get(target, key, receiver);
  },
  set(target, key, value, receiver) {
    if (typeof value !== 'number') return false; // -> TypeError в strict mode
    return Reflect.set(target, key, value, receiver);
  }
};`,
    tip: 'Ключевая фраза для интервьюера: «Reflect существует, чтобы прокси могли делегировать в дефолт, не потеряв receiver» — это отличает того, кто читал спеку, от того, кто читал туториал.' },

  { id: 'jsx11',
    q: 'Какие подводные камни у Proxy? Что он ломает?',
    a: `<p>Первое — <strong>приватные поля</strong>. Прокси не является инстансом класса, поэтому вызов метода, читающего <code>#field</code>, через прокси бросает TypeError: внутри метода <code>this</code> — это прокси, а бренда у него нет. Лечится привязкой методов к target в get-ловушке.</p>
    <p>Второе — <strong>внутренние слоты</strong>. Map, Set, Date, TypedArray хранят данные в слотах, а не в свойствах, поэтому <code>new Proxy(new Map(), {}).get(k)</code> падает: <code>this</code> внутри метода — прокси без слота. Тот же фикс через <code>bind(target)</code>.</p>
    <p>Третье — <strong>идентичность</strong>: <code>proxy !== target</code>, поэтому WeakMap-кеши, Set-ы, сравнения по ссылке и React-мемоизация могут вести себя неожиданно, если в систему попадают обе ссылки.</p>
    <p>Четвёртое — <strong>инварианты</strong>: на non-configurable свойствах прокси обязан отдавать реальные значения, а <code>ownKeys</code> обязан включать все non-configurable ключи; нарушение — TypeError в рантайме, часто далеко от места ошибки. И пятое: traps не срабатывают на операциях, которые не проходят через [[Get]]/[[Set]], например на прямом чтении внутренних слотов.</p>`,
    code: `class Counter {
  #n = 0;
  inc() { return ++this.#n; }
}
const p = new Proxy(new Counter(), {});
// p.inc(); // TypeError: Cannot read private member

const fixed = new Proxy(new Counter(), {
  get(t, k, r) {
    const v = Reflect.get(t, k, r);
    return typeof v === 'function' ? v.bind(t) : v;
  }
});
fixed.inc(); // 1`,
    tip: 'Упомяните Proxy.revocable как способ гарантированно оборвать доступ к объекту (плагины, sandbox) — после revoke любая операция бросает TypeError.' },

  { id: 'jsx12',
    q: 'Что такое дескрипторы свойств? Разбери writable, enumerable, configurable и что происходит при их сочетаниях.',
    a: `<p>Каждое свойство описывается дескриптором: либо data-дескриптор (<code>value</code>, <code>writable</code>), либо accessor-дескриптор (<code>get</code>, <code>set</code>). Общие для обоих — <code>enumerable</code> и <code>configurable</code>.</p>
    <p><code>writable: false</code> запрещает запись значения (в strict mode — TypeError, в sloppy — тихо игнорируется). <code>enumerable: false</code> убирает свойство из <code>for...in</code>, <code>Object.keys</code>, spread и <code>JSON.stringify</code>, но оно остаётся доступным по имени и видно в <code>getOwnPropertyNames</code>. <code>configurable: false</code> запрещает удаление и повторное переопределение дескриптора — это необратимо.</p>
    <p>Важные нюансы: свойства, созданные через <code>=</code> и литерал объекта, по умолчанию имеют все три флага <code>true</code>, а созданные через <code>Object.defineProperty</code> — все <code>false</code>. Методы класса и класс-поля не enumerable, поэтому не копируются spread-ом. При <code>configurable: false</code> всё же разрешён один переход: <code>writable</code> можно поменять с true на false, но не обратно.</p>
    <p>Практика: <code>Object.getOwnPropertyDescriptors</code> + <code>Object.create</code> — единственный корректный способ скопировать объект вместе с геттерами; обычный spread их <strong>вычислит</strong> и превратит в обычные значения.</p>`,
    code: `const o = {};
Object.defineProperty(o, 'id', { value: 1 });
Object.getOwnPropertyDescriptor(o, 'id');
// { value: 1, writable: false, enumerable: false, configurable: false }

const src = { get now() { return Date.now(); } };
const bad = { ...src };  // now — застывшее число
const good = Object.create(
  Object.getPrototypeOf(src),
  Object.getOwnPropertyDescriptors(src)  // геттер сохранён
);`,
    tip: 'Фраза «spread копирует значения, а не дескрипторы» — короткий и очень убедительный ответ на вопрос про копирование объектов с геттерами.' },

  { id: 'jsx13',
    q: 'Когда использовать геттеры и сеттеры, а когда обычные методы? Чем accessor в классе отличается от defineProperty?',
    a: `<p>Геттер уместен, когда значение — <strong>производное и дешёвое</strong>: <code>fullName</code>, <code>isEmpty</code>, <code>size</code>. Если вычисление дорогое или имеет побочные эффекты (сетевой запрос, мутация), нужен метод: вызывающий должен видеть скобки и понимать, что платит цену.</p>
    <p>Accessor в классе живёт на <strong>прототипе</strong> и не enumerable, а <code>Object.defineProperty</code> на инстансе создаёт собственное свойство. Разница видима: прототипный геттер не попадёт в spread и в <code>Object.keys</code> инстанса, а собственный — попадёт, если явно указать enumerable.</p>
    <p>Типовой приём — ленивая инициализация: геттер при первом обращении подменяет сам себя обычным свойством через <code>defineProperty</code>, и дальше доступ идёт без вызова функции.</p>
    <p>Подводные камни: геттер без сеттера при присваивании молча ничего не делает в sloppy mode и бросает TypeError в strict; рекурсия <code>get x(){ return this.x }</code> даёт stack overflow; и accessor-ы мешают JIT-оптимизациям, если их много в горячем пути.</p>`,
    code: `const config = {
  get parsed() {
    const value = JSON.parse(this.raw);
    Object.defineProperty(this, 'parsed', { value, configurable: true });
    return value;
  },
  raw: '{"a":1}'
};
config.parsed; // считается один раз, дальше — обычное свойство`,
    tip: 'Правило, которое хорошо звучит: «геттер обещает дешевизну и отсутствие сюрпризов; если обещание нарушается — делайте метод».' },

  { id: 'jsx14',
    q: 'Что произойдёт, если геттер объявлен на прототипе, а мы присваиваем свойство инстансу?',
    a: `<p>Присваивание идёт по алгоритму [[Set]], который <strong>ищет свойство вверх по цепочке прототипов</strong>. Если находит accessor — вызывается его сеттер с <code>this</code> равным инстансу. Если сеттера нет (только геттер) — присваивание проваливается: тихо в sloppy mode, с TypeError в strict (а значит, и в модулях, и в классах).</p>
    <p>Если на прототипе data-свойство с <code>writable: false</code> — точно так же: shadowing не произойдёт, будет TypeError. А вот если свойство writable — создастся собственное свойство на инстансе, и оно «затенит» прототипное.</p>
    <p>Это частая причина багов «почему поле не сохраняется»: класс объявил только <code>get value()</code>, а код в другом месте делает <code>obj.value = 5</code>. Обойти можно через <code>Object.defineProperty(obj, 'value', {...})</code> — defineProperty не смотрит на прототип, он создаёт собственное свойство напрямую.</p>
    <p>Отсюда же общее правило: <code>Object.assign</code> и spread ведут себя по-разному именно потому, что assign использует [[Set]] (триггерит сеттеры и падает на readonly), а spread — [[DefineOwnProperty]].</p>`,
    code: `class A { get value() { return 1; } }
const a = new A();
a.value = 5;              // TypeError в strict mode (класс всегда strict)

Object.defineProperty(a, 'value', { value: 5, writable: true });
a.value;                  // 5 — собственное свойство затенило геттер

const target = Object.freeze({ x: 1 });
// Object.assign(target, { x: 2 }); // TypeError
({ ...target, x: 2 });              // ок — новый объект`,
    tip: 'Разница assign vs spread через [[Set]] против [[DefineOwnProperty]] — один из лучших способов показать, что вы читаете спеку, а не только MDN.' },

  { id: 'jsx15',
    q: 'Object.freeze, Object.seal, Object.preventExtensions — в чём разница и что freeze НЕ делает?',
    a: `<p><code>preventExtensions</code> запрещает добавлять новые свойства, но существующие можно менять и удалять. <code>seal</code> — это preventExtensions плюс <code>configurable: false</code> на всех свойствах: удалять и переопределять нельзя, менять значения можно. <code>freeze</code> — seal плюс <code>writable: false</code>: объект полностью неизменяем на первом уровне.</p>
    <p>Чего freeze <strong>не</strong> делает: он <strong>поверхностный</strong>, вложенные объекты остаются изменяемыми; он не замораживает прототип; он не мешает работать сеттерам (accessor-свойства продолжают вызываться, потому что writable к ним не применяется); и он не работает на элементах в внутренних слотах — <code>Object.freeze(new Map())</code> не мешает <code>map.set()</code>.</p>
    <p>Ещё нюанс: тихая неудача в sloppy mode превращается в TypeError в strict — то есть в модулях и классах замороженный объект «громкий». Проверка — <code>Object.isFrozen</code>.</p>
    <p>Практически freeze хорош для конфигов и констант в dev-режиме как ассерт, но как основа иммутабельности в проде он медленный и хрупкий: лучше не мутировать по соглашению (плюс тип readonly в TS) или использовать persistent-структуры.</p>`,
    code: `function deepFreeze(obj) {
  for (const key of Reflect.ownKeys(obj)) {
    const v = obj[key];
    if (v && (typeof v === 'object' || typeof v === 'function')) deepFreeze(v);
  }
  return Object.freeze(obj);
}
const m = Object.freeze(new Map());
m.set('a', 1);      // работает! данные во внутреннем слоте
m.size;             // 1`,
    tip: 'Замечание про производительность: замороженные объекты в V8 получают отдельную форму, и запись в них — медленный путь; массово фризить данные в горячем коде не стоит.' },

  { id: 'jsx16',
    q: 'Как ты обеспечиваешь иммутабельность данных на практике в большом приложении?',
    a: `<p>Первый уровень — <strong>соглашение и типы</strong>: <code>readonly</code>/<code>Readonly&lt;T&gt;</code> в TypeScript ловит мутации на компиляции и стоит ноль в рантайме. Это основной инструмент, всё остальное — дополнение.</p>
    <p>Второй — <strong>копирующие операции вместо мутирующих</strong>: spread, <code>toSorted</code>, <code>toSpliced</code>, <code>toReversed</code>, <code>with</code> вместо <code>sort</code>, <code>splice</code>, <code>reverse</code> и присваивания по индексу. Это ES2023 и оно уже везде.</p>
    <p>Третий — <strong>структурное разделение</strong>: Immer с его Proxy-драфтом даёт мутабельный синтаксис и иммутабельный результат, переиспользуя неизменённые ветки; Immutable.js даёт настоящие persistent-структуры, но за цену чужого API. На больших деревьях structural sharing критичен: наивный deep copy на каждое изменение убивает и память, и GC.</p>
    <p>Что <strong>не</strong> работает как стратегия: <code>Object.freeze</code> всего стора (медленно и поверхностно) и <code>structuredClone</code> на каждое обновление (копирует всё дерево). Ну и напомню: Record &amp; Tuple, который обещал глубоко иммутабельные примитивы, был снят с рассмотрения TC39, так что ждать его не стоит.</p>`,
    code: `// было
state.items.sort((a, b) => a.n - b.n);
state.items[0].done = true;

// стало
const next = {
  ...state,
  items: state.items
    .toSorted((a, b) => a.n - b.n)
    .with(0, { ...state.items[0], done: true })
};`,
    tip: 'Отметьте, что дешёвое сравнение по ссылке (===) — главная практическая выгода иммутабельности: на нём стоит вся мемоизация в React и селекторах.' },

  { id: 'jsx17',
    q: 'В каком порядке инициализируются поля и выполняется конструктор при наследовании классов? Где здесь ловушка с super?',
    a: `<p>Порядок такой: в производном классе <code>this</code> не существует до вызова <code>super()</code> — обращение к нему до этого даёт ReferenceError. <code>super()</code> запускает конструктор базового класса, и <strong>внутри него</strong> инициализируются поля базового класса. Только после возврата из <code>super()</code> инициализируются поля производного класса, и потом идёт остальной код конструктора.</p>
    <p>Отсюда классическая ловушка: если базовый конструктор вызывает переопределённый метод, который читает поле производного класса, поле ещё <code>undefined</code> — оно инициализируется позже. Это ровно та причина, по которой шаблонный метод в конструкторе — антипаттерн.</p>
    <p>Вторая ловушка: поля производного класса <strong>перетирают</strong> одноимённые accessor-ы базового, потому что поле создаётся через [[DefineOwnProperty]] на инстансе, а не через [[Set]]. Метод же, объявленный как поле-стрелка, живёт на инстансе, а не на прототипе, и потому не виден через <code>super</code> и создаётся заново для каждого объекта.</p>
    <p>И третья: <code>super.method()</code> резолвится через [[HomeObject]] метода, а не через <code>this</code>, поэтому «вытащенный» метод теряет доступ к super.</p>`,
    code: `class Base {
  constructor() { this.init(); }
  init() { console.log('base init'); }
}
class Child extends Base {
  name = 'child';
  init() { console.log('child init, name =', this.name); }
}
new Child();
// 'child init, name = undefined'  — поле name ещё не создано`,
    tip: 'Скажите, что именно поэтому в конструкторе нельзя вызывать перегружаемые методы, и что React-классы решали это через componentDidMount, а не через конструктор.' },

  { id: 'jsx18',
    q: 'Чем приватные поля (#) отличаются от соглашения с подчёркиванием, Symbol и WeakMap? Как проверить наличие приватного поля?',
    a: `<p><code>#field</code> — единственная <strong>настоящая</strong> приватность в языке. Это не свойство: имя не является строкой, поле не видно ни в <code>Object.keys</code>, ни в <code>getOwnPropertySymbols</code>, ни в <code>Reflect.ownKeys</code>, ни в отладочной сериализации. Доступ вне лексического тела класса — <strong>синтаксическая</strong> ошибка, а не рантайм-проверка.</p>
    <p>Приватные поля не наследуются: подкласс не видит <code>#field</code> родителя. Динамический доступ по имени невозможен принципиально — <code>this['#x']</code> обращается к обычному свойству с таким именем.</p>
    <p>Обращение к <code>#field</code> у объекта, у которого его нет, бросает TypeError — это «brand check». Чтобы проверить безопасно, есть <code>#field in obj</code> — эргономичная проверка бренда, стандартный способ реализовать надёжный <code>isInstance</code>, устойчивый к подделкам и к кросс-realm-проблемам <code>instanceof</code>.</p>
    <p>Сравнение: подчёркивание — только соглашение; Symbol скрывает от перечисления, но достижим рефлексией; WeakMap даёт настоящую приватность, но громоздок и был исторической заменой <code>#</code>. Ограничение <code>#</code> — конфликт с Proxy (прокси не имеет бренда).</p>`,
    code: `class Money {
  #amount;
  constructor(a) { this.#amount = a; }
  static isMoney(x) { return #amount in x; }   // brand check без исключений
  add(other) { return new Money(this.#amount + other.#amount); }
}
Money.isMoney(new Money(1)); // true
Money.isMoney({});           // false`,
    tip: 'Упомяните, что #x in obj — надёжнее instanceof при работе с несколькими realm (iframe, worker) и при подмене Symbol.hasInstance.' },

  { id: 'jsx19',
    q: 'Зачем нужны статические блоки инициализации в классах и как они соотносятся со статическими приватными полями?',
    a: `<p>Статический блок <code>static { ... }</code> — это код, выполняющийся один раз при <strong>вычислении класса</strong>, в лексической области видимости тела класса. Он решает две задачи, которые раньше требовали кода вне класса.</p>
    <p>Первая — <strong>сложная инициализация статики</strong>: несколько взаимозависимых полей, try/catch, циклы, условная логика. Статический инициализатор поля — это одно выражение, а блок — полноценный код.</p>
    <p>Вторая — <strong>контролируемый доступ к приватным полям снаружи</strong>: внутри статического блока доступны <code>#</code>-поля класса, поэтому там можно записать в модульную переменную функцию-«ключик», дающую доверенному коду доступ к приватному состоянию. Это официальный паттерн из proposal.</p>
    <p>Порядок: блоки и статические поля выполняются сверху вниз в порядке объявления, статика базового класса — раньше статики производного. Внутри блока <code>this</code> — это сам конструктор класса, а <code>super.prop</code> ведёт к статике родителя; <code>super()</code> там запрещён.</p>`,
    code: `let readSecret;
class Vault {
  #secret;
  constructor(s) { this.#secret = s; }
  static #initialized;
  static {
    readSecret = (v) => v.#secret;      // доверенный доступ наружу
    this.#initialized = Date.now();
  }
}
readSecret(new Vault('x')); // 'x'`,
    tip: 'Хорошая ремарка: до статических блоков всё это писали как Class.field = ... сразу после класса, что ломало tree-shaking из-за side effect вне класса.' },

  { id: 'jsx20',
    q: 'Что нужно знать при наследовании от встроенных типов — Array, Error, Map? Причём тут Symbol.species?',
    a: `<p>Наследование от Array работает: <code>length</code> и индексы ведут себя нативно, потому что <code>super()</code> создаёт экзотический array-объект. Но методы вроде <code>map</code>, <code>filter</code>, <code>slice</code> возвращают <strong>ваш</strong> подкласс, а не обычный массив — это поведение управляется <code>Symbol.species</code>, и его переопределяют, если хочется получать обычные массивы.</p>
    <p>С Error главная боль — транспиляция: при таргете ES5 <code>class MyError extends Error</code> ломает <code>instanceof</code>, потому что вызов Error через <code>call</code> возвращает новый объект и прототип теряется. Лечится <code>Object.setPrototypeOf(this, new.target.prototype)</code> в конструкторе. В нативных классах этого не нужно.</p>
    <p>Ещё для Error стоит явно ставить <code>this.name = 'MyError'</code> (иначе в stack будет 'Error') и в V8 звать <code>Error.captureStackTrace(this, MyError)</code>, чтобы убрать конструктор из стека.</p>
    <p>С Map/Set проблема другая: их методы требуют внутренний слот, поэтому подкласс работает, а Proxy или объект, скопированный через <code>Object.create(Map.prototype)</code>, — нет.</p>`,
    code: `class Collection extends Array {
  static get [Symbol.species]() { return Array; } // map вернёт обычный Array
}
const c = new Collection(1, 2, 3);
c.map(x => x) instanceof Collection; // false — благодаря species

class HttpError extends Error {
  constructor(status, options) {
    super('HTTP ' + status, options);
    this.name = 'HttpError';
    this.status = status;
  }
}`,
    tip: 'Скажите, что species в ES2025 постепенно вычищают из спеки как источник сложности — знать надо, применять почти никогда не стоит.' },

  { id: 'jsx21',
    q: 'Как теряется this в классах и какой способ его сохранить лучше: bind в конструкторе, поле-стрелка или что-то ещё?',
    a: `<p>Методы класса живут на прототипе, и <code>this</code> у них определяется <strong>способом вызова</strong>. Как только метод передаётся как значение — в <code>addEventListener</code>, <code>setTimeout</code>, <code>arr.map</code>, — связь с объектом теряется, а поскольку класс всегда strict, <code>this</code> становится <code>undefined</code> и падает TypeError, а не тихо берёт window.</p>
    <p>Варианты. <code>this.m = this.m.bind(this)</code> в конструкторе: метод остаётся на прототипе (наследуемый, тестируемый, доступный через super), а на инстансе появляется связанная копия. Поле-стрелка <code>m = () =&gt; {}</code>: короче, но метод переезжает на <strong>инстанс</strong>, значит его нельзя вызвать через <code>super.m()</code>, нельзя переопределить в подклассе привычным образом и он занимает память на каждый объект.</p>
    <p>Часто лучший вариант — вообще не связывать: передавать стрелку на месте вызова (<code>() =&gt; this.m()</code>) или использовать <code>handleEvent</code>-интерфейс, когда в addEventListener передаётся сам объект — тогда <code>this</code> внутри правильный, и снимать слушатель можно без хранения ссылки на bound-функцию.</p>`,
    code: `class Widget {
  constructor(el) { this.el = el; this.count = 0; el.addEventListener('click', this); }
  handleEvent(e) { if (e.type === 'click') this.onClick(e); }
  onClick() { this.count++; }
  destroy() { this.el.removeEventListener('click', this); } // не нужен bound-ref
}`,
    tip: 'Аргумент про removeEventListener — самый практичный: bind создаёт новую функцию каждый раз, поэтому removeEventListener(this.m.bind(this)) не снимает слушатель, и это реальный источник утечек.' },

  { id: 'jsx22',
    q: 'Что такое new.target и где он реально нужен?',
    a: `<p><code>new.target</code> внутри функции или конструктора — это ссылка на конструктор, вызванный через <code>new</code>; при обычном вызове это <code>undefined</code>. При наследовании в базовом конструкторе <code>new.target</code> указывает на <strong>самый производный</strong> класс, а не на базовый.</p>
    <p>Практические применения: запретить вызов фабрики без new или, наоборот, сделать конструктор устойчивым к забытому new; сделать абстрактный класс (<code>if (new.target === Shape) throw</code>); в транспилированном коде восстановить прототип для наследников Error; определить, инстанцируется ли подкласс, чтобы выбрать правильный конструктор в <code>Symbol.species</code>-подобной логике.</p>
    <p>С <code>Reflect.construct(T, args, newTarget)</code> его можно подменить явно — так реализуют фабрики, которые создают объект с прототипом другого класса, не наследуя его конструктор.</p>`,
    code: `class Shape {
  constructor() {
    if (new.target === Shape) throw new TypeError('Shape is abstract');
    this.kind = new.target.name;
  }
}
class Circle extends Shape {}
new Circle().kind;  // 'Circle'
// new Shape();     // TypeError`,
    tip: 'Уточните, что стрелочные функции не имеют своего new.target — как и this, они берут его из внешней области.' },

  { id: 'jsx23',
    q: 'Расскажи про тонкости typeof: какие результаты он даёт и какие из них — исторические баги?',
    a: `<p><code>typeof</code> возвращает восемь строк: <code>'undefined'</code>, <code>'boolean'</code>, <code>'number'</code>, <code>'string'</code>, <code>'bigint'</code>, <code>'symbol'</code>, <code>'function'</code>, <code>'object'</code>. Он единственный оператор, который <strong>не бросает</strong> ReferenceError на необъявленной переменной — кроме случая TDZ: для <code>let</code>/<code>const</code> до инициализации он всё-таки бросит.</p>
    <p><code>typeof null === 'object'</code> — баг первой реализации (тег типа объектов был 0, и у null тоже), который нельзя починить из-за обратной совместимости; предложение вернуть <code>'null'</code> было отклонено.</p>
    <p><code>typeof function</code> даёт <code>'function'</code>, хотя функция — объект: это отдельная ветка в спецификации для всего, что имеет [[Call]]. Поэтому классы тоже дают <code>'function'</code>.</p>
    <p>Ещё две редкости: <code>typeof document.all</code> даёт <code>'undefined'</code> — легально прописанное в спеке исключение ради старых сайтов (это же единственный falsy-объект). И в кросс-realm-коде <code>typeof</code> надёжен, в отличие от <code>instanceof</code>.</p>`,
    code: `typeof undefined;        // 'undefined'
typeof null;             // 'object'  — исторический баг
typeof NaN;              // 'number'
typeof class {};         // 'function'
typeof Symbol();         // 'symbol'
typeof 10n;              // 'bigint'
typeof notDeclared;      // 'undefined' — не бросает
// typeof letBeforeInit; // ReferenceError — TDZ сильнее typeof`,
    tip: 'Фраза «typeof безопасен для undeclared, но не для TDZ» показывает, что вы понимаете, что TDZ — это не «переменной нет», а «переменная есть, но неинициализирована».' },

  { id: 'jsx24',
    q: 'Как работает instanceof на самом деле и в каких случаях он врёт? Что делает Symbol.hasInstance?',
    a: `<p><code>obj instanceof C</code> сначала ищет у <code>C</code> метод <code>Symbol.hasInstance</code> и, если он есть, вызывает его. Иначе идёт дефолт: берётся <code>C.prototype</code> и проверяется, встречается ли он в цепочке прототипов <code>obj</code> через [[GetPrototypeOf]]. То есть instanceof проверяет <strong>прототип</strong>, а не «происхождение от конструктора».</p>
    <p>Отсюда три случая, где он врёт. Первый — <strong>разные realm</strong>: массив из iframe или из <code>vm</code> в Node не пройдёт <code>instanceof Array</code>, потому что у него другой <code>Array.prototype</code>; здесь спасает <code>Array.isArray</code> и <code>Object.prototype.toString</code>. Второй — <strong>подмена прототипа</strong>: <code>Object.setPrototypeOf</code> или переприсваивание <code>C.prototype</code> меняет результат задним числом. Третий — <strong>транспиляция</strong> наследников Error/Array в ES5.</p>
    <p><code>Symbol.hasInstance</code> позволяет сделать структурную проверку («утиную типизацию») с синтаксисом instanceof. Это удобно, но опасно: читатель кода ожидает от instanceof проверку прототипа, а получает произвольную логику.</p>
    <p>Надёжная альтернатива для своих классов — brand check через <code>#field in obj</code>.</p>`,
    code: `class Iterable {
  static [Symbol.hasInstance](x) {
    return x != null && typeof x[Symbol.iterator] === 'function';
  }
}
[] instanceof Iterable;      // true
'abc' instanceof Iterable;   // true
({}) instanceof Iterable;    // false`,
    tip: 'Назовите конкретный кейс: Array.isArray существует именно потому, что instanceof Array ломается через iframe — это лучший короткий пример проблемы realm.' },

  { id: 'jsx25',
    q: 'Зачем нужен Object.prototype.toString.call(x) и как на него влияет Symbol.toStringTag?',
    a: `<p><code>Object.prototype.toString.call(x)</code> возвращает <code>'[object Type]'</code> и исторически был единственным способом отличить Array от Object, Date от объекта и null от undefined. Он работает <strong>кросс-realm</strong>, потому что смотрит на внутренние слоты и на <code>Symbol.toStringTag</code>, а не на цепочку прототипов.</p>
    <p>Для встроенных типов с внутренними слотами (Array, Function, Error, Boolean, Number, String, Date, RegExp, Arguments) тег зашит в спецификации. Для всего остального берётся строковое значение свойства <code>Symbol.toStringTag</code>, если оно есть; у Map, Set, Promise, WeakMap, генераторов и модулей оно определено на прототипе.</p>
    <p>Свои классы могут задать тег — это влияет только на этот метод и на отладочный вывод, но не на <code>instanceof</code> и не на <code>typeof</code>.</p>
    <p>Ограничение, о котором стоит сказать: тег подделывается тривиально, поэтому это <strong>эвристика для диагностики</strong>, а не проверка безопасности. Для настоящих проверок — <code>Array.isArray</code>, <code>Number.isInteger</code>, brand checks.</p>`,
    code: `const type = x => Object.prototype.toString.call(x).slice(8, -1);
type(null);          // 'Null'
type([]);            // 'Array'
type(new Map());     // 'Map'
type(Promise.resolve()); // 'Promise'

class Temperature { get [Symbol.toStringTag]() { return 'Temperature'; } }
type(new Temperature()); // 'Temperature'`,
    tip: 'Стоит добавить, что console.log и util.inspect в Node тоже используют toStringTag — это дешёвый способ улучшить читаемость логов своих классов.' },

  { id: 'jsx26',
    q: 'Почему 0.1 + 0.2 !== 0.3 и как правильно сравнивать и хранить дробные числа?',
    a: `<p>Все числа в JS — IEEE 754 double: знак, 11 бит экспоненты, 52 бита мантиссы. 0.1 и 0.2 в двоичной системе — бесконечные периодические дроби, они округляются при хранении, и сумма округлений даёт 0.30000000000000004. Это не баг JS, а свойство binary floating point — то же самое в C, Java, Python.</p>
    <p>Для сравнения используют относительную погрешность: <code>Math.abs(a - b) &lt; Number.EPSILON</code> корректно только для чисел около единицы; правильнее масштабировать эпсилон относительно величины операндов. <code>Number.EPSILON</code> — это 2 в степени -52, минимальная различимая разница около 1.</p>
    <p>Для денег правило простое: <strong>не хранить в float</strong>. Хранить в минимальных единицах как целые (копейки, центы) или в BigInt, а форматировать через <code>Intl.NumberFormat</code>. Библиотеки decimal.js/dinero.js делают то же самое.</p>
    <p>Ещё стоит упомянуть, что <code>toFixed</code> использует округление к ближайшему представимому, поэтому <code>(1.005).toFixed(2)</code> даёт '1.00' — 1.005 на самом деле чуть меньше 1.005.</p>`,
    code: `0.1 + 0.2;                    // 0.30000000000000004
0.1 + 0.2 === 0.3;            // false

const nearlyEqual = (a, b, eps = Number.EPSILON) =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
nearlyEqual(0.1 + 0.2, 0.3);  // true

(1.005).toFixed(2);           // '1.00' — не баг округления, а представление
(0.1 + 0.2).toFixed(2);       // '0.30'`,
    tip: 'Не останавливайтесь на «это IEEE 754» — сразу переходите к деньгам в целых центах, это показывает продуктовый опыт, а не теорию.' },

  { id: 'jsx27',
    q: 'Когда нужен BigInt, какие у него ограничения и как его сериализовать?',
    a: `<p>BigInt нужен, когда целое число выходит за <code>Number.MAX_SAFE_INTEGER</code> (2^53-1): id из БД (Twitter/Discord snowflake), суммы в минимальных единицах у крипты, точная арифметика больших чисел, хеши. Литерал — суффикс <code>n</code> или <code>BigInt(x)</code>.</p>
    <p>Ограничения. Нельзя <strong>смешивать</strong> BigInt и Number в арифметике — TypeError; это сделано намеренно, чтобы не потерять точность неявно. Нельзя применять унарный <code>+</code>. Деление — целочисленное, с усечением. <code>Math.*</code> с BigInt не работает. При этом сравнения (<code>&lt;</code>, <code>==</code>) между типами разрешены, а <code>===</code> — нет: <code>1n == 1</code> это true, <code>1n === 1</code> это false.</p>
    <p><code>JSON.stringify</code> на BigInt бросает TypeError. Решения: сериализовать в строку через <code>toJSON</code> на прототипе или через replacer, а на приёме — reviver. По этой же причине в API id-шники крупных систем приходят строками.</p>
    <p>Производительность: BigInt заметно медленнее Number и не оптимизируется как smi, поэтому в горячих циклах его не место.</p>`,
    code: `const big = 9007199254740993n;
Number(big);              // 9007199254740992 — потеря точности
// big + 1;               // TypeError
big + 1n;                 // 9007199254740994n
7n / 2n;                  // 3n — усечение
1n == 1;                  // true
1n === 1;                 // false

JSON.stringify({ id: big }, (k, v) => typeof v === 'bigint' ? v.toString() : v);`,
    tip: 'Упомяните, что BigInt64Array/BigUint64Array — единственный способ работать с 64-битными целыми в бинарных протоколах и WASM.' },

  { id: 'jsx28',
    q: 'Чем отличаются ===, Object.is и SameValueZero? Где это проявляется на практике?',
    a: `<p>Три алгоритма сравнения. <code>===</code> (Strict Equality) считает <code>NaN !== NaN</code> и <code>+0 === -0</code>. <code>Object.is</code> (SameValue) — наоборот: <code>NaN</code> равен <code>NaN</code>, а <code>+0</code> и <code>-0</code> различны. <code>SameValueZero</code> — гибрид: <code>NaN</code> равен <code>NaN</code>, но <code>+0</code> и <code>-0</code> равны.</p>
    <p>SameValueZero — это то, что использует <code>Array.prototype.includes</code>, а также ключи <code>Map</code> и <code>Set</code>. Поэтому <code>[NaN].includes(NaN)</code> это true, а <code>[NaN].indexOf(NaN)</code> это -1: indexOf использует <code>===</code>. Это самый частый практический эффект.</p>
    <p><code>-0</code> появляется реальнее, чем кажется: <code>Math.round(-0.4)</code>, <code>-1 * 0</code>, парсинг <code>'-0'</code>. Он ломает логику, если делить (<code>1/-0</code> это -Infinity) и если сериализовать (<code>JSON.stringify(-0)</code> даёт '0', и после round-trip знак теряется).</p>
    <p>React использует именно <code>Object.is</code> для сравнения state и зависимостей, поэтому обновление state в NaN не вызовет ререндер — это иногда удивляет.</p>`,
    code: `NaN === NaN;            // false
Object.is(NaN, NaN);    // true
Object.is(+0, -0);      // false
+0 === -0;              // true

[NaN].indexOf(NaN);     // -1  (===)
[NaN].includes(NaN);    // true (SameValueZero)
new Set([NaN, NaN]).size; // 1 (SameValueZero)
new Set([0, -0]).size;    // 1`,
    tip: 'Пара indexOf/includes с NaN — идеальный короткий ответ: он одновременно показывает знание трёх алгоритмов и практическое следствие.' },

  { id: 'jsx29',
    q: 'Что такое Number.MAX_SAFE_INTEGER и какие ещё ловушки есть при работе с числами и округлением?',
    a: `<p><code>MAX_SAFE_INTEGER</code> = 2^53 - 1: до него каждое целое представимо точно, дальше начинают «выпадать» значения — <code>2**53 === 2**53 + 1</code> это true. <code>Number.isSafeInteger</code> проверяет это. Именно поэтому id из бэкенда, превышающие 2^53, должны приходить строкой.</p>
    <p><code>parseInt</code> vs <code>Number</code>: <code>parseInt</code> читает префикс и молча игнорирует хвост (<code>parseInt('12px')</code> это 12, <code>parseInt('1e3')</code> это 1), <code>Number</code> требует всю строку. Классическая ловушка — <code>['1','2','3'].map(parseInt)</code> даёт <code>[1, NaN, NaN]</code>, потому что второй аргумент map — индекс, попадающий в radix.</p>
    <p>Округление: <code>Math.round(-0.5)</code> даёт <code>-0</code>, а не -1, потому что round округляет к плюс бесконечности при .5. <code>toFixed</code> возвращает строку и не всегда округляет «как в школе». Для форматирования и локали правильный инструмент — <code>Intl.NumberFormat</code> с <code>roundingMode</code> (ES2023), а не ручная математика.</p>
    <p>И побитовые операторы приводят к <strong>32-битному</strong> int, поэтому <code>~~x</code> и <code>x | 0</code> ломаются на больших числах — использовать их как «быстрый Math.trunc» опасно.</p>`,
    code: `Number.MAX_SAFE_INTEGER;      // 9007199254740991
2 ** 53 === 2 ** 53 + 1;      // true

['1','2','3'].map(parseInt);  // [1, NaN, NaN]
['1','2','3'].map(Number);    // [1, 2, 3]

Math.round(-0.5);             // -0
(2 ** 31) | 0;                // -2147483648 — переполнение int32

new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB'
}).format(1234.5);            // '1 234,50 ₽'`,
    tip: 'map(parseInt) — вопрос-детектор внимательности; всегда добавляйте, что лечится это через map(Number) или map(s => parseInt(s, 10)).' },

  { id: 'jsx30',
    q: 'Почему у строки с эмодзи length больше, чем видимых символов? Как правильно считать и резать строки?',
    a: `<p>Строки в JS — последовательности <strong>UTF-16 code units</strong>. Символы вне BMP (эмодзи, редкие иероглифы, математические символы) кодируются <strong>суррогатной парой</strong> из двух code unit, поэтому <code>'😀'.length</code> это 2. Индексация, <code>slice</code>, <code>split('')</code> и регулярки без флага <code>u</code> работают по code unit и могут разрезать пару, породив «сломанный» символ.</p>
    <p>Уровень выше — <strong>code point</strong>. Итератор строки (<code>for...of</code>, spread, <code>Array.from</code>) идёт по code point-ам и не рвёт суррогатные пары; <code>codePointAt</code> и <code>String.fromCodePoint</code> — их API. Флаг <code>u</code> в регулярках включает такой же режим.</p>
    <p>Но и code point — не то, что видит пользователь. Флаг страны это два code point, эмодзи семьи — до семи с ZWJ, буква с диакритикой может быть двумя. Пользовательский символ — <strong>графемный кластер</strong>, и единственный корректный способ его получить в стандарте — <code>Intl.Segmenter</code> с <code>granularity: 'grapheme'</code>.</p>
    <p>Практический вывод: для лимита символов в UI считать графемами, для хранения — байтами UTF-8, а <code>length</code> не значит почти ничего.</p>`,
    code: `const s = '👨‍👩‍👧';
s.length;                    // 8 — code units
[...s].length;               // 5 — code points (с ZWJ)
const seg = new Intl.Segmenter('ru', { granularity: 'grapheme' });
[...seg.segment(s)].length;  // 1 — то, что видит пользователь

'😀'.slice(0, 1);            // '\\uD83D' — сломанный символ`,
    tip: 'Назовите три уровня — code unit, code point, графемный кластер — и скажите, какой из них нужен для какой задачи; это сразу читается как экспертиза.' },

  { id: 'jsx31',
    q: 'Что такое нормализация Unicode и почему две одинаковые на вид строки могут быть не равны?',
    a: `<p>Один и тот же символ Unicode часто имеет несколько представлений: «й» может быть одним code point (U+0439) или композицией «и» + комбинирующая краткая (U+0438 U+0306). Визуально идентичны, но <code>===</code> даёт false и <code>length</code> разный.</p>
    <p><code>String.prototype.normalize</code> приводит к канонической форме: <strong>NFC</strong> (композиция, дефолт для веба и для сравнения), <strong>NFD</strong> (декомпозиция, удобна чтобы снять диакритику), <strong>NFKC/NFKD</strong> — с дополнительной совместимостной заменой (лигатуры, ① → 1, полноширинные символы). NFKC агрессивен и теряет информацию, поэтому годится для поиска и нормализации ввода, но не для хранения оригинала.</p>
    <p>Практика: нормализовать пользовательский ввод в NFC перед сравнением и сохранением; для поиска без учёта диакритики — NFD плюс удаление диапазона комбинирующих знаков.</p>
    <p>Для сравнения по правилам языка normalize мало: нужен <code>Intl.Collator</code>, потому что порядок и «равенство» символов зависят от локали (в шведском ä идёт после z, в немецком — рядом с a) и от чувствительности (<code>sensitivity: 'base'</code> игнорирует регистр и акценты).</p>`,
    code: `const a = 'й';                     // U+0439
const b = 'и\\u0306';               // и + комбинирующая краткая
a === b;                           // false
a.normalize('NFC') === b.normalize('NFC'); // true

const deburr = s => s.normalize('NFD').replace(/\\p{M}/gu, '');
deburr('Ёжик');                    // 'Ежик'

new Intl.Collator('ru', { sensitivity: 'base' }).compare('Ёж', 'еж'); // 0`,
    tip: 'Приведите живой кейс: имена файлов в macOS хранятся в NFD, а в Linux/Windows — в NFC, поэтому сравнение путей без normalize регулярно ломает сборки.' },

  { id: 'jsx32',
    q: 'Что умеет Intl помимо форматирования чисел, и какие задачи он снимает?',
    a: `<p>Intl — это стандартный доступ к данным CLDR прямо в рантайме, без библиотек. <code>Intl.NumberFormat</code> — числа, валюты, единицы измерения, компактная запись (1,2 млн), <code>roundingMode</code> и <code>signDisplay</code> из ES2023. <code>Intl.DateTimeFormat</code> — даты с учётом таймзоны и календаря, плюс <code>formatRange</code> для интервалов.</p>
    <p><code>Intl.RelativeTimeFormat</code> убирает самописные «3 дня назад» вместе со всеми проблемами склонений; <code>Intl.PluralRules</code> даёт правильную форму множественного числа (в русском — три категории: one/few/many); <code>Intl.ListFormat</code> собирает «A, B и C» по правилам языка.</p>
    <p><code>Intl.Collator</code> — сортировка и сравнение строк по локали, с <code>numeric: true</code> для естественной сортировки ('file10' после 'file2'). <code>Intl.Segmenter</code> — разбиение на графемы, слова и предложения. <code>Intl.DisplayNames</code> — названия языков, стран и валют на нужном языке.</p>
    <p>Главный аргумент: это ноль килобайт бандла, встроенные и актуальные данные локалей, и корректность там, где ручные реализации всегда врут. Минус — данные могут различаться между движками и версиями, поэтому на точный вывод в снапшот-тестах полагаться не стоит.</p>`,
    code: `const pr = new Intl.PluralRules('ru');
const forms = { one: 'товар', few: 'товара', many: 'товаров' };
const label = n => n + ' ' + forms[pr.select(n)];
label(1);   // '1 товар'
label(3);   // '3 товара'
label(11);  // '11 товаров'

new Intl.RelativeTimeFormat('ru', { numeric: 'auto' }).format(-1, 'day'); // 'вчера'
['file10', 'file2'].sort(new Intl.Collator(undefined, { numeric: true }).compare);`,
    tip: 'Пример с PluralRules для русского — самый убедительный: три категории вместо двух сразу показывают, почему самописные хелперы всегда ломаются.' },

  { id: 'jsx33',
    q: 'Что делает structuredClone и чем он отличается от JSON round-trip и от ручного глубокого копирования?',
    a: `<p><code>structuredClone</code> — рантайм-реализация алгоритма structured clone, того же, что используется в <code>postMessage</code>, IndexedDB и History API. Он копирует Date, RegExp, Map, Set, ArrayBuffer, TypedArray, Blob, File, Error и — главное — корректно обрабатывает <strong>циклические ссылки</strong> и сохраняет разделяемые ссылки внутри графа.</p>
    <p>Чего он <strong>не</strong> умеет: функции и Symbol (бросает DataCloneError), DOM-узлы (кроме поддерживаемых типов), геттеры и сеттеры (копируется вычисленное значение), <strong>прототип</strong> — клон экземпляра класса становится обычным объектом, и приватные поля теряются. Дескрипторы тоже не переносятся.</p>
    <p>JSON round-trip хуже по всем пунктам: теряет undefined, Date превращает в строку, Map/Set — в пустые объекты, падает на циклах и на BigInt. Единственное его преимущество — работает везде и дёшев на маленьких простых объектах.</p>
    <p>Производительность: structuredClone синхронный и блокирует поток; на больших графах он заметно дороже, чем целевой копирующий код. Для plain-объектов известной формы быстрее написать явное копирование.</p>`,
    code: `const src = { d: new Date(), m: new Map([['a', 1]]), n: undefined };
src.self = src;
const c = structuredClone(src);
c.self === c;                 // true — циклы сохранены
c.m instanceof Map;           // true

JSON.parse(JSON.stringify(src)); // TypeError: circular structure

class P { #x = 1; constructor(n) { this.n = n; } }
structuredClone(new P(1)) instanceof P; // false — прототип потерян`,
    tip: 'Ключевая формулировка: structuredClone копирует данные, а не поведение — прототипы, методы и приватные поля не переживают клонирование.' },

  { id: 'jsx34',
    q: 'Как передавать данные между главным потоком и Web Worker? Что такое transferable objects?',
    a: `<p>По умолчанию <code>postMessage</code> <strong>копирует</strong> данные алгоритмом structured clone. Для больших массивов это дорого: и по времени, и по памяти — на пике существуют обе копии, и главный поток блокируется на время сериализации.</p>
    <p><strong>Transferable objects</strong> (ArrayBuffer, MessagePort, ImageBitmap, OffscreenCanvas, ReadableStream) можно <strong>передать</strong> вторым аргументом: происходит перенос владения за O(1), исходный буфер становится detached (<code>byteLength === 0</code>) и больше не читается. Это правильный способ гонять пиксели, аудио и бинарные протоколы.</p>
    <p>Третий вариант — <code>SharedArrayBuffer</code>: память реально общая, копий нет, но нужны Atomics для синхронизации и cross-origin isolation.</p>
    <p>Практические заметки: worker не имеет доступа к DOM, у него свой глобальный объект; для типизированных задач удобнее обёртка вроде Comlink, которая прячет message-протокол за прокси; и не забывайте <code>worker.terminate()</code> и снятие слушателей — «забытые» воркеры это утечка потока, а не только памяти.</p>`,
    code: `const buf = new ArrayBuffer(64 * 1024 * 1024);
worker.postMessage({ buf }, [buf]);   // transfer, не копия
buf.byteLength;                       // 0 — detached

// в воркере
self.onmessage = (e) => {
  const view = new Uint8Array(e.data.buf);
  // ... обработали
  self.postMessage({ buf: view.buffer }, [view.buffer]); // отдали обратно
};`,
    tip: 'Правило выбора одной фразой: маленькое — копируй, большое с передачей владения — transfer, нужен одновременный доступ нескольким потокам — SharedArrayBuffer.' },

  { id: 'jsx35',
    q: 'Что такое SharedArrayBuffer и Atomics, и почему их так сложно включить в браузере?',
    a: `<p><code>SharedArrayBuffer</code> — буфер, который виден нескольким агентам (главный поток и воркеры) одновременно, без копирования. Он «передаётся» через postMessage, но обе стороны получают ссылки на <strong>один</strong> блок памяти.</p>
    <p>Из этого сразу следуют гонки, поэтому нужен <code>Atomics</code>: <code>load</code>, <code>store</code>, <code>add</code>, <code>compareExchange</code> дают атомарность и барьеры памяти; <code>Atomics.wait</code> блокирует поток до сигнала (только в воркерах — на главном потоке запрещён), <code>Atomics.notify</code> будит, а <code>Atomics.waitAsync</code> даёт неблокирующий вариант. Без атомиков даже простой счётчик даст неверный результат, а компилятор вправе переупорядочить обычные чтения.</p>
    <p>Сложность включения — последствие Spectre: точный таймер, собираемый из SharedArrayBuffer, позволяет читать чужую память через спекулятивное выполнение. Поэтому SAB доступен только в <strong>cross-origin isolated</strong> контексте: нужны заголовки <code>Cross-Origin-Opener-Policy: same-origin</code> и <code>Cross-Origin-Embedder-Policy: require-corp</code>, а все сторонние ресурсы должны отдавать CORP/CORS. Проверка — <code>self.crossOriginIsolated</code>.</p>
    <p>На практике SAB нужен в узком классе задач: WASM с потоками (ffmpeg.wasm, SQLite WASM, Photoshop web), аудио-обработка, симуляции. Для обычной фоновой работы достаточно обычных воркеров.</p>`,
    code: `if (self.crossOriginIsolated) {
  const sab = new SharedArrayBuffer(8);
  const counter = new Int32Array(sab);
  Atomics.add(counter, 0, 1);          // атомарный инкремент
  Atomics.notify(counter, 0);          // разбудить ждущих
}
// в воркере: Atomics.wait(counter, 0, 0) — блокирующее ожидание`,
    tip: 'Обязательно свяжите ограничение с Spectre и назовите оба заголовка COOP/COEP — это то, что реально спрашивают, а не API атомиков.' },

  { id: 'jsx36',
    q: 'Как ES-модули обрабатывают циклические зависимости и что такое live bindings?',
    a: `<p>Импорт в ESM — это не копия значения, а <strong>живая привязка</strong> к ячейке в модуле-экспортёре. Если экспортёр переприсвоит переменную, импортёр увидит новое значение. Привязки при этом read-only на стороне импортёра — присвоить в импортированное имя нельзя. В CommonJS всё наоборот: <code>require</code> отдаёт снимок значения <code>module.exports</code> на момент вызова.</p>
    <p>Загрузка ESM идёт в три фазы: <strong>construction</strong> (разбор графа и резолв всех импортов), <strong>instantiation</strong> (создание всех окружений и связывание привязок — до выполнения любого кода), <strong>evaluation</strong> (выполнение тел в порядке обхода в глубину). Именно фаза instantiation делает циклы работоспособными: к моменту выполнения все имена уже связаны.</p>
    <p>Но значения в цикле могут быть ещё не инициализированы. Если модуль A на верхнем уровне читает значение из B, а B ещё не выполнялся — для <code>let/const</code> это <strong>ReferenceError по TDZ</strong>, для функций всё работает благодаря hoisting. Отсюда правило: в циклах опирайтесь на объявления функций и на отложенное использование, а не на значения времени загрузки.</p>
    <p>В CommonJS цикл даёт частично заполненный <code>exports</code> и «тихий undefined» — сломается позже и непонятнее. Практика: циклы — сигнал проблемы архитектуры; лечится извлечением общего модуля или динамическим импортом.</p>`,
    code: `// counter.js
export let count = 0;
export const inc = () => { count++; };

// main.js
import { count, inc } from './counter.js';
console.log(count); // 0
inc();
console.log(count); // 1 — live binding, не копия
// count = 5;       // TypeError: Assignment to constant variable`,
    tip: 'Три фазы (construction / instantiation / evaluation) — это точная формулировка из спеки; сказать их вслух заметно сильнее, чем «модули хойстятся».' },

  { id: 'jsx37',
    q: 'Что даёт top-level await и какие у него риски?',
    a: `<p>TLA позволяет писать <code>await</code> на верхнем уровне ES-модуля. Модуль с TLA становится <strong>асинхронным</strong>: его выполнение приостанавливается, а все модули, которые его импортируют, ждут завершения — то есть ожидание корректно распространяется вверх по графу, без асинхронных IIFE и без экспорта промиса.</p>
    <p>Реальные кейсы: динамический выбор реализации (<code>const db = await import(driver)</code>), инициализация WASM-модуля, чтение конфига или feature-флагов до первого рендера, ресурсы, которые обязаны быть готовы до экспорта.</p>
    <p>Риски. Первый — <strong>задержка старта</strong>: TLA в общей библиотеке блокирует всех потребителей, и цепочка ожиданий складывается. Второй — <strong>дедлок в циклах</strong>: если A ждёт B, а B ждёт A, граф никогда не выполнится, и это не ошибка, а тихое зависание. Третий — <strong>несовместимость</strong>: CommonJS не может синхронно require-нуть модуль с TLA, а некоторые бандлеры и таргеты требуют специальной настройки.</p>
    <p>Правило: TLA уместен в entry-point-ах и в редких инициализаторах, но не в переиспользуемых библиотеках — там лучше экспортировать явную async-функцию инициализации.</p>`,
    code: `// db.js
const driver = process.env.DB === 'pg' ? './pg.js' : './sqlite.js';
export const db = await (await import(driver)).connect();

// любой импортёр db.js ждёт готовности автоматически
import { db } from './db.js';
db.query('select 1');`,
    tip: 'Фраза «TLA заразителен: он делает асинхронными всех ваших потребителей» — точный аргумент против его использования в библиотеках.' },

  { id: 'jsx38',
    q: 'Что такое import.meta и чем динамический import() отличается от статического?',
    a: `<p><code>import.meta</code> — объект с метаданными текущего модуля, наполняемый хостом. В браузере и Node там есть <code>url</code>; в Node ещё <code>dirname</code>, <code>filename</code> и <code>resolve()</code> — замена <code>__dirname</code> в ESM. Бандлеры добавляют своё: <code>import.meta.env</code> у Vite, <code>import.meta.hot</code> для HMR, <code>import.meta.glob</code>. Это стандартный способ получить путь к ассету рядом с модулем.</p>
    <p>Динамический <code>import()</code> — не оператор импорта, а синтаксическая форма, возвращающая промис с namespace-объектом. Отличия: он работает <strong>в рантайме</strong>, принимает вычисляемую строку, доступен внутри функций и условий, работает и в скриптах (не только в модулях), и его результат можно перехватить <code>catch</code>-ем.</p>
    <p>Цена: динамический импорт с невычислимым выражением ломает статический анализ, поэтому бандлер не сможет сделать tree-shaking и создаст либо огромный чанк, либо ничего. Поэтому пути стараются делать частично статическими.</p>
    <p>Есть ещё import attributes (ES2025): <code>import data from './x.json' with { type: 'json' }</code> — обязательное указание типа для не-JS модулей, из соображений безопасности.</p>`,
    code: `const workerUrl = new URL('./worker.js', import.meta.url);
new Worker(workerUrl, { type: 'module' });

// ленивая загрузка тяжёлой зависимости
button.onclick = async () => {
  const { renderChart } = await import('./chart.js');
  renderChart(data);
};

import config from './config.json' with { type: 'json' };`,
    tip: 'Приём с new URL(\'./file\', import.meta.url) — правильный способ адресовать ассеты: его понимают все бандлеры и он работает без них.' },

  { id: 'jsx39',
    q: 'Что на самом деле происходит на каждом await? Сколько микрозадач стоит await и почему это иногда важно?',
    a: `<p><code>await</code> ставит остаток async-функции в микрозадачу, привязанную к резолву ожидаемого значения. Функция синхронно выполняется до <strong>первого</strong> await и возвращает промис; всё, что после — асинхронно, даже если ждём не-промис.</p>
    <p><code>await 1</code> не бесплатен: значение оборачивается через <code>PromiseResolve</code>, и продолжение планируется на следующий тик микрозадач. После оптимизации спецификации (2018, «await takes 1 tick») <code>await promise</code> стоит один тик вместо трёх, но <code>await thenable</code> по-прежнему дороже — thenable раскручивается через дополнительные микрозадачи, из-за чего порядок логов может удивлять.</p>
    <p>Практическое следствие для порядка: <code>return promise</code> из async-функции добавляет два дополнительных тика по сравнению с <code>return await promise</code> — потому что резолв промиса промисом требует раскрутки. При этом <code>return await</code> внутри <code>try</code> ещё и обязателен, иначе catch не поймает ошибку.</p>
    <p>И главное для перфа: последовательные <code>await</code> — это последовательные ожидания. Если запросы независимы, надо стартовать их <strong>раньше</strong>, а ждать позже.</p>`,
    code: `// плохо: 2 последовательных RTT
const user = await fetchUser();
const posts = await fetchPosts();

// хорошо: старт одновременно, ожидание после
const userP = fetchUser();
const postsP = fetchPosts();
const user2 = await userP;
const posts2 = await postsP;

async function a() { return Promise.resolve(1); }      // резолвится позже
async function b() { return await Promise.resolve(1); } // на 2 тика раньше`,
    tip: 'Разница между return promise и return await promise в try/catch — короткий вопрос с высоким сигналом: без await ошибка пролетает мимо catch.' },

  { id: 'jsx40',
    q: 'Как ведут себя try/catch/finally в async-функциях? Что делает return или throw внутри finally?',
    a: `<p>В async-функции <code>try/catch</code> ловит и синхронные исключения, и отклонения ожидаемых промисов — но только те, которые реально <code>await</code>-ятся внутри блока. Промис, созданный в try и не ожидаемый там, отклонится <strong>вне</strong> try, и catch его не увидит — это источник unhandled rejection.</p>
    <p><code>finally</code> выполняется всегда, в том числе при <code>return</code> и <code>throw</code>. Но <code>return</code> внутри finally <strong>перезаписывает</strong> и ранее возвращённое значение, и выброшенное исключение — исключение просто исчезает. Это почти всегда баг, и большинство линтеров это запрещают (<code>no-unsafe-finally</code>).</p>
    <p><code>await</code> внутри finally задерживает завершение функции — полезно для корректной очистки, но может незаметно удлинить критический путь.</p>
    <p>Отдельно: <code>promise.finally(fn)</code> не меняет значение промиса — он его пробрасывает; но если <code>fn</code> бросит или вернёт отклонённый промис, результат станет отклонением. И типовой паттерн — снятие лоадера и освобождение ресурса именно в finally, а не в обеих ветках.</p>`,
    code: `async function bad() {
  try { return 1; }
  finally { return 2; }   // вернёт 2, исключения тоже проглотит
}

async function alsoBad() {
  try {
    const p = fetch('/x');   // не await — rejection уйдёт мимо catch
    return 'ok';
  } catch { return 'caught'; }
}

async function good(signal) {
  const release = await lock.acquire();
  try { return await work(signal); }
  finally { release(); }
}`,
    tip: 'Скажите, что return в finally — это правило линтера no-unsafe-finally: показывает, что вы знаете не только язык, но и как команда защищается от этого класса ошибок.' },

  { id: 'jsx41',
    q: 'Что такое unhandled rejection, когда он возникает и как это ловить в проде?',
    a: `<p>Unhandled rejection — отклонённый промис, у которого на момент опустошения очереди микрозадач нет обработчика <code>catch</code>/<code>onRejected</code>. Проверка отложена: если обработчик навесить позже, в той же микрозадачной «сессии», предупреждения не будет; если сильно позже — в браузере сработает <code>unhandledrejection</code>, а затем может прийти <code>rejectionhandled</code>.</p>
    <p>Типичные причины: floating promise (вызвали async-функцию без await и без catch), промис, созданный в try и не ожидаемый внутри, <code>forEach</code> с async-колбэком (forEach игнорирует возвращаемые промисы), забытый <code>return</code> в цепочке <code>.then</code>, и <code>Promise.all</code>, где одна ветка падает раньше, чем к остальным привязали обработчики.</p>
    <p>Ловля: в браузере <code>window.addEventListener('unhandledrejection', e =&gt; ...)</code> с <code>e.preventDefault()</code>, чтобы убрать шум в консоли, и отправкой в Sentry. В Node с версии 15 поведение по умолчанию — <strong>падение процесса</strong> (<code>--unhandled-rejections=throw</code>), поэтому обработчик <code>process.on('unhandledRejection')</code> нужен для логирования, а не для «проглатывания».</p>
    <p>Профилактика на уровне процесса: правило ESLint <code>no-floating-promises</code> из typescript-eslint и явный <code>void</code>, когда игнорирование намеренное.</p>`,
    code: `// floating promise
saveAnalytics();               // упадёт в unhandledrejection

// намеренно игнорируем, но осознанно
void saveAnalytics().catch(reportError);

window.addEventListener('unhandledrejection', (e) => {
  reportError(e.reason);
  e.preventDefault();          // не шуметь в консоли пользователю
});`,
    tip: 'Отметьте, что forEach с async-колбэком — самый частый источник floating promises; правильный вариант — for...of с await или Promise.all(map).' },

  { id: 'jsx42',
    q: 'Как ты проектируешь ошибки в приложении? Расскажи про кастомные классы ошибок и Error cause.',
    a: `<p>Основа — иерархия своих классов, наследующих Error, с полями, полезными для обработки: <code>code</code>, <code>status</code>, <code>retriable</code>. Обязательно ставим <code>this.name</code>, потому что иначе в stack будет 'Error', и в V8 зовём <code>Error.captureStackTrace</code>, чтобы убрать конструктор из трейса.</p>
    <p><code>cause</code> (ES2022) решает главную проблему перехвата: раньше при <code>throw new AppError('failed')</code> исходная ошибка со стеком терялась. Теперь <code>new Error('msg', { cause: err })</code> сохраняет цепочку, и её видно в выводе Node и в Sentry. Это позволяет добавлять контекст на каждом слое, не теряя корневую причину.</p>
    <p>Проверять тип ошибки лучше не через <code>instanceof</code> (ломается кросс-realm и при дублировании пакета в node_modules), а через <strong>дискриминант</strong>: <code>err.code === 'NOT_FOUND'</code> или brand check по приватному полю. В ES2025 появился <code>Error.isError()</code> — надёжная кросс-realm проверка «это вообще Error».</p>
    <p>И правило дисциплины: <strong>никогда не бросать не-Error</strong>. <code>throw 'oops'</code> лишает вас стека, и <code>catch (e)</code> получает строку; в TypeScript это ещё и <code>unknown</code>, который надо сужать.</p>`,
    code: `class AppError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = new.target.name;
    if (Error.captureStackTrace) Error.captureStackTrace(this, new.target);
  }
}
class NotFound extends AppError { code = 'NOT_FOUND'; }

try { await db.get(id); }
catch (e) { throw new NotFound('User ' + id + ' not found', { cause: e }); }`,
    tip: 'Проверка по err.code вместо instanceof — сильный аргумент: она переживает дубли пакета в node_modules и границы realm, где instanceof молча ломается.' },

  { id: 'jsx43',
    q: 'Что такое AggregateError и где он используется?',
    a: `<p><code>AggregateError</code> оборачивает <strong>несколько</strong> ошибок в одну: у него есть свойство <code>errors</code> с массивом. В стандарте он появился вместе с <code>Promise.any</code>, который отклоняется именно AggregateError-ом, когда упали все входные промисы.</p>
    <p>Помимо этого, он полезен везде, где операция состоит из независимых частей и «первая ошибка» — неполная картина: валидация формы (нужны все нарушенные правила, а не первое), пакетная обработка, параллельная очистка ресурсов в <code>finally</code>, где нельзя терять ошибки закрытия.</p>
    <p>Хороший паттерн — собрать результаты <code>Promise.allSettled</code>, вытащить все <code>rejected</code> и, если их больше нуля, бросить AggregateError с <code>cause</code>-контекстом. Это гораздо информативнее, чем <code>Promise.all</code>, который отдаёт только первую ошибку и молча теряет остальные.</p>
    <p>Нюанс вывода: сообщение AggregateError по умолчанию не печатает вложенные ошибки, поэтому в логгере надо явно разворачивать <code>errors</code> — иначе в Sentry прилетит бесполезное «All promises were rejected».</p>`,
    code: `const results = await Promise.allSettled(tasks.map(run));
const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);
if (failed.length) {
  throw new AggregateError(failed, failed.length + ' of ' + tasks.length + ' tasks failed');
}

try { await Promise.any([a(), b()]); }
catch (e) { console.log(e instanceof AggregateError, e.errors); }`,
    tip: 'Скажите, что Promise.all теряет все ошибки кроме первой — и что связка allSettled + AggregateError это стандартный способ не терять диагностику в батчах.' },

  { id: 'jsx44',
    q: 'Что такое скрытые классы и инлайн-кеши в V8, и как это влияет на то, как ты пишешь код?',
    a: `<p>V8 присваивает каждому объекту <strong>shape</strong> (hidden class) — описание набора и порядка свойств. Объекты, созданные с одинаковыми полями в одинаковом порядке, разделяют один shape, и доступ к свойству превращается в чтение по фиксированному смещению вместо хеш-лукапа.</p>
    <p>В месте доступа стоит <strong>инлайн-кеш</strong>. Если он видел один shape — он <strong>мономорфный</strong> и быстрый; несколько (до четырёх) — <strong>полиморфный</strong>; больше — <strong>мегаморфный</strong>, и V8 уходит в общий медленный путь. То же и для типов чисел: массив, в котором были только smi, оптимизируется лучше, чем массив смешанных типов.</p>
    <p>Практические выводы <strong>без мифологии</strong>: инициализируйте все поля в конструкторе в одном порядке, не добавляйте свойства «по ходу», не используйте объекты как словари с произвольными ключами (для этого есть Map), не смешивайте типы в массиве и не делайте массивы разреженными. Всё это — обычная гигиена кода, а не микрооптимизации.</p>
    <p>Что <strong>устарело</strong>: страшилки про «try/catch не оптимизируется» и «delete всегда убивает перф» относятся к Crankshaft и неверны для TurboFan; <code>delete</code> действительно может перевести объект в dictionary mode, но это надо измерять, а не бояться. Главное правило: сначала профилировщик, потом гипотеза.</p>`,
    code: `// разные shapes из-за порядка полей
const a = { x: 1, y: 2 };
const b = { y: 2, x: 1 };   // другой hidden class

// стабильная форма
class Point {
  constructor(x, y) { this.x = x; this.y = y; this.z = 0; }
}
// вместо словаря на объекте:
const cache = new Map();    // не { [dynamicKey]: value }`,
    tip: 'Обязательно добавьте «но всё это измеряется профилировщиком» — интервьюеры настороженно относятся к кандидатам, которые уверенно повторяют перф-мифы.' },

  { id: 'jsx45',
    q: 'Расскажи про группы в регулярных выражениях: захватывающие, именованные, незахватывающие, lookahead и lookbehind.',
    a: `<p>Скобки <code>(...)</code> создают захватывающую группу — она попадает в результат и нумеруется слева направо по открывающей скобке. <code>(?:...)</code> — незахватывающая, только для группировки и квантификаторов; она дешевле и не засоряет результат. <code>(?&lt;name&gt;...)</code> — именованная, доступна в <code>match.groups.name</code> и в замене как <code>$&lt;name&gt;</code>; это резко повышает читаемость и устойчивость к перестановке групп.</p>
    <p>Lookahead: <code>(?=...)</code> — позитивный, <code>(?!...)</code> — негативный. Lookbehind: <code>(?&lt;=...)</code> и <code>(?&lt;!...)</code>, в JS они <strong>переменной длины</strong>, в отличие от многих других языков. Все lookaround — это утверждения нулевой ширины: они проверяют контекст, но не потребляют символы, поэтому подходят для «найти X, за которым идёт Y, но вернуть только X».</p>
    <p>Для разбора текста удобен <code>matchAll</code>: он даёт итератор всех совпадений с группами и индексами, в отличие от <code>match</code> с флагом g, который теряет группы. Флаг <code>d</code> добавляет <code>indices</code> — точные позиции каждой группы, что нужно для подсветки синтаксиса.</p>
    <p>И общее правило зрелости: если регулярка перестала помещаться в голову, её надо заменить парсером — регулярками нельзя разбирать HTML и вложенные структуры.</p>`,
    code: `const re = /(?<y>\\d{4})-(?<m>\\d{2})-(?<d>\\d{2})/du;
const m = '2026-08-31'.match(re);
m.groups.y;              // '2026'
m.indices.groups.y;      // [0, 4]

'2026-08-31'.replace(re, '$<d>.$<m>.$<y>');   // '31.08.2026'

// только цена, но лишь если после неё RUB
'100 RUB 200 USD'.match(/\\d+(?= RUB)/g);      // ['100']`,
    tip: 'Именованные группы плюс флаг d — свежий и практичный набор; упоминание matchAll вместо exec-цикла тоже читается как современный стиль.' },

  { id: 'jsx46',
    q: 'Какие флаги есть у RegExp и в чём ловушка с lastIndex?',
    a: `<p>Флаги: <code>g</code> (глобальный), <code>i</code> (регистронезависимый), <code>m</code> (многострочный — меняет смысл <code>^</code> и <code>$</code>), <code>s</code> (dotAll — точка матчит перевод строки), <code>u</code> (unicode-режим: корректные суррогатные пары и <code>\\p{...}</code>), <code>v</code> (ES2024, расширенный unicode-набор со множествами и разностью), <code>y</code> (sticky — совпадение обязано начинаться ровно с <code>lastIndex</code>), <code>d</code> (indices).</p>
    <p>Главная ловушка: у регулярки с флагом <code>g</code> или <code>y</code> есть <strong>изменяемое состояние</strong> <code>lastIndex</code>. Методы <code>test</code> и <code>exec</code> его двигают, поэтому повторный вызов на той же строке даёт другой результат, а вынесенная в константу глобальная регулярка ведёт себя «через раз». Классический баг — <code>const re = /a/g</code> в модуле и <code>re.test(s)</code> в цикле валидации.</p>
    <p>Лечения три: не ставить <code>g</code> там, где нужен только факт совпадения; сбрасывать <code>re.lastIndex = 0</code>; или использовать <code>String.prototype.match</code>/<code>matchAll</code>, которые не мутируют состояние (matchAll даже требует флаг g и работает с клоном).</p>
    <p>Флаг <code>y</code> при этом полезен именно из-за lastIndex: на нём строят токенайзеры, последовательно продвигаясь по строке без перескоков.</p>`,
    code: `const re = /\\d+/g;
re.test('a1');   // true,  lastIndex = 2
re.test('a1');   // false! начинает с позиции 2
re.lastIndex;    // 0 — сбросился после неудачи

// безопасно
const ok = s => /\\d+/.test(s);
[...'a1 b22'.matchAll(/\\d+/g)].map(m => m[0]); // ['1','22']`,
    tip: 'Баг «регулярка с /g в константе даёт true через раз» — реальная прод-история; рассказать её конкретно ценнее, чем перечислить все флаги.' },

  { id: 'jsx47',
    q: 'Что такое катастрофический бэктрекинг и ReDoS? Как обнаружить и починить уязвимую регулярку?',
    a: `<p>Движок регулярок в JS — backtracking-based. Если в паттерне есть вложенные квантификаторы или пересекающиеся альтернативы (<code>(a+)+</code>, <code>(a|a)*</code>, <code>(\\s*,)*</code>), то для несовпадающей строки число способов разбить вход растёт экспоненциально, и движок перебирает их все. Строка в 40 символов может занять поток на минуты.</p>
    <p>В браузере это зависание вкладки, в Node — <strong>DoS всего сервера</strong>: event loop однопоточный, и один зловредный запрос кладёт обработку всех остальных. Реальные инциденты — падение Cloudflare в 2019 и Stack Exchange в 2016.</p>
    <p>Признак уязвимости: квантификатор внутри квантификатора, где внутренняя часть может совпасть несколькими способами, плюс возможность несовпадения в конце. Ищут это статически (ESLint-плагины, safe-regex, CodeQL) и фаззингом.</p>
    <p>Починка: убрать вложенность и сделать альтернативы взаимоисключающими; ограничить квантификатор явным диапазоном (<code>a{1,20}</code>); использовать атомарную эмуляцию через lookahead с обратной ссылкой; или вообще заменить регулярку на посимвольный разбор либо на <code>split</code>. Дополнительная защита — ограничение длины входа до применения регулярки и, для Node, перенос разбора в отдельный процесс с таймаутом.</p>`,
    code: `// уязвимо: экспоненциальный бэктрекинг
/^(a+)+$/.test('aaaaaaaaaaaaaaaaaaaaaaaaaaaaX');   // виснет

// безопасно: нет вложенного квантификатора
/^a+$/.test('aaaaaaaaaaaaaaaaaaaaaaaaaaaaX');      // мгновенно false

// атомарная группа через lookahead + backreference
const atomic = /^(?=(a+))\\1$/;

if (input.length > 256) throw new Error('too long'); // дешёвая защита`,
    tip: 'Назовите конкретный инцидент (Cloudflare 2019) и правило «ограничь длину входа» — это ответ уровня человека, который правил такое в проде.' },

  { id: 'jsx48',
    q: 'Стабильна ли сортировка в JavaScript? Какие подводные камни у Array.prototype.sort?',
    a: `<p>С ES2019 <code>sort</code> и <code>toSorted</code> обязаны быть <strong>стабильными</strong>: элементы с равным ключом сохраняют относительный порядок. До этого V8 использовал нестабильный QuickSort для массивов больше 10 элементов, и результат отличался между браузерами. Сейчас V8 использует TimSort.</p>
    <p>Первая ловушка — <strong>сортировка по умолчанию идёт по строкам</strong>: <code>[10, 9, 1].sort()</code> даёт <code>[1, 10, 9]</code>. Всегда нужен компаратор.</p>
    <p>Вторая — <strong>мутация</strong>: <code>sort</code> меняет исходный массив и возвращает ссылку на него же; в React это приводит к «магическому» изменению пропсов. Лечится <code>toSorted</code>.</p>
    <p>Третья — <strong>некорректный компаратор</strong>: он обязан быть консистентным (если a&lt;b, то b&gt;a) и возвращать число; <code>(a, b) =&gt; a.name &gt; b.name</code> возвращает boolean и даёт неопределённый результат. Компаратор, возвращающий случайные значения (популярный «shuffle» через <code>sort(() =&gt; Math.random() - 0.5)</code>), даёт смещённое распределение — правильный способ это Fisher-Yates.</p>
    <p>Четвёртая — <code>undefined</code> всегда уезжают в конец и <strong>не передаются</strong> в компаратор, а дырки разреженного массива идут ещё дальше в конец.</p>`,
    code: `[10, 9, 1].sort();                       // [1, 10, 9] — строковое сравнение
[10, 9, 1].sort((a, b) => a - b);        // [1, 9, 10]

// стабильность: при равном score порядок исходный
users.sort((a, b) => b.score - a.score);

// многоуровневая сортировка
items.toSorted((a, b) =>
  a.group - b.group || a.name.localeCompare(b.name, 'ru'));`,
    tip: 'Упомяните, что sort(() => Math.random() - 0.5) — не перемешивание, а источник смещения; замена на Fisher-Yates часто становится отдельным маленьким вопросом.' },

  { id: 'jsx49',
    q: 'Как правильно сортировать строки? Чем localeCompare отличается от простого сравнения и когда нужен Intl.Collator?',
    a: `<p>Оператор <code>&lt;</code> и <code>sort()</code> по умолчанию сравнивают строки по <strong>UTF-16 code unit</strong>. Это даёт «программистский» порядок: все заглавные раньше строчных ('Z' &lt; 'a'), 'ё' оказывается далеко от 'е', а символы вне BMP сортируются по суррогатам, а не по code point.</p>
    <p><code>localeCompare</code> использует правила локали: регистр и диакритика учитываются как вторичные признаки, порядок соответствует ожиданиям носителя языка. Опции: <code>sensitivity</code> ('base' игнорирует регистр и акценты, 'accent', 'case', 'variant'), <code>numeric: true</code> для естественной сортировки, <code>caseFirst</code>, <code>ignorePunctuation</code>.</p>
    <p>Для сортировки массива нужен <strong><code>Intl.Collator</code></strong>, а не <code>localeCompare</code> в компараторе: Collator создаёт объект один раз, а <code>localeCompare</code> при каждом вызове может пересоздавать внутренний коллятор — на больших массивах разница на порядок. Метод <code>collator.compare</code> уже привязан и передаётся в <code>sort</code> напрямую.</p>
    <p>Важно: результат Intl зависит от версии ICU в движке, поэтому в тестах не стоит ассертить точный порядок экзотических строк, а для стабильного порядка «одинакового везде» нужно сортировать по нормализованному ключу, вычисленному на бэкенде.</p>`,
    code: `['я', 'Ёж', 'ель', 'Абв'].sort();
// ['Абв','Ёж','ель','я'] — заглавные первыми, ё не на месте

const c = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });
['файл10', 'файл2', 'Файл1'].sort(c.compare);
// ['Файл1','файл2','файл10']`,
    tip: 'Аргумент про производительность (создать Collator один раз вместо localeCompare в компараторе) — практичная деталь, которую называют немногие.' },

  { id: 'jsx50',
    q: 'Что такое разреженные массивы и как разные методы обходятся с дырками?',
    a: `<p>Разреженный массив — массив, у которого есть индексы без собственного свойства: <code>[1, , 3]</code>, <code>new Array(3)</code>, <code>arr[100] = 1</code>, <code>delete arr[0]</code>. Дырка — это не <code>undefined</code>: <code>0 in [,]</code> даёт false, а <code>0 in [undefined]</code> — true.</p>
    <p>Методы делятся на три группы. <strong>Пропускают дырки</strong>: <code>forEach</code>, <code>map</code> (но сохраняет дырки в результате!), <code>filter</code>, <code>some</code>, <code>every</code>, <code>reduce</code>. <strong>Считают дырки за undefined</strong>: <code>join</code> (даёт пустую строку), <code>sort</code> (отправляет в конец), <code>fill</code>, <code>copyWithin</code>, <code>keys</code>, <code>Array.from</code>, spread и <code>for...of</code>. <strong>Новые ES2023-методы</strong> (<code>toSorted</code>, <code>toReversed</code>, <code>with</code>, <code>at</code>, <code>findLast</code>, <code>includes</code>) дырок не знают вовсе — читают <code>undefined</code>.</p>
    <p>Отсюда классика: <code>new Array(3).map((_, i) =&gt; i)</code> даёт <code>[ , , ]</code>, а <code>Array.from({ length: 3 }, (_, i) =&gt; i)</code> — <code>[0,1,2]</code>. И <code>[1,,3].indexOf(undefined)</code> это -1, а <code>includes(undefined)</code> — true.</p>
    <p>Плюс перф: V8 переводит разреженный массив в dictionary elements, и доступ становится в разы медленнее. Практика простая — <strong>не создавать дырки</strong>: вместо <code>delete arr[i]</code> использовать <code>splice</code> или фильтрацию.</p>`,
    code: `const sparse = [1, , 3];
sparse.length;                 // 3
1 in sparse;                   // false
sparse.map(x => x * 2);        // [2, <1 empty>, 6] — дырка сохранена
sparse.join('-');              // '1--3'
[...sparse];                   // [1, undefined, 3]

new Array(3).fill(0).map((_, i) => i);        // [0,1,2]
Array.from({ length: 3 }, (_, i) => i);       // [0,1,2]`,
    tip: 'Пара примеров new Array(3).map vs Array.from({length:3}) — самая узнаваемая иллюстрация дырок; её стоит держать наготове.' },

  { id: 'jsx51',
    q: 'Расскажи про at(), toSorted, toSpliced, toReversed и with. Зачем их добавили?',
    a: `<p><code>at()</code> (ES2022) даёт доступ по индексу с поддержкой отрицательных значений: <code>arr.at(-1)</code> вместо <code>arr[arr.length - 1]</code>. Есть у Array, String и TypedArray. Важно: это <strong>не</strong> отрицательная индексация — <code>arr[-1]</code> по-прежнему обычное строковое свойство.</p>
    <p>ES2023 добавил <strong>копирующие версии</strong> мутирующих методов: <code>toSorted</code>, <code>toReversed</code>, <code>toSpliced</code> и <code>with(index, value)</code>. Они возвращают новый массив, не трогая исходный, — то есть закрывают самую частую причину багов в React/Redux, где <code>sort</code> и <code>reverse</code> молча мутировали state или пропсы.</p>
    <p>Детали: они всегда возвращают <strong>обычный Array</strong> (не подкласс, species не применяется), не понимают дырок (превращают в <code>undefined</code>) и работают с любым array-like через <code>call</code>. У TypedArray есть <code>toSorted</code>, <code>toReversed</code>, <code>with</code>, но нет <code>toSpliced</code> — длина типизированного массива фиксирована.</p>
    <p>Плюс <code>findLast</code> и <code>findLastIndex</code> из того же релиза убирают уродливый паттерн <code>[...arr].reverse().find(...)</code>, который делал лишнюю копию.</p>`,
    code: `const arr = [3, 1, 2];
arr.at(-1);              // 2
arr.toSorted((a,b)=>a-b);// [1,2,3], arr не изменён
arr.with(0, 99);         // [99,1,2]
arr.toSpliced(1, 1);     // [3,2]
arr.findLast(x => x < 3);// 2

// раньше в редьюсере приходилось так:
// return [...state].sort(cmp);`,
    tip: 'Свяжите это с иммутабельностью в стейт-менеджерах: «toSorted появился ровно потому, что [...arr].sort() был обязательным ритуалом в каждом редьюсере».' },

  { id: 'jsx52',
    q: 'Что такое Object.groupBy и Map.groupBy? Чем они отличаются и в чём подвох?',
    a: `<p>ES2024 добавил статические методы группировки. <code>Object.groupBy(items, fn)</code> возвращает объект, где ключи — строковый результат колбэка, а значения — массивы. <code>Map.groupBy(items, fn)</code> возвращает Map и потому допускает <strong>любые ключи</strong>: объекты, числа, символы, без приведения к строке.</p>
    <p>Важная деталь: объект из <code>Object.groupBy</code> создаётся с прототипом <code>null</code>. Это защита от prototype pollution — ключ <code>'__proto__'</code> в данных не сломает объект, но и <code>result.hasOwnProperty</code> у него нет, и <code>console.log</code> покажет <code>[Object: null prototype]</code>.</p>
    <p>Колбэк получает <code>(element, index)</code>, а не аккумулятор, — это чистая группировка, без reduce-акробатики. Работает с любым <strong>итерируемым</strong>, не только с массивом: Set, Map.entries, генератор.</p>
    <p>Когда что: <code>Map.groupBy</code>, если ключ — не строка или важен порядок вставки и производительность на большом числе групп; <code>Object.groupBy</code>, если результат сразу идёт в JSON или в шаблон. Обе версии — просто читаемая замена <code>reduce</code>, которую все писали руками.</p>`,
    code: `const users = [
  { name: 'Ann', dept: 'eng' },
  { name: 'Bob', dept: 'ops' },
  { name: 'Cid', dept: 'eng' }
];
Object.groupBy(users, u => u.dept);
// { eng: [Ann, Cid], ops: [Bob] }  с прототипом null

const byTeam = Map.groupBy(users, u => teams.get(u.dept)); // ключ — объект

Object.getPrototypeOf(Object.groupBy(users, u => u.dept)); // null`,
    tip: 'Прототип null — деталь, которую почти никто не называет; она объясняет и безопасность, и почему у результата нет привычных методов Object.' },

  { id: 'jsx53',
    q: 'Какие возможности ES2023-ES2025 ты считаешь реально полезными и уже используешь?',
    a: `<p>ES2023: копирующие методы массивов (<code>toSorted</code>, <code>toSpliced</code>, <code>toReversed</code>, <code>with</code>), <code>findLast</code>/<code>findLastIndex</code>, hashbang-грамматика. ES2022 из недавнего — <code>Object.hasOwn</code> (замена <code>hasOwnProperty.call</code>), <code>at</code>, <code>Error.cause</code>, <code>#</code>-поля и статические блоки.</p>
    <p>ES2024: <code>Object.groupBy</code>/<code>Map.groupBy</code>, <code>Promise.withResolvers</code> (resolve/reject наружу без конструктора-обёртки — идеально для deferred и адаптации событийных API), <code>Array.fromAsync</code> (собрать async-итерируемое в массив), <code>ArrayBuffer.prototype.transfer</code> и <code>resize</code>, флаг <code>v</code> в регулярках, <code>String.isWellFormed</code>/<code>toWellFormed</code> для строк со сломанными суррогатами, <code>Atomics.waitAsync</code>.</p>
    <p>ES2025: <strong>iterator helpers</strong> (<code>map</code>, <code>filter</code>, <code>take</code>, <code>drop</code>, <code>flatMap</code>, <code>reduce</code>, <code>toArray</code> прямо на итераторах — ленивые цепочки без промежуточных массивов), <strong>методы Set</strong> (<code>union</code>, <code>intersection</code>, <code>difference</code>, <code>isSubsetOf</code>), <code>Promise.try</code>, <code>RegExp.escape</code>, import attributes, <code>Float16Array</code>, дублирующиеся именованные группы в регулярках.</p>
    <p>Из ближайшего будущего стоит следить за Temporal (даты), Explicit Resource Management (<code>using</code> и <code>Symbol.dispose</code>) и Signals.</p>`,
    code: `const { promise, resolve, reject } = Promise.withResolvers();
socket.onmessage = e => resolve(e.data);
socket.onerror = reject;
const first = await promise;

// iterator helpers: ленивое взятие первых 3 подходящих
const top3 = data.values().filter(x => x.active).map(x => x.id).take(3).toArray();

new Set([1,2,3]).intersection(new Set([2,3,4]));   // Set {2,3}`,
    tip: 'Iterator helpers стоит подать через выгоду: они не создают промежуточные массивы, поэтому цепочка по большому потоку данных не аллоцирует лишнего.' },

  { id: 'jsx54',
    q: 'Какие тонкости у JSON.stringify и JSON.parse? Что теряется при сериализации?',
    a: `<p><code>stringify</code> молча <strong>выбрасывает</strong> <code>undefined</code>, функции и символы в объектах, а в массивах заменяет их на <code>null</code>. <code>NaN</code> и <code>Infinity</code> становятся <code>null</code>. <code>Date</code> превращается в ISO-строку — потому что у Date есть <code>toJSON</code>, а обратного преобразования при parse нет. <code>Map</code>, <code>Set</code>, <code>RegExp</code> дают <code>{}</code>. <code>BigInt</code> бросает TypeError. Циклическая ссылка — тоже TypeError.</p>
    <p>Точки расширения: метод <code>toJSON</code> на объекте (вызывается первым и полностью определяет представление — удобно для value-объектов и для скрытия секретов), второй аргумент <code>replacer</code> (функция или массив-белый список ключей) и третий — отступ. У <code>parse</code> есть <code>reviver</code>; в ES2025 у него появился параметр <code>context</code> с <code>source</code> — исходным текстом числа, что наконец позволяет корректно парсить большие целые в BigInt без потери точности.</p>
    <p>Безопасность: <code>JSON.parse</code> сам по себе безопасен и не выполняет код (в отличие от eval), но ключ <code>__proto__</code> из недоверенного JSON при последующем мердже в объект даёт <strong>prototype pollution</strong>. Защита — <code>Object.create(null)</code>, проверка ключей в reviver, схема-валидация (zod, ajv).</p>
    <p>Ещё: порядок ключей — это порядок вставки (кроме целочисленных, которые всегда идут первыми и по возрастанию), поэтому JSON нельзя использовать как канонический ключ кеша без явной сортировки ключей.</p>`,
    code: `JSON.stringify({ a: undefined, b: () => {}, c: NaN });  // '{"c":null}'
JSON.stringify([undefined, () => {}]);                  // '[null,null]'
JSON.stringify({ m: new Map([['a',1]]) });              // '{"m":{}}'

class Token { constructor(v) { this.v = v; } toJSON() { return '[redacted]'; } }
JSON.stringify({ t: new Token('secret') });             // '{"t":"[redacted]"}'

JSON.stringify({ b: 1, a: 2, 2: 'x', 1: 'y' });
// '{"1":"y","2":"x","b":1,"a":2}' — целые ключи первыми`,
    tip: 'Про целочисленные ключи, которые всегда сортируются вперёд, знают немногие — а это ломает наивные ключи кеша, построенные через JSON.stringify.' },

  { id: 'jsx55',
    q: 'Какие проблемы у встроенного Date и что меняет Temporal?',
    a: `<p>Проблемы Date: он <strong>мутабельный</strong> (<code>setDate</code> меняет объект на месте), месяцы нумеруются с нуля, парсинг строк частично зависит от реализации (надёжен только ISO-формат; <code>new Date('2026-08-31')</code> — это UTC-полночь, а <code>new Date('2026/08/31')</code> — локальная), внутри — одно число миллисекунд без информации о таймзоне, поэтому «дата» и «момент времени» неразличимы.</p>
    <p>Отсюда классические баги: сдвиг на день при переходе UTC/локаль, неправильная арифметика вокруг перехода на летнее время (сутки не всегда 24 часа), невозможность представить «день рождения» без привязки к зоне.</p>
    <p><strong>Temporal</strong> решает это набором иммутабельных типов с разной семантикой: <code>PlainDate</code>, <code>PlainTime</code>, <code>PlainDateTime</code> (без зоны), <code>ZonedDateTime</code> (с IANA-зоной и корректным DST), <code>Instant</code> (точка на шкале), <code>Duration</code>. Арифметика явная — <code>add</code>, <code>subtract</code>, <code>until</code>, с настраиваемым разрешением неоднозначностей DST. Плюс поддержка календарей помимо григорианского.</p>
    <p>Статус: proposal стоит на Stage 3, реализация уже есть в Firefox и появляется в других движках; в проде пока используют полифилл или date-fns/Luxon. Практическое правило прямо сейчас: хранить UTC ISO-строку или epoch, форматировать через <code>Intl.DateTimeFormat</code> с явной timeZone, а арифметику делать библиотекой.</p>`,
    code: `const d = new Date('2026-08-31');    // UTC полночь
d.getDate();                        // может быть 30 в UTC-5

// Temporal (полифилл)
const day = Temporal.PlainDate.from('2026-08-31');
day.add({ months: 1 }).toString();  // '2026-09-30' — корректный клэмп
Temporal.Now.zonedDateTimeISO('Europe/Moscow').hour;

new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'long' })
  .format(new Date());`,
    tip: 'Разделение «момент времени» и «календарная дата» — главная идея Temporal; сформулировав её, вы объясняете сразу весь класс багов с таймзонами.' },

  { id: 'jsx56',
    q: 'Какие тонкости есть у деструктуризации? Приведи неочевидные случаи.',
    a: `<p>Значение по умолчанию срабатывает <strong>только на <code>undefined</code></strong>, но не на <code>null</code>, <code>0</code> или пустой строке — это отличает деструктуризацию от <code>||</code> и роднит с <code>??</code>. Поэтому <code>const { a = 1 } = { a: null }</code> даёт <code>null</code>.</p>
    <p>Деструктуризация массива идёт через <strong>итератор</strong>, а объекта — через доступ к свойствам. Значит, из Set и из генератора можно деструктурировать по позициям, а из объекта без Symbol.iterator — нет. Деструктуризация <code>null</code> или <code>undefined</code> бросает TypeError (даже с дефолтами), поэтому у параметра-объекта всегда пишут <code>= {}</code>.</p>
    <p>Синтаксические нюансы: переименование <code>{ a: b }</code> — <code>b</code> это новая переменная, <code>a</code> не существует; вложенное <code>{ a: { b } }</code> не создаёт <code>a</code>; присваивание без <code>const</code> требует скобок <code>({ a } = obj)</code>, иначе парсер видит блок; rest в объекте копирует только <strong>собственные перечисляемые</strong> свойства и не берёт геттеры с прототипа. Можно деструктурировать и в вычисляемые ключи, и в свойства объекта: <code>({ x: obj.prop } = src)</code>.</p>
    <p>И дефолты вычисляются лениво и слева направо, поэтому предыдущие имена доступны последующим.</p>`,
    code: `const { a = 1 } = { a: null };        // null, не 1
const [x = 1] = [undefined];         // 1
const { b: { c } = {} } = {};        // c === undefined, без падения
// const { d } = null;               // TypeError

const [first, ...rest] = new Set([1, 2, 3]);   // работает: итератор
({ p: window.title } = { p: 'hi' });           // присваивание в свойство

function f({ page = 1, size = page * 10 } = {}) { return size; }
f();                                  // 10`,
    tip: 'Уточните, что деструктуризация массива всегда идёт через итератор — это объясняет и работу с Set/генераторами, и почему у объекта так нельзя.' },

  { id: 'jsx57',
    q: 'Что нужно знать про параметры по умолчанию и rest-параметры? Что происходит с arguments и length?',
    a: `<p>Дефолты вычисляются <strong>при каждом вызове</strong> и только когда аргумент равен <code>undefined</code> — явная передача <code>undefined</code> тоже триггерит дефолт, а <code>null</code> нет. Вычисляются они слева направо, и правые параметры видят левые; обратное — ReferenceError по TDZ.</p>
    <p>Параметры с дефолтами создают <strong>отдельную область видимости</strong> для списка параметров, отдельную от тела функции. Отсюда неочевидность: переменная, объявленная в теле с тем же именем, не видна из дефолтов, и функция-дефолт замыкается на параметрах, а не на локальных переменных тела.</p>
    <p>Функция с дефолтами, rest-параметром или деструктуризацией автоматически получает <strong>unmapped <code>arguments</code></strong>: изменение параметра больше не отражается в <code>arguments[i]</code>. Плюс в такой функции запрещён <code>'use strict'</code> в теле — синтаксическая ошибка.</p>
    <p><code>fn.length</code> считает только параметры <strong>до</strong> первого дефолта и не включает rest — важно для библиотек, которые смотрят на арность (Express различает middleware по числу аргументов, Mocha — по наличию done).</p>`,
    code: `function f(a, b = a + 1, ...rest) { return [a, b, rest]; }
f(1);                    // [1, 2, []]
f(1, undefined, 9);      // [1, 2, [9]]
f(1, null);              // [1, null, []]
f.length;                // 1

function g(x = 1) { var x = 2; return x; }  // отдельные скоупы параметров и тела

const cached = (fn) => fn.length === 0 ? memoZero(fn) : memoArgs(fn);`,
    tip: 'Отдельный скоуп для списка параметров — редкая деталь; хорошая иллюстрация того, что вы понимаете, почему в такой функции нельзя писать use strict.' },

  { id: 'jsx58',
    q: 'Какие структуры данных ты выбираешь под какие задачи в JS и почему?',
    a: `<p><strong>Массив</strong> — по умолчанию: непрерывная память, отличная локальность, быстрые push/pop. Но <code>shift</code>/<code>unshift</code> и <code>splice</code> из начала — O(n), поэтому очередь на массиве через <code>shift</code> деградирует; правильная очередь — кольцевой буфер или два стека, либо просто указатель головы без реального удаления.</p>
    <p><strong>Map</strong> — когда ключи не строки, когда важен порядок вставки, когда ключи приходят от пользователя (нет коллизии с <code>__proto__</code> и прототипными методами) и когда часто добавляют/удаляют: Map оптимизирован под это, объект — нет. <strong>Set</strong> — для уникальности и членства, с ES2025-операциями над множествами.</p>
    <p><strong>WeakMap/WeakSet/WeakRef</strong> — для метаданных на чужих объектах и кешей, которые не должны удерживать ключи. <strong>TypedArray и ArrayBuffer</strong> — для бинарных данных, работы с воркерами, WASM, графики: фиксированный тип, отсутствие боксинга, transferable.</p>
    <p>Чего в стандарте <strong>нет</strong>: приоритетная очередь (heap), сбалансированное дерево, LRU. Их пишут руками или берут из библиотеки. Типовая ошибка — эмулировать heap сортировкой массива на каждой вставке: это O(n log n) вместо O(log n), и на больших объёмах разница фатальна.</p>`,
    code: `// LRU на Map: порядок вставки + переустановка ключа
class LRU {
  constructor(limit) { this.limit = limit; this.map = new Map(); }
  get(k) {
    if (!this.map.has(k)) return undefined;
    const v = this.map.get(k);
    this.map.delete(k); this.map.set(k, v);   // освежили
    return v;
  }
  set(k, v) {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.limit) this.map.delete(this.map.keys().next().value);
  }
}`,
    tip: 'LRU на Map за счёт гарантированного порядка вставки — красивый ответ: он показывает, что вы знаете не просто API, а свойства структуры.' },

  { id: 'jsx59',
    q: 'Что такое сигналы (signals) и почему TC39 обсуждает их стандартизацию? Чем они отличаются от Observable и от промисов?',
    a: `<p>Сигнал — реактивный контейнер значения с автоматическим отслеживанием зависимостей. Читая сигнал внутри вычисляемого (<code>computed</code>) или эффекта, вы автоматически подписываетесь на него; при изменении источника зависимые пересчитываются. Это <strong>pull-based</strong> модель с проталкиванием инвалидации: изменение помечает граф грязным, а реальный пересчёт происходит при чтении.</p>
    <p>Такая схема решает две классические проблемы push-моделей: <strong>glitch</strong> (промежуточные несогласованные состояния, когда узел пересчитался по половине обновлённых входов) и лишние вычисления (если результат никто не читает, он не считается). Плюс <code>computed</code> мемоизируется и не пересчитывается, если входы не менялись фактически.</p>
    <p>Отличия: <strong>Promise</strong> — одно значение, один раз; <strong>Observable</strong> — поток событий во времени, push-based, требует ручного объявления зависимостей через операторы и подвержен glitch-ам; <strong>signal</strong> — значение, которое всегда актуально, с автоматическим графом зависимостей.</p>
    <p>Proposal TC39 (Stage 1) написан авторами Angular, Vue, Solid, Preact, Ember, MobX и Qwik. Цель — не заменить фреймворки, а дать общее ядро, чтобы стейт-логику можно было писать один раз и рендерить чем угодно; API нарочно низкоуровневое (<code>Signal.State</code>, <code>Signal.Computed</code>, <code>Signal.subtle.Watcher</code>), эффекты и планирование остаются за фреймворком.</p>`,
    code: `const count = new Signal.State(0);
const double = new Signal.Computed(() => count.get() * 2);

const w = new Signal.subtle.Watcher(() => queueMicrotask(flush));
w.watch(double);

count.set(5);
double.get();   // 10 — пересчитано лениво, при чтении`,
    tip: 'Слово glitch (несогласованное промежуточное состояние) и фраза «pull-based с push-инвалидацией» — точно объясняют, зачем сигналы, а не просто «это как ref во Vue».' },

  { id: 'jsx60',
    q: 'Что выведет код? Объясни, как это работает и можно ли сделать иначе.',
    a: `<p>Выведет <code>'yes'</code>. Условие <code>a == 1 && a == 2 && a == 3</code> выполнимо, потому что <code>==</code> с числом запускает ToPrimitive на объекте, а мы контролируем это приведение через <code>Symbol.toPrimitive</code>, возвращая каждый раз новое значение.</p>
    <p>Тот же трюк работает через <code>valueOf</code> или <code>toString</code> — они вызываются, если <code>Symbol.toPrimitive</code> нет. Для hint <code>default</code> (а <code>==</code> использует именно его) порядок такой: <code>Symbol.toPrimitive</code>, потом <code>valueOf</code>, потом <code>toString</code>.</p>
    <p>Есть и вариант <strong>без объекта</strong>: объявить <code>a</code> как геттер на <code>globalThis</code> через <code>defineProperty</code> с побочным эффектом — тогда даже <code>===</code> сработает, потому что каждое чтение переменной вызывает геттер и возвращает разные числа.</p>
    <p>Практический смысл вопроса — не трюк, а проверка: понимаете ли вы, что <code>==</code> вызывает <strong>пользовательский код</strong>. Именно поэтому <code>==</code> с объектами непредсказуем и в проде используют <code>===</code>.</p>`,
    code: `let i = 0;
const a = { [Symbol.toPrimitive]() { return ++i; } };
if (a == 1 && a == 2 && a == 3) console.log('yes');

// вариант со строгим равенством
let j = 0;
Object.defineProperty(globalThis, 'b', { get: () => ++j });
if (b === 1 && b === 2 && b === 3) console.log('yes strict');`,
    tip: 'Дайте оба решения — через toPrimitive и через геттер на globalThis; второе отвечает на закономерное «а с === можно?».' },

  { id: 'jsx61',
    q: 'Что выведет код и в каком порядке? Объясни каждый шаг.',
    a: `<p>Порядок: <code>script start</code>, <code>script end</code>, <code>micro 1</code>, <code>micro 2</code>, затем <code>raf</code>, затем <code>timeout</code> — при условии, что кадр отрисовки наступает раньше срабатывания таймера, что типично для активной вкладки.</p>
    <p>Разбор: синхронный код выполняется целиком — это первая макрозадача. Затем дренируется очередь микрозадач: <code>micro 1</code> и порождённый им <code>micro 2</code> — обратите внимание, что микрозадача, добавленная внутри микрозадачи, выполняется в том же дренаже, до выхода к рендеру.</p>
    <p>После опустошения микрозадач браузер решает, нужен ли кадр. Если да — идёт фаза rendering, и там вызываются rAF-колбэки, поэтому <code>raf</code> опережает <code>timeout</code>. Сам <code>setTimeout(0)</code> имеет минимальную задержку (обычно ~1 мс, с клампингом до 4 мс при вложенности), и его задача берётся уже на следующем обороте цикла.</p>
    <p>Важная оговорка: этот порядок <strong>не гарантирован спецификацией</strong> — он зависит от того, запланирован ли кадр. На скрытой вкладке rAF не вызовется вовсе, и <code>timeout</code> выйдет первым. Именно эта недетерминированность — правильный финал ответа.</p>`,
    code: `console.log('script start');

setTimeout(() => console.log('timeout'), 0);
requestAnimationFrame(() => console.log('raf'));

Promise.resolve().then(() => {
  console.log('micro 1');
  queueMicrotask(() => console.log('micro 2'));
});

console.log('script end');`,
    tip: 'Обязательно скажите, что порядок raf/timeout зависит от того, планируется ли кадр — уверенный «всегда raf раньше» это ошибка.' },

  { id: 'jsx62',
    q: 'Что выведет код? Почему поле в подклассе ведёт себя не так, как ожидается?',
    a: `<p>Выведет <code>'Base: undefined'</code>, потом <code>10</code>. Причина — порядок инициализации: <code>super()</code> выполняет конструктор базового класса <strong>целиком</strong>, включая вызов <code>this.render()</code>. Метод уже переопределён (методы живут на прототипе и существуют с момента объявления класса), поэтому вызывается <code>Child.prototype.render</code>. Но поле <code>size</code> производного класса ещё не создано — поля инициализируются только <strong>после</strong> возврата из <code>super()</code>.</p>
    <p>Поэтому первый вызов видит <code>undefined</code>, а второй, уже после конструктора, видит <code>10</code>.</p>
    <p>Это же объясняет вторую классическую ловушку: если бы в <code>Child</code> было объявлено поле с именем метода базового класса, оно бы <strong>перетёрло</strong> прототипный метод на инстансе, потому что поле создаётся через [[DefineOwnProperty]] на объекте.</p>
    <p>Вывод для дизайна: не вызывайте перегружаемые методы из конструктора. Если нужна инициализация с хуками — сделайте явный <code>init()</code>, вызываемый фабрикой после конструирования.</p>`,
    code: `class Base {
  constructor() { this.render(); }
  render() { console.log('Base render'); }
}

class Child extends Base {
  size = 10;
  render() { console.log('Base: ' + this.size); }
}

const c = new Child();
c.render();
// 'Base: undefined'
// 'Base: 10'`,
    tip: 'Сформулируйте правило одной фразой: «поля производного класса создаются после super(), поэтому конструктор базового видит их undefined».' },

  { id: 'jsx63',
    q: 'Что выведет код? Разбери поведение методов на разреженном массиве.',
    a: `<p>Вывод: <code>3</code>, затем <code>[1, empty, 3]</code>, затем <code>'1--3'</code>, затем <code>[1, undefined, 3]</code>, затем <code>2</code>, затем <code>false</code> и <code>true</code>.</p>
    <p><code>length</code> равен 3, потому что длина определяется максимальным индексом, а не количеством реальных свойств. <code>map</code> <strong>пропускает</strong> дырку (колбэк для неё не вызывается), но <strong>сохраняет</strong> её в результате — это самая неинтуитивная часть. <code>join</code> трактует дырку как пустую строку, поэтому получается двойной дефис.</p>
    <p>Spread и <code>for...of</code> идут через итератор массива, который читает <code>arr[i]</code> по каждому индексу и потому даёт <code>undefined</code> вместо дырок. <code>filter(Boolean).length</code> равен 2, потому что filter дырку пропускает, а 1 и 3 истинны.</p>
    <p>И финальный контраст: <code>indexOf(undefined)</code> даёт -1, так как использует <code>===</code> и пропускает дырки, а <code>includes(undefined)</code> даёт true, потому что использует SameValueZero и <strong>не</strong> пропускает дырки — читает их как <code>undefined</code>.</p>`,
    code: `const arr = [1, , 3];

console.log(arr.length);              // 3
console.log(arr.map(x => x * 2));     // [2, <1 empty item>, 6]
console.log(arr.join('-'));           // '1--3'
console.log([...arr]);                // [1, undefined, 3]
console.log(arr.filter(Boolean).length); // 2
console.log(arr.indexOf(undefined));  // -1
console.log(arr.includes(undefined)); // true`,
    tip: 'Контраст indexOf vs includes на дырке — самая ёмкая иллюстрация того, что методы массива делятся на «знающие про дырки» и «не знающие».' },

  { id: 'jsx64',
    q: 'Что вернут эти async-функции и почему? Разбери взаимодействие try/catch/finally и await.',
    a: `<p><code>f1</code> вернёт <code>'finally'</code>: <code>return</code> внутри <code>finally</code> перезаписывает значение из <code>try</code>. Более того, он проглотил бы и исключение — это причина, по которой линтеры запрещают такой код.</p>
    <p><code>f2</code> отклонится, а не вернёт <code>'caught'</code>: без <code>await</code> перед <code>fail()</code> функция возвращает промис, и его отклонение происходит <strong>после</strong> выхода из блока <code>try</code>, поэтому <code>catch</code> его не видит. Это классический источник unhandled rejection.</p>
    <p><code>f3</code> вернёт <code>'caught'</code>, потому что <code>return await</code> заставляет функцию дождаться промиса <strong>внутри</strong> try — и отклонение превращается в исключение в нужном месте.</p>
    <p>Мораль: внутри <code>try</code> всегда пишите <code>return await</code>, а не <code>return</code>; вне try разница только в лишних тиках. И никогда не возвращайте значение из <code>finally</code> — там место только для освобождения ресурсов.</p>`,
    code: `const fail = () => Promise.reject(new Error('boom'));

async function f1() {
  try { return 'try'; }
  finally { return 'finally'; }
}

async function f2() {
  try { return fail(); }
  catch { return 'caught'; }
}

async function f3() {
  try { return await fail(); }
  catch { return 'caught'; }
}
// f1() -> 'finally'; f2() -> rejected Error: boom; f3() -> 'caught'`,
    tip: 'Именно из-за f2 правило «return await внутри try» попало в typescript-eslint как no-return-await с исключением для try-блоков.' },

  { id: 'jsx65',
    q: 'Что выведет этот цикл валидации и в чём баг?',
    a: `<p>Выведет <code>true</code>, <code>false</code>, <code>true</code>, <code>false</code> — то есть валидные строки «через одну» считаются невалидными. Баг в том, что регулярка объявлена с флагом <code>g</code> и вынесена в модульную константу, а значит имеет <strong>изменяемое состояние</strong> <code>lastIndex</code>.</p>
    <p><code>test</code> у глобальной регулярки начинает поиск с <code>lastIndex</code> и после успешного совпадения сдвигает его за конец найденного. На следующей строке поиск стартует уже не с нуля, совпадение не находится, возвращается <code>false</code>, и заодно <code>lastIndex</code> сбрасывается в 0 — из-за чего следующий вызов снова успешен. Отсюда чередование.</p>
    <p>Три варианта починки. Убрать <code>g</code> — для проверки факта совпадения он не нужен и это правильный фикс. Сбрасывать <code>re.lastIndex = 0</code> перед каждым вызовом. Или использовать методы, не мутирующие состояние: <code>String.prototype.match</code> без сохранения регулярки или <code>matchAll</code>, которая работает с внутренним клоном.</p>
    <p>Тот же баг возникает с <code>exec</code> в цикле по разным строкам и с регулярками, экспортируемыми из общего модуля, — это одна из самых коварных ошибок, потому что тесты на одной строке её не ловят.</p>`,
    code: `const HAS_DIGIT = /\\d+/g;

for (const s of ['a1', 'b2', 'c3', 'd4']) {
  console.log(HAS_DIGIT.test(s));
}
// true, false, true, false

// фикс
const HAS_DIGIT_OK = /\\d+/;
for (const s of ['a1', 'b2', 'c3', 'd4']) console.log(HAS_DIGIT_OK.test(s));
// true, true, true, true`,
    tip: 'Скажите, что баг не ловится юнит-тестом на одной строке — это добавляет ответу вес человека, который чинил такое в проде.' },
];
