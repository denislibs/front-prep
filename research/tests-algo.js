/**
 * Автотесты алгоритмической секции (задачи alg1–alg25 из research/tasks-algo.js).
 *
 * Все наборы исполняются в воркере: чистый JS без DOM.
 * Время везде виртуальное — асинхронный планировщик alg24 продвигается
 * только через clock.tick, реального ожидания в наборе нет.
 */

const TESTS_ALGO = {

  /* ─────────────────── Хеш-таблица как приём ─────────────────── */

  alg1: {
    env: 'worker',
    entry: 'groupAnagrams',
    starter: `function groupAnagrams(words) {
  // ваш код
}`,
    cases: [
      { name: 'группирует анаграммы и сохраняет порядок первого появления',
        body: `assert.equal(
  groupAnagrams(['eat', 'tea', 'tan', 'ate', 'nat', 'bat']),
  [['eat', 'tea', 'ate'], ['tan', 'nat'], ['bat']]
);` },

      { name: 'на пустом массиве возвращает пустой результат',
        body: `assert.equal(groupAnagrams([]), []);` },

      { name: 'одно слово даёт одну группу',
        body: `assert.equal(groupAnagrams(['alpha']), [['alpha']]);` },

      { name: 'не объединяет слова, которые не являются анаграммами',
        body: `assert.equal(groupAnagrams(['abc', 'def', 'ghi']), [['abc'], ['def'], ['ghi']]);` },

      { name: 'игнорирует регистр',
        body: `assert.equal(groupAnagrams(['Тор', 'рот', 'ТОР']), [['Тор', 'рот', 'ТОР']]);` },

      { name: 'полные дубликаты попадают в одну группу и не схлопываются',
        body: `assert.equal(groupAnagrams(['ab', 'ab', 'ba']), [['ab', 'ab', 'ba']]);` },

      { name: 'не мутирует входной массив',
        body: `const words = ['eat', 'tea', 'bat'];
groupAnagrams(words);
assert.equal(words, ['eat', 'tea', 'bat'], 'входной массив должен остаться нетронутым');` },
    ],
  },

  alg2: {
    env: 'worker',
    entry: 'longestConsecutive',
    starter: `function longestConsecutive(nums) {
  // ваш код
}`,
    cases: [
      { name: 'находит длину самой длинной цепочки подряд идущих чисел',
        body: `assert.equal(longestConsecutive([100, 4, 200, 1, 3, 2]), 4);` },

      { name: 'на пустом массиве возвращает ноль',
        body: `assert.equal(longestConsecutive([]), 0);` },

      { name: 'на одном элементе возвращает единицу',
        body: `assert.equal(longestConsecutive([42]), 1);` },

      { name: 'дубликаты не удлиняют последовательность',
        body: `assert.equal(longestConsecutive([1, 2, 2, 3]), 3);
assert.equal(longestConsecutive([7, 7, 7, 7]), 1);` },

      { name: 'работает с отрицательными числами и нулём',
        body: `assert.equal(longestConsecutive([-3, -2, -1, 5]), 3);
assert.equal(longestConsecutive([0, -1, 1]), 3);` },

      { name: 'выбирает самую длинную из нескольких цепочек',
        body: `assert.equal(longestConsecutive([10, 11, 1, 2, 3, 4, 50]), 4);` },

      { name: 'справляется со ста тысячами чисел, то есть работает за O(n)',
        body: `const nums = [];
for (let i = 100000; i > 0; i--) nums.push(i);
assert.equal(longestConsecutive(nums), 100000, 'квадратичное решение здесь не уложится в отведённое время');` },
    ],
  },

  alg3: {
    env: 'worker',
    entry: 'findPairs',
    starter: `function findPairs(nums, target) {
  // ваш код
}`,
    cases: [
      { name: 'находит все пары с заданной суммой',
        body: `assert.equal(findPairs([1, 2, 3, 4, 3], 6), [[2, 4], [3, 3]]);` },

      { name: 'на пустом массиве возвращает пустой список',
        body: `assert.equal(findPairs([], 6), []);` },

      { name: 'не составляет пару из одного элемента с самим собой',
        body: `assert.equal(findPairs([3], 6), [], 'единственный элемент не может быть парой');` },

      { name: 'одинаковая пара значений возвращается только один раз',
        body: `assert.equal(findPairs([1, 5, 1, 5], 6), [[1, 5]]);
assert.equal(findPairs([0, 0, 0], 0), [[0, 0]], 'три нуля дают одну пару, а не три');` },

      { name: 'работает с отрицательными числами',
        body: `assert.equal(findPairs([-2, 4, 2, 0], 2), [[-2, 4], [2, 0]]);` },

      { name: 'возвращает пустой список, когда подходящих пар нет',
        body: `assert.equal(findPairs([1, 2, 3], 100), []);` },
    ],
  },

  alg4: {
    env: 'worker',
    entry: 'topKEvents',
    starter: `function topKEvents(events, k) {
  // ваш код
}`,
    cases: [
      { name: 'возвращает k самых частых событий по убыванию частоты',
        body: `assert.equal(topKEvents(['click', 'view', 'click', 'scroll', 'click', 'view'], 2), ['click', 'view']);` },

      { name: 'на пустом логе возвращает пустой массив',
        body: `assert.equal(topKEvents([], 3), []);` },

      { name: 'при k равном нулю ничего не возвращает',
        body: `assert.equal(topKEvents(['a', 'a', 'b'], 0), []);` },

      { name: 'при k больше числа уникальных событий возвращает все',
        body: `assert.equal(topKEvents(['a', 'a', 'b'], 10), ['a', 'b']);` },

      { name: 'при равной частоте раньше идёт встреченное первым',
        body: `assert.equal(topKEvents(['x', 'y', 'z', 'y', 'x'], 2), ['x', 'y'], 'x и y встречаются дважды, но x появился раньше');` },

      { name: 'одно событие обрабатывается корректно',
        body: `assert.equal(topKEvents(['ping'], 1), ['ping']);
assert.equal(topKEvents(['ping', 'ping'], 1), ['ping']);` },

      { name: 'не мутирует входной лог',
        body: `const events = ['a', 'b', 'a'];
topKEvents(events, 1);
assert.equal(events, ['a', 'b', 'a']);` },
    ],
  },

  /* ───────────────── Два указателя и окно ───────────────── */

  alg5: {
    env: 'worker',
    entry: 'maxWater',
    starter: `function maxWater(heights) {
  // ваш код
}`,
    cases: [
      { name: 'находит максимальный объём для классического примера',
        body: `assert.equal(maxWater([1, 8, 6, 2, 5, 4, 8, 3, 7]), 49);` },

      { name: 'на пустом массиве возвращает ноль',
        body: `assert.equal(maxWater([]), 0);` },

      { name: 'одна стенка не удерживает воду',
        body: `assert.equal(maxWater([5]), 0, 'для контейнера нужны две стенки');` },

      { name: 'две стенки дают площадь по меньшей из них',
        body: `assert.equal(maxWater([1, 1]), 1);
assert.equal(maxWater([1, 9]), 1, 'высоту ограничивает меньшая стенка');` },

      { name: 'выбирает дальние стенки, когда это выгоднее высоких',
        body: `assert.equal(maxWater([4, 3, 2, 1, 4]), 16, 'крайние стенки дают больше, чем любая пара высоких соседей');` },

      { name: 'работает на одинаковых и на убывающих высотах',
        body: `assert.equal(maxWater([3, 3, 3, 3]), 9);
assert.equal(maxWater([5, 4, 3, 2, 1]), 6);` },

      { name: 'нули среди высот не ломают ответ',
        body: `assert.equal(maxWater([0, 0, 0]), 0);
assert.equal(maxWater([2, 0, 2]), 4);` },
    ],
  },

  alg6: {
    env: 'worker',
    entry: 'minWindow',
    starter: `function minWindow(source, target) {
  // ваш код
}`,
    cases: [
      { name: 'находит кратчайшее окно со всеми нужными символами',
        body: `assert.equal(minWindow('ADOBECODEBANC', 'ABC'), 'BANC');` },

      { name: 'возвращает пустую строку, когда окна не существует',
        body: `assert.equal(minWindow('a', 'aa'), '', 'второго a в источнике нет');
assert.equal(minWindow('abc', 'xyz'), '');` },

      { name: 'пустой источник и пустой образец дают пустую строку',
        body: `assert.equal(minWindow('', 'abc'), '');
assert.equal(minWindow('abc', ''), '');` },

      { name: 'окно из одного символа находится',
        body: `assert.equal(minWindow('a', 'a'), 'a');
assert.equal(minWindow('abc', 'b'), 'b');` },

      { name: 'учитывает количество повторяющихся символов образца',
        body: `assert.equal(minWindow('aaflslflsldkalskaaa', 'aaa'), 'aaa');
assert.equal(minWindow('AAAB', 'AB'), 'AB', 'лишние A не должны попасть в окно');` },

      { name: 'весь источник может оказаться минимальным окном',
        body: `assert.equal(minWindow('abc', 'abc'), 'abc');` },
    ],
  },

  alg7: {
    env: 'worker',
    entry: 'dedupeSorted',
    starter: `function dedupeSorted(arr) {
  // ваш код
}`,
    cases: [
      { name: 'возвращает число уникальных и оставляет их в начале массива',
        body: `const arr = [1, 1, 2, 2, 3];
const length = dedupeSorted(arr);
assert.equal(length, 3);
assert.equal(arr.slice(0, length), [1, 2, 3], 'уникальные элементы должны лежать в начале того же массива');` },

      { name: 'на пустом массиве возвращает ноль',
        body: `assert.equal(dedupeSorted([]), 0);` },

      { name: 'один элемент остаётся один',
        body: `const arr = [7];
assert.equal(dedupeSorted(arr), 1);
assert.equal(arr[0], 7);` },

      { name: 'массив из одинаковых элементов схлопывается в один',
        body: `const arr = [2, 2, 2, 2];
const length = dedupeSorted(arr);
assert.equal(length, 1);
assert.equal(arr.slice(0, length), [2]);` },

      { name: 'массив без дубликатов не меняется',
        body: `const arr = [1, 2, 3];
assert.equal(dedupeSorted(arr), 3);
assert.equal(arr.slice(0, 3), [1, 2, 3]);` },

      { name: 'работает с отрицательными числами и нулём',
        body: `const arr = [-3, -3, -1, 0, 0];
const length = dedupeSorted(arr);
assert.equal(length, 3);
assert.equal(arr.slice(0, length), [-3, -1, 0]);` },

      { name: 'работает на месте, а не возвращает новый массив',
        body: `const arr = [5, 5, 9];
const result = dedupeSorted(arr);
assert.ok(typeof result === 'number', 'функция должна возвращать длину, а не массив');
assert.equal(arr[1], 9, 'второй уникальный элемент должен быть записан прямо во входной массив');` },
    ],
  },

  alg8: {
    env: 'worker',
    entry: 'sortColors',
    starter: `function sortColors(arr) {
  // ваш код
}`,
    cases: [
      { name: 'сортирует массив из нулей, единиц и двоек',
        body: `assert.equal(sortColors([2, 0, 2, 1, 1, 0]), [0, 0, 1, 1, 2, 2]);
assert.equal(sortColors([2, 2, 0, 1]), [0, 1, 2, 2]);
assert.equal(sortColors([1, 2, 0]), [0, 1, 2], 'после обмена с хвостом пришедший элемент ещё не проверен');` },

      { name: 'пустой массив и один элемент не ломают алгоритм',
        body: `assert.equal(sortColors([]), []);
assert.equal(sortColors([1]), [1]);
assert.equal(sortColors([2]), [2]);` },

      { name: 'уже отсортированный массив остаётся прежним',
        body: `assert.equal(sortColors([0, 0, 1, 2, 2]), [0, 0, 1, 2, 2]);` },

      { name: 'полностью развёрнутый массив разворачивается обратно',
        body: `assert.equal(sortColors([2, 1, 0]), [0, 1, 2]);
assert.equal(sortColors([2, 2, 1, 1, 0, 0]), [0, 0, 1, 1, 2, 2]);` },

      { name: 'массив из одинаковых значений не меняется',
        body: `assert.equal(sortColors([2, 2, 2]), [2, 2, 2]);
assert.equal(sortColors([0, 0]), [0, 0]);` },

      { name: 'сортирует на месте, изменяя переданный массив',
        body: `const arr = [1, 2, 0];
const result = sortColors(arr);
assert.equal(arr, [0, 1, 2], 'исходный массив должен быть отсортирован');
assert.ok(result === arr, 'должен возвращаться тот же самый массив, а не копия');` },

      { name: 'обрабатывает случай без одного из значений',
        body: `assert.equal(sortColors([2, 0, 2, 0]), [0, 0, 2, 2]);
assert.equal(sortColors([1, 0, 1, 0]), [0, 0, 1, 1]);` },
    ],
  },

  /* ───────────────── Стек и очередь ───────────────── */

  alg9: {
    env: 'worker',
    entry: 'isBalanced',
    starter: `function isBalanced(str) {
  // ваш код
}`,
    cases: [
      { name: 'принимает корректную вложенность скобок',
        body: `assert.equal(isBalanced('const a = [1, {b: 2}];'), true);
assert.equal(isBalanced('([{}])'), true);` },

      { name: 'пустая строка считается сбалансированной',
        body: `assert.equal(isBalanced(''), true);
assert.equal(isBalanced('просто текст'), true);` },

      { name: 'отвергает неверный порядок и лишние скобки',
        body: `assert.equal(isBalanced(')('), false, 'закрывающая скобка при пустом стеке');
assert.equal(isBalanced('{[}]'), false, 'скобки закрываются в неправильном порядке');
assert.equal(isBalanced('(('), false, 'остались незакрытые скобки');` },

      { name: 'скобки внутри строкового литерала не учитываются',
        body: `const q = String.fromCharCode(34);
assert.equal(isBalanced('f(' + q + '(' + q + ')'), true, 'скобка внутри кавычек — просто символ');
assert.equal(isBalanced(q + '(' + q), true);` },

      { name: 'незакрытый строковый литерал делает строку несбалансированной',
        body: `const q = String.fromCharCode(34);
assert.equal(isBalanced(q + 'unclosed'), false);
assert.equal(isBalanced("'"), false);` },

      { name: 'кавычка другого вида внутри литерала не закрывает его',
        body: `const q = String.fromCharCode(34);
assert.equal(isBalanced(q + "it's" + q), true, 'апостроф внутри двойных кавычек — обычный символ');
assert.equal(isBalanced("'" + q + "'"), true);` },

      { name: 'обратный слэш экранирует кавычку внутри литерала',
        body: `const q = String.fromCharCode(34);
const bs = String.fromCharCode(92);
assert.equal(isBalanced(q + bs + q + q), true, 'экранированная кавычка не закрывает литерал');
assert.equal(isBalanced(q + bs + q), false, 'литерал остался незакрытым');` },
    ],
  },

  alg10: {
    env: 'worker',
    entry: 'evalRPN',
    starter: `function evalRPN(tokens) {
  // ваш код
}`,
    cases: [
      { name: 'вычисляет выражение с несколькими операциями',
        body: `assert.equal(evalRPN(['2', '1', '+', '3', '*']), 9);
assert.equal(evalRPN(['4', '13', '5', '/', '+']), 6);` },

      { name: 'единственное число возвращается как есть',
        body: `assert.equal(evalRPN(['5']), 5);
assert.equal(evalRPN(['-42']), -42);` },

      { name: 'соблюдает порядок операндов для вычитания и деления',
        body: `assert.equal(evalRPN(['3', '1', '-']), 2, 'первым снимается правый операнд');
assert.equal(evalRPN(['10', '2', '/']), 5);` },

      { name: 'деление усекает к нулю, а не округляет вниз',
        body: `assert.equal(evalRPN(['-7', '2', '/']), -3, 'Math.floor дал бы -4');
assert.equal(evalRPN(['7', '2', '/']), 3);` },

      { name: 'понимает отрицательные числа как операнды',
        body: `assert.equal(evalRPN(['-3', '2', '*']), -6);
assert.equal(evalRPN(['-3', '-2', '+']), -5);` },

      { name: 'бросает исключение при нехватке операндов',
        body: `assert.throws(function () { evalRPN(['+']); }, 'оператору нечего складывать');
assert.throws(function () { evalRPN(['1', '+']); });
assert.throws(function () { evalRPN([]); }, 'пустое выражение некорректно');` },

      { name: 'бросает исключение при лишних операндах и делении на ноль',
        body: `assert.throws(function () { evalRPN(['1', '2']); }, 'в стеке осталось два значения');
assert.throws(function () { evalRPN(['1', '0', '/']); }, 'деление на ноль');` },
    ],
  },

  alg11: {
    env: 'worker',
    entry: 'nextGreater',
    starter: `function nextGreater(nums) {
  // ваш код
}`,
    cases: [
      { name: 'находит ближайший больший элемент справа',
        body: `assert.equal(nextGreater([2, 1, 2, 4, 3]), [4, 2, 4, null, null]);` },

      { name: 'на пустом массиве возвращает пустой массив',
        body: `assert.equal(nextGreater([]), []);` },

      { name: 'единственный элемент не имеет большего справа',
        body: `assert.equal(nextGreater([1]), [null]);` },

      { name: 'на убывающем массиве ответов нет',
        body: `assert.equal(nextGreater([3, 2, 1]), [null, null, null]);` },

      { name: 'на возрастающем массиве ответ у каждого — сосед справа',
        body: `assert.equal(nextGreater([1, 2, 3]), [2, 3, null]);` },

      { name: 'равные элементы не считаются большими',
        body: `assert.equal(nextGreater([2, 2, 2]), [null, null, null], 'нужен строго больший элемент');` },

      { name: 'работает с отрицательными числами',
        body: `assert.equal(nextGreater([-1, -3, -2]), [null, -2, null], 'маркер отсутствия — null, а не -1');` },
    ],
  },

  alg12: {
    env: 'worker',
    entry: 'createQueue',
    starter: `function createQueue() {
  // ваш код
}`,
    cases: [
      { name: 'отдаёт элементы в порядке добавления',
        body: `const queue = createQueue();
queue.push(1);
queue.push(2);
queue.push(3);
assert.equal([queue.shift(), queue.shift(), queue.shift()], [1, 2, 3]);` },

      { name: 'новая очередь пуста',
        body: `const queue = createQueue();
assert.equal(queue.size, 0);
assert.equal(queue.shift(), undefined, 'снятие с пустой очереди даёт undefined');
assert.equal(queue.peek(), undefined);` },

      { name: 'size отражает число элементов',
        body: `const queue = createQueue();
queue.push('a');
queue.push('b');
assert.equal(queue.size, 2);
queue.shift();
assert.equal(queue.size, 1);
queue.shift();
assert.equal(queue.size, 0);` },

      { name: 'peek показывает голову, но не удаляет её',
        body: `const queue = createQueue();
queue.push('first');
queue.push('second');
assert.equal(queue.peek(), 'first');
assert.equal(queue.peek(), 'first', 'повторный peek возвращает то же значение');
assert.equal(queue.size, 2);
assert.equal(queue.shift(), 'first');` },

      { name: 'сохраняет порядок при перемежающихся добавлениях и снятиях',
        body: `const queue = createQueue();
const seen = [];
queue.push('a');
seen.push(queue.shift());
queue.push('b');
queue.push('c');
seen.push(queue.shift());
queue.push('d');
seen.push(queue.shift());
seen.push(queue.shift());
assert.equal(seen, ['a', 'b', 'c', 'd'], 'порядок должен оставаться FIFO при перекладывании между стеками');` },

      { name: 'после опустошения очередь снова пригодна к работе',
        body: `const queue = createQueue();
queue.push(1);
queue.shift();
assert.equal(queue.shift(), undefined);
queue.push(2);
assert.equal(queue.size, 1);
assert.equal(queue.shift(), 2);` },

      { name: 'выдерживает тысячи элементов в правильном порядке',
        body: `const queue = createQueue();
for (let i = 0; i < 5000; i++) queue.push(i);
assert.equal(queue.size, 5000);
let ok = true;
for (let i = 0; i < 5000; i++) if (queue.shift() !== i) ok = false;
assert.ok(ok, 'порядок должен сохраниться на большом объёме');
assert.equal(queue.size, 0);` },
    ],
  },

  /* ───────────────── Деревья ───────────────── */

  alg13: {
    env: 'worker',
    entry: 'traverseComments',
    starter: `function traverseComments(root) {
  // ваш код
}`,
    cases: [
      { name: 'обходит дерево в глубину слева направо',
        body: `const root = { id: 1, replies: [
  { id: 2, replies: [{ id: 4, replies: [] }, { id: 5, replies: [] }] },
  { id: 3, replies: [{ id: 6, replies: [] }] },
] };
assert.equal(traverseComments(root).dfs, [1, 2, 4, 5, 3, 6]);` },

      { name: 'обходит дерево в ширину по уровням',
        body: `const root = { id: 1, replies: [
  { id: 2, replies: [{ id: 4, replies: [] }, { id: 5, replies: [] }] },
  { id: 3, replies: [{ id: 6, replies: [] }] },
] };
assert.equal(traverseComments(root).bfs, [1, 2, 3, 4, 5, 6]);` },

      { name: 'на пустом дереве возвращает два пустых массива',
        body: `assert.equal(traverseComments(null), { dfs: [], bfs: [] });` },

      { name: 'узел без поля replies не ломает обход',
        body: `assert.equal(traverseComments({ id: 9 }), { dfs: [9], bfs: [9] });` },

      { name: 'на цепочке без ветвлений оба обхода совпадают',
        body: `const root = { id: 1, replies: [{ id: 2, replies: [{ id: 3, replies: [] }] }] };
const result = traverseComments(root);
assert.equal(result.dfs, [1, 2, 3]);
assert.equal(result.bfs, [1, 2, 3]);` },

      { name: 'на плоском списке ответов оба обхода совпадают',
        body: `const root = { id: 1, replies: [{ id: 2, replies: [] }, { id: 3, replies: [] }, { id: 4, replies: [] }] };
const result = traverseComments(root);
assert.equal(result.dfs, [1, 2, 3, 4]);
assert.equal(result.bfs, [1, 2, 3, 4]);` },

      { name: 'не переполняет стек на ветке из двадцати тысяч ответов',
        body: `let node = { id: 0, replies: [] };
const root = node;
for (let i = 1; i < 20000; i++) {
  const child = { id: i, replies: [] };
  node.replies.push(child);
  node = child;
}
const result = traverseComments(root);
assert.equal(result.dfs.length, 20000, 'рекурсивный обход здесь переполнит стек вызовов');
assert.equal(result.bfs.length, 20000);
assert.equal(result.dfs[19999], 19999);` },
    ],
  },

  alg14: {
    env: 'worker',
    entry: 'maxDepth',
    starter: `function maxDepth(root) {
  // ваш код
}`,
    cases: [
      { name: 'считает глубину дерева с ветвлениями',
        body: `const root = { id: 1, children: [
  { id: 2, children: [{ id: 4, children: [] }] },
  { id: 3, children: [] },
] };
assert.equal(maxDepth(root), 3);` },

      { name: 'пустое дерево имеет глубину ноль',
        body: `assert.equal(maxDepth(null), 0);
assert.equal(maxDepth(undefined), 0);` },

      { name: 'одиночный узел имеет глубину один',
        body: `assert.equal(maxDepth({ id: 1, children: [] }), 1);
assert.equal(maxDepth({ id: 1 }), 1, 'отсутствие поля children равносильно пустому списку');` },

      { name: 'широкое дерево без внуков остаётся глубиной два',
        body: `const root = { id: 1, children: [{ id: 2, children: [] }, { id: 3, children: [] }, { id: 4, children: [] }] };
assert.equal(maxDepth(root), 2);` },

      { name: 'берёт максимум по веткам, а не по первой',
        body: `const root = { id: 1, children: [
  { id: 2, children: [] },
  { id: 3, children: [{ id: 4, children: [{ id: 5, children: [] }] }] },
] };
assert.equal(maxDepth(root), 4, 'глубокая ветка идёт второй');` },

      { name: 'не переполняет стек на дереве глубиной двадцать тысяч',
        body: `let node = { id: 0, children: [] };
const root = node;
for (let i = 1; i < 20000; i++) {
  const child = { id: i, children: [] };
  node.children.push(child);
  node = child;
}
assert.equal(maxDepth(root), 20000, 'рекурсивное решение здесь упадёт с переполнением стека');` },
    ],
  },

  alg15: {
    env: 'worker',
    entry: 'findPath',
    starter: `function findPath(root, predicate) {
  // ваш код
}`,
    cases: [
      { name: 'возвращает путь от корня до найденного узла',
        body: `const root = { id: 1, children: [
  { id: 2, children: [{ id: 4, children: [] }, { id: 5, children: [] }] },
  { id: 3, children: [] },
] };
assert.equal(findPath(root, function (node) { return node.id === 5; }), [1, 2, 5]);` },

      { name: 'корень тоже проверяется предикатом',
        body: `const root = { id: 1, children: [{ id: 2, children: [] }] };
assert.equal(findPath(root, function (node) { return node.id === 1; }), [1]);` },

      { name: 'возвращает null, когда подходящего узла нет',
        body: `const root = { id: 1, children: [{ id: 2, children: [] }] };
assert.equal(findPath(root, function (node) { return node.id === 99; }), null);` },

      { name: 'на пустом дереве возвращает null',
        body: `assert.equal(findPath(null, function () { return true; }), null);` },

      { name: 'при нескольких совпадениях выбирает первое в порядке обхода в глубину',
        body: `const root = { id: 1, children: [
  { id: 2, children: [{ id: 4, children: [] }] },
  { id: 3, children: [] },
] };
assert.equal(findPath(root, function (node) { return node.id >= 3; }), [1, 2, 4],
  'обход в глубину доходит до узла 4 раньше, чем до узла 3');` },

      { name: 'предикат получает сам узел, а не только его id',
        body: `const root = { id: 1, slug: 'root', children: [{ id: 2, slug: 'target', children: [] }] };
assert.equal(findPath(root, function (node) { return node.slug === 'target'; }), [1, 2]);` },

      { name: 'узел без поля children не ломает поиск',
        body: `const root = { id: 1, children: [{ id: 2 }] };
assert.equal(findPath(root, function (node) { return node.id === 2; }), [1, 2]);` },
    ],
  },

  alg16: {
    env: 'worker',
    entry: 'serializeTree',
    starter: `function serializeTree(node) {
  // ваш код
}

function deserializeTree(text) {
  // ваш код
}`,
    cases: [
      { name: 'сериализует дерево в описанный формат',
        body: `const tree = { id: 1, children: [
  { id: 2, children: [{ id: 4, children: [] }, { id: 5, children: [] }] },
  { id: 3, children: [] },
] };
assert.equal(serializeTree(tree), '1(2(4)(5))(3)');` },

      { name: 'пустое дерево и пустая строка обрабатываются симметрично',
        body: `assert.ok(typeof deserializeTree === 'function', 'нужна функция deserializeTree');
assert.equal(serializeTree(null), '');
assert.equal(deserializeTree(''), null);` },

      { name: 'одиночный узел проходит круговой рейс',
        body: `assert.equal(serializeTree({ id: 7, children: [] }), '7');
assert.equal(deserializeTree('7'), { id: 7, children: [] });` },

      { name: 'круговой рейс восстанавливает дерево целиком',
        body: `const tree = { id: 1, children: [
  { id: 2, children: [{ id: 4, children: [] }, { id: 5, children: [] }] },
  { id: 3, children: [{ id: 6, children: [] }] },
] };
assert.equal(deserializeTree(serializeTree(tree)), tree, 'после разбора дерево должно быть структурно тем же');` },

      { name: 'многозначные идентификаторы не слипаются',
        body: `const tree = { id: 42, children: [{ id: 100, children: [] }, { id: 7, children: [] }] };
assert.equal(serializeTree(tree), '42(100)(7)');
assert.equal(deserializeTree('42(100)(7)'), tree);` },

      { name: 'глубокая цепочка сохраняет вложенность',
        body: `const chain = { id: 1, children: [{ id: 2, children: [{ id: 3, children: [] }] }] };
assert.equal(serializeTree(chain), '1(2(3))');
assert.equal(deserializeTree('1(2(3))'), chain);` },

      { name: 'широкое дерево сохраняет порядок детей',
        body: `const wide = { id: 1, children: [{ id: 2, children: [] }, { id: 3, children: [] }, { id: 4, children: [] }] };
assert.equal(serializeTree(wide), '1(2)(3)(4)');
assert.equal(deserializeTree(serializeTree(wide)), wide);` },
    ],
  },

  alg17: {
    env: 'worker',
    entry: 'containsSubtree',
    starter: `function containsSubtree(root, sub) {
  // ваш код
}`,
    cases: [
      { name: 'находит поддерево внутри дерева',
        body: `const root = { id: 1, children: [
  { id: 2, children: [{ id: 4, children: [] }, { id: 5, children: [] }] },
  { id: 3, children: [] },
] };
const sub = { id: 2, children: [{ id: 4, children: [] }, { id: 5, children: [] }] };
assert.equal(containsSubtree(root, sub), true);` },

      { name: 'дерево содержит само себя',
        body: `const root = { id: 1, children: [{ id: 2, children: [] }] };
assert.equal(containsSubtree(root, root), true);` },

      { name: 'пустое поддерево содержится всегда, а непустое в пустом дереве — нет',
        body: `assert.equal(containsSubtree({ id: 1, children: [] }, null), true);
assert.equal(containsSubtree(null, { id: 1, children: [] }), false);
assert.equal(containsSubtree(null, null), true);` },

      { name: 'узел с лишними детьми не считается совпадением',
        body: `const root = { id: 1, children: [
  { id: 2, children: [{ id: 4, children: [] }, { id: 5, children: [] }] },
] };
assert.equal(containsSubtree(root, { id: 2, children: [{ id: 4, children: [] }] }), false,
  'у образца один ребёнок, а у кандидата два — это не то же самое поддерево');` },

      { name: 'другой идентификатор означает отсутствие совпадения',
        body: `const root = { id: 1, children: [{ id: 2, children: [] }] };
assert.equal(containsSubtree(root, { id: 99, children: [] }), false);
assert.equal(containsSubtree(root, { id: 2, children: [{ id: 3, children: [] }] }), false);` },

      { name: 'порядок детей имеет значение',
        body: `const root = { id: 1, children: [
  { id: 2, children: [{ id: 4, children: [] }, { id: 5, children: [] }] },
] };
assert.equal(containsSubtree(root, { id: 2, children: [{ id: 5, children: [] }, { id: 4, children: [] }] }), false);` },

      { name: 'находит лист как поддерево',
        body: `const root = { id: 1, children: [{ id: 2, children: [{ id: 3, children: [] }] }] };
assert.equal(containsSubtree(root, { id: 3, children: [] }), true);` },
    ],
  },

  /* ───────────────── Графы ───────────────── */

  alg18: {
    env: 'worker',
    entry: 'findCycle',
    starter: `function findCycle(graph) {
  // ваш код
}`,
    cases: [
      { name: 'находит цикл из трёх модулей',
        body: `assert.equal(findCycle({ a: ['b'], b: ['c'], c: ['a'] }), ['a', 'b', 'c']);` },

      { name: 'на ациклическом графе возвращает null',
        body: `assert.equal(findCycle({ app: ['ui', 'utils'], ui: ['utils'], utils: [] }), null);` },

      { name: 'пустой граф циклов не содержит',
        body: `assert.equal(findCycle({}), null);` },

      { name: 'находит модуль, импортирующий сам себя',
        body: `assert.equal(findCycle({ a: ['a'] }), ['a']);` },

      { name: 'ромбовидные зависимости циклом не считаются',
        body: `assert.equal(findCycle({ a: ['b', 'c'], b: ['d'], c: ['d'], d: [] }), null,
  'общая зависимость двух веток — это не цикл');` },

      { name: 'модуль без своего ключа считается листом',
        body: `assert.equal(findCycle({ app: ['react', 'lodash'] }), null);` },

      { name: 'возвращает только сам цикл, без хвоста пути до него',
        body: `assert.equal(findCycle({ a: ['b'], b: ['c'], c: ['b'] }), ['b', 'c'],
  'модуль a в цикл не входит');
assert.equal(findCycle({ a: ['b'], b: [], x: ['y'], y: ['x'] }), ['x', 'y'],
  'цикл во второй несвязной части графа');` },
    ],
  },

  alg19: {
    env: 'worker',
    entry: 'buildOrder',
    starter: `function buildOrder(graph) {
  // ваш код
}`,
    cases: [
      { name: 'ставит зависимости раньше зависящих модулей',
        body: `assert.equal(buildOrder({ app: ['ui', 'utils'], ui: ['utils'], utils: [] }), ['utils', 'ui', 'app']);` },

      { name: 'пустой граф даёт пустой порядок',
        body: `assert.equal(buildOrder({}), []);` },

      { name: 'единственный модуль без зависимостей возвращается как есть',
        body: `assert.equal(buildOrder({ a: [] }), ['a']);` },

      { name: 'при цикле возвращает null',
        body: `assert.equal(buildOrder({ a: ['b'], b: ['a'] }), null);
assert.equal(buildOrder({ a: ['a'] }), null, 'самоимпорт — тоже цикл');
assert.equal(buildOrder({ app: ['a'], a: ['b'], b: ['a'] }), null);` },

      { name: 'модули, упомянутые только в импортах, попадают в результат',
        body: `assert.equal(buildOrder({ app: ['react'] }), ['react', 'app']);` },

      { name: 'независимые модули сохраняют порядок объявления',
        body: `assert.equal(buildOrder({ a: [], b: [], c: [] }), ['a', 'b', 'c']);` },

      { name: 'ромбовидные зависимости раскладываются детерминированно',
        body: `assert.equal(buildOrder({ app: ['a', 'b'], a: ['core'], b: ['core'], core: [] }), ['core', 'a', 'b', 'app']);
assert.equal(buildOrder({ app: ['x', 'x'], x: [] }), ['x', 'app'], 'повторный импорт не должен считаться дважды');` },
    ],
  },

  alg20: {
    env: 'worker',
    entry: 'shortestPath',
    starter: `function shortestPath(graph, from, to) {
  // ваш код
}`,
    cases: [
      { name: 'находит путь между узлами',
        body: `const graph = { a: ['b', 'c'], b: ['d'], c: ['d'], d: [] };
assert.equal(shortestPath(graph, 'a', 'd'), ['a', 'b', 'd']);
assert.equal(shortestPath(graph, 'a', 'b'), ['a', 'b']);` },

      { name: 'путь из узла в самого себя состоит из одного элемента',
        body: `assert.equal(shortestPath({ a: ['b'], b: [] }, 'a', 'a'), ['a']);` },

      { name: 'возвращает null, когда пути нет',
        body: `assert.equal(shortestPath({ a: ['b'], b: [], z: [] }, 'a', 'z'), null);
assert.equal(shortestPath({ a: [] }, 'a', 'b'), null);` },

      { name: 'неизвестный начальный узел даёт null',
        body: `assert.equal(shortestPath({ a: ['b'], b: [] }, 'nope', 'a'), null);` },

      { name: 'выбирает кратчайший путь, а не первый найденный',
        body: `const graph = { a: ['b', 'd'], b: ['c'], c: ['d'], d: [] };
assert.equal(shortestPath(graph, 'a', 'd'), ['a', 'd'],
  'обход в глубину пошёл бы через b и c — это длиннее');` },

      { name: 'не зацикливается на графе с циклом',
        body: `const graph = { a: ['b'], b: ['a', 'c'], c: [] };
assert.equal(shortestPath(graph, 'a', 'c'), ['a', 'b', 'c']);` },

      { name: 'находит длинный путь в цепочке',
        body: `const graph = {};
for (let i = 0; i < 500; i++) graph['n' + i] = ['n' + (i + 1)];
graph.n500 = [];
const path = shortestPath(graph, 'n0', 'n500');
assert.equal(path.length, 501);
assert.equal(path[0], 'n0');
assert.equal(path[500], 'n500');` },
    ],
  },

  /* ───────────────── Динамика ───────────────── */

  alg21: {
    env: 'worker',
    entry: 'climbStairs',
    starter: `function climbStairs(n) {
  // ваш код
}`,
    cases: [
      { name: 'считает способы для небольших лестниц',
        body: `assert.equal(climbStairs(2), 2);
assert.equal(climbStairs(3), 3);
assert.equal(climbStairs(5), 8);` },

      { name: 'ноль ступеней — один способ, не делать ничего',
        body: `assert.equal(climbStairs(0), 1, 'пустой набор шагов тоже способ');` },

      { name: 'одна ступень — один способ',
        body: `assert.equal(climbStairs(1), 1);` },

      { name: 'отрицательное число ступеней даёт ноль',
        body: `assert.equal(climbStairs(-1), 0);
assert.equal(climbStairs(-10), 0);` },

      { name: 'последовательность совпадает с числами Фибоначчи',
        body: `assert.equal([4, 6, 7, 10].map(climbStairs), [5, 13, 21, 89]);` },

      { name: 'мгновенно отвечает для сорока пяти ступеней',
        body: `assert.equal(climbStairs(45), 1836311903, 'наивная рекурсия здесь не уложится в отведённое время');` },
    ],
  },

  alg22: {
    env: 'worker',
    entry: 'lengthOfLIS',
    starter: `function lengthOfLIS(nums) {
  // ваш код
}`,
    cases: [
      { name: 'находит длину возрастающей подпоследовательности',
        body: `assert.equal(lengthOfLIS([10, 9, 2, 5, 3, 7, 101, 18]), 4);` },

      { name: 'на пустом массиве возвращает ноль',
        body: `assert.equal(lengthOfLIS([]), 0);` },

      { name: 'один элемент даёт единицу',
        body: `assert.equal(lengthOfLIS([7]), 1);` },

      { name: 'на убывающем массиве длина равна единице',
        body: `assert.equal(lengthOfLIS([5, 4, 3, 2, 1]), 1);` },

      { name: 'равные элементы не продолжают последовательность',
        body: `assert.equal(lengthOfLIS([2, 2, 2]), 1, 'возрастание строгое');
assert.equal(lengthOfLIS([1, 2, 2, 3]), 3);` },

      { name: 'работает с отрицательными числами',
        body: `assert.equal(lengthOfLIS([-5, -3, -4, 0]), 3);
assert.equal(lengthOfLIS([0, -1, -2, 5]), 2);` },

      { name: 'справляется с пятьюдесятью тысячами элементов',
        body: `const nums = [];
for (let i = 0; i < 25000; i++) nums.push(50000 - i);
for (let i = 1; i <= 25000; i++) nums.push(i);
assert.equal(lengthOfLIS(nums), 25000, 'квадратичная динамика здесь не уложится в отведённое время');` },
    ],
  },

  alg23: {
    env: 'worker',
    entry: 'editDistance',
    starter: `function editDistance(a, b) {
  // ваш код
}`,
    cases: [
      { name: 'считает расстояние для классического примера',
        body: `assert.equal(editDistance('kitten', 'sitting'), 3);
assert.equal(editDistance('sunday', 'saturday'), 3);` },

      { name: 'одинаковые строки дают ноль',
        body: `assert.equal(editDistance('', ''), 0);
assert.equal(editDistance('abc', 'abc'), 0);` },

      { name: 'расстояние до пустой строки равно её длине',
        body: `assert.equal(editDistance('abc', ''), 3);
assert.equal(editDistance('', 'abcd'), 4);` },

      { name: 'одна опечатка стоит единицу',
        body: `assert.equal(editDistance('реакт', 'реэкт'), 1, 'замена символа');
assert.equal(editDistance('color', 'colour'), 1, 'вставка символа');
assert.equal(editDistance('colour', 'color'), 1, 'удаление символа');` },

      { name: 'симметрично относительно порядка аргументов',
        body: `assert.equal(editDistance('flaw', 'lawn'), 2);
assert.equal(editDistance('lawn', 'flaw'), 2);
assert.equal(editDistance('abcdef', 'az'), 5);
assert.equal(editDistance('az', 'abcdef'), 5);` },

      { name: 'учитывает регистр',
        body: `assert.equal(editDistance('a', 'A'), 1);
assert.equal(editDistance('React', 'react'), 1);` },

      { name: 'справляется со строками в тысячу символов',
        body: `const a = 'ab'.repeat(500);
const b = 'ba'.repeat(500);
assert.equal(editDistance(a, b), 2, 'сдвиг на один символ в обе стороны');` },
    ],
  },

  /* ───────────────── Прикладное ───────────────── */

  alg24: {
    env: 'worker',
    entry: 'runWithLimit',
    starter: `function runWithLimit(tasks, limit) {
  // ваш код
}`,
    cases: [
      { name: 'одновременно выполняется не больше limit задач',
        body: `const started = [];
const make = function (name, ms) {
  return { priority: 0, run: function () {
    started.push(name);
    return new Promise(function (resolve) { setTimeout(function () { resolve(name); }, ms); });
  } };
};
const promise = runWithLimit([make('A', 10), make('B', 10), make('C', 10), make('D', 10)], 2);
assert.equal(started, ['A', 'B'], 'сразу должны стартовать только две задачи');
await clock.tick(10);
assert.equal(started, ['A', 'B', 'C', 'D'], 'освободившиеся слоты занимают следующие задачи');
await clock.tick(10);
assert.equal(await promise, ['A', 'B', 'C', 'D']);` },

      { name: 'результаты возвращаются в исходном порядке, а не в порядке завершения',
        body: `const make = function (name, ms) {
  return { priority: 0, run: function () {
    return new Promise(function (resolve) { setTimeout(function () { resolve(name); }, ms); });
  } };
};
const promise = runWithLimit([make('медленная', 30), make('быстрая', 10)], 2);
await clock.tick(30);
assert.equal(await promise, ['медленная', 'быстрая'], 'порядок берётся из массива задач');` },

      { name: 'первой запускается задача с наибольшим приоритетом',
        body: `const started = [];
const make = function (name, priority) {
  return { priority: priority, run: function () {
    started.push(name);
    return new Promise(function (resolve) { setTimeout(function () { resolve(name); }, 10); });
  } };
};
const promise = runWithLimit([make('низкий', 0), make('высокий', 5), make('средний', 3)], 1);
assert.equal(started, ['высокий']);
await clock.tick(10);
assert.equal(started, ['высокий', 'средний']);
await clock.tick(10);
assert.equal(started, ['высокий', 'средний', 'низкий']);
await clock.tick(10);
assert.equal(await promise, ['низкий', 'высокий', 'средний']);` },

      { name: 'при равном приоритете сохраняется порядок объявления',
        body: `const started = [];
const make = function (name) {
  return { priority: 2, run: function () {
    started.push(name);
    return new Promise(function (resolve) { setTimeout(function () { resolve(name); }, 5); });
  } };
};
const promise = runWithLimit([make('A'), make('B'), make('C')], 1);
await clock.tick(20);
await promise;
assert.equal(started, ['A', 'B', 'C']);` },

      { name: 'пустой список задач сразу даёт пустой массив',
        body: `assert.equal(await runWithLimit([], 3), []);` },

      { name: 'при limit больше числа задач стартуют все сразу',
        body: `const started = [];
const make = function (name) {
  return { priority: 0, run: function () {
    started.push(name);
    return new Promise(function (resolve) { setTimeout(function () { resolve(name); }, 10); });
  } };
};
const promise = runWithLimit([make('A'), make('B'), make('C')], 10);
assert.equal(started, ['A', 'B', 'C']);
await clock.tick(10);
assert.equal(await promise, ['A', 'B', 'C']);` },

      { name: 'ошибка задачи отклоняет общий промис и останавливает запуск новых',
        body: `const started = [];
const ok = function (name) {
  return { priority: 0, run: function () {
    started.push(name);
    return new Promise(function (resolve) { setTimeout(function () { resolve(name); }, 10); });
  } };
};
const bad = { priority: 0, run: function () {
  started.push('плохая');
  return Promise.reject(new Error('boom'));
} };
const promise = runWithLimit([ok('A'), bad, ok('C')], 1);
promise.catch(function () {});
await clock.tick(50);
const error = await assert.rejects(promise);
assert.equal(error.message, 'boom');
assert.equal(started, ['A', 'плохая'], 'после ошибки третья задача стартовать не должна');` },
    ],
  },

  alg25: {
    env: 'worker',
    entry: 'mergeDateRanges',
    starter: `function mergeDateRanges(ranges) {
  // ваш код
}`,
    cases: [
      { name: 'сливает пересекающиеся интервалы',
        body: `assert.equal(mergeDateRanges([
  { start: '2026-03-02T10:00:00Z', end: '2026-03-02T11:30:00Z' },
  { start: '2026-03-02T11:00:00Z', end: '2026-03-02T12:00:00Z' },
]), [{ start: '2026-03-02T10:00:00Z', end: '2026-03-02T12:00:00Z' }]);` },

      { name: 'пустой список и один интервал возвращаются без изменений',
        body: `assert.equal(mergeDateRanges([]), []);
assert.equal(mergeDateRanges([{ start: '2026-03-02T09:00:00Z', end: '2026-03-02T10:00:00Z' }]),
  [{ start: '2026-03-02T09:00:00Z', end: '2026-03-02T10:00:00Z' }]);` },

      { name: 'касающиеся интервалы становятся одним блоком',
        body: `assert.equal(mergeDateRanges([
  { start: '2026-03-02T10:00:00Z', end: '2026-03-02T11:00:00Z' },
  { start: '2026-03-02T11:00:00Z', end: '2026-03-02T12:00:00Z' },
]), [{ start: '2026-03-02T10:00:00Z', end: '2026-03-02T12:00:00Z' }]);` },

      { name: 'вложенный интервал поглощается внешним',
        body: `assert.equal(mergeDateRanges([
  { start: '2026-03-02T09:00:00Z', end: '2026-03-02T18:00:00Z' },
  { start: '2026-03-02T10:00:00Z', end: '2026-03-02T11:00:00Z' },
]), [{ start: '2026-03-02T09:00:00Z', end: '2026-03-02T18:00:00Z' }],
  'конец должен остаться поздним — нужен максимум, а не последнее значение');` },

      { name: 'непересекающиеся интервалы сортируются по началу',
        body: `assert.equal(mergeDateRanges([
  { start: '2026-03-02T12:00:00Z', end: '2026-03-02T13:00:00Z' },
  { start: '2026-03-02T09:00:00Z', end: '2026-03-02T10:00:00Z' },
]), [
  { start: '2026-03-02T09:00:00Z', end: '2026-03-02T10:00:00Z' },
  { start: '2026-03-02T12:00:00Z', end: '2026-03-02T13:00:00Z' },
]);` },

      { name: 'цепочка из нескольких пересечений схлопывается в один интервал',
        body: `assert.equal(mergeDateRanges([
  { start: '2026-03-02T09:00:00Z', end: '2026-03-02T10:00:00Z' },
  { start: '2026-03-02T09:30:00Z', end: '2026-03-02T11:00:00Z' },
  { start: '2026-03-02T10:30:00Z', end: '2026-03-02T12:00:00Z' },
  { start: '2026-03-02T15:00:00Z', end: '2026-03-02T16:00:00Z' },
]), [
  { start: '2026-03-02T09:00:00Z', end: '2026-03-02T12:00:00Z' },
  { start: '2026-03-02T15:00:00Z', end: '2026-03-02T16:00:00Z' },
]);` },

      { name: 'не мутирует ни входной массив, ни его объекты',
        body: `const first = { start: '2026-03-02T12:00:00Z', end: '2026-03-02T13:00:00Z' };
const second = { start: '2026-03-02T09:00:00Z', end: '2026-03-02T14:00:00Z' };
const input = [first, second];
mergeDateRanges(input);
assert.equal(input, [first, second], 'порядок входного массива не должен меняться');
assert.equal(first, { start: '2026-03-02T12:00:00Z', end: '2026-03-02T13:00:00Z' });
assert.equal(second, { start: '2026-03-02T09:00:00Z', end: '2026-03-02T14:00:00Z' });` },
    ],
  },
};
