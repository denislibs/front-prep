/**
 * Наборы автотестов для режима worker (чистый JS, без DOM).
 *
 * Правила: только виртуальное время (clock.tick), только наблюдаемое поведение,
 * названия проверок объясняют, что именно сломано.
 */
const TESTS_WORKER_A = {
  /* ══ t1 · debounce ══════════════════════════════════════════ */
  t1: {
    env: 'worker',
    entry: 'debounce',
    starter: `function debounce(fn, ms) {
  // ваш код
}`,
    cases: [
      { name: 'не вызывает функцию сразу',
        body: `const fn = spy();
const d = debounce(fn, 100);
d();
assert.equal(fn.count, 0, 'вызов должен быть отложен');` },

      { name: 'вызывает функцию через указанное время',
        body: `const fn = spy();
const d = debounce(fn, 100);
d();
await clock.tick(100);
assert.equal(fn.count, 1);` },

      { name: 'схлопывает серию вызовов в один',
        body: `const fn = spy();
const d = debounce(fn, 100);
d(); await clock.tick(50);
d(); await clock.tick(50);
d(); await clock.tick(100);
assert.equal(fn.count, 1, 'должен остаться только последний вызов');` },

      { name: 'передаёт аргументы последнего вызова',
        body: `const fn = spy();
const d = debounce(fn, 100);
d('a'); d('b'); d('c');
await clock.tick(100);
assert.equal(fn.lastArgs, ['c']);` },

      { name: 'сохраняет контекст вызова',
        body: `const fn = spy();
const obj = { name: 'ctx', run: debounce(fn, 100) };
obj.run();
await clock.tick(100);
assert.equal(fn.contexts[0] && fn.contexts[0].name, 'ctx', 'this должен долетать до fn');` },
    ],
  },

  /* ══ t2 · throttle ══════════════════════════════════════════ */
  t2: {
    env: 'worker',
    entry: 'throttle',
    starter: `function throttle(fn, ms) {
  // ваш код
}`,
    cases: [
      { name: 'пропускает первый вызов сразу',
        body: `await clock.tick(1000); // отводим виртуальное время от нуля
const fn = spy();
const t = throttle(fn, 100);
t();
assert.equal(fn.count, 1, 'первый вызов не должен ждать окна');` },

      { name: 'передаёт аргументы и сохраняет контекст вызова',
        body: `await clock.tick(1000);
const fn = spy();
const obj = { name: 'ctx', run: throttle(fn, 100) };
obj.run(1, 2);
assert.equal(fn.lastArgs, [1, 2]);
assert.equal(fn.contexts[0] && fn.contexts[0].name, 'ctx', 'this должен долетать до fn');` },

      { name: 'не пропускает второй вызов внутри окна',
        body: `await clock.tick(1000);
const fn = spy();
const t = throttle(fn, 100);
t(); t(); t(); t();
await clock.tick(50);
assert.equal(fn.count, 1, 'внутри окна должен пройти только первый вызов');` },

      { name: 'не теряет последний вызов в окне',
        body: `await clock.tick(1000);
const fn = spy();
const t = throttle(fn, 100);
t('a');
t('b');
await clock.tick(100);
assert.equal(fn.count, 2, 'отложенный вызов после окна обязателен');
assert.equal(fn.lastArgs, ['b'], 'отложиться должен последний вызов серии');` },

      { name: 'ставит ровно один отложенный вызов на серию событий',
        body: `await clock.tick(1000);
const fn = spy();
const t = throttle(fn, 100);
t();
for (let i = 0; i < 5; i++) t();
await clock.tick(1000);
assert.equal(fn.count, 2, 'серия из шести вызовов даёт один немедленный и один отложенный');` },

      { name: 'после окончания окна снова пропускает вызов сразу',
        body: `await clock.tick(1000);
const fn = spy();
const t = throttle(fn, 100);
t();
await clock.tick(300);
t();
assert.equal(fn.count, 2, 'по истечении окна вызов не должен откладываться');` },
    ],
  },

  /* ══ t3 · promisePool ═══════════════════════════════════════ */
  t3: {
    env: 'worker',
    entry: 'promisePool',
    starter: `async function promisePool(tasks, limit) {
  // ваш код
}`,
    cases: [
      { name: 'возвращает пустой массив для пустого списка задач',
        body: `assert.equal(await promisePool([], 3), []);` },

      { name: 'возвращает результаты, когда задач меньше лимита',
        body: `const tasks = [1, 2, 3].map(function (v) { return function () { return Promise.resolve(v); }; });
assert.equal(await promisePool(tasks, 10), [1, 2, 3]);` },

      { name: 'сохраняет порядок результатов, а не порядок завершения',
        body: `const make = (v, ms) => () => new Promise(r => setTimeout(() => r(v), ms));
const p = promisePool([make('a', 30), make('b', 10), make('c', 20)], 2);
await clock.tick(200);
assert.equal(await p, ['a', 'b', 'c'], 'результат кладётся по индексу задачи');` },

      { name: 'не запускает больше limit задач одновременно',
        body: `let running = 0;
let peak = 0;
const make = () => () => {
  running++;
  peak = Math.max(peak, running);
  return new Promise(r => setTimeout(() => { running--; r(1); }, 10));
};
const tasks = [make(), make(), make(), make(), make(), make()];
const p = promisePool(tasks, 2);
await clock.tick(500);
await p;
assert.equal(peak, 2, 'одновременно должно выполняться ровно две задачи');` },

      { name: 'не создаёт промисы заранее — задачи стартуют по мере освобождения слота',
        body: `const started = [];
const make = (name) => () => { started.push(name); return new Promise(r => setTimeout(r, 10)); };
const p = promisePool([make('a'), make('b'), make('c')], 1);
await clock.tick(0);
assert.equal(started, ['a'], 'вторая задача не должна стартовать, пока не завершилась первая');
await clock.tick(5);
assert.equal(started, ['a'], 'задача не должна стартовать раньше завершения предыдущей');
await clock.tick(100);
await p;
assert.equal(started, ['a', 'b', 'c']);` },

      { name: 'использует все доступные слоты, а не выполняет задачи по одной',
        body: `const started = [];
const make = (name) => () => { started.push(name); return new Promise(r => setTimeout(r, 10)); };
const p = promisePool([make('a'), make('b'), make('c'), make('d')], 3);
await clock.tick(0);
assert.equal(started, ['a', 'b', 'c'], 'при limit = 3 сразу должны стартовать три задачи');
await clock.tick(100);
await p;` },
    ],
  },

  /* ══ t4 · EventEmitter ══════════════════════════════════════ */
  t4: {
    env: 'worker',
    entry: 'EventEmitter',
    starter: `class EventEmitter {
  // ваш код
}`,
    cases: [
      { name: 'вызывает подписчика и передаёт ему аргументы события',
        body: `const e = new EventEmitter();
const fn = spy();
e.on('tick', fn);
e.emit('tick', 1, 'два');
assert.equal(fn.count, 1);
assert.equal(fn.lastArgs, [1, 'два']);` },

      { name: 'вызывает всех подписчиков события в порядке подписки',
        body: `const e = new EventEmitter();
const order = [];
e.on('x', () => order.push('первый'));
e.on('x', () => order.push('второй'));
e.emit('x');
assert.equal(order, ['первый', 'второй']);` },

      { name: 'emit без подписчиков не бросает исключение',
        body: `const e = new EventEmitter();
e.emit('никого');
e.off('никого', () => {});
assert.ok(true);` },

      { name: 'off снимает подписку',
        body: `const e = new EventEmitter();
const fn = spy();
e.on('x', fn);
e.off('x', fn);
e.emit('x');
assert.equal(fn.count, 0, 'после off обработчик вызываться не должен');` },

      { name: 'off снимает только указанного подписчика',
        body: `const e = new EventEmitter();
const a = spy();
const b = spy();
e.on('x', a);
e.on('x', b);
e.off('x', a);
e.emit('x');
assert.equal(a.count, 0);
assert.equal(b.count, 1, 'остальные подписчики должны остаться');` },

      { name: 'once вызывает обработчик ровно один раз',
        body: `const e = new EventEmitter();
const fn = spy();
e.once('x', fn);
e.emit('x', 'первый');
e.emit('x', 'второй');
assert.equal(fn.count, 1, 'once должен отписаться после первого срабатывания');
assert.equal(fn.lastArgs, ['первый']);` },

      { name: 'on возвращает функцию отписки',
        body: `const e = new EventEmitter();
const fn = spy();
const unsubscribe = e.on('x', fn);
assert.equal(typeof unsubscribe, 'function', 'on должен возвращать функцию отписки');
unsubscribe();
e.emit('x');
assert.equal(fn.count, 0);` },

      { name: 'отписка во время рассылки не пропускает остальных слушателей',
        body: `const e = new EventEmitter();
const calls = [];
const second = () => calls.push('второй');
const first = () => { e.off('x', second); calls.push('первый'); };
e.on('x', first);
e.on('x', second);
e.emit('x');
assert.equal(calls, ['первый', 'второй'], 'перебирать нужно копию списка подписчиков');` },
    ],
  },

  /* ══ t5 · deepClone ═════════════════════════════════════════ */
  t5: {
    env: 'worker',
    entry: 'deepClone',
    starter: `function deepClone(value) {
  // ваш код
}`,
    cases: [
      { name: 'возвращает примитивы как есть',
        body: `assert.equal(deepClone(5), 5);
assert.equal(deepClone('строка'), 'строка');
assert.equal(deepClone(null), null);
assert.equal(deepClone(undefined), undefined);
assert.equal(deepClone(true), true);` },

      { name: 'копирует вложенные объекты и массивы, а не переиспользует ссылки',
        body: `const src = { a: 1, b: { c: [1, 2, { d: 3 }] } };
const copy = deepClone(src);
assert.equal(copy, src, 'структура копии должна совпадать с оригиналом');
assert.ok(copy !== src, 'корень должен быть новым объектом');
assert.ok(copy.b !== src.b, 'вложенный объект должен быть новым');
assert.ok(copy.b.c !== src.b.c, 'массив должен быть новым');
assert.ok(copy.b.c[2] !== src.b.c[2], 'объект внутри массива тоже копируется');` },

      { name: 'изменение копии не затрагивает оригинал',
        body: `const src = { list: [1, 2, 3], nested: { flag: false } };
const copy = deepClone(src);
copy.list.push(4);
copy.nested.flag = true;
assert.equal(src.list, [1, 2, 3], 'оригинальный массив не должен меняться');
assert.equal(src.nested.flag, false, 'оригинальный объект не должен меняться');` },

      { name: 'копирует Date как новый объект с тем же временем',
        body: `const src = { d: new Date(1700000000000) };
const copy = deepClone(src);
assert.ok(copy.d instanceof Date, 'Date должен остаться Date, а не превратиться в объект');
assert.equal(copy.d.getTime(), 1700000000000);
assert.ok(copy.d !== src.d, 'Date должен быть новым экземпляром');` },

      { name: 'копирует Map и Set вместе с их содержимым',
        body: `const src = { m: new Map([['k', { v: 1 }]]), s: new Set([1, 2]) };
const copy = deepClone(src);
assert.ok(copy.m instanceof Map, 'Map должен остаться Map');
assert.ok(copy.s instanceof Set, 'Set должен остаться Set');
assert.equal(copy.m.get('k'), { v: 1 });
assert.ok(copy.m.get('k') !== src.m.get('k'), 'значения внутри Map тоже копируются');
assert.equal(copy.s, new Set([1, 2]));
assert.ok(copy.s !== src.s);` },

      { name: 'не зацикливается на циклических ссылках',
        body: `const src = { name: 'root' };
src.self = src;
const copy = deepClone(src);
assert.equal(copy.name, 'root');
assert.ok(copy !== src);
assert.ok(copy.self === copy, 'цикл должен указывать на копию, а не на оригинал');` },

      { name: 'сохраняет общую ссылку, встреченную дважды',
        body: `const shared = { v: 1 };
const src = { left: shared, right: shared };
const copy = deepClone(src);
assert.ok(copy.left !== shared, 'общий объект должен быть скопирован');
assert.ok(copy.left === copy.right, 'один и тот же объект не должен превратиться в две разные копии');` },
    ],
  },

  /* ══ t6 · retry ═════════════════════════════════════════════ */
  t6: {
    env: 'worker',
    entry: 'retry',
    starter: `async function retry(fn, retries = 3, delay = 500) {
  // ваш код
}`,
    cases: [
      { name: 'возвращает результат успешной функции без повторов',
        body: `let count = 0;
const fn = () => { count++; return Promise.resolve('ок'); };
assert.equal(await retry(fn, 3, 100), 'ок');
assert.equal(count, 1, 'при успехе повторять нечего');` },

      { name: 'повторяет упавшую функцию и возвращает результат удачной попытки',
        body: `let count = 0;
const fn = () => {
  count++;
  return count < 3 ? Promise.reject(new Error('сбой')) : Promise.resolve('ок');
};
const p = retry(fn, 5, 100);
await clock.tick(0);
await clock.tick(5000);
assert.equal(await p, 'ок');
assert.equal(count, 3);` },

      { name: 'ждёт задержку перед повтором, а не дёргает функцию подряд',
        body: `let count = 0;
const fn = () => { count++; return Promise.reject(new Error('сбой')); };
const p = retry(fn, 3, 100);
const guard = assert.rejects(p);
await clock.tick(0);
assert.equal(count, 1, 'вторая попытка должна ждать delay мс');
await clock.tick(99);
assert.equal(count, 1, 'до истечения задержки повтора быть не должно');
await clock.tick(1);
assert.equal(count, 2);
await clock.tick(100000);
await guard;` },

      { name: 'бросает последнюю ошибку, исчерпав попытки',
        body: `const fn = () => Promise.reject(new Error('всё плохо'));
const guard = assert.rejects(retry(fn, 2, 10), 'retry обязан пробросить ошибку, а не проглотить её');
await clock.tick(0);
await clock.tick(100000);
const err = await guard;
assert.equal(err.message, 'всё плохо');` },

      { name: 'делает ровно retries повторов после первой попытки',
        body: `let count = 0;
const fn = () => { count++; return Promise.reject(new Error('сбой')); };
const guard = assert.rejects(retry(fn, 2, 10));
await clock.tick(0);
await clock.tick(100000);
await guard;
assert.equal(count, 3, 'при retries = 2 всего должно быть три вызова: попытка и два повтора');` },

      { name: 'увеличивает паузу между попытками (экспоненциальный backoff)',
        body: `let count = 0;
const fn = () => { count++; return Promise.reject(new Error('сбой')); };
const guard = assert.rejects(retry(fn, 3, 100));
await clock.tick(0);
assert.equal(count, 1, 'первая попытка происходит сразу');
await clock.tick(100);
assert.equal(count, 2, 'первая пауза — 100 мс');
await clock.tick(100);
assert.equal(count, 2, 'вторая пауза должна быть длиннее первой');
await clock.tick(100);
assert.equal(count, 3, 'вторая пауза — 200 мс');
await clock.tick(100000);
await guard;
assert.equal(count, 4);` },
    ],
  },

  /* ══ t7 · Promise.all своими руками ═════════════════════════ */
  t7: {
    env: 'worker',
    entry: 'myPromiseAll',
    starter: `function myPromiseAll(items) {
  // ваш код
}`,
    cases: [
      { name: 'резолвится массивом значений',
        body: `assert.equal(await myPromiseAll([Promise.resolve(1), Promise.resolve(2)]), [1, 2]);` },

      { name: 'на пустом массиве резолвится пустым массивом',
        body: `assert.equal(await myPromiseAll([]), [], 'пустой вход должен резолвиться, а не висеть');` },

      { name: 'принимает не только промисы',
        body: `assert.equal(await myPromiseAll([1, Promise.resolve(2), 'три']), [1, 2, 'три']);` },

      { name: 'сохраняет порядок исходного массива, а не порядок завершения',
        body: `const delay = (v, ms) => new Promise(r => setTimeout(() => r(v), ms));
const p = myPromiseAll([delay('a', 30), delay('b', 10), delay('c', 20)]);
await clock.tick(100);
assert.equal(await p, ['a', 'b', 'c'], 'результат кладётся по индексу, а не через push');` },

      { name: 'отклоняется первой же ошибкой',
        body: `const err = await assert.rejects(myPromiseAll([Promise.resolve(1), Promise.reject(new Error('бум'))]));
assert.equal(err.message, 'бум');` },

      { name: 'не ждёт остальные промисы после ошибки',
        body: `const delay = (v, ms) => new Promise(r => setTimeout(() => r(v), ms));
let state = 'ожидание';
const p = myPromiseAll([delay('медленный', 10000), Promise.reject(new Error('быстрый'))]);
p.then(() => { state = 'резолв'; }, () => { state = 'реджект'; });
await clock.tick(0);
assert.equal(state, 'реджект', 'реджект должен произойти сразу, не дожидаясь долгих промисов');
await clock.tick(20000);` },
    ],
  },

  /* ══ t8 · memoize ═══════════════════════════════════════════ */
  t8: {
    env: 'worker',
    entry: 'memoize',
    starter: `function memoize(fn) {
  // ваш код
}`,
    cases: [
      { name: 'вызывает исходную функцию только один раз для одинаковых аргументов',
        body: `const fn = spy(x => x * 2);
const m = memoize(fn);
assert.equal(m(2), 4);
assert.equal(m(2), 4);
assert.equal(m(2), 4);
assert.equal(fn.count, 1, 'повторный вызов должен браться из кеша');` },

      { name: 'считает разные аргументы разными ключами',
        body: `const fn = spy(x => x * 2);
const m = memoize(fn);
assert.equal(m(2), 4);
assert.equal(m(3), 6);
assert.equal(fn.count, 2);` },

      { name: 'кеширует результат undefined и не вызывает функцию заново',
        body: `const fn = spy(() => undefined);
const m = memoize(fn);
m(1);
m(1);
assert.equal(fn.count, 1, 'нельзя определять «нет в кеше» по undefined в значении');` },

      { name: 'различает вызовы с разным числом аргументов',
        body: `const fn = spy((...args) => args.length);
const m = memoize(fn);
assert.equal(m(1), 1);
assert.equal(m(1, 2), 2, 'ключ кеша должен учитывать все аргументы');
assert.equal(fn.count, 2);` },

      { name: 'различает объектные аргументы с разным содержимым',
        body: `const fn = spy(o => o.id);
const m = memoize(fn);
assert.equal(m({ id: 1 }), 1);
assert.equal(m({ id: 2 }), 2, 'разные объекты не должны схлопываться в один ключ');
assert.equal(fn.count, 2);` },

      { name: 'сохраняет контекст вызова',
        body: `const fn = spy(function (a) { return this.base + a; });
const obj = { base: 10, calc: memoize(fn) };
assert.equal(obj.calc(5), 15, 'this должен долетать до исходной функции');` },
    ],
  },

  /* ══ t9 · curry ═════════════════════════════════════════════ */
  t9: {
    env: 'worker',
    entry: 'curry',
    starter: `function curry(fn) {
  // ваш код
}`,
    cases: [
      { name: 'вызов со всеми аргументами сразу работает как обычный',
        body: `const sum = curry(function (a, b, c) { return a + b + c; });
assert.equal(sum(1, 2, 3), 6);` },

      { name: 'принимает аргументы по одному',
        body: `const sum = curry(function (a, b, c) { return a + b + c; });
assert.equal(sum(1)(2)(3), 6);` },

      { name: 'принимает аргументы любыми порциями',
        body: `const sum = curry(function (a, b, c) { return a + b + c; });
assert.equal(sum(1, 2)(3), 6);
assert.equal(sum(1)(2, 3), 6);` },

      { name: 'не вызывает функцию, пока не собраны все аргументы',
        body: `let count = 0;
const sum = curry(function (a, b, c) { count++; return a + b + c; });
sum(1);
sum(1)(2);
assert.equal(count, 0, 'функция арности 3 не должна вызываться от двух аргументов');
assert.equal(sum(1)(2)(3), 6);
assert.equal(count, 1);` },

      { name: 'частично применённая функция переиспользуется независимо',
        body: `const sum = curry(function (a, b, c) { return a + b + c; });
const from1 = sum(1);
assert.equal(from1(2)(3), 6);
assert.equal(from1(10)(100), 111, 'аргументы не должны накапливаться между вызовами');` },

      { name: 'функция одного аргумента вызывается сразу',
        body: `const double = curry(function (x) { return x * 2; });
assert.equal(double(5), 10);` },

      { name: 'сохраняет контекст вызова',
        body: `const obj = {
  base: 10,
  add: curry(function (a, b) { return this.base + a + b; }),
};
assert.equal(obj.add(1)(2), 13, 'this должен доходить до исходной функции');` },
    ],
  },

  /* ══ t10 · myBind ═══════════════════════════════════════════ */
  t10: {
    env: 'worker',
    entry: 'Function.prototype.myBind',
    starter: `Function.prototype.myBind = function (ctx, ...bound) {
  // ваш код
};`,
    cases: [
      { name: 'привязывает контекст к функции',
        body: `function who() { return this.tag; }
const bound = who.myBind({ tag: 'пользователь' });
assert.equal(bound(), 'пользователь');` },

      { name: 'возвращает результат исходной функции',
        body: `function sum(a, b) { return a + b; }
assert.equal(sum.myBind(null)(2, 3), 5);` },

      { name: 'подставляет связанные аргументы перед аргументами вызова',
        body: `function join(...args) { return args.join('-'); }
const bound = join.myBind(null, 'a', 'b');
assert.equal(bound('c', 'd'), 'a-b-c-d');` },

      { name: 'не накапливает аргументы между вызовами',
        body: `function join(...args) { return args.join('-'); }
const bound = join.myBind(null, 'a');
assert.equal(bound('b'), 'a-b');
assert.equal(bound('c'), 'a-c', 'каждый вызов получает свои аргументы поверх связанных');` },

      { name: 'привязанный контекст нельзя переопределить через call',
        body: `function who() { return this.tag; }
const bound = who.myBind({ tag: 'связанный' });
assert.equal(bound.call({ tag: 'чужой' }), 'связанный', 'bind фиксирует this намертво');
assert.equal(bound.apply({ tag: 'чужой' }), 'связанный');` },

      { name: 'спасает метод, оторванный от объекта',
        body: `const user = {
  name: 'Аня',
  greet: function (greeting, mark) { return greeting + ', ' + this.name + mark; },
};
const detached = user.greet;
const bound = detached.myBind(user, 'Привет');
assert.equal(bound('!'), 'Привет, Аня!');` },
    ],
  },

  /* ══ t11 · LRU-кеш ══════════════════════════════════════════ */
  t11: {
    env: 'worker',
    entry: 'LRUCache',
    starter: `class LRUCache {
  constructor(capacity) {
    // ваш код
  }

  get(key) {
    // ваш код
  }

  put(key, value) {
    // ваш код
  }
}`,
    cases: [
      { name: 'отдаёт положенное значение',
        body: `const cache = new LRUCache(2);
cache.put('a', 1);
assert.equal(cache.get('a'), 1);` },

      { name: 'возвращает -1 для неизвестного ключа',
        body: `const cache = new LRUCache(2);
assert.equal(cache.get('нет'), -1);` },

      { name: 'вытесняет самый давний элемент при переполнении',
        body: `const cache = new LRUCache(2);
cache.put('a', 1);
cache.put('b', 2);
cache.put('c', 3);
assert.equal(cache.get('a'), -1, 'при переполнении должен уйти самый давно использованный ключ');
assert.equal(cache.get('b'), 2);
assert.equal(cache.get('c'), 3);` },

      { name: 'обращение через get делает элемент свежим',
        body: `const cache = new LRUCache(2);
cache.put('a', 1);
cache.put('b', 2);
cache.get('a');
cache.put('c', 3);
assert.equal(cache.get('a'), 1, 'после get элемент должен стать самым свежим');
assert.equal(cache.get('b'), -1, 'вытесниться должен b — к нему не обращались дольше всех');` },

      { name: 'повторный put обновляет значение и не раздувает кеш',
        body: `const cache = new LRUCache(2);
cache.put('a', 1);
cache.put('b', 2);
cache.put('a', 10);
cache.put('c', 3);
assert.equal(cache.get('a'), 10, 'обновлённое значение должно сохраниться и освежить ключ');
assert.equal(cache.get('b'), -1);
assert.equal(cache.get('c'), 3);` },

      { name: 'работает при ёмкости 1',
        body: `const cache = new LRUCache(1);
cache.put('a', 1);
cache.put('b', 2);
assert.equal(cache.get('a'), -1);
assert.equal(cache.get('b'), 2);` },

      { name: 'выдерживает длинную последовательность обращений',
        body: `const cache = new LRUCache(3);
cache.put(1, 'один');
cache.put(2, 'два');
cache.put(3, 'три');
cache.get(1);
cache.put(4, 'четыре');   // вытесняет 2
assert.equal(cache.get(2), -1);
cache.get(3);
cache.put(5, 'пять');     // вытесняет 1
assert.equal(cache.get(1), -1);
assert.equal(cache.get(3), 'три');
assert.equal(cache.get(4), 'четыре');
assert.equal(cache.get(5), 'пять');` },
    ],
  },

  /* ══ t15 · flatten, chunk, groupBy ══════════════════════════ */
  t15: {
    env: 'worker',
    entry: 'flatten',
    starter: `function flatten(arr, depth = 1) {
  // ваш код
}

function chunk(arr, size) {
  // ваш код
}

function groupBy(arr, keyFn) {
  // ваш код
}`,
    cases: [
      { name: 'flatten разворачивает вложенность на один уровень по умолчанию',
        body: `assert.equal(flatten([1, [2, [3, [4]]]]), [1, 2, [3, [4]]], 'по умолчанию глубина равна 1');
assert.equal(flatten([]), []);` },

      { name: 'flatten уважает переданную глубину',
        body: `const src = [1, [2, [3, [4]]]];
assert.equal(flatten(src, 2), [1, 2, 3, [4]]);
assert.equal(flatten(src, Infinity), [1, 2, 3, 4], 'глубина Infinity должна разворачивать всё');` },

      { name: 'flatten не мутирует исходный массив и на глубине 0 возвращает копию',
        body: `const src = [1, [2, 3]];
const result = flatten(src, 0);
assert.equal(result, [1, [2, 3]]);
assert.ok(result !== src, 'при глубине 0 надо вернуть копию, а не сам массив');
flatten(src, Infinity);
assert.equal(src, [1, [2, 3]], 'исходный массив должен остаться прежним');` },

      { name: 'chunk режет массив на куски заданного размера',
        body: `if (typeof chunk === 'undefined') assert.fail('Не объявлена функция chunk — в этой задаче нужны все три утилиты.');
assert.equal(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
assert.equal(chunk([1, 2, 3, 4, 5], 5), [[1, 2, 3, 4, 5]]);` },

      { name: 'chunk оставляет неполный последний кусок и не падает на пустом входе',
        body: `if (typeof chunk === 'undefined') assert.fail('Не объявлена функция chunk — в этой задаче нужны все три утилиты.');
assert.equal(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]], 'хвост короче size — это нормально');
assert.equal(chunk([], 3), [], 'на пустом массиве должен получиться пустой массив, а не [[]]');` },

      { name: 'groupBy собирает элементы в объект по вычисляемому ключу',
        body: `if (typeof groupBy === 'undefined') assert.fail('Не объявлена функция groupBy — в этой задаче нужны все три утилиты.');
const words = ['раз', 'два', 'три', 'четыре'];
assert.equal(groupBy(words, w => w.length), { 3: ['раз', 'два', 'три'], 6: ['четыре'] });` },

      { name: 'groupBy сохраняет порядок внутри группы и не падает на пустом входе',
        body: `if (typeof groupBy === 'undefined') assert.fail('Не объявлена функция groupBy — в этой задаче нужны все три утилиты.');
const users = [
  { name: 'а', city: 'Москва' },
  { name: 'б', city: 'Питер' },
  { name: 'в', city: 'Москва' },
];
const grouped = groupBy(users, u => u.city);
assert.equal(grouped['Москва'], [users[0], users[2]], 'порядок внутри группы — как в исходном массиве');
assert.equal(grouped['Питер'], [users[1]]);
assert.equal(groupBy([], x => x), {});` },
    ],
  },

  /* ══ tx1 · deepEqual ════════════════════════════════════════ */
  tx1: {
    env: 'worker',
    entry: 'deepEqual',
    starter: `function deepEqual(a, b) {
  // ваш код
}`,
    cases: [
      { name: 'сравнивает примитивы',
        body: `assert.equal(deepEqual(1, 1), true);
assert.equal(deepEqual('a', 'b'), false);` },

      { name: 'сравнивает вложенные структуры',
        body: `assert.equal(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true);` },

      { name: 'различает разное количество ключей',
        body: `assert.equal(deepEqual({ a: 1 }, { a: 1, b: 2 }), false);` },

      { name: 'считает NaN равным NaN и не путает типы',
        body: `assert.equal(deepEqual(NaN, NaN), true, 'сравнение примитивов должно вести себя как Object.is');
assert.equal(deepEqual(1, '1'), false);
assert.equal(deepEqual(null, undefined), false);
assert.equal(deepEqual(null, {}), false, 'typeof null === object — классическая ловушка');` },

      { name: 'не зависит от порядка ключей и различает массив с объектом',
        body: `assert.equal(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
assert.equal(deepEqual([1, 2], [1, 2, 3]), false);
assert.equal(deepEqual([], {}), false, 'массив и объект — разные сущности');` },

      { name: 'сравнивает Date, RegExp, Map и Set по содержимому',
        body: `assert.equal(deepEqual(new Date(1000), new Date(1000)), true);
assert.equal(deepEqual(new Date(1000), new Date(2000)), false);
assert.equal(deepEqual(/ab/g, /ab/g), true);
assert.equal(deepEqual(/ab/g, /ab/i), false, 'флаги регулярки — часть значения');
assert.equal(deepEqual(new Map([['a', 1]]), new Map([['a', 1]])), true);
assert.equal(deepEqual(new Map([['a', 1]]), new Map([['a', 2]])), false);
assert.equal(deepEqual(new Set([1, 2]), new Set([2, 1])), true, 'порядок в Set значения не имеет');
assert.equal(deepEqual(new Set([1]), new Set([1, 2])), false);` },
    ],
  },

  /* ══ tx2 · get / set по пути ════════════════════════════════ */
  tx2: {
    env: 'worker',
    entry: 'get',
    starter: `function get(obj, path, defaultValue) {
  // ваш код
}

function set(obj, path, value) {
  // ваш код
}`,
    cases: [
      { name: 'get достаёт значение по точечному пути',
        body: `assert.equal(get({ a: { b: { c: 42 } } }, 'a.b.c'), 42);` },

      { name: 'get понимает скобочную нотацию и индексы массивов',
        body: `const obj = { a: { b: [{ c: 'цель' }] } };
assert.equal(get(obj, 'a.b[0].c'), 'цель');
assert.equal(get(obj, 'a.b.0.c'), 'цель', 'точечная запись индекса тоже должна работать');` },

      { name: 'get принимает путь массивом ключей',
        body: `assert.equal(get({ a: { b: 1 } }, ['a', 'b']), 1);` },

      { name: 'get возвращает дефолт и не падает на null посреди пути',
        body: `assert.equal(get({ a: null }, 'a.b.c', 'дефолт'), 'дефолт', 'null посреди пути не должен ронять функцию');
assert.equal(get({}, 'нет.такого', 'дефолт'), 'дефолт');
assert.equal(get(undefined, 'a.b', 'дефолт'), 'дефолт');` },

      { name: 'get отличает существующий null от отсутствующего значения',
        body: `assert.equal(get({ a: null }, 'a', 'дефолт'), null, 'дефолт подставляется только вместо undefined');
assert.equal(get({ a: 0 }, 'a', 'дефолт'), 0, 'ноль — валидное значение');
assert.equal(get({ a: false }, 'a', 'дефолт'), false);` },

      { name: 'set создаёт недостающие объекты по пути',
        body: `if (typeof set === 'undefined') assert.fail('Не объявлена функция set — в этой задаче нужны обе функции.');
const obj = {};
set(obj, 'a.b.c', 7);
assert.equal(obj, { a: { b: { c: 7 } } });` },

      { name: 'set создаёт массив, если следующий ключ числовой',
        body: `if (typeof set === 'undefined') assert.fail('Не объявлена функция set — в этой задаче нужны обе функции.');
const obj = {};
set(obj, 'list[0].id', 5);
assert.ok(Array.isArray(obj.list), 'под числовой ключ нужен массив, а не объект');
assert.equal(obj.list[0].id, 5);` },

      { name: 'set перезаписывает существующее значение и возвращает тот же объект',
        body: `if (typeof set === 'undefined') assert.fail('Не объявлена функция set — в этой задаче нужны обе функции.');
const obj = { a: { b: 1, keep: 'на месте' } };
const returned = set(obj, 'a.b', 2);
assert.equal(obj.a.b, 2);
assert.equal(obj.a.keep, 'на месте', 'соседние ключи не должны стираться');
assert.ok(returned === obj, 'set должен вернуть исходный объект');` },
    ],
  },

  /* ══ tx3 · pipe / compose ═══════════════════════════════════ */
  tx3: {
    env: 'worker',
    entry: 'pipe',
    starter: `function pipe(...fns) {
  // ваш код
}

function compose(...fns) {
  // ваш код
}

function pipeAsync(...fns) {
  // ваш код
}`,
    cases: [
      { name: 'pipe применяет функции слева направо',
        body: `const inc = x => x + 1;
const double = x => x * 2;
assert.equal(pipe(inc, double)(3), 8, 'pipe(f, g)(x) это g(f(x))');` },

      { name: 'pipe передаёт все аргументы в первую функцию',
        body: `const sum = (a, b) => a + b;
const double = x => x * 2;
assert.equal(pipe(sum, double)(2, 3), 10, 'первая функция получает все аргументы вызова');` },

      { name: 'pipe без функций возвращает первый аргумент',
        body: `assert.equal(pipe()('как есть'), 'как есть');
assert.equal(pipe()(1, 2, 3), 1);` },

      { name: 'compose применяет функции справа налево',
        body: `if (typeof compose === 'undefined') assert.fail('Не объявлена функция compose — в этой задаче нужны обе.');
const inc = x => x + 1;
const double = x => x * 2;
assert.equal(compose(inc, double)(3), 7, 'compose(f, g)(x) это f(g(x))');` },

      { name: 'compose и pipe дают зеркальный порядок на одном наборе функций',
        body: `if (typeof compose === 'undefined') assert.fail('Не объявлена функция compose — в этой задаче нужны обе.');
const add = x => x + 'A';
const mul = x => x + 'B';
assert.equal(pipe(add, mul)('_'), '_AB');
assert.equal(compose(add, mul)('_'), '_BA');
assert.equal(compose(add, mul)('_'), '_BA', 'повторный вызов не должен зависеть от предыдущего');` },

      { name: 'pipe сохраняет контекст вызова',
        body: `const obj = {
  base: 10,
  run: pipe(function (x) { return this.base + x; }, x => x * 2),
};
assert.equal(obj.run(5), 30, 'this должен доходить до первой функции цепочки');` },

      { name: 'pipeAsync дожидается промежуточных промисов',
        body: `if (typeof pipeAsync === 'undefined') assert.fail('Не объявлена функция pipeAsync — она нужна в этой задаче.');
const chain = pipeAsync(
  async x => x + 1,
  x => Promise.resolve(x * 2),
  x => x - 3
);
assert.equal(await chain(4), 7, 'каждый шаг должен получать развёрнутое значение, а не промис');` },
    ],
  },

  /* ══ tx4 · once ═════════════════════════════════════════════ */
  tx4: {
    env: 'worker',
    entry: 'once',
    starter: `function once(fn) {
  // ваш код
}`,
    cases: [
      { name: 'вызывает исходную функцию только один раз',
        body: `const fn = spy();
const wrapped = once(fn);
wrapped();
wrapped();
wrapped();
assert.equal(fn.count, 1);` },

      { name: 'возвращает результат первого вызова при каждом обращении',
        body: `let n = 0;
const wrapped = once(() => ++n);
assert.equal(wrapped(), 1);
assert.equal(wrapped(), 1, 'повторный вызов должен отдавать закешированный результат');
assert.equal(wrapped(), 1);` },

      { name: 'кеширует результат undefined и не вызывает функцию заново',
        body: `const fn = spy(() => undefined);
const wrapped = once(fn);
wrapped();
wrapped();
assert.equal(fn.count, 1, 'флаг «уже вызвана» важнее проверки результата на undefined');` },

      { name: 'сохраняет контекст и аргументы первого вызова',
        body: `const fn = spy(function (suffix) { return this.tag + suffix; });
const obj = { tag: 'ctx', run: once(fn) };
assert.equal(obj.run('-1'), 'ctx-1');
assert.equal(fn.contexts[0] && fn.contexts[0].tag, 'ctx', 'this должен долетать до fn');
assert.equal(fn.calls[0], ['-1']);` },

      { name: 'игнорирует аргументы последующих вызовов',
        body: `const wrapped = once(x => x);
assert.equal(wrapped('первый'), 'первый');
assert.equal(wrapped('второй'), 'первый', 'результат зафиксирован на первом вызове');` },

      { name: 'reset позволяет вызвать функцию заново',
        body: `let n = 0;
const fn = spy(() => ++n);
const wrapped = once(fn);
assert.equal(wrapped(), 1);
assert.equal(wrapped(), 1);
wrapped.reset();
assert.equal(wrapped(), 2, 'после reset функция должна вызваться снова');
assert.equal(fn.count, 2);` },
    ],
  },

  /* ══ tx5 · partial с плейсхолдерами ═════════════════════════ */
  tx5: {
    env: 'worker',
    entry: 'partial',
    starter: `const _ = Symbol('placeholder');

function partial(fn, ...preset) {
  // ваш код
}

function partialRight(fn, ...preset) {
  // ваш код
}`,
    cases: [
      { name: 'подставляет заранее заданные аргументы перед новыми',
        body: `const join = (...args) => args.join('-');
assert.equal(partial(join, 1, 2)(3), '1-2-3');` },

      { name: 'без предустановленных аргументов работает как обычный вызов',
        body: `const join = (...args) => args.join('-');
assert.equal(partial(join)(1, 2, 3), '1-2-3');
assert.equal(partial(join, 1, 2, 3)(), '1-2-3');` },

      { name: 'плейсхолдер резервирует позицию для аргумента вызова',
        body: `if (typeof _ === 'undefined') assert.fail('Не объявлен плейсхолдер _ — он нужен в этой задаче.');
const join = (...args) => args.join('-');
assert.equal(partial(join, 1, _, 3)(2), '1-2-3', 'плейсхолдер заполняется первым аргументом вызова');` },

      { name: 'лишние аргументы вызова дописываются справа',
        body: `if (typeof _ === 'undefined') assert.fail('Не объявлен плейсхолдер _ — он нужен в этой задаче.');
const join = (...args) => args.join('-');
assert.equal(partial(join, 1, _, 3)(2, 4, 5), '1-2-3-4-5');` },

      { name: 'плейсхолдеры заполняются заново на каждом вызове',
        body: `if (typeof _ === 'undefined') assert.fail('Не объявлен плейсхолдер _ — он нужен в этой задаче.');
const join = (...args) => args.join('-');
const p = partial(join, 1, _, 3);
assert.equal(p(2), '1-2-3');
assert.equal(p(9), '1-9-3', 'предустановленные аргументы не должны «съедаться» первым вызовом');` },

      { name: 'не фиксирует this — контекст берётся из места вызова',
        body: `const obj = {
  tag: 'ctx',
  run: partial(function (suffix) { return this.tag + suffix; }, '-1'),
};
assert.equal(obj.run(), 'ctx-1', 'в отличие от bind, partial не должен связывать this');` },

      { name: 'partialRight дописывает свои аргументы справа',
        body: `if (typeof partialRight === 'undefined') assert.fail('Не объявлена функция partialRight — она нужна в этой задаче.');
const join = (...args) => args.join('-');
assert.equal(partialRight(join, 3)(1, 2), '1-2-3');
assert.equal(partialRight(join, 2, 3)(1), '1-2-3');` },
    ],
  },

  /* ══ tx6 · debounce с leading/trailing/maxWait ══════════════ */
  tx6: {
    env: 'worker',
    entry: 'debounce',
    starter: `function debounce(fn, wait, options) {
  // ваш код
}`,
    cases: [
      { name: 'по умолчанию вызывает функцию после паузы',
        body: `const fn = spy();
const d = debounce(fn, 100);
d();
assert.equal(fn.count, 0, 'без leading вызов должен быть отложен');
await clock.tick(100);
assert.equal(fn.count, 1);` },

      { name: 'сохраняет контекст и аргументы последнего вызова',
        body: `const fn = spy();
const obj = { tag: 'ctx', run: debounce(fn, 100) };
obj.run(1);
obj.run(2);
await clock.tick(100);
assert.equal(fn.count, 1, 'серия вызовов схлопывается в один');
assert.equal(fn.lastArgs, [2]);
assert.equal(fn.contexts[0] && fn.contexts[0].tag, 'ctx');` },

      { name: 'leading: true вызывает функцию на первом событии серии',
        body: `const fn = spy();
const d = debounce(fn, 100, { leading: true, trailing: false });
d('первый');
assert.equal(fn.count, 1, 'при leading вызов должен произойти немедленно');
assert.equal(fn.lastArgs, ['первый']);
await clock.tick(500);
assert.equal(fn.count, 1, 'при trailing: false повторного вызова после паузы быть не должно');` },

      { name: 'leading вместе с trailing не дублирует вызов на одиночном событии',
        body: `const fn = spy();
const d = debounce(fn, 100, { leading: true, trailing: true });
d();
await clock.tick(500);
assert.equal(fn.count, 1, 'одно событие должно дать ровно один вызов, а не два');` },

      { name: 'leading вместе с trailing даёт два вызова на серии событий',
        body: `const fn = spy();
const d = debounce(fn, 100, { leading: true, trailing: true });
d('a');
assert.equal(fn.count, 1);
await clock.tick(50);
d('b');
await clock.tick(100);
assert.equal(fn.count, 2, 'после паузы должен догнать последний вызов серии');
assert.equal(fn.lastArgs, ['b']);` },

      { name: 'maxWait пробивает бесконечную серию событий',
        body: `const fn = spy();
const d = debounce(fn, 100, { maxWait: 250 });
d('a'); await clock.tick(50);
d('b'); await clock.tick(50);
d('c'); await clock.tick(50);
d('d'); await clock.tick(50);
d('e'); await clock.tick(50);
assert.ok(fn.count >= 1, 'события идут чаще паузы, поэтому без maxWait функция не вызвалась бы ни разу');` },

      { name: 'cancel отменяет отложенный вызов',
        body: `const fn = spy();
const d = debounce(fn, 100);
d('x');
d.cancel();
await clock.tick(1000);
assert.equal(fn.count, 0, 'после cancel отложенный вызов не должен состояться');` },

      { name: 'flush вызывает отложенное немедленно и снимает таймер',
        body: `const fn = spy();
const d = debounce(fn, 100);
d('x');
d.flush();
assert.equal(fn.count, 1, 'flush должен вызвать функцию прямо сейчас');
assert.equal(fn.lastArgs, ['x']);
await clock.tick(1000);
assert.equal(fn.count, 1, 'после flush таймер не должен выстрелить повторно');` },
    ],
  },

  /* ══ tx7 · promisify / callbackify ══════════════════════════ */
  tx7: {
    env: 'worker',
    entry: 'promisify',
    starter: `function promisify(fn) {
  // ваш код
}

function callbackify(asyncFn) {
  // ваш код
}`,
    cases: [
      { name: 'резолвит промис значением из колбэка',
        body: `const read = (name, cb) => cb(null, 'данные ' + name);
assert.equal(await promisify(read)('файл'), 'данные файл');` },

      { name: 'отклоняет промис ошибкой из колбэка',
        body: `const fail = (cb) => cb(new Error('бум'));
const err = await assert.rejects(promisify(fail)(), 'ошибка в первом аргументе колбэка должна реджектить промис');
assert.equal(err.message, 'бум');` },

      { name: 'резолвит массивом, если колбэк отдал несколько значений',
        body: `const multi = (cb) => cb(null, 1, 2, 3);
assert.equal(await promisify(multi)(), [1, 2, 3]);` },

      { name: 'дожидается асинхронного колбэка',
        body: `const later = (cb) => setTimeout(() => cb(null, 'готово'), 100);
const p = promisify(later)();
await clock.tick(100);
assert.equal(await p, 'готово');` },

      { name: 'сохраняет контекст вызова',
        body: `const obj = {
  tag: 'ctx',
  read: function (cb) { cb(null, this.tag); },
};
obj.readAsync = promisify(obj.read);
assert.equal(await obj.readAsync(), 'ctx', 'this должен долетать до исходной функции');` },

      { name: 'превращает синхронное исключение в отклонённый промис',
        body: `const boom = () => { throw new Error('синхронно упало'); };
const err = await assert.rejects(promisify(boom)(), 'синхронный throw не должен ронять вызывающий код');
assert.equal(err.message, 'синхронно упало');` },

      { name: 'callbackify отдаёт результат вторым аргументом колбэка',
        body: `if (typeof callbackify === 'undefined') assert.fail('Не объявлена функция callbackify — она нужна в этой задаче.');
const doubleAsync = async (x) => x * 2;
let got = null;
callbackify(doubleAsync)(21, (err, value) => { got = [err, value]; });
await clock.tick(0);
assert.equal(got, [null, 42], 'при успехе первым аргументом должен идти null');` },

      { name: 'callbackify передаёт ошибку первым аргументом колбэка',
        body: `if (typeof callbackify === 'undefined') assert.fail('Не объявлена функция callbackify — она нужна в этой задаче.');
const failing = async () => { throw new Error('нет'); };
let got = null;
callbackify(failing)((err, value) => { got = [err && err.message, value]; });
await clock.tick(0);
assert.equal(got, ['нет', undefined]);` },
    ],
  },

  /* ══ tx8 · rateLimit ════════════════════════════════════════ */
  tx8: {
    env: 'worker',
    entry: 'rateLimit',
    starter: `function rateLimit(fn, limit, interval) {
  // ваш код
}`,
    cases: [
      { name: 'пропускает вызовы в пределах лимита сразу',
        body: `const fn = spy();
const limited = rateLimit(fn, 2, 100);
limited(1);
limited(2);
await clock.tick(0);
assert.equal(fn.count, 2, 'первые limit вызовов не должны ждать');` },

      { name: 'возвращает промис с результатом функции',
        body: `const limited = rateLimit(x => x * 2, 5, 100);
assert.equal(await limited(21), 42);` },

      { name: 'откладывает лишние вызовы, а не выбрасывает их',
        body: `const fn = spy();
const limited = rateLimit(fn, 2, 100);
limited(1); limited(2); limited(3);
await clock.tick(0);
assert.equal(fn.count, 2, 'третий вызов должен подождать, а не выполниться сразу');
await clock.tick(500);
assert.equal(fn.count, 3, 'отложенный вызов не должен потеряться — это не throttle');` },

      { name: 'сохраняет порядок вызовов',
        body: `const order = [];
const limited = rateLimit(x => { order.push(x); }, 1, 100);
limited('a'); limited('b'); limited('c');
await clock.tick(1000);
assert.equal(order, ['a', 'b', 'c']);` },

      { name: 'не делает больше limit вызовов за окно',
        body: `const times = [];
const limited = rateLimit(() => { times.push(Date.now()); }, 2, 100);
for (let i = 0; i < 6; i++) limited(i);
await clock.tick(5000);
assert.equal(times.length, 6, 'все вызовы должны в итоге выполниться');
for (let i = 2; i < times.length; i++) {
  assert.ok(times[i] - times[i - 2] >= 100,
    'между вызовом и вызовом на limit раньше должно пройти не меньше interval');
}` },

      { name: 'после освобождения окна снова пропускает вызовы сразу',
        body: `const fn = spy();
const limited = rateLimit(fn, 2, 100);
limited(); limited();
await clock.tick(500);
assert.equal(fn.count, 2);
limited(); limited();
await clock.tick(0);
assert.equal(fn.count, 4, 'окно скользящее: старые метки должны выйти из счёта');` },

      { name: 'отклоняет промис, если функция бросила исключение',
        body: `const limited = rateLimit(() => { throw new Error('бум'); }, 2, 100);
const err = await assert.rejects(limited());
assert.equal(err.message, 'бум');` },

      { name: 'сохраняет контекст вызова',
        body: `const obj = {
  tag: 'ctx',
  run: rateLimit(function () { return this.tag; }, 2, 100),
};
assert.equal(await obj.run(), 'ctx', 'this должен долетать до исходной функции');` },
    ],
  },

  /* ══ tx9 · свои map / filter / reduce / forEach ═════════════ */
  tx9: {
    env: 'worker',
    entry: 'Array.prototype.myMap',
    starter: `Array.prototype.myMap = function (callback, thisArg) {
  // ваш код
};

Array.prototype.myFilter = function (callback, thisArg) {
  // ваш код
};

Array.prototype.myForEach = function (callback, thisArg) {
  // ваш код
};

Array.prototype.myReduce = function (callback, initialValue) {
  // ваш код
};`,
    cases: [
      { name: 'myMap строит новый массив из результатов колбэка',
        body: `const src = [1, 2, 3];
const result = src.myMap(function (x) { return x * 2; });
assert.equal(result, [2, 4, 6]);
assert.ok(result !== src, 'map обязан возвращать новый массив');
assert.equal(src, [1, 2, 3], 'исходный массив не должен меняться');` },

      { name: 'myMap передаёт в колбэк значение, индекс и сам массив',
        body: `const src = ['a', 'b'];
const seen = [];
src.myMap(function (value, index, array) {
  seen.push([value, index, array === src]);
  return value;
});
assert.equal(seen, [['a', 0, true], ['b', 1, true]], 'колбэк получает три аргумента');` },

      { name: 'myFilter оставляет только подходящие элементы',
        body: `if (typeof Array.prototype.myFilter === 'undefined') assert.fail('Не объявлен Array.prototype.myFilter — в этой задаче нужны все четыре метода.');
assert.equal([1, 2, 3, 4].myFilter(function (x) { return x % 2 === 0; }), [2, 4]);
assert.equal([1, 2, 3].myFilter(function () { return false; }), []);` },

      { name: 'myForEach обходит все элементы и возвращает undefined',
        body: `if (typeof Array.prototype.myForEach === 'undefined') assert.fail('Не объявлен Array.prototype.myForEach — в этой задаче нужны все четыре метода.');
const seen = [];
const result = [10, 20].myForEach(function (v, i) { seen.push(i + ':' + v); });
assert.equal(seen, ['0:10', '1:20']);
assert.equal(result, undefined, 'forEach ничего не возвращает');` },

      { name: 'поддерживают второй аргумент thisArg',
        body: `if (typeof Array.prototype.myFilter === 'undefined') assert.fail('Не объявлен Array.prototype.myFilter — в этой задаче нужны все четыре метода.');
const ctx = { mul: 3, min: 2 };
assert.equal([1, 2].myMap(function (x) { return x * this.mul; }, ctx), [3, 6]);
assert.equal([1, 2, 3].myFilter(function (x) { return x >= this.min; }, ctx), [2, 3]);` },

      { name: 'myReduce сворачивает массив с начальным значением и без него',
        body: `if (typeof Array.prototype.myReduce === 'undefined') assert.fail('Не объявлен Array.prototype.myReduce — в этой задаче нужны все четыре метода.');
const add = function (acc, x) { return acc + x; };
assert.equal([1, 2, 3].myReduce(add), 6, 'без начального значения аккумулятор — первый элемент');
assert.equal([1, 2, 3].myReduce(add, 10), 16);
assert.equal([].myReduce(add, 'пусто'), 'пусто');` },

      { name: 'myReduce отличает отсутствующее начальное значение от явного undefined',
        body: `if (typeof Array.prototype.myReduce === 'undefined') assert.fail('Не объявлен Array.prototype.myReduce — в этой задаче нужны все четыре метода.');
const add = function (acc, x) { return acc + x; };
const withExplicitUndefined = [1, 2].myReduce(add, undefined);
assert.ok(Number.isNaN(withExplicitUndefined), 'явно переданный undefined — это начальное значение, а не его отсутствие');
const err = assert.throws(function () { [].myReduce(add); }, 'reduce пустого массива без начального значения обязан бросить TypeError');
assert.equal(err instanceof TypeError, true);` },

      { name: 'пропускают дырки разреженного массива',
        body: `if (typeof Array.prototype.myForEach === 'undefined') assert.fail('Не объявлен Array.prototype.myForEach — в этой задаче нужны все четыре метода.');
const sparse = [1, , 3];
const mapped = sparse.myMap(function (x) { return x * 2; });
assert.equal(mapped.length, 3, 'длина результата сохраняется');
assert.equal(mapped[0], 2);
assert.equal(mapped[2], 6);
assert.equal(1 in mapped, false, 'дырка должна остаться дыркой, а не стать undefined');
let visits = 0;
sparse.myForEach(function () { visits++; });
assert.equal(visits, 2, 'колбэк не должен вызываться для дырок');` },
    ],
  },

  /* ══ tx10 · uniqueBy / uniqueWith ═══════════════════════════ */
  tx10: {
    env: 'worker',
    entry: 'uniqueBy',
    starter: `function uniqueBy(arr, keyFn) {
  // ваш код
}

function uniqueWith(arr, isEqual) {
  // ваш код
}`,
    cases: [
      { name: 'удаляет дубликаты примитивов без keyFn',
        body: `assert.equal(uniqueBy([1, 2, 2, 3, 1]), [1, 2, 3]);
assert.equal(uniqueBy([]), [], 'пустой вход даёт пустой результат');` },

      { name: 'дедуплицирует объекты по вычисляемому ключу',
        body: `const users = [{ id: 1, n: 'а' }, { id: 2, n: 'б' }, { id: 1, n: 'в' }];
assert.equal(uniqueBy(users, u => u.id), [users[0], users[1]]);` },

      { name: 'оставляет первое вхождение, а не последнее',
        body: `const users = [{ id: 1, n: 'первый' }, { id: 1, n: 'второй' }];
const result = uniqueBy(users, u => u.id);
assert.equal(result.length, 1);
assert.equal(result[0].n, 'первый', 'при совпадении ключа остаётся первый встреченный элемент');` },

      { name: 'работает с составным ключом',
        body: `const rows = [
  { city: 'Москва', role: 'admin' },
  { city: 'Москва', role: 'user' },
  { city: 'Москва', role: 'admin' },
];
assert.equal(uniqueBy(rows, r => r.city + '|' + r.role).length, 2);` },

      { name: 'считает NaN дубликатом самого себя',
        body: `assert.equal(uniqueBy([NaN, NaN, 1]), [NaN, 1], 'indexOf здесь не работает — NaN не равен сам себе');` },

      { name: 'не мутирует исходный массив',
        body: `const src = [1, 1, 2];
uniqueBy(src);
assert.equal(src, [1, 1, 2]);` },

      { name: 'uniqueWith дедуплицирует по произвольному компаратору',
        body: `if (typeof uniqueWith === 'undefined') assert.fail('Не объявлена функция uniqueWith — она нужна в этой задаче.');
const points = [{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 2 }];
const isSame = (a, b) => a.x === b.x && a.y === b.y;
const result = uniqueWith(points, isSame);
assert.equal(result, [points[0], points[2]], 'одинаковые по содержимому объекты должны схлопнуться');` },

      { name: 'uniqueWith сохраняет порядок и не трогает исходный массив',
        body: `if (typeof uniqueWith === 'undefined') assert.fail('Не объявлена функция uniqueWith — она нужна в этой задаче.');
const src = [3, 1, 3, 2, 1];
const result = uniqueWith(src, (a, b) => a === b);
assert.equal(result, [3, 1, 2], 'порядок — как первого вхождения в исходном массиве');
assert.equal(src, [3, 1, 3, 2, 1]);
assert.equal(uniqueWith([], (a, b) => a === b), []);` },
    ],
  },
};
