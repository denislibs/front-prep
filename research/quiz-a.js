// Блок тестов A: JavaScript (qa1–qa45) и TypeScript (qa46–qa75).
// Формат описан в docs/quiz-format.md.
const QUIZ_A = [

  { id: 'qa1',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `console.log(typeof null);
console.log(typeof NaN);
console.log(typeof []);
console.log(typeof undeclaredVariable);`,
    options: [
      "'object', 'NaN', 'array', затем ReferenceError",
      "'null', 'number', 'object', 'undefined'",
      "'object', 'number', 'object', 'undefined'",
      "'object', 'number', 'array', затем ReferenceError",
    ],
    correct: 2,
    why: `<p><code>typeof null === 'object'</code> — историческая ошибка первой реализации: тег типа хранился в младших битах, и у <code>null</code> он совпал с тегом объекта. <code>NaN</code> — это значение типа number, поэтому <code>typeof NaN</code> даёт <strong>'number'</strong>. Массив — обычный объект, отдельного тега у него нет. А <code>typeof</code> — единственный оператор, который не бросает на необъявленном имени: он вернёт <strong>'undefined'</strong>.</p>
    <p>Самый привлекательный неверный вариант — тот, где на последней строке ReferenceError. Логика «обращение к необъявленной переменной — это ошибка» верна вообще, но для <code>typeof</code> сделано специальное исключение ещё в ES1: именно поэтому <code>typeof x === 'undefined'</code> исторически было единственным безопасным способом проверить наличие глобала. Обратите внимание: на переменную в TDZ (объявленную через <code>let</code> ниже по коду) это исключение не распространяется — там будет ReferenceError.</p>`,
    cardId: 'jsx23' },

  { id: 'qa2',
    deck: 'js',
    q: 'В каком порядке появятся строки в консоли?',
    snippet: `console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
queueMicrotask(() => console.log('4'));
console.log('5');`,
    options: [
      '1, 5, 2, 3, 4',
      '1, 5, 3, 4, 2',
      '1, 3, 4, 5, 2',
      '1, 5, 4, 3, 2',
    ],
    correct: 1,
    why: `<p>Сначала целиком выполняется синхронный код текущей макрозадачи: <strong>1</strong> и <strong>5</strong>. Регистрация таймера и колбэков ничего не выполняет. Затем наступает microtask checkpoint, и очередь микрозадач дренируется целиком в порядке постановки: <code>.then</code> встал в неё первым, <code>queueMicrotask</code> — вторым, отсюда <strong>3, 4</strong>. Макрозадача таймера берётся только на следующем обороте цикла — <strong>2</strong> последней.</p>
    <p>Вариант <code>1, 5, 4, 3, 2</code> — самая частая ошибка: кажется, что <code>queueMicrotask</code> «приоритетнее», потому что это специальный API для микрозадач. Никакого приоритета нет, очередь одна и общая, и порядок в ней определяется только моментом постановки. Отдельные приоритеты есть только у <code>process.nextTick</code> в Node — но это не веб-платформа.</p>`,
    cardId: 'js1' },

  { id: 'qa3',
    deck: 'js',
    q: 'В какой момент оборота event loop браузер вызывает колбэки requestAnimationFrame?',
    options: [
      'Сразу после текущей макрозадачи, но до дренажа очереди микрозадач',
      'В общей очереди макрозадач, наравне с setTimeout, примерно раз в 16.7 мс',
      'После style, layout и paint — в остатке кадра, вместе с requestIdleCallback',
      'Внутри шага update the rendering, до вычисления стилей и layout',
    ],
    correct: 3,
    why: `<p>rAF — не задача и не микрозадача. Это отдельная фаза внутри шага «update the rendering»: браузер решает, что кадр нужен, диспатчит отложенные <code>resize</code> и <code>scroll</code>, затем вызывает <strong>все</strong> зарегистрированные rAF-колбэки, затем колбэки <code>ResizeObserver</code> и <code>IntersectionObserver</code> — и только после этого считает style, layout, paint. Смысл именно в этом окне: DOM уже можно менять, а layout ещё не посчитан, поэтому мутация не вызовет лишнего пересчёта.</p>
    <p>Вариант «после paint, вместе с requestIdleCallback» путает две фазы. <code>requestIdleCallback</code> действительно идёт после paint, в остатке кадра, и именно поэтому не годится для анимации: изменение, сделанное там, попадёт на экран только следующим кадром. Вариант «в общей очереди макрозадач» тоже неверен: rAF привязан к vsync, а на скрытой вкладке замораживается полностью, тогда как <code>setTimeout</code> лишь троттлится до одного раза в секунду.</p>`,
    cardId: 'jsx1' },

  { id: 'qa4',
    deck: 'js',
    q: 'Надо обработать 50 000 записей, не заморозив интерфейс. Какой способ уступить управление между чанками действительно даст браузеру перерисоваться?',
    options: [
      'setTimeout или MessageChannel между чанками — новая макрозадача возвращает управление в цикл',
      'await Promise.resolve() между чанками — точка приостановки отдаёт управление браузеру',
      'queueMicrotask на следующий чанк — очередь микрозадач разбирается по одной штуке за оборот',
      'Просто уменьшить чанк до 100 элементов — короткие итерации не успевают заблокировать поток',
    ],
    correct: 0,
    why: `<p>Выход к рендеру даёт только <strong>макро</strong>задача. Очередь микрозадач дренируется целиком в цикле <code>while (queue.length)</code>, поэтому любое количество <code>await Promise.resolve()</code> и <code>queueMicrotask</code> не вернёт управление браузеру — это и есть microtask starvation: вкладка живая, CPU занят, кадров нет. Из макрозадач <code>MessageChannel</code> лучше <code>setTimeout</code>, потому что не подпадает под клампинг до 4 мс на вложенных вызовах; ещё точнее <code>scheduler.postTask</code> и <code>await scheduler.yield()</code>.</p>
    <p>Вариант с <code>await Promise.resolve()</code> — самая частая ловушка: <code>await</code> выглядит как «уступил», но это микрозадача, и она встаёт в тот же дренаж. Вариант «уменьшить чанк» тоже не решение: разбиение по количеству элементов не переживает разницу устройств — тот же код на бюджетном Android снова даст long task. Разбивать нужно по времени: обработали пачку, посмотрели <code>performance.now()</code>, съели бюджет в 5 мс — уступили.</p>`,
    cardId: 'jsx2' },

  { id: 'qa5',
    deck: 'js',
    q: 'В каком порядке выведутся буквы?',
    snippet: `async function f() {
  console.log('a');
  await null;
  console.log('b');
}

f();
Promise.resolve().then(() => console.log('c'));
console.log('d');`,
    options: [
      'a, b, d, c',
      'a, d, b, c',
      'a, d, c, b',
      'd, a, b, c',
    ],
    correct: 1,
    why: `<p>Вызов <code>f()</code> выполняет тело синхронно до первого <code>await</code>: печатается <strong>a</strong>. <code>await null</code> приостанавливает функцию и ставит продолжение в очередь микрозадач — первым. Затем регистрируется <code>.then</code> — вторая микрозадача. Дальше досчитывается синхронный код: <strong>d</strong>. И только потом дренируется очередь: <strong>b</strong>, затем <strong>c</strong>.</p>
    <p>Вариант <code>a, d, c, b</code> — след старого знания: до ES2019 <code>await</code> оборачивал операнд в лишний промис и стоил три тика, поэтому продолжение действительно оказывалось позже. Оптимизацию приняли в 2018-м, и сегодня <code>await</code> на уже готовом значении стоит ровно один тик. Вариант <code>a, b, d, c</code> предполагает, что <code>await</code> на не-промисе не приостанавливает функцию — приостанавливает всегда, даже на <code>null</code>.</p>`,
    cardId: 'jsx39' },

  { id: 'qa6',
    deck: 'js',
    q: 'Чем Symbol.for("id") отличается от Symbol("id")?',
    options: [
      'Symbol.for создаёт свойство, попадающее в Object.keys, а Symbol() — скрытое',
      'Symbol.for возвращает строковый ключ, а Symbol() — настоящий символ',
      'Symbol.for создаёт неперечислимое свойство, а Symbol() — обычное перечислимое',
      'Symbol.for берёт символ из глобального реестра: два вызова с одним ключом дадут один символ',
    ],
    correct: 3,
    why: `<p><code>Symbol('id')</code> каждый раз создаёт <strong>новый</strong> уникальный символ: <code>Symbol('id') === Symbol('id')</code> всегда <code>false</code>, а аргумент — только описание для отладки. <code>Symbol.for('id')</code> работает через глобальный реестр, общий для всех realm внутри агента: первый вызов создаёт символ и кладёт в реестр, последующие возвращают тот же самый. Обратная операция — <code>Symbol.keyFor</code>, и она работает только для реестровых символов.</p>
    <p>Варианты про <code>Object.keys</code> и перечислимость неверны для обоих: символьные ключи не попадают в <code>Object.keys</code>, <code>for...in</code> и <code>JSON.stringify</code> никогда, независимо от способа создания. Достать их можно только через <code>Object.getOwnPropertySymbols</code> или <code>Reflect.ownKeys</code>. Именно поэтому символ — способ спрятать служебное поле от обхода, но <strong>не</strong> способ сделать его приватным.</p>`,
    cardId: 'jsx5' },

  { id: 'qa7',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `const obj = {
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return 42;
    if (hint === 'string') return 'str';
    return 'default';
  },
};

console.log(+obj);
console.log(obj + '');
console.log(String(obj));`,
    options: [
      "42, 'default', 'str'",
      "42, 'str', 'str'",
      "42, 42, 'str'",
      "'str', 'default', 'str'",
    ],
    correct: 0,
    why: `<p>Унарный плюс запрашивает hint <code>'number'</code> — получаем <strong>42</strong>. Бинарный <code>+</code> не знает заранее, будет сложение или конкатенация, поэтому запрашивает hint <code>'default'</code> — получаем <strong>'default'</strong>. <code>String(obj)</code> явно просит строку, hint <code>'string'</code> — получаем <strong>'str'</strong>.</p>
    <p>Вариант <code>42, 'str', 'str'</code> отражает самое живучее заблуждение: раз справа строка, значит и hint строковый. Нет — hint зависит только от операции, а не от типа второго операнда. Полезно помнить и обратное правило: если <code>Symbol.toPrimitive</code> не объявлен, для hint <code>'default'</code> и <code>'number'</code> порядок фолбэка <code>valueOf</code> → <code>toString</code>, а для <code>'string'</code> — наоборот. Единственный встроенный тип, где <code>'default'</code> ведёт себя как <code>'string'</code>, — это <code>Date</code>.</p>`,
    cardId: 'jsx7' },

  { id: 'qa8',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `console.log([] == ![]);
console.log('' == 0);
console.log(null == 0);
console.log(null == undefined);`,
    options: [
      'false, true, false, true',
      'true, true, true, true',
      'true, true, false, true',
      'true, false, false, true',
    ],
    correct: 2,
    why: `<p><code>![]</code> вычисляется первым: массив истинный, значит <code>false</code>. Дальше <code>[] == false</code> — обе стороны приводятся к числу: <code>false</code> → 0, <code>[]</code> → <code>''</code> → 0. Отсюда <strong>true</strong>. <code>'' == 0</code> — по той же схеме <strong>true</strong>. <code>null == undefined</code> — <strong>true</strong> по отдельному правилу спецификации, без всякого приведения.</p>
    <p>А вот <code>null == 0</code> даёт <strong>false</strong>, и это самый коварный пункт. У <code>null</code> в алгоритме нестрогого равенства ровно одно исключение — равенство с <code>undefined</code>; ни к какому числу он не приводится. При этом <code>null &gt;= 0</code> уже <code>true</code>, потому что операторы сравнения идут по другому алгоритму, где <code>null</code> честно становится нулём. Именно это несогласованное поведение и есть главный аргумент в пользу <code>===</code>.</p>`,
    cardId: 'js13' },

  { id: 'qa9',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `console.log([] + {});
console.log(typeof ([] + []));
console.log(1 < 2 < 3);
console.log(3 > 2 > 1);`,
    options: [
      "'[object Object]', 'object', true, true",
      "'[object Object]', 'string', true, true",
      "NaN, 'string', true, false",
      "'[object Object]', 'string', true, false",
    ],
    correct: 3,
    why: `<p>Бинарный <code>+</code> с двумя объектами приводит оба к примитивам: <code>[]</code> → <code>''</code>, <code>{}</code> → <code>'[object Object]'</code>, склейка даёт строку. <code>[] + []</code> — это <code>'' + ''</code>, то есть пустая <strong>строка</strong>, а не объект и не массив. Цепочки сравнений вычисляются слева направо: <code>1 &lt; 2</code> → <code>true</code>, затем <code>true &lt; 3</code> → <code>1 &lt; 3</code> → <strong>true</strong>. А <code>3 &gt; 2</code> → <code>true</code>, затем <code>true &gt; 1</code> → <code>1 &gt; 1</code> → <strong>false</strong>.</p>
    <p>Вариант, где обе цепочки дают <code>true</code>, — прямое следствие чтения выражения «по-математически», как <code>1 &lt; 2 &lt; 3</code> в записи неравенства. В JS такой конструкции нет: это два независимых сравнения, и промежуточный булев результат превращается в 0 или 1. Отсюда практическое правило — диапазон проверяют явно: <code>x &gt; 1 &amp;&amp; x &lt; 3</code>.</p>`,
    cardId: 'jsx8' },

  { id: 'qa10',
    deck: 'js',
    q: 'Что выведет последняя строка?',
    snippet: `const target = {
  _v: 1,
  get v() { return this._v; },
};

const proxy = new Proxy(target, {
  get(t, key) { return t[key]; },
});

const child = Object.create(proxy);
child._v = 99;
console.log(child.v);`,
    options: [
      '1 — ловушка потеряла receiver, и геттер выполнился с this === target',
      '99 — геттер получил this === child, как при обычном наследовании',
      'undefined — через прототип-прокси аксессоры не проходят',
      'TypeError — прокси нельзя ставить прототипом объекта',
    ],
    correct: 0,
    why: `<p>Ловушка <code>get</code> получает третьим аргументом <code>receiver</code> — объект, с которого началось чтение, то есть <code>child</code>. Но реализация написана как <code>t[key]</code> и этот аргумент выбрасывает: обращение идёт напрямую к <code>target</code>, поэтому геттер вызывается с <code>this === target</code> и читает <code>target._v</code>, то есть <strong>1</strong>. Правильная запись — <code>Reflect.get(t, key, receiver)</code>: тогда геттер получит <code>this === child</code> и вернёт 99.</p>
    <p>Вариант «99» — то, чего ожидаешь по аналогии с обычным прототипным наследованием, и именно поэтому баг такой незаметный: без прокси в цепочке всё работало бы правильно. Это главный аргумент за <code>Reflect</code>: его методы повторяют сигнатуры ловушек один в один, поэтому дефолтная реализация ловушки — это ровно вызов одноимённого метода <code>Reflect</code> с теми же аргументами.</p>`,
    cardId: 'jsx10' },

  { id: 'qa11',
    deck: 'js',
    q: 'Класс с приватным полем #count обернули в Proxy и отдали наружу. Что сломается?',
    options: [
      'Приватные поля станут видны через ловушку ownKeys — утечёт инкапсуляция',
      'Ничего: приватные поля читаются через прокси так же, как обычные свойства',
      'Методы класса упадут с TypeError: у прокси нет внутреннего слота #count',
      'Прокси молча вернёт undefined вместо значения приватного поля',
    ],
    correct: 2,
    why: `<p>Приватные поля — это не свойства, а внутренние слоты, привязанные к конкретному объекту. Прокси — <strong>другой</strong> объект: слота у него нет, а ловушки на приватные поля не срабатывают в принципе, потому что доступ к <code>#count</code> вообще не проходит через [[Get]]. Поэтому вызов <code>p.increment()</code> выполнит метод с <code>this === proxy</code> и упадёт с <code>TypeError: Cannot read private member</code>. Лечится тем, что ловушка возвращает метод, привязанный к target.</p>
    <p>Вариант «ничего не сломается» выглядит разумно, если считать <code>#</code> просто соглашением об именовании, как <code>_field</code>. Разница принципиальная: подчёркивание — договорённость, символ — скрытие от обхода, а <code>#</code> — единственный настоящий механизм приватности в языке. Он же даёт побочный эффект: объект с приватными полями плохо переживает прокси, <code>structuredClone</code> и любое «оборачивание».</p>`,
    cardId: 'jsx11' },

  { id: 'qa12',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `const o = { b: 2 };
Object.defineProperty(o, 'a', { value: 1 });

console.log(o.a);
console.log(Object.keys(o));
console.log(JSON.stringify(o));`,
    options: [
      '1, ["a", "b"], {"a":1,"b":2}',
      '1, ["b"], {"b":2}',
      'undefined, ["b"], {"b":2}',
      '1, ["b"], {"a":1,"b":2}',
    ],
    correct: 1,
    why: `<p>У <code>Object.defineProperty</code> все три булевых атрибута по умолчанию <strong>false</strong>: свойство получается неперечислимым, только для чтения и без возможности переконфигурировать. Читается оно нормально — <code>o.a</code> даёт <strong>1</strong>. Но в <code>Object.keys</code>, <code>for...in</code>, spread и <code>JSON.stringify</code> попадают только перечислимые собственные свойства, поэтому там остаётся один <code>b</code>.</p>
    <p>Вариант <code>1, ["b"], {"a":1,"b":2}</code> — самая правдоподобная ошибка: кажется, что <code>JSON.stringify</code> сериализует «всё, что есть в объекте». Он опирается ровно на тот же перебор, что и <code>Object.keys</code>. Отсюда практическое следствие: свойство, добавленное через <code>defineProperty</code> без явного <code>enumerable: true</code>, бесследно исчезает при любом копировании через spread и при отправке на сервер — а обычное присваивание <code>o.a = 1</code> создало бы свойство со всеми атрибутами <code>true</code>.</p>`,
    cardId: 'jsx12' },

  { id: 'qa13',
    deck: 'js',
    q: 'Код выполняется в ES-модуле, то есть в strict mode. Что произойдёт?',
    snippet: `const proto = {
  get name() { return 'proto'; },
};

const obj = Object.create(proto);
obj.name = 'own';
console.log(obj.name);`,
    options: [
      'TypeError: у свойства name есть только геттер, присваивание бросает',
      "'own' — собственное свойство затеняет прототипный геттер",
      "'proto' — присваивание молча игнорируется, геттер продолжает работать",
      "'own' — движок создаёт сеттер автоматически, если объявлен только геттер",
    ],
    correct: 0,
    why: `<p>Присваивание свойству не создаёт собственное свойство вслепую: сначала движок идёт по цепочке прототипов и ищет, нет ли там аксессора с таким именем. Аксессор нашёлся, но сеттера у него нет — значит записать некуда. В strict mode это <strong>TypeError</strong>, и ES-модули всегда strict.</p>
    <p>Вариант <code>'proto'</code> тоже описывает реальное поведение — но в sloppy mode: там присваивание просто молча ничего не делает, и это ещё хуже, потому что баг никак себя не проявляет. Вариант <code>'own'</code> опирается на верное само по себе правило «собственное свойство затеняет прототипное»: оно работает для данных, но не для аксессоров. Обойти можно через <code>Object.defineProperty(obj, 'name', { value: 'own' })</code> — она пишет напрямую, минуя цепочку.</p>`,
    cardId: 'jsx14' },

  { id: 'qa14',
    deck: 'js',
    q: 'Что выведет последняя строка?',
    snippet: `const state = Object.freeze({
  user: { name: 'Ann' },
  tags: ['a'],
});

state.user.name = 'Bob';
state.tags.push('b');
console.log(state.user.name, state.tags.length);`,
    options: [
      "'Ann' 1 — freeze замораживает структуру рекурсивно",
      "'Ann' 2 — запись в свойство блокируется, а push разрешён",
      "'Bob' 2 — freeze поверхностный, вложенные объекты не тронуты",
      'TypeError на первой же записи в замороженный объект',
    ],
    correct: 2,
    why: `<p><code>Object.freeze</code> работает <strong>на один уровень</strong>: он делает собственные свойства неписываемыми и непереконфигурируемыми и запрещает добавлять новые. Значения этих свойств — ссылки на другие объекты — он не трогает. Поэтому и мутация <code>state.user.name</code>, и <code>state.tags.push</code> проходят штатно.</p>
    <p>Вариант с TypeError выглядит убедительно, потому что запись в <em>собственное</em> свойство замороженного объекта в strict mode действительно бросает. Но здесь записи в <code>state</code> нет ни одной: обе строки меняют вложенные объекты. Для настоящей заморозки нужен рекурсивный обход (<code>deepFreeze</code>), а в приложении обычно дешевле не замораживать вовсе, а держать дисциплину неизменяемости через структурное разделение — Immer или библиотеку персистентных структур.</p>`,
    cardId: 'jsx15' },

  { id: 'qa15',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `class Base {
  constructor() { this.render(); }
  render() { console.log('base'); }
}

class Child extends Base {
  size = 10;
  render() { console.log('size:', this.size); }
}

const c = new Child();
c.render();`,
    options: [
      "'base', затем 'size: 10'",
      "'size: undefined', затем 'size: 10'",
      "'size: 10', затем 'size: 10'",
      'ReferenceError: обращение к this до завершения super()',
    ],
    correct: 1,
    why: `<p>Методы живут на прототипе и существуют с момента вычисления класса, поэтому <code>this.render()</code> внутри конструктора базы попадает в <strong>переопределённый</strong> <code>Child.prototype.render</code>. А вот поля производного класса инициализируются только <strong>после</strong> возврата из <code>super()</code>, поэтому в этот момент <code>this.size</code> ещё не существует и читается как <code>undefined</code>. Второй вызов происходит после полного конструирования — там уже 10.</p>
    <p>Вариант <code>'base'</code> предполагает, что в конструкторе базы вызовется базовый метод. Так работает C++, но не JS: диспетчеризация всегда динамическая. Вариант с ReferenceError описывает другую ловушку того же механизма — обращение к <code>this</code> <em>до</em> вызова <code>super()</code> действительно бросает, потому что <code>this</code> в TDZ; здесь же <code>super()</code> уже идёт. Лечение общее: не вызывать перегружаемые методы из конструктора, а выносить их в явный <code>init()</code>, который зовёт статическая фабрика.</p>`,
    cardId: 'jsx62' },

  { id: 'qa16',
    deck: 'js',
    q: 'Как проверить, что произвольный объект — экземпляр класса с приватным полем #id, не бросив исключение?',
    options: [
      "obj.hasOwnProperty('#id')",
      "Object.getOwnPropertyNames(obj).includes('#id')",
      "Reflect.ownKeys(obj).some(k => String(k).startsWith('#'))",
      'Статический метод класса, возвращающий #id in obj — ergonomic brand check',
    ],
    correct: 3,
    why: `<p>С ES2022 оператор <code>in</code> умеет проверять приватные имена: внутри тела класса выражение <code>#id in obj</code> возвращает <code>true</code>, если у объекта есть соответствующий внутренний слот, и <code>false</code> вместо <code>TypeError</code> в противном случае. Стандартная форма — статический метод: <code>static isUser(v) { return #id in v; }</code>. Обычное чтение <code>obj.#id</code> вне зависимости от результата бросило бы.</p>
    <p>Все остальные варианты исходят из ложной посылки, что <code>#id</code> — это свойство с именем «решётка id». Это не так: приватные поля вообще не являются свойствами, их нет ни в <code>Object.getOwnPropertyNames</code>, ни в <code>Reflect.ownKeys</code>, ни в <code>JSON.stringify</code>, и получить к ним доступ снаружи класса невозможно никаким рефлексивным API. Именно этим они отличаются от соглашения с подчёркиванием и от символьных ключей, которые скрыты от обхода, но доступны через <code>getOwnPropertySymbols</code>.</p>`,
    cardId: 'jsx18' },

  { id: 'qa17',
    deck: 'js',
    q: 'class MyArray extends Array. Какого типа объект вернёт myArr.map(fn) и можно ли это изменить?',
    options: [
      'Обычный Array — методы встроенных типов всегда создают базовый Array',
      'MyArray, и изменить нельзя: поведение зафиксировано спецификацией',
      'MyArray, а изменить можно статическим геттером Symbol.species',
      'Обычный Array, а вернуть MyArray можно только переопределив сам map',
    ],
    correct: 2,
    why: `<p>Методы вроде <code>map</code>, <code>filter</code> и <code>slice</code> создают результат через <strong>ArraySpeciesCreate</strong>: они смотрят на <code>this.constructor[Symbol.species]</code> и конструируют объект этого класса. По умолчанию <code>Array[Symbol.species]</code> возвращает сам конструктор, поэтому у наследника результат тоже будет <code>MyArray</code>. Чтобы получить обычный массив, достаточно объявить <code>static get [Symbol.species]() { return Array; }</code>.</p>
    <p>Вариант «всегда обычный Array» — распространённое заблуждение, перенесённое из мира ES5, где наследование от Array через <code>Array.call(this)</code> действительно не работало. Сегодня <code>class X extends Array</code> корректен, длина обновляется, а вот наследование от <code>Error</code> и <code>Map</code> имеет свои особенности: у <code>Error</code> нужно вручную ставить <code>name</code> и звать <code>Error.captureStackTrace</code>, а транспиляция в ES5 ломает <code>instanceof</code> для обоих.</p>`,
    cardId: 'jsx20' },

  { id: 'qa18',
    deck: 'js',
    q: 'Что произойдёт при вызове fn()?',
    snippet: `class Counter {
  count = 0;
  inc() { this.count++; }
}

const c = new Counter();
const fn = c.inc;
fn();
console.log(c.count);`,
    options: [
      'TypeError: тело класса всегда strict, поэтому this внутри inc равен undefined',
      '1 — метод сохраняет привязку к инстансу, потому что объявлен в классе',
      '0 — this указал на globalThis, счётчик увеличился у глобального объекта',
      'NaN — this.count прочитан как undefined и увеличен до NaN',
    ],
    correct: 0,
    why: `<p><code>this</code> определяется способом вызова, а не местом объявления. При вызове <code>fn()</code> без точки нет объекта-получателя, а тело класса всегда исполняется в strict mode — значит <code>this</code> остаётся <code>undefined</code>, и чтение <code>this.count</code> бросает <strong>TypeError</strong>.</p>
    <p>Вариант «0 через globalThis» описывает поведение в sloppy mode: там <code>this</code> подменяется на глобальный объект, счётчик тихо создаётся у <code>globalThis</code>, и баг живёт годами. Именно из-за этого классы сделали строгими принудительно — ошибка теперь громкая. Вариант «1» предполагает, что методы класса автоматически привязаны: это верно только для полей-стрелок (<code>inc = () =&gt; {}</code>), которые создаются на каждом инстансе и потому стоят памяти, но зато переживают вырывание из объекта.</p>`,
    cardId: 'js5' },

  { id: 'qa19',
    deck: 'js',
    q: 'Что возвращает new.target внутри функции и где это применяют?',
    options: [
      'Прототип создаваемого объекта; применяют, чтобы подменить прототип на лету',
      'Имя класса строкой; применяют в логах и сообщениях об ошибках',
      'true при вызове через new и false при обычном вызове; больше ни для чего',
      'Вызванный конструктор либо undefined при обычном вызове; так запрещают вызов без new',
    ],
    correct: 3,
    why: `<p><code>new.target</code> — ссылка на конструктор, с которого началось создание объекта, или <code>undefined</code>, если функцию вызвали обычным образом. Отсюда два реальных применения: охрана <code>if (!new.target) throw new TypeError('use new')</code> и определение «меня инстанцируют напрямую или через наследника» — в подклассе <code>new.target</code> указывает на подкласс, что позволяет базовому классу узнать настоящее имя через <code>new.target.name</code>.</p>
    <p>Вариант с булевым значением почти верен по смыслу и потому опаснее всего: код <code>if (new.target === true)</code> не сработает никогда. Разница существенна как раз в наследовании — булев флаг не дал бы отличить <code>new Base()</code> от <code>new Child()</code>. Заодно стоит помнить: у стрелочных функций своего <code>new.target</code> нет, они берут его из внешней области, как и <code>this</code>.</p>`,
    cardId: 'jsx22' },

  { id: 'qa20',
    deck: 'js',
    q: 'Массив пришёл из iframe, и arr instanceof Array возвращает false. Почему и чем заменить проверку?',
    options: [
      'Массив был сериализован в объект при передаче; заменить на typeof arr === "object"',
      'У другого окна свой Array.prototype; заменить на Array.isArray с кросс-realm проверкой',
      'instanceof не работает со встроенными типами; заменить на arr.constructor === Array',
      'Прототип потерян при структурном клонировании; заменить на проверку "length" in arr',
    ],
    correct: 1,
    why: `<p><code>instanceof</code> не сравнивает «типы»: он идёт по цепочке прототипов объекта и ищет в ней конкретный объект <code>Array.prototype</code> из <strong>текущего</strong> realm. У iframe свой глобальный объект и свой <code>Array.prototype</code>, поэтому проверка честно возвращает <code>false</code>. <code>Array.isArray</code> смотрит на внутренний слот значения, а не на прототип, и потому работает через границы realm — это же относится к Worker и к <code>vm</code> в Node.</p>
    <p>Вариант с <code>arr.constructor === Array</code> — заманчивая замена, но она страдает ровно той же болезнью: <code>constructor</code> берётся из чужого прототипа и указывает на чужой <code>Array</code>. Более того, <code>constructor</code> — обычное перезаписываемое свойство, так что на него нельзя опираться даже внутри одного realm. Проверка на наличие <code>length</code> ловит и строки, и arguments, и любой объект с таким полем.</p>`,
    cardId: 'jsx24' },

  { id: 'qa21',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `class Money {
  get [Symbol.toStringTag]() { return 'Money'; }
}

const m = new Money();
console.log(Object.prototype.toString.call(m));
console.log(Object.prototype.toString.call(null));
console.log(String(m));`,
    options: [
      "'[object Object]', '[object Null]', '[object Object]'",
      "'[object Money]', '[object Null]', '[object Money]'",
      "'[object Money]', 'null', '[object Money]'",
      "'[object Money]', '[object Undefined]', 'Money'",
    ],
    correct: 1,
    why: `<p><code>Object.prototype.toString</code> строит результат из <code>Symbol.toStringTag</code>, если тот определён, — отсюда <strong>'[object Money]'</strong>. Для <code>null</code> и <code>undefined</code> в спецификации прописаны отдельные ветки, дающие <strong>'[object Null]'</strong> и <code>'[object Undefined]'</code>. А <code>String(m)</code> просто зовёт унаследованный <code>toString</code>, то есть тот же самый метод — результат совпадает.</p>
    <p>Вариант <code>'null'</code> второй строкой смешивает два разных механизма: строку <code>'null'</code> вернул бы <code>String(null)</code>, а не <code>Object.prototype.toString.call(null)</code>. Практический смысл приёма — получить «настоящий» тип там, где <code>typeof</code> бесполезен: <code>'[object Date]'</code>, <code>'[object RegExp]'</code>, <code>'[object Map]'</code>. Но помните, что тег переопределяем, поэтому это диагностика, а не защита: для массивов надёжнее <code>Array.isArray</code>.</p>`,
    cardId: 'jsx25' },

  { id: 'qa22',
    deck: 'js',
    q: 'Как хранить и складывать денежные суммы во фронтенде, чтобы не ловить 0.1 + 0.2?',
    options: [
      'Хранить number и округлять итог через toFixed(2) непосредственно перед выводом',
      'Хранить number, а при сравнении допускать разницу меньше Number.EPSILON',
      'Хранить целое число минорных единиц (копеек) и форматировать только при выводе',
      'Хранить строку и приводить через parseFloat перед каждой арифметической операцией',
    ],
    correct: 2,
    why: `<p>Числа в JS — это IEEE-754 double: 0.1 и 0.2 не представимы точно в двоичной дроби, поэтому их сумма даёт 0.30000000000000004. Стандартное решение — вообще не хранить дробь: держать сумму целым числом копеек (или центов) и делить на 100 один раз, в момент форматирования через <code>Intl.NumberFormat</code>. Целые числа точны до <code>2 ** 53 - 1</code>, чего хватает с огромным запасом.</p>
    <p>Округление через <code>toFixed(2)</code> — самый популярный неверный ответ. Оно маскирует проблему на выводе, но ошибка продолжает накапливаться в самих вычислениях, а сам <code>toFixed</code> округляет не так, как ждут: <code>(1.005).toFixed(2)</code> даёт <code>'1.00'</code>, потому что 1.005 на самом деле чуть меньше. Сравнение через <code>Number.EPSILON</code> подходит для инженерных расчётов, но не для денег: там нужна точность, а не допуск.</p>`,
    cardId: 'jsx26' },

  { id: 'qa23',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `console.log(Object.is(NaN, NaN), NaN === NaN);
console.log(Object.is(0, -0), 0 === -0);
console.log(new Set([NaN, NaN]).size);
console.log([0].includes(-0));`,
    options: [
      'true false, false true, 1, true',
      'true false, false true, 2, false',
      'false false, true true, 1, true',
      'true true, false false, 1, false',
    ],
    correct: 0,
    why: `<p>В языке три алгоритма сравнения. <strong>Strict equality</strong> считает <code>NaN !== NaN</code>, но <code>0 === -0</code>. <strong>SameValue</strong> (это <code>Object.is</code>) считает <code>NaN</code> равным себе, но различает нули. <strong>SameValueZero</strong> — компромисс: <code>NaN</code> равен себе, нули не различаются; по нему работают <code>Set</code>, ключи <code>Map</code> и <code>Array.prototype.includes</code>. Отсюда: <code>Set</code> схлопывает два <code>NaN</code> в один элемент, а <code>[0].includes(-0)</code> даёт <code>true</code>.</p>
    <p>Вариант с <code>size === 2</code> и <code>includes(-0) === false</code> — результат переноса правил <code>===</code> на коллекции: если <code>NaN !== NaN</code>, значит и в Set их должно быть два. Это как раз тот случай, где спецификация сознательно отступила от <code>===</code>: дедупликация, в которой <code>NaN</code> плодится бесконечно, была бы бесполезна. Обратный контраст полезно помнить: <code>indexOf</code> остался на <code>===</code> и <code>NaN</code> не находит никогда.</p>`,
    cardId: 'jsx28' },

  { id: 'qa24',
    deck: 'js',
    q: 'API отдаёт id как число 9007199254740993, и после JSON.parse значение портится. Как правильно решить?',
    options: [
      'Прочитать как number и сравнивать идентификаторы с допуском Number.EPSILON',
      'Обернуть после парсинга: BigInt(data.id) восстановит утраченную точность',
      'Передать в JSON.parse reviver, возвращающий Number(value) для поля id',
      'Договориться, чтобы бэкенд отдавал id строкой: точность теряется ещё до reviver',
    ],
    correct: 3,
    why: `<p>Все целые числа точны только до <code>Number.MAX_SAFE_INTEGER</code>, то есть <code>2 ** 53 - 1 = 9007199254740991</code>. Значение 9007199254740993 в double не представимо и округляется до 9007199254740992 <strong>в момент парсинга</strong>, ещё до того, как что-либо получит управление. Единственное надёжное решение — договориться о строке в контракте API; альтернатива — парсер вроде <code>json-bigint</code>, который читает число как <code>BigInt</code> вместо <code>Number</code>.</p>
    <p>Вариант с <code>BigInt(data.id)</code> — самая частая попытка: он выглядит как «повысили точность», но конвертирует уже испорченное число, и результат будет 9007199254740992n. Reviver не помогает по той же причине: он получает уже разобранное значение. Полезный признак проблемы — <code>Number.isSafeInteger(id)</code> возвращает <code>false</code>, и это стоит поставить проверкой на границе.</p>`,
    cardId: 'jsx29' },

  { id: 'qa25',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `const s = 'a👍b';
console.log(s.length);
console.log([...s].length);
console.log(s.slice(0, 2));`,
    options: [
      "3, 3, строка 'a👍'",
      "4, 4, строка 'a👍'",
      "4, 3, строка 'a👍'",
      "4, 3, 'a' плюс половина суррогатной пары",
    ],
    correct: 3,
    why: `<p><code>length</code> считает <strong>кодовые единицы UTF-16</strong>, а эмодзи вне BMP занимает суррогатную пару, то есть две единицы — отсюда 4. Spread идёт через строковый итератор, который группирует суррогатные пары в кодовые точки, — отсюда 3. А <code>slice(0, 2)</code> режет по тем же кодовым единицам и отрубает от пары старший суррогат: получается <code>'a'</code> и одиночный <code>\\uD83D</code>, который отрисуется как «крякозябра».</p>
    <p>Вариант <code>4, 3, 'a👍'</code> — почти правильный ответ, в котором забыли, что <code>slice</code> живёт в той же системе координат, что и <code>length</code>. Это и есть практическая ловушка: обрезка описания «до 100 символов» ломает эмодзи на границе. Для резки безопаснее <code>[...s].slice(0, n).join('')</code>, а полностью корректно — по графемам через <code>Intl.Segmenter</code>: флаги и семьи состоят из нескольких кодовых точек, и даже spread разобьёт их на части.</p>`,
    cardId: 'jsx30' },

  { id: 'qa26',
    deck: 'js',
    q: 'Что structuredClone умеет из того, чего не умеет JSON round-trip, и чего он всё-таки не умеет?',
    options: [
      'Клонирует функции и DOM-узлы, но теряет содержимое Map и Set',
      'Клонирует Map, Set, Date и циклические ссылки; функции и классы не переносит',
      'Клонирует всё без исключений, единственное ограничение — размер структуры',
      'Клонирует прототипы классов и геттеры, но ломается на циклических ссылках',
    ],
    correct: 1,
    why: `<p><code>structuredClone</code> реализует алгоритм structured clone из HTML: он понимает <code>Map</code>, <code>Set</code>, <code>Date</code>, <code>RegExp</code>, <code>ArrayBuffer</code>, <code>Blob</code>, типизированные массивы и корректно обрабатывает циклические ссылки и повторяющиеся ссылки на один объект. Чего он не умеет — <strong>функции, символы и прототипы</strong>: экземпляр класса вернётся простым объектом с теми же полями, а функция в свойстве вызовет <code>DataCloneError</code>.</p>
    <p>Вариант «клонирует всё» звучит правдоподобно, потому что метод действительно закрывает почти все дыры <code>JSON.parse(JSON.stringify(x))</code>: тот теряет <code>undefined</code>, превращает <code>Date</code> в строку, <code>Map</code> и <code>Set</code> — в пустые объекты и падает на циклах. Но именно потеря прототипа делает <code>structuredClone</code> непригодным для доменных объектов с методами — там нужен либо ручной <code>clone()</code>, либо переход на плоские структуры данных.</p>`,
    cardId: 'jsx33' },

  { id: 'qa27',
    deck: 'js',
    q: 'Передаём в Worker ArrayBuffer на 50 МБ. Чем передача через transfer отличается от обычной?',
    options: [
      'Transfer сжимает буфер перед копированием, поэтому передача занимает меньше времени',
      'Разницы нет: ArrayBuffer и так передаётся между потоками по ссылке',
      'Transfer переносит владение без копии: в исходном потоке буфер становится detached',
      'Transfer создаёт общую память, и оба потока видят изменения друг друга',
    ],
    correct: 2,
    why: `<p>Обычный <code>postMessage(buf)</code> делает structured clone — то есть полную копию 50 МБ, с задержкой и двойным расходом памяти. Список transfer (<code>postMessage(buf, [buf])</code>) вместо копирования <strong>переносит владение</strong>: указатель отдаётся другому потоку за константное время, а в исходном буфер становится detached — его <code>byteLength</code> обнуляется, и любое чтение бросает. Переносимы <code>ArrayBuffer</code>, <code>MessagePort</code>, <code>ImageBitmap</code>, <code>OffscreenCanvas</code>, потоки.</p>
    <p>Вариант «создаёт общую память» описывает <code>SharedArrayBuffer</code> — это другой механизм: там буфер действительно виден обоим потокам одновременно, но за него нужно платить заголовками кросс-origin изоляции (<code>COOP</code> и <code>COEP</code>) и синхронизацией через <code>Atomics</code>. Transfer, наоборот, гарантирует, что в каждый момент владелец ровно один, — поэтому гонок по данным быть не может в принципе.</p>`,
    cardId: 'jsx34' },

  { id: 'qa28',
    deck: 'js',
    q: 'Что выведет console.log в main.js?',
    snippet: `// counter.js
export let count = 0;
export function inc() { count++; }

// main.js
import { count, inc } from './counter.js';
inc();
console.log(count);`,
    options: [
      '1 — импорт это живая связь с ячейкой модуля, а не копия значения',
      '0 — импортируется копия значения на момент выполнения импорта',
      'SyntaxError — экспортировать let спецификация запрещает',
      'TypeError — импортированное имя доступно только для чтения',
    ],
    correct: 0,
    why: `<p>ES-модули экспортируют <strong>live bindings</strong>: импортированное имя — это ссылка на ту же ячейку памяти, что и переменная в модуле-источнике. Когда <code>inc()</code> меняет <code>count</code> внутри <code>counter.js</code>, импортёр видит новое значение немедленно. Именно на этом свойстве держится корректная работа циклических зависимостей в ESM: имя может быть объявлено, но ещё не инициализировано, и обращение к нему до инициализации даст ReferenceError по правилам TDZ.</p>
    <p>Вариант «0» — это поведение CommonJS: там <code>module.exports</code> копируется по значению в момент <code>require</code>, и переприсваивание в источнике импортёр уже не увидит. Разница важна на практике при миграции. Про TypeError: импортированное имя действительно доступно только для чтения — попытка <code>count = 5</code> в <code>main.js</code> была бы ошибкой, — но здесь никто ему не присваивает, меняет значение сам модуль-владелец.</p>`,
    cardId: 'jsx36' },

  { id: 'qa29',
    deck: 'js',
    q: 'В чём главный риск top-level await в модуле, который импортируют другие?',
    options: [
      'Он задерживает выполнение всех импортёров: граф модулей ждёт его резолва',
      'Он запрещён в браузерах и работает только в Node с отдельным флагом',
      'Он переводит модуль в CommonJS и тем самым ломает tree shaking',
      'Он выполняется до статических импортов, поэтому зависимости ещё не готовы',
    ],
    correct: 0,
    why: `<p>Top-level await делает модуль асинхронным, и все его импортёры — тоже: их выполнение откладывается до резолва. Модуль конфигурации, который на старте ждёт сетевой запрос, задерживает загрузку всего приложения, а если промис не резолвится, приложение просто не стартует без единой ошибки. Отсюда практика: TLA допустим в точке входа, где ожидание осознанно, и нежелателен в библиотечных модулях.</p>
    <p>Вариант «выполняется до статических импортов» переворачивает порядок: зависимости как раз уже вычислены к моменту выполнения тела модуля. А вариант с CommonJS путает причину и следствие — TLA невозможно транспилировать в CJS, поэтому бандлер выдаст ошибку конфигурации, но сам по себе он формат модуля не меняет. Ещё одна реальная опасность, которую стоит назвать вслух: TLA в двух модулях, ожидающих друг друга, даёт настоящий deadlock.</p>`,
    cardId: 'jsx37' },

  { id: 'qa30',
    deck: 'js',
    q: 'Чем разрешится промис от f()?',
    snippet: `async function f() {
  try {
    return 'try';
  } finally {
    return 'finally';
  }
}

f().then(console.log);`,
    options: [
      "'try' — return в try фиксирует значение, finally выполняется уже после",
      'Промис отклонится: два return в одной функции — ошибка выполнения',
      "'try finally' — значения объединяются в порядке выполнения блоков",
      "'finally' — completion из finally вытесняет предыдущую, включая исключения",
    ],
    correct: 3,
    why: `<p>Блок <code>try</code> формирует completion record типа «return» со значением <code>'try'</code>. Затем обязательно выполняется <code>finally</code>, и его собственный <code>return</code> порождает новую completion, которая <strong>вытесняет</strong> предыдущую. Печатается <code>'finally'</code>. Хуже того: если бы <code>try</code> бросил исключение, <code>return</code> в <code>finally</code> проглотил бы и его — ошибка исчезла бы бесследно, без стека и без записи в мониторинге. Ровно поэтому существует правило линтера <code>no-unsafe-finally</code>.</p>
    <p>Вариант <code>'try'</code> опирается на верную половину знания: значение действительно вычисляется в <code>try</code> до входа в <code>finally</code>. Но вычисленное значение — ещё не результат функции, а лишь completion, и любой <code>return</code>, <code>throw</code>, <code>break</code> или <code>continue</code> в <code>finally</code> её перезаписывает. Практическое правило простое: <code>finally</code> — только для освобождения ресурса, никаких <code>return</code> и никаких брошенных ошибок оттуда.</p>`,
    cardId: 'jsx40' },

  { id: 'qa31',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `async function fail() { throw new Error('boom'); }

async function f() {
  try {
    return fail();
  } catch {
    return 'caught';
  }
}

f().then(
  (v) => console.log('ok', v),
  (e) => console.log('rejected', e.message),
);`,
    options: [
      'ok caught — catch перехватит отклонение возвращённого промиса',
      'rejected boom — точки приостановки внутри try нет, поэтому catch не сработал',
      'ok undefined — return промиса из async-функции даёт undefined',
      'В консоли будет unhandled rejection, а сама f() зависнет навсегда',
    ],
    correct: 1,
    why: `<p><code>try/catch</code> в async-функции ловит исключения, а не отклонения промисов. Точка, где отклонение <em>превращается</em> в исключение, — это <code>await</code>. В коде его нет: <code>return fail()</code> возвращает промис, управление покидает блок <code>try</code>, и уже снаружи async-функция резолвится этим промисом, а его отклонение становится отклонением <code>f()</code>. Достаточно написать <code>return await fail()</code> — и <code>catch</code> сработает штатно.</p>
    <p>Вариант «ok caught» — самый естественный: код визуально выглядит так, будто ошибка возникает внутри блока. Именно поэтому старое правило линтера <code>no-return-await</code>, требовавшее убирать «лишний» <code>await</code>, сегодня считается вредным и заменено на <code>return-await</code> в режиме <code>in-try-catch</code>. TypeScript эту разницу не подсвечивает: типы у обоих вариантов совпадают, ошибка чисто рантаймовая.</p>`,
    cardId: 'jsx64' },

  { id: 'qa32',
    deck: 'js',
    q: 'В каком случае возникнет unhandledrejection, хотя обработчик ошибки в коде есть?',
    options: [
      'Когда .catch навешан сразу после .then в той же цепочке вызовов',
      'Когда промис создан внутри try/catch и на нём стоит await',
      'Когда промис создан и отложен, а .catch навешан уже в следующем тике',
      'Когда используется Promise.allSettled без разбора статусов rejected',
    ],
    correct: 2,
    why: `<p>Событие <code>unhandledrejection</code> выстреливает, если к моменту опустошения очереди микрозадач у отклонённого промиса нет ни одного обработчика отказа. Поэтому <code>const p = load(); setTimeout(() =&gt; p.catch(handle), 0)</code> сначала поднимет тревогу и только потом обработает ошибку. Тот же эффект даёт сохранение промиса в переменную «на потом» и передача его в другой модуль через тик.</p>
    <p>Вариант с <code>allSettled</code> — правдоподобная, но неверная ловушка: <code>Promise.allSettled</code> <strong>никогда</strong> не отклоняется, он всегда резолвится массивом со статусами, поэтому необработанного отказа там быть не может. А вот <code>Promise.all</code> действительно оставляет остальные промисы без обработчика после первого отказа — вот там событие возможно. В проде это ловят подпиской <code>window.addEventListener('unhandledrejection', ...)</code> и отправкой в мониторинг, не забыв <code>event.preventDefault()</code>, чтобы не засорять консоль.</p>`,
    cardId: 'jsx41' },

  { id: 'qa33',
    deck: 'js',
    q: 'Перехватываем ошибку сети и пробрасываем свою доменную. Как не потерять исходную причину?',
    options: [
      'Скопировать стек присваиванием: err.stack = e.stack перед пробросом',
      'Пробросить исходную ошибку, дописав контекст в её message',
      'new AppError("не удалось загрузить", { cause: e }) — стандартное поле cause',
      'Обернуть в AggregateError: он специально предназначен для хранения причины',
    ],
    correct: 2,
    why: `<p>С ES2022 у конструктора <code>Error</code> есть второй аргумент с полем <code>cause</code>. Оно образует цепочку: <code>e.cause.cause</code> ведёт к первопричине, DevTools печатает её отдельным блоком, а Sentry и подобные сервисы умеют разворачивать цепочку в интерфейсе. Это ровно то, что раньше делали самописным полем <code>originalError</code>, только стандартно и с поддержкой инструментов.</p>
    <p>Ручное копирование <code>stack</code> — исторический приём, и он хуже по двум причинам: стек становится ложью (заголовок от одной ошибки, кадры от другой), а сам объект-причина с его собственными полями — кодом ответа, URL, телом — теряется. Вариант с <code>AggregateError</code> путает задачи: этот класс существует для <strong>нескольких</strong> ошибок сразу (его создаёт <code>Promise.any</code>) и хранит их в поле <code>errors</code>; для одной причины он избыточен.</p>`,
    cardId: 'jsx42' },

  { id: 'qa34',
    deck: 'js',
    q: 'Чем Promise.any отличается от Promise.race и что придёт в catch, если упали все промисы?',
    options: [
      'any дожидается всех и отдаёт массив результатов; в catch придёт массив ошибок',
      'any — это алиас race, добавленный в ES2021; в catch придёт первая по времени ошибка',
      'any берёт первый завершившийся любым способом; в catch придёт причина этого отказа',
      'any берёт первый успешный, игнорируя отказы; в catch придёт AggregateError с errors',
    ],
    correct: 3,
    why: `<p><code>Promise.race</code> завершается первым <strong>любым</strong> исходом: если самым быстрым оказался отказ, вся гонка отклоняется. <code>Promise.any</code> ждёт первый <strong>успех</strong> и игнорирует отказы по пути; отклоняется он только когда провалились все, и в этом случае причиной становится <code>AggregateError</code>, у которого в поле <code>errors</code> лежит массив всех ошибок в порядке исходных промисов.</p>
    <p>Вариант «в catch первая по времени ошибка» — типичное смешение <code>any</code> и <code>race</code>. Разница практическая: <code>race</code> берут для таймаутов (гонка запроса с отложенным отказом), а <code>any</code> — для фолбэков вроде нескольких зеркал CDN, где отказ одного узла не должен ронять операцию. Ещё одна деталь про <code>race</code>: она никогда не резолвится, если передать пустой массив, тогда как <code>any</code> на пустом массиве сразу отклоняется пустым <code>AggregateError</code>.</p>`,
    cardId: 'jsx43' },

  { id: 'qa35',
    deck: 'js',
    q: 'Что выведет этот цикл валидации?',
    snippet: `const HAS_DIGIT = /\\d+/g;

for (const s of ['a1', 'b2', 'c3', 'd4']) {
  console.log(HAS_DIGIT.test(s));
}`,
    options: [
      'true, false, true, false',
      'true, true, true, true',
      'false, false, false, false',
      'true, true, false, false',
    ],
    correct: 0,
    why: `<p>У регулярки с флагом <code>g</code> (и с <code>y</code>) есть изменяемое состояние — <code>lastIndex</code>, и <code>test</code> начинает поиск именно с него. Разберём: на <code>'a1'</code> совпадение найдено на позиции 1, <code>lastIndex</code> становится 2 — <code>true</code>. На <code>'b2'</code> поиск стартует с позиции 2, а строка длиной 2 — совпадения нет, <code>false</code>, и при неудаче <code>lastIndex</code> сбрасывается в 0. Дальше цикл повторяется, отсюда идеальное чередование.</p>
    <p>Вариант «все true» — то, что даст интуиция и юнит-тест на одной строке; поэтому баг обычно доезжает до прода. Правильный фикс здесь — <strong>убрать флаг g</strong>: для проверки факта совпадения он не нужен вовсе, а без него <code>lastIndex</code> не используется. Ручной сброс <code>RE.lastIndex = 0</code> работает, но его легко забыть; неомутирующая альтернатива — <code>String.prototype.match</code> или <code>matchAll</code>, которая работает с внутренним клоном регулярки.</p>`,
    cardId: 'jsx65' },

  { id: 'qa36',
    deck: 'js',
    q: 'Регулярка /^(\\w+\\s?)+$/ вешает вкладку на длинной строке без совпадения. Как называется проблема и что чинить?',
    options: [
      'Утечка памяти в движке регулярок; чинится флагом u и пересозданием объекта',
      'Катастрофический бэктрекинг; чинится устранением вложенных квантификаторов',
      'Переполнение lastIndex; чинится сбросом lastIndex перед каждым вызовом',
      'Блокировка на подборе кодировки; чинится нормализацией строки в форму NFC',
    ],
    correct: 1,
    why: `<p>Классический бэктрекинг-движок при неудаче перебирает все способы разбить строку на группы. Вложенный квантификатор — <code>+</code> внутри группы, которая сама под <code>+</code>, — даёт экспоненциальное число вариантов: строка из 30 символов без финального совпадения перебирается около миллиарда раз и блокирует поток. Это ReDoS: уязвимость, которую можно эксплуатировать одним запросом. Чинят переписыванием без вложенного квантификатора, например <code>/^\\w+(\\s\\w+)*$/</code>, или сменой на нежадный разбор без амбивалентности.</p>
    <p>Вариант с <code>lastIndex</code> — реальная и частая проблема тех же регулярок, но совсем другая: она даёт неверный результат, а не зависание. Отличать легко по симптому: здесь поток занят на 100% и не отвечает. Обнаруживать такие шаблоны помогают <code>eslint-plugin-regexp</code>, инструменты вроде <code>recheck</code>, а на новых движках — RE2 без бэктрекинга, где проблема невозможна по построению.</p>`,
    cardId: 'jsx47' },

  { id: 'qa37',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `const nums = [10, 9, 100, 1];
console.log(nums.sort());
console.log(nums === nums.sort());`,
    options: [
      '[1, 9, 10, 100] и true',
      '[1, 10, 100, 9] и true',
      '[1, 10, 100, 9] и false',
      '[10, 9, 100, 1] и false',
    ],
    correct: 1,
    why: `<p>Без компаратора <code>sort</code> приводит элементы к строкам и сравнивает их по кодовым единицам UTF-16: <code>'1' &lt; '10' &lt; '100' &lt; '9'</code>. Отсюда <strong>[1, 10, 100, 9]</strong>. Второе — <code>sort</code> мутирует исходный массив и возвращает <strong>ссылку на него же</strong>, поэтому сравнение даёт <code>true</code>. Для чисел компаратор обязателен: <code>(a, b) =&gt; a - b</code>.</p>
    <p>Вариант <code>[1, 9, 10, 100]</code> — то, чего ждёшь по здравому смыслу, и это самая частая ошибка в реальном коде: на массиве <code>[1, 2, 3]</code> баг не виден, а проявляется, как только появляется двузначное число. Про мутацию тоже стоит помнить: <code>const</code> от неё не защищает, а безопасная копия делается через <code>toSorted</code> (ES2023) или <code>[...arr].sort()</code>. Сама сортировка с ES2019 гарантированно стабильна — на это уже можно опираться.</p>`,
    cardId: 'jsx48' },

  { id: 'qa38',
    deck: 'js',
    q: 'Сортируем список фамилий на русском обычным a < b. Почему порядок получается неверным?',
    options: [
      'Сравнение идёт по кодовым точкам UTF-16, а не по алфавиту: буква ё уезжает за я',
      'Строки в JS сравниваются по длине, и только при равной длине — посимвольно',
      'V8 сравнивает по байтам UTF-8, поэтому кириллица упорядочивается в обратную сторону',
      'Оператор < определён только для чисел, на строках он всегда возвращает false',
    ],
    correct: 0,
    why: `<p>Операторы <code>&lt;</code> и <code>&gt;</code> для строк выполняют побайтовое (точнее, покодовое) сравнение кодовых единиц UTF-16. Кириллица идёт диапазоном А–я, а вот <strong>ё</strong> живёт отдельно, в позиции U+0451 — после <code>я</code>. Плюс все заглавные буквы оказываются меньше всех строчных, поэтому «Яблоко» встанет раньше «арбуза».</p>
    <p>Правильный инструмент — <code>a.localeCompare(b, 'ru')</code>, а для сортировки длинного списка — <code>new Intl.Collator('ru').compare</code>, потому что коллатор создаётся один раз и не пересоздаёт таблицы правил на каждое сравнение (разница на десятках тысяч элементов — порядок величины). Полезные опции: <code>sensitivity: 'base'</code> игнорирует регистр и диакритику, а <code>numeric: true</code> даёт «естественную» сортировку, где <code>item2</code> идёт перед <code>item10</code>.</p>`,
    cardId: 'jsx49' },

  { id: 'qa39',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `const arr = [1, , 3];
console.log(arr.length);
console.log(arr.map((x) => x * 2));
console.log(arr.indexOf(undefined));
console.log(arr.includes(undefined));`,
    options: [
      '2, [2, 6], -1, false',
      '3, [2, NaN, 6], 1, true',
      '3, [2, empty, 6], 1, true',
      '3, [2, empty, 6], -1, true',
    ],
    correct: 3,
    why: `<p>Ключ ко всем четырём строкам один: знает конкретный метод про дырки или считает их за <code>undefined</code>. <code>length</code> — это максимальный индекс плюс один, реальное число элементов дало бы <code>Object.keys(arr).length === 2</code>. <code>map</code> пропускает дырку (колбэк для неё не вызывается), но <strong>сохраняет</strong> её в результате — массив остаётся разреженным. <code>indexOf</code> дырки пропускает и потому <code>undefined</code> не находит (<code>-1</code>), а <code>includes</code> читает их как <code>undefined</code> и возвращает <code>true</code>.</p>
    <p>Вариант <code>[2, NaN, 6]</code> и <code>indexOf === 1</code> исходит из того, что дырка — это обычный <code>undefined</code>. Разделение историческое: методы из ES5 проектировались, когда разреженный массив считался «данными с пропусками», а итератор, <code>includes</code> и методы ES2023 появились уже с моделью «массив длины n — это n значений». Материализовать дырки можно через <code>Array.from(arr)</code>, <code>[...arr]</code> или <code>arr.flat(0)</code>.</p>`,
    cardId: 'jsx63' },

  { id: 'qa40',
    deck: 'js',
    q: 'Зачем в ES2023 добавили toSorted, toSpliced, toReversed и with?',
    options: [
      'Они быстрее старых методов: движок оптимизирует их через copy-on-write',
      'Они корректно работают с разреженными массивами, пропуская дырки',
      'Они возвращают новую копию вместо мутации исходного массива',
      'Они добавлены только для TypedArray, у обычных массивов это полифилл',
    ],
    correct: 2,
    why: `<p>Это неомутирующие двойники <code>sort</code>, <code>splice</code>, <code>reverse</code> и присваивания по индексу. <code>arr.with(0, 'x')</code> заменяет мнимую «копию с изменением» на один вызов вместо <code>const copy = [...arr]; copy[0] = 'x';</code>. Практический смысл — код в React и любом сторе с иммутабельным состоянием: <code>setItems(items.toSorted(cmp))</code> вместо ошибки <code>items.sort()</code>, которая мутирует стейт на месте и не вызывает перерисовку.</p>
    <p>Вариант про скорость — правдоподобная, но неверная мотивация: копия честно создаётся, и по времени это то же самое, что <code>[...arr].sort()</code>. Про разреженные массивы наоборот: новые методы дырки <strong>материализуют</strong> в <code>undefined</code>, а не пропускают — они наследуют модель итератора, а не ES5. Заодно к этой же семье относится <code>at()</code> с поддержкой отрицательных индексов: <code>arr.at(-1)</code> вместо <code>arr[arr.length - 1]</code>.</p>`,
    cardId: 'jsx51' },

  { id: 'qa41',
    deck: 'js',
    q: 'Чем Object.groupBy отличается от Map.groupBy?',
    options: [
      'Object.groupBy сохраняет порядок вставки ключей, а Map.groupBy — нет',
      'Map.groupBy принимает только строковые ключи, Object.groupBy — любые',
      'Object.groupBy мутирует исходный массив, Map.groupBy создаёт копию',
      'Map.groupBy допускает ключи любого типа; Object.groupBy приводит ключ к строке',
    ],
    correct: 3,
    why: `<p>Разница ровно в природе контейнера. <code>Object.groupBy</code> кладёт группы в объект, поэтому ключ проходит через <code>ToPropertyKey</code> — группировка по объекту-категории схлопнет все элементы в один ключ <code>'[object Object]'</code>. <code>Map.groupBy</code> использует <code>Map</code>, где ключом может быть что угодно, и сравнение идёт по SameValueZero. Обе функции статические и обе возвращают новую структуру, ничего не мутируя.</p>
    <p>Вариант про порядок ключей — правдоподобная, но неверная деталь: и <code>Map</code>, и объект сохраняют порядок вставки, только у объекта целочисленные ключи всё равно всплывают наверх и сортируются по возрастанию. Про <code>Object.groupBy</code> полезно знать ещё одно: результат создаётся с прототипом <code>null</code>, поэтому у него нет <code>hasOwnProperty</code> и <code>toString</code>, зато нет и риска коллизии с <code>__proto__</code>.</p>`,
    cardId: 'jsx52' },

  { id: 'qa42',
    deck: 'js',
    q: 'Что потеряется, если сохранить объект состояния через JSON.stringify и прочитать обратно?',
    options: [
      'Числа потеряют точность, строки будут экранированы, массивы станут объектами',
      'Только функции; Map, Set и Date переживают round-trip корректно',
      'undefined, функции и символы в свойствах, а Map и Set превратятся в пустые {}',
      'Вложенность глубже трёх уровней и все свойства со значением null',
    ],
    correct: 2,
    why: `<p><code>JSON.stringify</code> молча выбрасывает свойства со значением <code>undefined</code>, функциями и символами (в массиве они, наоборот, становятся <code>null</code>), не знает про <code>Map</code> и <code>Set</code> и сериализует их как <code>{}</code>, теряет прототип, а <code>Date</code> превращает в ISO-строку, которая после <code>parse</code> так строкой и останется. На циклической ссылке он бросает <code>TypeError</code>, а <code>BigInt</code> — тоже <code>TypeError</code>, причём без всякого обходного пути, кроме <code>toJSON</code>.</p>
    <p>Вариант «только функции» — половина правды и потому самый заманчивый: про функции помнят все, а вот исчезновение <code>Map</code> замечают уже в проде, когда стор восстанавливается пустым. Полезно помнить и про управляющие рычаги: второй аргумент-replacer или метод <code>toJSON</code> на объекте позволяют сериализовать <code>Map</code> явно, а reviver в <code>JSON.parse</code> — восстановить <code>Date</code> и <code>BigInt</code> обратно.</p>`,
    cardId: 'jsx54' },

  { id: 'qa43',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `const { a = 1 } = { a: undefined };
const { b = 2 } = { b: null };
const [x = 3, y = 4] = [0, undefined];

console.log(a, b, x, y);`,
    options: [
      '1, 2, 3, 4',
      '1, null, 0, 4',
      'undefined, null, 0, 4',
      '1, 2, 0, 4',
    ],
    correct: 1,
    why: `<p>Значение по умолчанию подставляется <strong>только</strong> когда извлечённое значение строго равно <code>undefined</code>. <code>null</code> — полноценное значение, дефолт не срабатывает, поэтому <code>b === null</code>. Ноль тоже значение: <code>x === 0</code>, дефолт 3 не применился. А вот <code>y</code> получил явный <code>undefined</code> из массива и потому стал 4.</p>
    <p>Вариант <code>1, 2, 3, 4</code> исходит из «дефолт подставляется для всего ложного» — это правило работает у <code>||</code>, но не у деструктуризации. Ближайший аналог здесь — оператор <code>??</code>, который тоже реагирует лишь на <code>null</code> и <code>undefined</code>; разница в том, что деструктуризация не реагирует даже на <code>null</code>. Отсюда практический вывод: если API возвращает <code>null</code> для «нет значения», дефолты в деструктуризации не спасут — нужен явный <code>?? fallback</code>.</p>`,
    cardId: 'jsx56' },

  { id: 'qa44',
    deck: 'js',
    q: 'Что выведет этот код?',
    snippet: `function f(a, b = 2, c) {}
function g(...args) {}
function h(a, b) {}

console.log(f.length, g.length, h.length);`,
    options: [
      '1, 0, 2',
      '3, 1, 2',
      '1, 1, 2',
      '3, 0, 2',
    ],
    correct: 0,
    why: `<p><code>Function.prototype.length</code> — это число параметров <strong>до первого</strong> со значением по умолчанию или rest-параметра. У <code>f</code> таким параметром оказывается <code>b</code>, поэтому считается только <code>a</code>, и <code>c</code> в счёт не идёт, хотя дефолта у него нет. У <code>g</code> первый же параметр — rest, поэтому 0. У <code>h</code> обычная пара — 2.</p>
    <p>Вариант «3, 0, 2» — самый естественный: кажется, что <code>length</code> просто считает объявленные имена. На это свойство опираются реальные библиотеки: Express по арности middleware отличает обработчик <code>(req, res, next)</code> от обработчика ошибок <code>(err, req, res, next)</code>, а Mocha по наличию параметра <code>done</code> решает, асинхронный ли тест. Добавление дефолта такому колбэку молча меняет поведение фреймворка. Родственная деталь: <code>arguments</code> в нестрогой функции перестаёт быть связанным с параметрами, как только у неё появляются дефолты или rest.</p>`,
    cardId: 'jsx57' },

  { id: 'qa45',
    deck: 'js',
    q: 'Цикл печатает 3, 3, 3. Какой способ починит вывод, не заменяя var на let?',
    snippet: `for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}`,
    options: [
      'Обернуть тело цикла в IIFE, передав i её параметром',
      'Заменить стрелочную функцию на обычную function — у неё будет своя i',
      'Объявить var i прямо внутри тела цикла — тогда на каждой итерации будет новая переменная',
      'Заменить setTimeout на queueMicrotask — микрозадачи выполнятся до конца цикла',
    ],
    correct: 0,
    why: `<p><code>var</code> имеет функциональную область видимости: переменная <code>i</code> одна на весь цикл, и все три колбэка замыкаются на одну и ту же ячейку. К моменту, когда таймеры сработают, цикл давно закончился и в ячейке лежит 3. IIFE создаёт новую область видимости на каждой итерации и копирует туда текущее значение: <code>(function (j) { setTimeout(() =&gt; console.log(j), 0); })(i)</code>. С <code>let</code> то же самое делает движок автоматически, создавая новое связывание на каждую итерацию.</p>
    <p>Вариант «объявить var внутри тела» не работает именно из-за hoisting: объявление всплывает к началу функции, и это по-прежнему одна переменная. Вариант с обычной <code>function</code> путает <code>this</code> и замыкание: тип функции на захват переменных не влияет вообще. А <code>queueMicrotask</code> лишь меняет очередь — колбэки всё равно выполнятся после завершения синхронного цикла и увидят ту же тройку.</p>`,
    cardId: 'js4' },

  { id: 'qa46',
    deck: 'ts',
    q: 'В каком случае interface нельзя заменить на type без потери возможностей?',
    options: [
      'Когда нужно описать union из нескольких вариантов объекта',
      'Когда потребители должны дополнять тип через declaration merging и module augmentation',
      'Когда тип должен быть рекурсивным: type рекурсию не поддерживает',
      'Когда нужны mapped types и перемаппинг ключей через as',
    ],
    correct: 1,
    why: `<p>Единственная содержательная разница — <strong>слияние объявлений</strong>. Два одноимённых интерфейса в одной области видимости сливаются в один тип, и на этом держится расширение чужих типов: <code>declare module 'express' { interface Request { user?: User } }</code>. С <code>type</code> так нельзя — повторное объявление будет ошибкой. Поэтому публичный API библиотеки на <code>type</code> лишает пользователей возможности его дополнить, и это решение необратимо после релиза.</p>
    <p>Варианты про union и mapped types переворачивают ситуацию: как раз их <code>interface</code> выразить не может, и там <code>type</code> обязателен. Рекурсия же доступна обоим. Остальные различия косметические: сообщения об ошибках у интерфейсов часто читаются лучше, потому что имя не разворачивается, а <code>type</code> удобнее для алиасов примитивов и кортежей. Практическое правило: объектные формы — <code>interface</code>, всё остальное — <code>type</code>.</p>`,
    cardId: 'ts1' },

  { id: 'qa47',
    deck: 'ts',
    q: 'Какие строки не пройдут проверку типов?',
    snippet: `function f(a: any, u: unknown) {
  a.foo.bar();                                  // 1
  u.foo;                                        // 2
  if (typeof u === 'string') u.toUpperCase();   // 3
}`,
    options: [
      'Только первая: any запрещает обращение к неизвестным полям',
      'Первая и вторая: обе переменные требуют предварительного сужения',
      'Только вторая: unknown не даёт обращаться к свойствам без сужения',
      'Вторая и третья: typeof не сужает unknown, нужен пользовательский предикат',
    ],
    correct: 2,
    why: `<p><code>any</code> отключает проверку полностью: строка 1 компилируется и упадёт в рантайме. <code>unknown</code> — верхний тип, с которым нельзя делать <strong>ничего</strong>, пока он не сужен, поэтому строка 2 — ошибка <code>Object is of type unknown</code>. А строка 3 корректна: <code>typeof</code> сужает <code>unknown</code> точно так же, как union, и внутри блока переменная имеет тип <code>string</code>.</p>
    <p>Вариант «первая и вторая» соблазняет симметрией: раз оба типа «неизвестные», значит и правила одинаковые. Разница как раз принципиальная и в этом весь смысл <code>unknown</code>: он безопасно принимает что угодно, но заставляет проверить перед использованием. Отсюда практическое применение — тип для результата <code>JSON.parse</code>, для <code>catch (e: unknown)</code> и для границы с внешним миром вообще: ошибка возникает в момент небрежности, а не через три слоя вызовов.</p>`,
    cardId: 'ts2' },

  { id: 'qa48',
    deck: 'ts',
    q: 'Что скажет компилятор об этом коде?',
    snippet: `type Shape =
  | { kind: 'circle'; r: number }
  | { kind: 'square'; a: number };

function area(s: Shape): number {
  switch (s.kind) {
    case 'circle':
      return Math.PI * s.r ** 2;
    default: {
      const _never: never = s;
      return 0;
    }
  }
}`,
    options: [
      'Ошибок нет: default покрывает оставшийся вариант',
      'Ошибка в ветке circle: обращение к s.r требует приведения типа',
      'Ошибка: never нельзя использовать как тип локальной переменной',
      'Ошибка присваивания _never: вариант square остался необработанным',
    ],
    correct: 3,
    why: `<p><code>never</code> — тип без единого значения, поэтому присвоить ему можно только выражение типа <code>never</code>. После обработки <code>'circle'</code> в <code>default</code> остаётся <code>{ kind: 'square'; a: number }</code>, и компилятор честно сообщает: этот тип не присваивается <code>never</code>. Это и есть <strong>exhaustive check</strong>: добавили новый вариант в union — сборка красная ровно в тех местах, где его забыли обработать.</p>
    <p>Вариант «ошибок нет» — то, что было бы верно без строки с <code>_never</code>: <code>default</code> синтаксически покрывает всё, и без проверки компилятор промолчал бы. В этом и ценность приёма: он превращает молчаливую дыру в ошибку компиляции. В рантайме обычно дополняют это броском: <code>throw new Error('unhandled: ' + JSON.stringify(s))</code> — данные могут прийти из сети и не соответствовать типам.</p>`,
    cardId: 'ts3' },

  { id: 'qa49',
    deck: 'ts',
    q: 'Стейт загрузки описан как { loading: boolean; data?: T; error?: Error }. Что даст переход на discriminated union?',
    options: [
      'Уменьшит размер бандла: union компилируется в один общий enum',
      'Позволит обращаться к data через optional chaining без проверок',
      'Сделает невозможные комбинации невыразимыми и включит сужение по дискриминанту',
      'Добавит автоматическую рантайм-валидацию значений полей',
    ],
    correct: 2,
    why: `<p>Исходная форма допускает состояния, которых не бывает: <code>loading: true</code> вместе с <code>data</code> и <code>error</code> одновременно, или всё пустое. Union из <code>{ status: 'idle' } | { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: Error }</code> делает такие комбинации невыразимыми, а поле-дискриминант включает сужение: внутри <code>if (s.status === 'success')</code> поле <code>data</code> обязательное и не <code>undefined</code>, никаких <code>!</code> и <code>?.</code>.</p>
    <p>Вариант про optional chaining описывает как раз то, от чего уходят: <code>data?.items</code> компилируется всегда и потому скрывает логическую ошибку — обращение к данным в состоянии загрузки. Про бандл вариант неверен буквально: типы стираются и в рантайм не попадают вовсе. Требования к дискриминанту стоит помнить: это литеральный тип (или <code>null</code>/<code>undefined</code>), одинаково названное поле во всех членах, и оно должно быть обязательным.</p>`,
    cardId: 'ts4' },

  { id: 'qa50',
    deck: 'ts',
    q: 'Как изнутри устроен Partial<T> из стандартной библиотеки?',
    options: [
      'Mapped type: каждому ключу из keyof T добавляется модификатор вопросительного знака',
      'Conditional type: T extends object ? T | undefined : T',
      'Пересечение исходного T и Record<keyof T, undefined>',
      'Встроенная операция компилятора, на уровне типов её выразить нельзя',
    ],
    correct: 0,
    why: `<p><code>Partial</code> — обычный гомоморфный mapped type: перебирает ключи через <code>keyof T</code> и добавляет каждому <code>?</code>. Рядом живут родственники: <code>Required</code> снимает модификатор через <code>-?</code>, <code>Readonly</code> добавляет <code>readonly</code>, <code>Pick</code> ограничивает набор ключей параметром <code>K extends keyof T</code>, а <code>Omit</code> выражается как <code>Pick&lt;T, Exclude&lt;keyof T, K&gt;&gt;</code>. Единственный по-настоящему «магический» из популярных — <code>ReturnType</code>, он опирается на <code>infer</code> в conditional type.</p>
    <p>Вариант «встроено в компилятор» — распространённое представление, и оно вредно на практике: как только считаешь утилиты чёрным ящиком, перестаёшь писать свои. А ровно эти же два-три приёма закрывают большинство прикладных задач: <code>Pick</code> по вычисленному набору ключей, фильтрация ключей по типу значения, глубокие варианты. Вариант с <code>Record&lt;keyof T, undefined&gt;</code> дал бы поля обязательными со значением <code>undefined</code> — при <code>exactOptionalPropertyTypes</code> это совсем не то же самое.</p>`,
    cardId: 'ts6' },

  { id: 'qa51',
    deck: 'ts',
    q: 'Чем тип routes отличается от типа routes2?',
    snippet: `const routes = {
  home: '/',
  user: '/user/:id',
} satisfies Record<string, string>;

const routes2: Record<string, string> = {
  home: '/',
  user: '/user/:id',
};`,
    options: [
      'Ничем: satisfies — это та же аннотация, только записанная после выражения',
      "keyof typeof routes равен 'home' | 'user', а keyof typeof routes2 — string",
      "routes.home имеет литеральный тип '/', а routes2.home — просто string",
      'routes целиком стал readonly, а routes2 остался изменяемым',
    ],
    correct: 1,
    why: `<p><code>satisfies</code> проверяет выражение на соответствие типу, но <strong>не заменяет</strong> выведенный тип переменной. Поэтому <code>routes</code> сохраняет свой объектный тип с конкретными ключами, и <code>keyof typeof routes</code> даёт <code>'home' | 'user'</code> — на этом строятся типобезопасные ссылки на маршруты. Аннотация же затирает вывод: <code>routes2</code> имеет ровно тип <code>Record&lt;string, string&gt;</code>, у которого <code>keyof</code> — это <code>string</code>, и опечатка <code>routes2.hme</code> станет обычным <code>string</code> вместо ошибки.</p>
    <p>Самый привлекательный неверный вариант — про литеральный тип <code>'/'</code>. Ключи <code>satisfies</code> действительно сохраняет, а вот значения — нет: контекстный тип <code>Record&lt;string, string&gt;</code> расширяет литералы до <code>string</code>, и <code>routes.home</code> имеет тип <code>string</code>. Чтобы удержать и литералы, нужна связка <code>as const satisfies Record&lt;string, string&gt;</code> — она и замораживает значения, и оставляет проверку на месте.</p>`,
    cardId: 'ts7' },

  { id: 'qa52',
    deck: 'ts',
    q: 'type UserId = string и type OrderId = string — компилятор их путает. Как сделать типы номинальными?',
    options: [
      'Объявить оба через interface: интерфейсы в TS номинальны',
      'Обернуть в дженерик Id<"user">: параметр типа делает тип уникальным',
      'Включить strict — под ним структурная типизация для алиасов отключается',
      'Пересечь с фантомным полем: string & { readonly __brand: "UserId" }',
    ],
    correct: 3,
    why: `<p>Система типов TypeScript структурная: два алиаса с одинаковой структурой полностью взаимозаменяемы, и <code>type</code> вообще не создаёт нового типа, а лишь даёт имя. Номинальность эмулируют брендированием — пересечением с типом, содержащим уникальное фантомное поле. В рантайме значение остаётся обычной строкой, поле существует только на уровне типов, а создаётся такое значение единственной функцией-конструктором с <code>as</code> внутри.</p>
    <p>Вариант с <code>interface</code> — распространённое заблуждение, перенесённое из Java и C#: в TS интерфейсы проверяются так же структурно, как и всё остальное. Дженерик <code>Id&lt;'user'&gt;</code> сам по себе тоже не спасает: если параметр типа нигде не используется в структуре, тип остаётся структурно тем же <code>string</code> — работать он начнёт ровно тогда, когда внутри появится то самое фантомное поле.</p>`,
    cardId: 'ts8' },

  { id: 'qa53',
    deck: 'ts',
    q: 'Что произойдёт, если сервер вернул { id: 1 } без поля name?',
    snippet: `const raw: unknown = await res.json();
const user = raw as { id: number; name: string };

console.log(user.name.toUpperCase());`,
    options: [
      'Компилятор не пропустит as от unknown — потребуется двойной каст через any',
      'Соберётся и упадёт в рантайме: as ничего не проверяет, name будет undefined',
      'В рантайме вернётся пустая строка: TypeScript подставляет значение по умолчанию',
      'Ошибка компиляции: as требует структурной совместимости исходного типа',
    ],
    correct: 1,
    why: `<p><code>as</code> — не проверка и не преобразование, а односторонняя команда компилятору «поверь мне». Никакого кода в результате не появляется: типы стираются целиком. Если поля нет, <code>user.name</code> будет <code>undefined</code>, а <code>.toUpperCase()</code> бросит <code>TypeError</code> — на строке, которая проходила все проверки. Именно в этом опасность приведений: они переносят ошибку из компиляции в рантайм и в другое место программы.</p>
    <p>Вариант про двойной каст описывает реальное ограничение, но не это: <code>unknown</code> приводится к чему угодно свободно, а вот <code>as</code> между двумя несовместимыми конкретными типами компилятор запретит и потребует <code>as unknown as T</code>. Правильное решение на границе с сетью — рантайм-валидация: <code>zod</code>, <code>valibot</code> или самописный предикат. Тогда тип не постулируется, а выводится из фактически проверенных данных.</p>`,
    cardId: 'ts9' },

  { id: 'qa54',
    deck: 'ts',
    q: 'Почему union строковых литералов чаще предпочитают числовому enum?',
    options: [
      'Union быстрее проверяется компилятором, а enum ощутимо замедляет tsc',
      'Числовой enum нельзя использовать в switch с exhaustive-проверкой через never',
      'Union поддерживает declaration merging, а enum — нет',
      'Enum порождает рантайм-объект и не стирается, а union существует только в типах',
    ],
    correct: 3,
    why: `<p><code>enum</code> — одна из немногих конструкций TypeScript, которая генерирует код: в бандл попадает объект с прямым и обратным отображением. Union литералов стирается полностью, сериализуется как обычная строка, читается в логах и devtools как есть и не требует импортировать значение туда, где нужен только тип. Плюс с <code>isolatedModules</code> и однофайловыми транспиляторами (esbuild, SWC) <code>const enum</code> просто не работает так, как обещает.</p>
    <p>Вариант про exhaustive check неверен: <code>never</code>-проверка одинаково работает и с enum, и с union. Вариант про declaration merging — перевёрнутый: сливаются как раз <code>enum</code> и <code>namespace</code>, а union — нет. Где enum всё-таки уместен: когда нужен рантайм-список значений для итерации или обратное отображение число → имя; но и это чаще решают через <code>as const</code>-массив и <code>typeof ARR[number]</code>.</p>`,
    cardId: 'ts10' },

  { id: 'qa55',
    deck: 'ts',
    q: 'Какой тип будет у x внутри if?',
    snippet: `function isUser(v: unknown): boolean {
  return typeof v === 'object' && v !== null && 'id' in v;
}

declare const x: unknown;

if (isUser(x)) {
  // тип x здесь?
}`,
    options: [
      'object — компилятор выводит сужение из тела функции',
      '{ id: unknown } — оператор in работает и через границу функции',
      'unknown — возврат boolean не сужает, предикат v is ... не написан',
      'never — компилятор не может согласовать unknown и проверку через in',
    ],
    correct: 2,
    why: `<p>Сужение по вызову функции работает только если её тип возврата объявлен предикатом <code>v is T</code>. Обычный <code>boolean</code> для компилятора — просто булево значение, поэтому вне функции о <code>x</code> ничего нового не известно, и он остаётся <code>unknown</code>. Достаточно заменить <code>: boolean</code> на <code>: v is { id: unknown }</code>, и сужение появится.</p>
    <p>Вариант «object» опирается на разумное ожидание, что компилятор проанализирует тело: анализ потока не переходит границу функции, иначе проверка типов стала бы межпроцедурной и неподъёмной по стоимости. Есть, впрочем, оговорка: с TS 5.5 предикат <strong>выводится автоматически</strong> для функций без явной аннотации возврата, тело которых сводится к цепочке проверок одного параметра. Ирония в том, что явное <code>: boolean</code> этот вывод как раз глушит. И помните главное про предикаты: тело никто не верифицирует — предикат, который врёт, компилятор примет молча.</p>`,
    cardId: 'tsx1' },

  { id: 'qa56',
    deck: 'ts',
    q: 'Чем assertion function (asserts v is T) отличается от type guard (v is T)?',
    options: [
      'Она не возвращает значение, а бросает; сужение действует после вызова до конца области',
      'Её тело в отличие от предиката проверяется компилятором на соответствие заявленному типу',
      'Она работает только с классами, потому что внутри опирается на instanceof',
      'Она сужает тип только внутри собственного тела, снаружи никакого эффекта нет',
    ],
    correct: 0,
    why: `<p>Type guard возвращает <code>boolean</code>, и сужение действует внутри <code>if</code>. Assertion function ничего не возвращает: она либо молча проходит, либо бросает — и компилятор понимает, что весь код <strong>после</strong> вызова выполняется только при истинном условии. Отсюда линейный стиль без вложенности: <code>assertDefined(user); user.name;</code>. Это же механизм за <code>invariant()</code> и <code>node:assert</code>.</p>
    <p>Вариант про верификацию тела — самая заманчивая ошибка: хочется верить, что уж такая-то конструкция проверяется. Нет, компилятор доверяет сигнатуре в обоих случаях одинаково: <code>asserts v is string</code> с пустым телом молча пропустит что угодно. У assertion function есть и своя специфика: она требует, чтобы у вызываемого имени был явный тип, поэтому <code>const assertDefined = (v) =&gt; ...</code> без аннотации не сработает, а импорт через namespace (<code>utils.assertDefined(x)</code>) требует явного типа у каждого имени в пути.</p>`,
    cardId: 'tsx2' },

  { id: 'qa57',
    deck: 'ts',
    q: 'Какой тип у x внутри блока if?',
    snippet: `function f(x: unknown) {
  if (typeof x === 'object') {
    // тип x здесь?
  }
}`,
    options: [
      'object — null исключается автоматически начиная с TS 4.4',
      'Record<string, unknown> — компилятор подставляет индексную сигнатуру',
      '{} — то есть «любое значение, кроме null и undefined»',
      'object | null — typeof null тоже даёт "object", и компилятор это учитывает',
    ],
    correct: 3,
    why: `<p>Компилятор точно моделирует рантайм: <code>typeof null === 'object'</code>, поэтому проверка не исключает <code>null</code>, и тип остаётся <code>object | null</code>. Любое обращение к свойству внутри блока даст ошибку «Object is possibly null». Корректная форма — <code>typeof x === 'object' &amp;&amp; x !== null</code>, а если нужно исключить и массивы, добавляют <code>&amp;&amp; !Array.isArray(x)</code>. Это самый частый дефект самописных предикатов.</p>
    <p>Вариант <code>Record&lt;string, unknown&gt;</code> — то, чего хотелось бы: тогда можно было бы сразу читать поля. Компилятор так не делает, потому что это было бы неверно — у <code>object</code> нет обещания про строковые ключи. Начиная с TS 4.9 полезен другой приём: <code>in</code> сужает даже <code>unknown</code>-подобные значения и добавляет проверенный ключ в тип, поэтому <code>if (typeof x === 'object' &amp;&amp; x !== null &amp;&amp; 'id' in x)</code> даёт доступ к <code>x.id</code> без приведений.</p>`,
    cardId: 'tsx3' },

  { id: 'qa58',
    deck: 'ts',
    q: 'Почему v.length внутри колбэка — ошибка и как починить без оператора !?',
    snippet: `let v: string | null = get();

if (v !== null) {
  setTimeout(() => {
    v.length;   // Object is possibly null
  }, 0);
}`,
    options: [
      'v объявлена через let, и сужение не переживает колбэк; снять снимок в const',
      'setTimeout типизирован как принимающий () => void, из-за этого сужение теряется',
      'Колбэк создаёт новую область видимости, и v внутри неё имеет тип any',
      'Ошибки на самом деле нет: сужение через if распространяется на замыкания внутри блока',
    ],
    correct: 0,
    why: `<p>Анализ потока управления работает в пределах линейного кода. Колбэк выполнится когда-то потом, и компилятор не знает когда — а <code>v</code> объявлена через <code>let</code>, значит к тому моменту ей могли присвоить <code>null</code>. Поэтому сужение внутри функции сбрасывается. Лечение — снять снимок в <code>const</code> до проверки: <code>const snapshot = v; if (snapshot !== null) setTimeout(() =&gt; snapshot.length, 0);</code>. Для <code>const</code> компилятор доказал неизменность и сужение сохраняет.</p>
    <p>Вариант «ошибки нет» — то, чего ждёшь по аналогии с обычным блоком, и именно поэтому правку часто делают через <code>!</code>. Так делать не стоит: это не каприз компилятора, а указание на реальную гонку — значение действительно могло измениться, пока таймер ждал. То же самое происходит со свойствами объекта (<code>obj.value</code> сбрасывается после любого вызова функции) и после <code>await</code> внутри блока.</p>`,
    cardId: 'tsx4' },

  { id: 'qa59',
    deck: 'ts',
    q: 'В сигнатуре function parse<T>(input: string): T параметр T встречается ровно один раз. Что это значит?',
    options: [
      'Ничего особенного: одно упоминание параметра типа — обычная корректная форма',
      'Компилятор выведет T как unknown и предупредит о неиспользуемом параметре',
      'T ничего не связывает и работает как замаскированный any на стороне вызова',
      'T автоматически получает ограничение extends object',
    ],
    correct: 2,
    why: `<p>Смысл параметра типа — <strong>связать</strong> две позиции: вход с выходом, аргумент с аргументом. Если <code>T</code> появляется только в возвращаемом типе, выводить его не из чего, и он берётся из того, что напишет вызывающий: <code>parse&lt;User&gt;(json)</code>. Компилятор поверит на слово, ничего не проверив, — то есть это ровно <code>as</code>, только замаскированный под дженерик. Отсюда правило: параметр типа должен встречаться в сигнатуре минимум дважды.</p>
    <p>Вариант «выведет unknown и предупредит» правдоподобен, но неверен дважды: без явного аргумента <code>T</code> действительно станет <code>unknown</code> (а с дефолтом — дефолтом), однако никакого предупреждения не будет, и вызов <code>parse&lt;User&gt;(json)</code> пройдёт молча. Честная сигнатура для этой задачи — <code>parse(input: string): unknown</code> с валидацией на стороне вызова. Из смежных ловушек вывода стоит помнить: возвращаемый тип не является источником вывода, а несколько кандидатов из разных аргументов дают супертип, а не пересечение.</p>`,
    cardId: 'tsx5' },

  { id: 'qa60',
    deck: 'ts',
    q: 'Зачем нужен NoInfer<T>, появившийся в TS 5.4?',
    options: [
      'Запретить передавать в позицию значение, тип которого шире объявленного',
      'Исключить позицию из источников вывода: T выводится только из других аргументов',
      'Отключить дистрибутивность conditional type внутри параметра типа',
      'Заставить компилятор вывести литеральный тип вместо расширенного',
    ],
    correct: 1,
    why: `<p>Когда параметр типа встречается в нескольких позициях, компилятор собирает кандидатов из всех и берёт супертип. Классический случай: <code>createSelect&lt;T&gt;(options: T[], def: T)</code> — опечатка в <code>def</code> не даст ошибки, потому что <code>T</code> просто расширится до объединения. <code>NoInfer&lt;T&gt;</code> помечает позицию как «не источник вывода»: <code>def: NoInfer&lt;T&gt;</code> заставит <code>T</code> вывестись только из <code>options</code>, а <code>def</code> будет проверен относительно результата.</p>
    <p>Вариант про литеральный тип описывает <code>const</code>-параметры типа — соседний, но другой инструмент: <code>&lt;const T&gt;</code> заставляет вывести значение как <code>as const</code>, тогда как <code>NoInfer</code> вообще не влияет на то, каким получится <code>T</code>. Важная оговорка: <code>NoInfer</code> сам ничего не проверяет — если из оставшихся позиций <code>T</code> вывелся широко, ошибки всё равно не будет. И самописные полифиллы вида <code>[T][T extends any ? 0 : never]</code> ведут себя иначе на дистрибутивных типах, поэтому на 5.4+ их надо убирать.</p>`,
    cardId: 'tsx6' },

  { id: 'qa61',
    deck: 'ts',
    q: 'Какие типы выведет компилятор для a и b?',
    snippet: `declare function pick<const T extends readonly string[]>(keys: T): T[number];

const a = pick(['x', 'y']);

const keys = ['x', 'y'];
const b = pick(keys);`,
    options: [
      "a: 'x' | 'y', b: string — const-параметр не действует на заранее объявленную переменную",
      "a: 'x' | 'y', b: 'x' | 'y' — const-параметр действует на любой аргумент",
      'a: string, b: string — const работает только вместе с as const на месте вызова',
      "a: readonly ['x', 'y'], b: string[] — T[number] возвращает сам массив",
    ],
    correct: 0,
    why: `<p><code>const</code>-параметр типа (TS 5.0) заставляет вывести аргумент так, как если бы к нему написали <code>as const</code>. Но работает это только для <strong>литерала на месте вызова</strong>: у <code>['x', 'y']</code> выведется <code>readonly ['x', 'y']</code>, и <code>T[number]</code> даст <code>'x' | 'y'</code>. Переменная <code>keys</code> уже получила тип <code>string[]</code> в момент своего объявления, и на этот вывод <code>const</code>-параметр повлиять не может — отсюда <code>b: string</code>.</p>
    <p>Вариант «действует на любой аргумент» — самый частый источник вопроса «почему у коллеги работает, а у меня нет»: разница между инлайн-литералом и вынесенной константой глазом не видна. Ещё две детали: ограничение обязано включать <code>readonly</code>, иначе вызовы перестанут проходить с невнятной ошибкой, и внутри реализации <code>T</code> тоже readonly, поэтому <code>push</code> и <code>sort</code> по нему недоступны без копии.</p>`,
    cardId: 'tsx7' },

  { id: 'qa62',
    deck: 'ts',
    q: 'strictFunctionTypes включён, но параметры обработчика в интерфейсе всё равно проверяются бивариантно. Почему?',
    options: [
      'Флаг действует только на возвращаемые типы, параметры бивариантны всегда',
      'Бивариантность отключается отдельным флагом strictBindCallApply',
      'Флаг не действует на методы — нужна запись свойством: on: (e: E) => void',
      'Обработчики событий исключены из проверки объявлениями в lib.dom.d.ts',
    ],
    correct: 2,
    why: `<p><code>strictFunctionTypes</code> включает контравариантную проверку параметров, но в чекере есть явное исключение: на <strong>методы</strong> (запись <code>on(e: E): void</code>) оно не распространяется. Причина историческая — иначе перестал бы типизироваться <code>Array.prototype.push</code> и множество библиотечных сигнатур, где бивариантность методов сложилась до появления флага. Чтобы получить строгость, ту же вещь объявляют свойством-функцией: <code>on: (e: E) =&gt; void</code>.</p>
    <p>Вариант про <code>strictBindCallApply</code> звучит убедительно из-за похожего имени, но этот флаг про другое: он типизирует аргументы <code>bind</code>, <code>call</code> и <code>apply</code>. Разница «метод против свойства» невидима на ревью — отличаются двоеточие и стрелка, а поведение проверки противоположное. Форсировать стиль по проекту разом умеет правило <code>@typescript-eslint/method-signature-style</code>. Оговорка: переезд на свойства ломает declaration merging, потому что перегрузки несколькими объявлениями возможны только для методов.</p>`,
    cardId: 'tsx8' },

  { id: 'qa63',
    deck: 'ts',
    q: 'При strict: true — какая из двух последних строк не пройдёт проверку?',
    snippet: `interface WithMethod { handle(e: MouseEvent): void }
interface WithProperty { handle: (e: MouseEvent) => void }

const narrow = (e: MouseEvent & { x2: number }) => {};

const m: WithMethod = { handle: narrow };
const p: WithProperty = { handle: narrow };`,
    options: [
      'Обе: параметр обработчика должен совпадать с объявленным точно',
      'Ни одной: параметры функций в TypeScript всегда бивариантны',
      'Только m: методы проверяются контравариантно, и narrow не подходит',
      'Только p: свойство-функция проверяется контравариантно, метод — бивариантно',
    ],
    correct: 3,
    why: `<p><code>narrow</code> требует от аргумента больше, чем обещает интерфейс: любой <code>MouseEvent</code> без поля <code>x2</code> её сломает. Под <code>strictFunctionTypes</code> параметры проверяются контравариантно, поэтому присваивание запрещено — но только для записи <strong>свойством</strong>. Метод (<code>handle(e: MouseEvent): void</code>) остаётся бивариантным по историческому исключению, и строка с <code>m</code> компилируется молча.</p>
    <p>Вариант «ни одной» — то, что было бы верно до TS 2.6, когда бивариантными были все параметры. Практический вывод: если хочется, чтобы компилятор ловил слишком узкие обработчики, объявляйте их свойствами-функциями. Полезно помнить и смежное послабление: функция с меньшим числом параметров присваивается типу с большим — отсюда классический баг <code>arr.map(parseInt)</code>, где вторым аргументом уезжает индекс.</p>`,
    cardId: 'tsx10' },

  { id: 'qa64',
    deck: 'ts',
    q: 'Чему равны Role и Key?',
    snippet: `const ROLES = ['admin', 'user'] as const;
type Role = typeof ROLES[number];

const cfg = { host: 'localhost', port: 3000 };
type Key = keyof typeof cfg;`,
    options: [
      'Role = string, Key = string — as const влияет только на значения',
      "Role = 'admin' | 'user', Key = 'host' | 'port'",
      "Role = readonly ['admin', 'user'], Key = 'host' | 'port'",
      "Role = 'admin' | 'user', Key = string | number",
    ],
    correct: 1,
    why: `<p><code>as const</code> выводит для массива тип <code>readonly ['admin', 'user']</code>, а индексированный доступ по <code>number</code> даёт объединение всех элементов — <code>'admin' | 'user'</code>. Это стандартный способ получить union из единственного списка-источника: значения доступны в рантайме, а тип выводится из них автоматически и не расходится при правках. Для <code>cfg</code> <code>as const</code> не нужен: <code>keyof typeof</code> берёт имена свойств независимо от того, расширены значения или нет.</p>
    <p>Вариант «Role = string» описывает то, что случится при <strong>забытом</strong> <code>as const</code>: массив выведется как <code>string[]</code>, <code>[number]</code> даст <code>string</code>, и вся конструкция обесценится — но ошибки при этом не будет, тип просто станет широким. Из смежных ловушек: индексная сигнатура делает <code>keyof T</code> равным <code>string | number</code>, поэтому <code>keyof Record&lt;string, number&gt;</code> точности не даёт.</p>`,
    cardId: 'tsx11' },

  { id: 'qa65',
    deck: 'ts',
    q: 'Какой тип получится в Events?',
    snippet: 'type Handlers = {\n  onClick: () => void;\n  label: string;\n  onFocus: () => void;\n};\n\ntype Events = {\n  [K in keyof Handlers as K extends `on${string}` ? K : never]: Handlers[K]\n};',
    options: [
      '{ onClick: () => void; label: never; onFocus: () => void }',
      '{ onClick: () => void; onFocus: () => void }',
      '{ onClick: never; label: string; onFocus: never }',
      'never — как только одна ветка даёт never, весь mapped type схлопывается',
    ],
    correct: 1,
    why: `<p>Перемаппинг ключей через <code>as</code> (TS 4.1) позволяет вычислить новое имя ключа. Ключ, для которого выражение даёт <strong>never</strong>, из результата просто <em>выпадает</em> — это стандартная идиома фильтрации. Здесь шаблонный тип <code>on...</code> оставляет <code>onClick</code> и <code>onFocus</code>, а <code>label</code> исчезает. Так же фильтруют по типу значения: <code>[K in keyof T as T[K] extends Function ? K : never]</code>.</p>
    <p>Вариант <code>{ onClick: never; label: string; onFocus: never }</code> путает две позиции: <code>never</code> в имени ключа удаляет свойство, а <code>never</code> в типе значения оставил бы свойство с непригодным типом. Вариант «весь тип схлопывается в never» переносит на mapped type правило поглощения из объединений — там оно работает, здесь нет. Из практических ловушек перемаппинга: ключ обязательно нужно сузить через <code>K &amp; string</code>, потому что <code>keyof T</code> включает символы, а два разных ключа после преобразования (например, <code>Lowercase</code>) могут схлопнуться в один без единого предупреждения.</p>`,
    cardId: 'tsx12' },

  { id: 'qa66',
    deck: 'ts',
    q: 'Где реальный предел применимости template literal types?',
    options: [
      'Они не работают с union: в шаблон можно подставить только один литерал',
      'Они вычисляются в рантайме и потому замедляют старт приложения',
      'Комбинаторный взрыв: union перемножаются, и компилятор упирается в лимит',
      'Они требуют ограничения extends string у каждого параметра, иначе не компилируются',
    ],
    correct: 2,
    why: `<p>Подстановка union в шаблон даёт декартово произведение: два объединения по 50 членов — это 2500 литералов, три — 125 000, а жёсткий лимит на размер union в компиляторе — 100 000 членов, после чего вылетает ошибка «Expression produces a union type that is too complex to represent». Задолго до самой ошибки начинает тормозить IDE: рекурсивный тип путей к вложенным полям на большой модели данных в одиночку убивает отзывчивость подсказок.</p>
    <p>Вариант «не работают с union» — прямо противоположен реальности: именно дистрибуция по объединениям и делает эти типы полезными, на ней строятся хелперы вида «on плюс Capitalize от ключа» и типизация путей вроде <code>'user.address.city'</code>. Про рантайм вариант неверен буквально: типы стираются и в бандл не попадают вовсе — цена платится временем компиляции, а не временем работы. Ещё одна деталь для собеседования: подстановка <code>number</code> в шаблон сопоставляется с числовыми литералами, но обратно тип не считает — строка <code>'1e3'</code> тоже пройдёт как число.</p>`,
    cardId: 'tsx13' },

  { id: 'qa67',
    deck: 'ts',
    q: 'Чему равны A, B и C?',
    snippet: `type IsString<T> = T extends string ? true : false;

type A = IsString<string | number>;
type B = IsString<never>;
type C = IsString<any>;`,
    options: [
      'A = boolean, B = never, C = boolean',
      'A = false, B = false, C = false',
      'A = boolean, B = false, C = true',
      'A = true, B = false, C = boolean',
    ],
    correct: 0,
    why: `<p>Conditional type с «голым» параметром дистрибутивен: он применяется к каждому члену объединения по отдельности, а результаты объединяются. Отсюда <code>A = true | false</code>, то есть <strong>boolean</strong>. <code>never</code> — пустое объединение, поэтому итерировать не по чему и результат <strong>never</strong>: ни одна ветка не выполнялась. Для <code>any</code> в спецификации отдельное правило — берутся <strong>обе</strong> ветки, отсюда снова <code>boolean</code>.</p>
    <p>Вариант <code>B = false</code> — самая частая ошибка на собеседовании: рассуждают «never не является string, значит false». Отключить дистрибутивность можно обёрткой в кортеж: <code>[T] extends [string]</code>. Тогда <code>A</code> станет <code>false</code>, а проверка <code>[T] extends [never]</code> даст корректный <code>IsNever</code>. И помните ещё два следствия: <code>boolean</code> — это <code>true | false</code>, поэтому он тоже дистрибутируется, а проверку на <code>any</code> в цепочке условий всегда ставят первой, иначе всё после неё вернёт обе ветки и станет бессмысленным.</p>`,
    cardId: 'tsx15' },

  { id: 'qa68',
    deck: 'ts',
    q: 'Чему равны A и B?',
    snippet: 'type ToNum<S> = S extends `${infer N extends number}` ? N : never;\ntype A = ToNum<"42">;\n\ntype Ret<T> = T extends (...a: any[]) => infer R ? R : never;\ntype B = Ret<() => Promise<string>>;',
    options: [
      "A = '42' (строковый литерал), B = string",
      'A = number, B = Promise<string>',
      "A = '42' (строковый литерал), B = Promise<string>",
      'A = 42 (числовой литерал), B = Promise<string>',
    ],
    correct: 3,
    why: `<p>Без ограничения выведенный из шаблона тип всегда строковый: <code>infer N</code> дал бы <code>'42'</code>. Конструкция <code>infer N extends number</code> (TS 4.8) не просто проверяет ограничение, а <strong>приводит</strong> результат к числовому литералу — получается <code>42</code>. Во втором случае <code>infer R</code> захватывает объявленный тип возврата как есть: <code>Ret</code> не разворачивает промис, для этого нужен <code>Awaited&lt;Ret&lt;T&gt;&gt;</code>.</p>
    <p>Вариант <code>B = string</code> — след ожидания, что <code>ReturnType</code> «понимает» async-функции. Не понимает: это просто <code>infer</code> в позиции возврата. Из смежных тонкостей <code>infer</code> стоит помнить: несколько <code>infer</code> с одним именем объединяют кандидатов (в контравариантной позиции — в пересечение, на чём построен <code>UnionToIntersection</code>), а при выводе из перегруженной функции берётся <strong>последняя</strong> сигнатура, а не подходящая — из-за этого <code>ReturnType</code> на перегрузках часто врёт.</p>`,
    cardId: 'tsx17' },

  { id: 'qa69',
    deck: 'ts',
    q: 'Функция объявлена перегрузками get(k: "a"): number и get(k: "b"): string. Вызывающий передаёт значение типа "a" | "b". Что будет?',
    options: [
      'Вернётся number | string: компилятор объединит подходящие перегрузки',
      'Выберется первая подходящая перегрузка, результат будет number',
      'Ошибка: union не подходит ни к одной перегрузке — нужен дженерик или ещё одна сигнатура',
      'Выберется последняя перегрузка, результат будет string',
    ],
    correct: 2,
    why: `<p>Разрешение перегрузок идёт сверху вниз и ищет <strong>одну</strong> сигнатуру, которой аргумент соответствует целиком. Значение типа <code>'a' | 'b'</code> не подходит ни под <code>'a'</code>, ни под <code>'b'</code>, а объединять результаты нескольких перегрузок компилятор не умеет. Это самая частая боль перегрузок в реальном коде. Лечится либо дженериком с <code>keyof</code> и mapped-типом результата, либо явной дополнительной сигнатурой для union.</p>
    <p>Вариант «объединит в number | string» — то, чего интуитивно ждёшь, и именно поэтому вместо перегрузок обычно советуют дженерик: <code>function get&lt;K extends keyof M&gt;(k: K): M[K]</code> решает задачу одной сигнатурой и корректно работает с union. Другие грабли перегрузок: порядок значим — широкая сигнатура сверху делает нижние недостижимыми без предупреждения, а сообщение об ошибке печатает последнюю попытку, а не самую близкую.</p>`,
    cardId: 'tsx18' },

  { id: 'qa70',
    deck: 'ts',
    q: 'Какие из этих присваиваний компилятор отвергнет?',
    snippet: `const a: readonly number[] = [1, 2];
const b: number[] = a;

type P = { readonly x: number };
const p: P = { x: 1 };
const q: { x: number } = p;`,
    options: [
      'Оба: readonly проверяется одинаково для массивов и для свойств объектов',
      'Только b: у объектов модификатор readonly на присваиваемость не влияет',
      'Только q: свойство readonly нельзя присвоить изменяемому',
      'Ни одного: readonly проверяется только в момент попытки записи',
    ],
    correct: 1,
    why: `<p><code>readonly number[]</code> и <code>number[]</code> — разные типы, и присваивание первого второму компилятор запрещает: иначе через новую ссылку можно было бы вызвать <code>push</code>. А вот <code>readonly</code> на <strong>свойстве</strong> в проверке присваиваемости просто игнорируется — тип <code>{ readonly x: number }</code> свободно присваивается <code>{ x: number }</code>, после чего запись разрешена. Это известная и сознательная дыра в системе типов.</p>
    <p>Вариант «оба отвергнет» — то, чего ждёшь от последовательной системы, и потому самый правдоподобный. Полезно помнить и остальные границы: <code>readonly</code> поверхностный (<code>readonly items: Item[]</code> запрещает переприсвоить массив, но не <code>items.push</code>), <code>Readonly&lt;T&gt;</code> тоже работает на один уровень, а <code>as const</code> не действует на выражения с вычислениями — <code>{ x: a + b } as const</code> даст <code>number</code>, а не литерал. И всё это чисто статические ограничения: в рантайме их нет, там нужен <code>Object.freeze</code>.</p>`,
    cardId: 'tsx19' },

  { id: 'qa71',
    deck: 'ts',
    q: 'Чему равны A, B и C?',
    snippet: `type A = Awaited<Promise<Promise<string>>>;
type B = Awaited<string | Promise<number>>;
type C = Awaited<{ then(cb: (v: number) => void): void }>;`,
    options: [
      'A = Promise<string>, B = string | Promise<number>, C = unknown',
      'A = string, B = Promise<string | number>, C = never',
      'A = Promise<string>, B = string | number, C = number',
      'A = string, B = string | number, C = number',
    ],
    correct: 3,
    why: `<p><code>Awaited</code> моделирует поведение <code>await</code>, а оно рекурсивное: <code>await</code> на промисе промиса разворачивает оба уровня, поэтому <code>A = string</code>. Тип дистрибутивен по объединению, и не-промис возвращается как есть — отсюда <code>B = string | number</code>. И самое неочевидное: <code>await</code> разворачивает любой <strong>thenable</strong>, а не только настоящий <code>Promise</code>, поэтому <code>Awaited</code> вытаскивает тип из параметра колбэка в <code>then</code> — <code>C = number</code>. Именно поэтому реализация этого типа получилась нетривиальной.</p>
    <p>Вариант <code>A = Promise&lt;string&gt;</code> предполагает разворот на один уровень — это было бы верно для наивного <code>T extends Promise&lt;infer U&gt; ? U : T</code>. Из практических деталей стоит помнить: <code>Awaited&lt;any&gt;</code> даёт <code>any</code>, и вся цепочка после этого молча теряет проверку; <code>Promise.all</code> на массиве (а не кортеже) отдаёт <code>T[]</code> и теряет позиции; а тип отклонения нигде не выражен — <code>Promise&lt;T&gt;</code> не параметризован ошибкой, поэтому в <code>catch</code> всегда <code>unknown</code>.</p>`,
    cardId: 'tsx20' },

  { id: 'qa72',
    deck: 'ts',
    q: 'Ответ API типизирован интерфейсом. Бэкенд переименовал поле, и фронтенд упал в рантайме. Почему TypeScript не помог?',
    options: [
      'Типы стираются: на границе с сетью нужна рантайм-валидация, например через zod',
      'Нужно было объявить контракт через type: интерфейсы не участвуют в проверке',
      'Помог бы strict: под ним ответы fetch проверяются по объявленному типу автоматически',
      'Нужно было применить satisfies: в отличие от аннотации он проверяет данные в рантайме',
    ],
    correct: 0,
    why: `<p>Типы существуют только во время компиляции и целиком стираются при сборке. <code>res.json()</code> возвращает <code>any</code> (или <code>unknown</code>), и любая аннотация поверх — это обещание, а не проверка. Единственный способ узнать, что пришло на самом деле, — проверить данные кодом. Схемные валидаторы (<code>zod</code>, <code>valibot</code>, <code>arktype</code>) удобны тем, что схема одновременно является источником типа: <code>type User = z.infer&lt;typeof UserSchema&gt;</code>, так что дублировать контракт не приходится.</p>
    <p>Вариант про <code>satisfies</code> — самая заманчивая ошибка: оператор появился недавно, звучит как «проверить соответствие», и легко принять его за рантайм-проверку. Это чисто статическая конструкция, как и <code>as</code>. Граница проходит так: внутри приложения хватает типов, а на всех входах извне — сеть, <code>localStorage</code>, URL-параметры, <code>postMessage</code>, конфиги — нужна валидация. Проверять при этом стоит на границе один раз, а не размазывать проверки по коду.</p>`,
    cardId: 'tsx28' },

  { id: 'qa73',
    deck: 'ts',
    q: 'Что меняет флаг noUncheckedIndexedAccess?',
    options: [
      'Запрещает индексные сигнатуры в пользу Record и Map',
      'Требует проверять границы массива через at() вместо квадратных скобок',
      'Добавляет | null к результату доступа по отсутствующему ключу',
      'Добавляет | undefined к результату доступа по индексу и по строковому ключу',
    ],
    correct: 3,
    why: `<p>Без флага <code>arr[10]</code> имеет тип элемента, хотя в рантайме там может быть <code>undefined</code> — это дыра в строгости, которую <code>strict</code> не закрывает. Флаг честно добавляет <code>| undefined</code> к результату индексирования массивов и объектов с индексной сигнатурой, заставляя проверить значение перед использованием.</p>
    <p>Вариант с <code>| null</code> — почти верный, и путаница естественная: отсутствующее свойство в JS даёт именно <code>undefined</code>, а <code>null</code> появляется только там, где его положили явно. Флаг часто выключают из-за шума в индексных циклах, но шум обычно лечится сменой стиля: <code>for...of</code>, <code>entries()</code>, деструктуризация и <code>at()</code> дают корректные типы без единой проверки. Худшее, что можно сделать, — заглушить всё через <code>!</code>: тогда выигрыш обнуляется, а код становится хуже, чем был без флага.</p>`,
    cardId: 'tsx30' },

  { id: 'qa74',
    deck: 'ts',
    q: 'В каких строках компилятор сообщит об ошибке?',
    snippet: `type P = { a: number };

const x: P = { a: 1, b: 2 };

const t = { a: 1, b: 2 };
const y: P = t;`,
    options: [
      'Только в x: проверка на лишние свойства работает лишь для свежего литерала',
      'Только в y: переменная обязана структурно совпадать с типом P',
      'В обеих: лишнее поле b несовместимо с типом P',
      'Ни в одной: структурная типизация допускает лишние свойства',
    ],
    correct: 0,
    why: `<p>Структурная типизация действительно допускает лишние поля: объект с <code>a</code> и <code>b</code> подходит везде, где ждут <code>{ a: number }</code>. Поэтому присваивание <code>y = t</code> корректно. Но у объектных <strong>литералов</strong> есть дополнительная эвристика — excess property check: литерал считается «свежим», и лишнее поле в нём почти наверняка опечатка, поэтому компилятор ругается. Свежесть теряется, как только литерал прошёл через переменную.</p>
    <p>Вариант «ни в одной» логичен с точки зрения теории типов и потому соблазнителен — проверка на лишние свойства и правда выбивается из общей модели, это прагматичное исключение ради опечаток. Полезно знать, где оно молчит: свойство из соседнего члена union проходит (<code>{ kind: 'icon', icon: 'x', label: 'oops' }</code> для размеченного объединения не ловится), а индексная сигнатура в целевом типе отключает проверку целиком.</p>`,
    cardId: 'tsx36' },

  { id: 'qa75',
    deck: 'ts',
    q: 'Почему user[k] — ошибка и какой обход корректен?',
    snippet: `const user = { id: 1, name: 'Ann' };

for (const k of Object.keys(user)) {
  console.log(user[k]);   // implicit any
}`,
    options: [
      'Object.keys не типизирована в lib.dom; помогает подключение lib.es2017.object',
      'keys даёт string[], потому что объект может иметь больше полей, чем в типе; берите пары из Object.entries',
      'keys даёт keyof T, а ошибка в другом: у user нет индексной сигнатуры',
      'keys даёт string[] по историческим причинам; единственный путь — приведение as (keyof typeof user)[]',
    ],
    correct: 1,
    why: `<p>Сигнатура <code>Object.keys(o: object): string[]</code> не случайна, а следует из структурной типизации: значение типа <code>{ id: number; name: string }</code> в рантайме может иметь любые дополнительные поля, потому что объект с лишними свойствами присваивается этому типу. Вернуть <code>keyof T</code> было бы <strong>небезопасно</strong> — компилятор пообещал бы, что других ключей нет. Практичный обход — <code>Object.entries</code>: значение приходит уже типизированным, и индексировать объект не нужно.</p>
    <p>Вариант с приведением <code>as (keyof typeof user)[]</code> — то, что пишут чаще всего, и он работает для литералов, объявленных рядом. Но называть его единственным неверно, а главное — он ломается ровно там, где опаснее всего: на объекте, пришедшем из сети, где лишние ключи реальны. Смежные детали: <code>for...in</code> дополнительно перебирает унаследованные перечислимые свойства (отсюда <code>Object.hasOwn</code>), <code>Object.entries</code> теряет связь конкретного ключа с его значением и даёт <code>[string, A | B][]</code>, а <code>Object.fromEntries</code> почти всегда требует ручной аннотации результата.</p>`,
    cardId: 'tsx39' },

];
