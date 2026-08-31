const TESTS_WORKER_B = {

  /* ─────────────────────────── Данные ─────────────────────────── */

  tx11: {
    env: 'worker',
    entry: 'intersection',
    starter: `function intersection(a, b, keyFn) {
  // ваш код
}

function difference(a, b, keyFn) {
  // ваш код
}

function union(a, b, keyFn) {
  // ваш код
}

function symmetricDifference(a, b, keyFn) {
  // ваш код
}`,
    cases: [
      { name: 'пересечение оставляет только общие элементы',
        body: `assert.equal(intersection([1, 2, 3], [2, 3, 4]), [2, 3]);
assert.equal(intersection([1, 2], [3, 4]), []);` },

      { name: 'пересечение сохраняет порядок первого массива и схлопывает дубликаты',
        body: `assert.equal(intersection([3, 1, 1, 2, 3], [1, 3]), [3, 1], 'порядок берётся из первого массива, повторы удаляются');` },

      { name: 'сравнивает объекты по ключу и возвращает элементы первого массива',
        body: `const mine = { id: 2, from: 'a' };
const res = intersection([{ id: 1, from: 'a' }, mine], [{ id: 2, from: 'b' }], function (u) { return u.id; });
assert.equal(res.length, 1);
assert.ok(res[0] === mine, 'в результат должен попасть объект из первого массива, а не из второго');` },

      { name: 'разность выкидывает всё, что есть во втором массиве',
        body: `assert.ok(typeof difference === 'function', 'нужна функция difference');
assert.equal(difference([1, 2, 3], [2]), [1, 3]);
assert.equal(difference([1, 1, 2], []), [1, 2], 'дубликаты внутри одного массива схлопываются');
assert.equal(difference([], [1, 2]), []);` },

      { name: 'объединение склеивает массивы без повторов',
        body: `assert.ok(typeof union === 'function', 'нужна функция union');
assert.equal(union([1, 2], [2, 3]), [1, 2, 3]);
assert.equal(union([], []), []);
assert.equal(union([{ id: 1 }], [{ id: 1 }, { id: 2 }], function (u) { return u.id; }).length, 2, 'объекты с одинаковым ключом считаются одним элементом');` },

      { name: 'симметричная разность берёт уникальное из обоих массивов',
        body: `assert.ok(typeof symmetricDifference === 'function', 'нужна функция symmetricDifference');
assert.equal(symmetricDifference([1, 2, 3], [3, 4]), [1, 2, 4]);
assert.equal(symmetricDifference([1, 2], [1, 2]), []);` },

      { name: 'не мутирует входные массивы',
        body: `const a = [1, 2, 3];
const b = [2, 5];
intersection(a, b);
difference(a, b);
union(a, b);
assert.equal(a, [1, 2, 3], 'первый массив должен остаться нетронутым');
assert.equal(b, [2, 5], 'второй массив должен остаться нетронутым');` },

      { name: 'справляется с большими массивами за линейное время',
        body: `const a = [];
const b = [];
for (let i = 0; i < 60000; i++) { a.push(i); b.push(i + 30000); }
assert.equal(intersection(a, b).length, 30000, 'поиск через includes даёт O(n*m) и не укладывается в таймаут');` },
    ],
  },

  tx12: {
    env: 'worker',
    entry: 'sortBy',
    starter: `// правила: 'age' | { key: 'name', desc: true } | (item) => item.score
function sortBy(arr, rules) {
  // ваш код
}`,
    cases: [
      { name: 'сортирует по имени поля, переданному строкой',
        body: `const users = [{ name: 'Аня', age: 30 }, { name: 'Борис', age: 25 }, { name: 'Вера', age: 28 }];
assert.equal(sortBy(users, ['age']).map(function (u) { return u.name; }), ['Борис', 'Вера', 'Аня']);` },

      { name: 'не мутирует исходный массив',
        body: `const src = [{ v: 3 }, { v: 1 }, { v: 2 }];
const sorted = sortBy(src, ['v']);
assert.equal(src.map(function (o) { return o.v; }), [3, 1, 2], 'sort мутирует массив — нужна копия');
assert.equal(sorted.map(function (o) { return o.v; }), [1, 2, 3]);
assert.ok(sorted !== src, 'должен вернуться новый массив');` },

      { name: 'не теряет исходный порядок при равных ключах',
        body: `const items = [{ k: 1, i: 0 }, { k: 1, i: 1 }, { k: 0, i: 2 }, { k: 1, i: 3 }];
assert.equal(sortBy(items, ['k']).map(function (o) { return o.i; }), [2, 0, 1, 3], 'сортировка обязана быть стабильной');` },

      { name: 'разворачивает порядок по правилу с desc',
        body: `const users = [{ name: 'Аня', age: 30 }, { name: 'Борис', age: 25 }, { name: 'Вера', age: 30 }];
assert.equal(sortBy(users, [{ key: 'age', desc: true }]).map(function (u) { return u.name; }), ['Аня', 'Вера', 'Борис']);` },

      { name: 'принимает функцию как правило',
        body: `const users = [{ name: 'Аня' }, { name: 'Борис' }, { name: 'Вера' }];
assert.equal(sortBy(users, [function (u) { return u.name.length; }]).map(function (u) { return u.name; }), ['Аня', 'Вера', 'Борис']);` },

      { name: 'сортирует по нескольким полям по очереди',
        body: `const rows = [
  { dep: 'b', name: 'Яна' },
  { dep: 'a', name: 'Пётр' },
  { dep: 'b', name: 'Аня' },
  { dep: 'a', name: 'Зоя' }
];
const res = sortBy(rows, ['dep', { key: 'name', desc: true }]);
assert.equal(res.map(function (r) { return r.name; }), ['Пётр', 'Зоя', 'Яна', 'Аня'], 'второе правило решает исход только при равенстве первого');` },

      { name: 'пустые значения уезжают в конец при обоих направлениях',
        body: `const list = [{ v: 2 }, { v: null }, { v: 1 }, { v: undefined }];
assert.equal(sortBy(list, ['v']).map(function (o) { return o.v; }), [1, 2, null, undefined]);
assert.equal(sortBy(list, [{ key: 'v', desc: true }]).map(function (o) { return o.v; }), [2, 1, null, undefined], 'desc не должен поднимать пустые значения наверх');` },

      { name: 'сравнивает строки по локали, а не по кодам символов',
        body: `assert.equal(sortBy([{ n: 'B' }, { n: 'a' }], ['n']).map(function (o) { return o.n; }), ['a', 'B'], 'нужен localeCompare, а не сравнение через минус');` },
    ],
  },

  tx13: {
    env: 'worker',
    entry: 'buildTree',
    starter: `function buildTree(items) {
  // ваш код
}`,
    cases: [
      { name: 'собирает двухуровневое дерево',
        body: `const items = [
  { id: 1, parentId: null, title: 'Корень' },
  { id: 2, parentId: 1, title: 'Дочерний' }
];
const tree = buildTree(items);
assert.equal(tree.length, 1);
assert.equal(tree[0].id, 1);
assert.equal(tree[0].children.length, 1);
assert.equal(tree[0].children[0].title, 'Дочерний');` },

      { name: 'пустой список даёт пустое дерево',
        body: `assert.equal(buildTree([]), []);` },

      { name: 'находит родителя, даже если он идёт после ребёнка',
        body: `const items = [
  { id: 2, parentId: 1 },
  { id: 3, parentId: 2 },
  { id: 1, parentId: null }
];
const tree = buildTree(items);
assert.equal(tree.map(function (n) { return n.id; }), [1], 'порядок в исходном массиве не должен влиять на результат');
assert.equal(tree[0].children[0].children.map(function (n) { return n.id; }), [3]);` },

      { name: 'сохраняет порядок детей',
        body: `const items = [
  { id: 1, parentId: null },
  { id: 3, parentId: 1 },
  { id: 2, parentId: 1 },
  { id: 5, parentId: 1 }
];
assert.equal(buildTree(items)[0].children.map(function (n) { return n.id; }), [3, 2, 5]);` },

      { name: 'узел с несуществующим родителем становится корнем',
        body: `const items = [
  { id: 1, parentId: 99 },
  { id: 2, parentId: 1 }
];
const tree = buildTree(items);
assert.equal(tree.map(function (n) { return n.id; }), [1], 'висячая ссылка на родителя не должна терять узел');
assert.equal(tree[0].children.map(function (n) { return n.id; }), [2]);` },

      { name: 'ссылка узла на самого себя не роняет и не теряет его',
        body: `const tree = buildTree([{ id: 1, parentId: 1 }, { id: 2, parentId: null }]);
assert.equal(tree.map(function (n) { return n.id; }), [1, 2]);` },

      { name: 'не мутирует исходные объекты',
        body: `const items = [{ id: 1, parentId: null }, { id: 2, parentId: 1 }];
buildTree(items);
assert.equal(items[0].children, undefined, 'исходным объектам нельзя дописывать children');
assert.equal(items[1].children, undefined);` },

      { name: 'справляется с длинной цепочкой и большим списком',
        body: `const wide = [{ id: 0, parentId: null }];
for (let i = 1; i < 20000; i++) wide.push({ id: i, parentId: 0 });
assert.equal(buildTree(wide)[0].children.length, 19999, 'рекурсивный filter по parentId даёт O(n^2) и не укладывается в бюджет времени');

const chain = [];
for (let i = 0; i < 10000; i++) chain.push({ id: i, parentId: i === 0 ? null : i - 1 });
const tree = buildTree(chain);
assert.equal(tree.length, 1);
let node = tree[0];
let depth = 0;
while (node.children.length) { node = node.children[0]; depth++; }
assert.equal(depth, 9999, 'рекурсивная сборка глубокой цепочки переполняет стек');` },
    ],
  },

  tx14: {
    env: 'worker',
    entry: 'flattenTree',
    starter: `function flattenTree(nodes) {
  // ваш код
}`,
    cases: [
      { name: 'разворачивает дерево в порядке обхода в глубину',
        body: `const tree = [{ id: 1, children: [{ id: 2, children: [{ id: 3 }] }, { id: 4 }] }];
assert.equal(flattenTree(tree).map(function (n) { return n.id; }), [1, 2, 3, 4], 'pre-order: сначала узел, потом его дети слева направо');` },

      { name: 'проставляет глубину и родителя каждому узлу',
        body: `const tree = [{ id: 1, children: [{ id: 2, children: [{ id: 3 }] }, { id: 4 }] }];
const flat = flattenTree(tree);
assert.equal(flat.map(function (n) { return n.depth; }), [0, 1, 2, 1]);
assert.equal(flat.map(function (n) { return n.parentId; }), [null, 1, 2, 1], 'у корня parentId должен быть null');` },

      { name: 'не оставляет children в плоском результате',
        body: `const tree = [{ id: 1, title: 'a', children: [{ id: 2, title: 'b' }] }];
const flat = flattenTree(tree);
assert.ok(!('children' in flat[0]), 'поле children не должно попадать в результат');
assert.equal(flat[0].title, 'a', 'остальные поля узла сохраняются');` },

      { name: 'пустой лес и узлы без детей обрабатываются корректно',
        body: `assert.equal(flattenTree([]), []);
const flat = flattenTree([{ id: 1 }, { id: 2, children: [] }]);
assert.equal(flat.map(function (n) { return n.id; }), [1, 2]);
assert.equal(flat.map(function (n) { return n.depth; }), [0, 0]);` },

      { name: 'разворачивает лес из нескольких корней подряд',
        body: `const forest = [
  { id: 1, children: [{ id: 2 }] },
  { id: 3, children: [{ id: 4 }] }
];
const flat = flattenTree(forest);
assert.equal(flat.map(function (n) { return n.id; }), [1, 2, 3, 4]);
assert.equal(flat.map(function (n) { return n.parentId; }), [null, 1, null, 3]);` },

      { name: 'не мутирует исходное дерево',
        body: `const tree = [{ id: 1, children: [{ id: 2 }] }];
flattenTree(tree);
assert.equal(tree[0].children.length, 1, 'children исходного узла должен остаться на месте');
assert.equal(tree[0].depth, undefined, 'исходным узлам нельзя дописывать depth');` },

      { name: 'не переполняет стек на очень глубоком дереве',
        body: `let node = { id: 0 };
const root = node;
for (let i = 1; i < 20000; i++) {
  const child = { id: i };
  node.children = [child];
  node = child;
}
const flat = flattenTree([root]);
assert.equal(flat.length, 20000, 'рекурсия здесь падает — нужен итеративный обход');
assert.equal(flat[19999].depth, 19999);` },
    ],
  },

  tx15: {
    env: 'worker',
    entry: 'findPath',
    starter: `function findPath(roots, predicate) {
  // ваш код
}

function findPathBfs(roots, predicate) {
  // ваш код
}`,
    cases: [
      { name: 'возвращает путь от корня до найденного узла',
        body: `const tree = [{ id: 1, children: [{ id: 2, children: [{ id: 3 }] }, { id: 4 }] }];
const path = findPath(tree, function (n) { return n.id === 3; });
assert.equal(path.map(function (n) { return n.id; }), [1, 2, 3]);` },

      { name: 'возвращает null, когда подходящего узла нет',
        body: `const tree = [{ id: 1, children: [{ id: 2 }] }];
assert.equal(findPath(tree, function (n) { return n.id === 99; }), null);
assert.equal(findPath([], function () { return true; }), null);` },

      { name: 'находит сам корень и отдаёт путь из одного узла',
        body: `const tree = [{ id: 1, children: [{ id: 2 }] }];
const path = findPath(tree, function (n) { return n.id === 1; });
assert.equal(path.length, 1);
assert.equal(path[0].id, 1);` },

      { name: 'не тащит в путь тупиковые ветки',
        body: `const tree = [{ id: 1, children: [
  { id: 2, children: [{ id: 5 }, { id: 6 }] },
  { id: 3, children: [{ id: 4 }] }
] }];
assert.equal(findPath(tree, function (n) { return n.id === 4; }).map(function (n) { return n.id; }), [1, 3, 4], 'узлы просмотренной и отброшенной ветки не должны остаться в пути');` },

      { name: 'ищет во всех корнях леса, а не только в первом',
        body: `const forest = [
  { id: 'a', children: [{ id: 'a1' }] },
  { id: 'b', children: [{ id: 'b1', children: [{ id: 'цель' }] }] }
];
assert.equal(findPath(forest, function (n) { return n.id === 'цель'; }).map(function (n) { return n.id; }), ['b', 'b1', 'цель']);` },

      { name: 'возвращает сами узлы дерева, а не их копии',
        body: `const target = { id: 7 };
const tree = [{ id: 1, children: [{ id: 2, children: [target] }] }];
const path = findPath(tree, function (n) { return n.id === 7; });
assert.ok(path[path.length - 1] === target, 'в пути должны лежать ссылки на исходные узлы');
assert.ok(path[0] === tree[0]);` },

      { name: 'BFS находит узел, ближайший к корню, а DFS — первый по обходу',
        body: `assert.ok(typeof findPathBfs === 'function', 'нужна вторая реализация findPathBfs');
const tree = [{ id: 'корень', children: [
  { id: 'ветка', children: [{ id: 'цель', mark: 'глубокая' }] },
  { id: 'цель', mark: 'мелкая' }
] }];
const bfs = findPathBfs(tree, function (n) { return n.id === 'цель'; });
assert.equal(bfs.length, 2);
assert.equal(bfs[1].mark, 'мелкая', 'BFS обязан найти ближайший к корню узел');
const dfs = findPath(tree, function (n) { return n.id === 'цель'; });
assert.equal(dfs[dfs.length - 1].mark, 'глубокая', 'DFS находит первый по порядку обхода');` },
    ],
  },

  tx16: {
    env: 'worker',
    entry: 'formatNumber',
    starter: `// options: { groupSep = ' ', decimalSep = ',', digits }
function formatNumber(value, options) {
  // ваш код
}`,
    cases: [
      { name: 'разбивает целую часть на группы по три цифры',
        body: `assert.equal(formatNumber(1234567), '1 234 567');` },

      { name: 'не трогает числа меньше тысячи',
        body: `assert.equal(formatNumber(999), '999');
assert.equal(formatNumber(0), '0');
assert.equal(formatNumber(1), '1');` },

      { name: 'ставит разделитель ровно на границе тысячи',
        body: `assert.equal(formatNumber(1000), '1 000');
assert.equal(formatNumber(100), '100');
assert.equal(formatNumber(10000), '10 000');` },

      { name: 'округляет дробную часть до заданного числа знаков',
        body: `assert.equal(formatNumber(1234.567, { digits: 2 }), '1 234,57');
assert.equal(formatNumber(1234, { digits: 0 }), '1 234');` },

      { name: 'сохраняет минус у отрицательных чисел',
        body: `assert.equal(formatNumber(-1234567.5, { digits: 1 }), '-1 234 567,5');
assert.equal(formatNumber(-0.5, { digits: 1 }), '-0,5', 'знак не должен потеряться на числах меньше единицы');` },

      { name: 'принимает свои разделители групп и дробной части',
        body: `assert.equal(formatNumber(1234567.89, { groupSep: ',', decimalSep: '.', digits: 2 }), '1,234,567.89');
assert.equal(formatNumber(1234567, { groupSep: '' }), '1234567');` },

      { name: 'отдаёт NaN и Infinity как есть, а не как мусор',
        body: `assert.equal(formatNumber(NaN), 'NaN');
assert.equal(formatNumber(Infinity), 'Infinity');
assert.equal(formatNumber(-Infinity), '-Infinity');` },

      { name: 'без опции digits не режет дробную часть',
        body: `assert.equal(formatNumber(1234.5), '1 234,5');` },
    ],
  },

  tx17: {
    env: 'worker',
    entry: 'plural',
    starter: `// forms: ['товар', 'товара', 'товаров']
function plural(count, forms) {
  // ваш код
}

function pluralize(count, forms) {
  // ваш код
}`,
    cases: [
      { name: 'склоняет базовые 1, 2 и 5',
        body: `const f = ['товар', 'товара', 'товаров'];
assert.equal(plural(1, f), 'товар');
assert.equal(plural(2, f), 'товара');
assert.equal(plural(5, f), 'товаров');` },

      { name: 'ноль и 5-9 берут форму множественного числа',
        body: `const f = ['товар', 'товара', 'товаров'];
assert.equal(plural(0, f), 'товаров');
assert.equal(plural(7, f), 'товаров');
assert.equal(plural(9, f), 'товаров');` },

      { name: 'склоняет 11 как множественное, а не как единицу',
        body: `const f = ['товар', 'товара', 'товаров'];
assert.equal(plural(11, f), 'товаров', 'самая частая ошибка: 11 товаров, а не 11 товар');
assert.equal(plural(12, f), 'товаров');
assert.equal(plural(13, f), 'товаров');
assert.equal(plural(14, f), 'товаров');` },

      { name: 'после двадцати правило повторяется по последней цифре',
        body: `const f = ['товар', 'товара', 'товаров'];
assert.equal(plural(21, f), 'товар');
assert.equal(plural(22, f), 'товара');
assert.equal(plural(25, f), 'товаров');
assert.equal(plural(101, f), 'товар');` },

      { name: 'сотни не ломают исключение для одиннадцати',
        body: `const f = ['товар', 'товара', 'товаров'];
assert.equal(plural(111, f), 'товаров', '111 считается по остатку от 100, то есть как 11');
assert.equal(plural(112, f), 'товаров');
assert.equal(plural(1011, f), 'товаров');
assert.equal(plural(100, f), 'товаров');` },

      { name: 'отрицательные числа склоняются как положительные',
        body: `const f = ['товар', 'товара', 'товаров'];
assert.equal(plural(-1, f), 'товар');
assert.equal(plural(-3, f), 'товара');
assert.equal(plural(-11, f), 'товаров');` },

      { name: 'pluralize склеивает число со словом',
        body: `assert.ok(typeof pluralize === 'function', 'нужна функция pluralize');
const f = ['товар', 'товара', 'товаров'];
assert.equal(pluralize(5, f), '5 товаров');
assert.equal(pluralize(1, f), '1 товар');
assert.equal(pluralize(21, f), '21 товар');` },
    ],
  },

  tx18: {
    env: 'worker',
    entry: 'transliterate',
    starter: `function transliterate(str) {
  // ваш код
}

function slugify(str) {
  // ваш код
}`,
    cases: [
      { name: 'переводит кириллицу в латиницу',
        body: `assert.equal(transliterate('привет мир'), 'privet mir');` },

      { name: 'сохраняет регистр, в том числе у многобуквенных замен',
        body: `assert.equal(transliterate('Привет'), 'Privet');
assert.equal(transliterate('МИР'), 'MIR');
assert.equal(transliterate('Щука'), 'Schuka', 'заглавная щ даёт Sch, а не SCH и не sch');` },

      { name: 'твёрдый и мягкий знаки исчезают',
        body: `assert.equal(transliterate('подъезд'), 'podezd');
assert.equal(transliterate('соль'), 'sol');
assert.equal(transliterate('ЬЪ'), '');` },

      { name: 'латиница, цифры и знаки остаются как есть',
        body: `assert.equal(transliterate('abc-123!'), 'abc-123!');
assert.equal(transliterate(''), '');
assert.equal(transliterate('Топ 10'), 'Top 10');` },

      { name: 'слаг приводит всё к нижнему регистру и режет знаки',
        body: `assert.ok(typeof slugify === 'function', 'нужна функция slugify');
assert.equal(slugify('Привет, мир!'), 'privet-mir');
assert.equal(slugify('Топ-10 книг'), 'top-10-knig');` },

      { name: 'подряд идущие пробелы и знаки схлопываются в один дефис',
        body: `assert.equal(slugify('Привет   ---   мир'), 'privet-mir', 'несколько разделителей подряд дают один дефис');` },

      { name: 'дефисы по краям срезаются, пустая строка остаётся пустой',
        body: `assert.equal(slugify('  Привет!  '), 'privet');
assert.equal(slugify('!!!'), '');
assert.equal(slugify(''), '');
assert.equal(slugify('---'), '');` },
    ],
  },

  tx19: {
    env: 'worker',
    entry: 'parseQuery',
    starter: `function parseQuery(queryString) {
  // ваш код
}

function stringifyQuery(obj) {
  // ваш код
}`,
    cases: [
      { name: 'разбирает пары ключ-значение',
        body: `const q = parseQuery('a=1&b=2');
assert.equal(q.a, '1');
assert.equal(q.b, '2');
assert.equal(Object.keys(q).length, 2);` },

      { name: 'отбрасывает ведущий вопросительный знак',
        body: `assert.equal(parseQuery('?a=1').a, '1');
assert.equal(Object.keys(parseQuery('?')).length, 0);
assert.equal(Object.keys(parseQuery('')).length, 0);` },

      { name: 'декодирует процентные последовательности и плюс как пробел',
        body: `const q = parseQuery('a=hello%20world&b=hello+world&c=%D0%B4%D0%B0');
assert.equal(q.a, 'hello world');
assert.equal(q.b, 'hello world', 'плюс в query string означает пробел');
assert.equal(q.c, 'да');` },

      { name: 'режет пару только по первому знаку равенства',
        body: `assert.equal(parseQuery('a=b=c').a, 'b=c', 'split по = обрезает значение');` },

      { name: 'повторяющиеся ключи собираются в массив',
        body: `const q = parseQuery('tag=a&tag=b&tag=c');
assert.equal(q.tag, ['a', 'b', 'c']);
assert.equal(parseQuery('tag=a').tag, 'a', 'единственное вхождение остаётся строкой');` },

      { name: 'ключ без значения даёт пустую строку',
        body: `const q = parseQuery('flag&a=1');
assert.equal(q.flag, '');
assert.equal(q.a, '1');` },

      { name: 'сериализация пропускает null и undefined',
        body: `assert.ok(typeof stringifyQuery === 'function', 'нужна функция stringifyQuery');
assert.equal(stringifyQuery({ a: 1, b: null, c: undefined, d: 'x' }), 'a=1&d=x');
assert.equal(stringifyQuery({}), '');
assert.equal(stringifyQuery({ a: '' }), 'a=', 'пустая строка это значение, а не отсутствие значения');` },

      { name: 'сериализация разворачивает массивы и кодирует спецсимволы',
        body: `assert.equal(stringifyQuery({ tag: ['a', 'b'] }), 'tag=a&tag=b');
assert.equal(stringifyQuery({ q: 'два слова' }), 'q=' + encodeURIComponent('два слова'));
const back = parseQuery(stringifyQuery({ q: 'a b', tag: ['x', 'y'] }));
assert.equal(back.q, 'a b');
assert.equal(back.tag, ['x', 'y']);` },
    ],
  },

  tx20: {
    env: 'worker',
    entry: 'template',
    starter: `// options: { fallback = '', escape = true }
function template(str, data, options) {
  // ваш код
}`,
    cases: [
      { name: 'подставляет значение по простому ключу',
        body: `assert.equal(template('Привет, {{ name }}!', { name: 'Аня' }), 'Привет, Аня!');` },

      { name: 'текст без плейсхолдеров не меняется',
        body: `assert.equal(template('нет никаких скобок', {}), 'нет никаких скобок');
assert.equal(template('', {}), '');` },

      { name: 'лишние пробелы внутри скобок игнорируются',
        body: `assert.equal(template('{{name}}|{{   name   }}', { name: 'x' }), 'x|x');` },

      { name: 'резолвит путь через точку',
        body: `assert.equal(template('{{ user.profile.city }}', { user: { profile: { city: 'Москва' } } }), 'Москва');
assert.equal(template('{{ a.b }}-{{ a.c }}', { a: { b: 1, c: 2 } }), '1-2');` },

      { name: 'отсутствующее значение превращается в пустую строку',
        body: `assert.equal(template('[{{ nope }}]', {}), '[]');
assert.equal(template('[{{ a.b.c }}]', { a: null }), '[]', 'обрыв пути не должен ронять шаблон');
assert.equal(template('[{{ x }}]', { x: null }), '[]');` },

      { name: 'ноль и false подставляются, а не считаются пустыми',
        body: `assert.equal(template('{{ n }}', { n: 0 }), '0');
assert.equal(template('{{ b }}', { b: false }), 'false');` },

      { name: 'подставляемые значения экранируются от HTML',
        body: `assert.equal(template('{{ x }}', { x: '<b>&"' }), '&lt;b&gt;&amp;&quot;', 'без экранирования шаблонизатор становится дырой для XSS');` },

      { name: 'экранирование отключается опцией',
        body: `assert.equal(template('{{ x }}', { x: '<b>' }, { escape: false }), '<b>');
assert.equal(template('{{ nope }}', {}, { fallback: 'нет данных' }), 'нет данных');` },
    ],
  },

  /* ───────────────────────── Алгоритмы ───────────────────────── */

  tx39: {
    env: 'worker',
    entry: 'twoSum',
    starter: `function twoSum(nums, target) {
  // ваш код
}`,
    cases: [
      { name: 'находит пару и возвращает её индексы',
        body: `assert.equal(twoSum([2, 7, 11, 15], 9), [0, 1]);
assert.equal(twoSum([3, 2, 4], 6), [1, 2]);` },

      { name: 'возвращает null, когда подходящей пары нет',
        body: `assert.equal(twoSum([1, 2, 3], 100), null);
assert.equal(twoSum([], 0), null);
assert.equal(twoSum([5], 5), null);` },

      { name: 'не использует один и тот же элемент дважды',
        body: `assert.equal(twoSum([3], 6), null, 'элемент не может быть парой самому себе');
assert.equal(twoSum([5, 5], 10), [0, 1], 'а два одинаковых элемента — вполне могут');` },

      { name: 'работает с отрицательными числами и нулями',
        body: `assert.equal(twoSum([-3, 4, 3, 90], 0), [0, 2]);
assert.equal(twoSum([0, 4, 3, 0], 0), [0, 3]);
assert.equal(twoSum([-1, -2, -3, -4, -5], -8), [2, 4]);` },

      { name: 'при нескольких подходящих парах возвращает корректную',
        body: `const nums = [1, 2, 3, 4];
const idx = twoSum(nums, 5);
assert.ok(idx !== null, 'пара 1+4 или 2+3 точно есть');
assert.ok(idx[0] !== idx[1], 'индексы должны быть разными');
assert.equal(nums[idx[0]] + nums[idx[1]], 5);` },

      { name: 'справляется с большим массивом за один проход',
        body: `const nums = [];
for (let i = 0; i < 60000; i++) nums.push(i);
assert.equal(twoSum(nums, 119997), [59998, 59999], 'двойной цикл здесь не укладывается в таймаут');` },
    ],
  },

  tx40: {
    env: 'worker',
    entry: 'isValidBrackets',
    starter: `function isValidBrackets(str) {
  // ваш код
}`,
    cases: [
      { name: 'пустая строка сбалансирована',
        body: `assert.equal(isValidBrackets(''), true);` },

      { name: 'принимает простые и последовательные пары',
        body: `assert.equal(isValidBrackets('()'), true);
assert.equal(isValidBrackets('()[]{}'), true);` },

      { name: 'принимает вложенные скобки разных видов',
        body: `assert.equal(isValidBrackets('{[()]}'), true);
assert.equal(isValidBrackets('((()))'), true);` },

      { name: 'ловит закрытие не тем типом скобки',
        body: `assert.equal(isValidBrackets('(]'), false);
assert.equal(isValidBrackets('([)]'), false, 'порядок закрытия важен, одного подсчёта количества мало');` },

      { name: 'ловит незакрытые скобки в конце строки',
        body: `assert.equal(isValidBrackets('((('), false, 'в конце стек обязан быть пустым');
assert.equal(isValidBrackets('([]'), false);` },

      { name: 'ловит лишнюю закрывающую скобку',
        body: `assert.equal(isValidBrackets(')'), false);
assert.equal(isValidBrackets(')('), false, 'закрывающая при пустом стеке сразу делает строку невалидной');
assert.equal(isValidBrackets('())'), false);` },

      { name: 'прочие символы не мешают проверке',
        body: `assert.equal(isValidBrackets('if (a[0]) { return 1; }'), true);
assert.equal(isValidBrackets('текст без скобок'), true);
assert.equal(isValidBrackets('a)b'), false);` },
    ],
  },

  tx41: {
    env: 'worker',
    entry: 'isPalindrome',
    starter: `function isPalindrome(str) {
  // ваш код
}

function firstUniqueChar(str) {
  // ваш код
}

function isAnagram(a, b) {
  // ваш код
}`,
    cases: [
      { name: 'палиндром распознаётся без учёта регистра и знаков',
        body: `assert.equal(isPalindrome('А роза упала на лапу Азора'), true);
assert.equal(isPalindrome('A man, a plan, a canal: Panama'), true);` },

      { name: 'пустая строка и один символ считаются палиндромами',
        body: `assert.equal(isPalindrome(''), true);
assert.equal(isPalindrome('ы'), true);
assert.equal(isPalindrome('.,!'), true, 'строка без букв и цифр тоже палиндром');` },

      { name: 'непалиндром отсекается',
        body: `assert.equal(isPalindrome('abca'), false);
assert.equal(isPalindrome('привет'), false);
assert.equal(isPalindrome('ab'), false);` },

      { name: 'первый уникальный символ ищется по индексу в исходной строке',
        body: `assert.ok(typeof firstUniqueChar === 'function', 'нужна функция firstUniqueChar');
assert.equal(firstUniqueChar('leetcode'), 0);
assert.equal(firstUniqueChar('loveleetcode'), 2, 'считать частоты надо целиком, до поиска первого одиночки');` },

      { name: 'когда уникальных символов нет, возвращается минус один',
        body: `assert.equal(firstUniqueChar('aabbcc'), -1);
assert.equal(firstUniqueChar(''), -1);
assert.equal(firstUniqueChar('a'), 0);` },

      { name: 'анаграмма определяется по количеству каждой буквы',
        body: `assert.ok(typeof isAnagram === 'function', 'нужна функция isAnagram');
assert.equal(isAnagram('listen', 'silent'), true);
assert.equal(isAnagram('апельсин', 'спаниель'), true);
assert.equal(isAnagram('aabb', 'abbb'), false, 'совпадения набора букв мало — важны количества');` },

      { name: 'строки разной длины анаграммами не считаются',
        body: `assert.equal(isAnagram('abc', 'ab'), false);
assert.equal(isAnagram('a', 'aa'), false);
assert.equal(isAnagram('', ''), true);` },
    ],
  },

  tx42: {
    env: 'worker',
    entry: 'lengthOfLongestSubstring',
    starter: `// вернуть { length, substring }
function lengthOfLongestSubstring(s) {
  // ваш код
}`,
    cases: [
      { name: 'возвращает и длину, и саму подстроку',
        body: `assert.equal(lengthOfLongestSubstring('abcabcbb'), { length: 3, substring: 'abc' });` },

      { name: 'пустая строка даёт нулевую длину и пустую подстроку',
        body: `assert.equal(lengthOfLongestSubstring(''), { length: 0, substring: '' });` },

      { name: 'строка из одинаковых символов сжимается до одного',
        body: `assert.equal(lengthOfLongestSubstring('bbbbb'), { length: 1, substring: 'b' });
assert.equal(lengthOfLongestSubstring(' '), { length: 1, substring: ' ' });` },

      { name: 'строка без повторов возвращается целиком',
        body: `assert.equal(lengthOfLongestSubstring('abcdef'), { length: 6, substring: 'abcdef' });
assert.equal(lengthOfLongestSubstring('a'), { length: 1, substring: 'a' });` },

      { name: 'лучшая подстрока может быть не в начале строки',
        body: `assert.equal(lengthOfLongestSubstring('pwwkew'), { length: 3, substring: 'wke' }, 'pwke не подстрока — окно должно быть непрерывным');` },

      { name: 'левая граница окна не едет назад на входе abba',
        body: `assert.equal(lengthOfLongestSubstring('abba'), { length: 2, substring: 'ab' }, 'прошлый индекс символа может быть левее границы окна — прыгать туда нельзя');
assert.equal(lengthOfLongestSubstring('dvdf'), { length: 3, substring: 'vdf' });` },

      { name: 'обрабатывает длинную строку за один проход',
        body: `let s = '';
const alphabet = 'abcd';
for (let i = 0; i < 50000; i++) s += alphabet[i % 4];
const res = lengthOfLongestSubstring(s);
assert.equal(res.length, 4, 'квадратичный перебор подстрок здесь не укладывается в таймаут');
assert.equal(res.substring, 'abcd');` },
    ],
  },

  tx43: {
    env: 'worker',
    entry: 'mergeIntervals',
    starter: `function mergeIntervals(intervals) {
  // ваш код
}`,
    cases: [
      { name: 'объединяет пересекающиеся интервалы',
        body: `assert.equal(mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]]);` },

      { name: 'пустой вход и один интервал обрабатываются корректно',
        body: `assert.equal(mergeIntervals([]), []);
assert.equal(mergeIntervals([[5, 5]]), [[5, 5]]);
assert.equal(mergeIntervals([[3, 7]]), [[3, 7]]);` },

      { name: 'сначала сортирует, поэтому порядок на входе не важен',
        body: `assert.equal(mergeIntervals([[8, 10], [1, 3], [2, 6]]), [[1, 6], [8, 10]], 'без сортировки по началу жадное слияние не работает');` },

      { name: 'вложенный интервал не укорачивает внешний',
        body: `assert.equal(mergeIntervals([[1, 10], [2, 3], [4, 5]]), [[1, 10]], 'конец надо брать как максимум, иначе интервал схлопнется до 3');` },

      { name: 'касающиеся интервалы склеиваются, а разделённые — нет',
        body: `assert.equal(mergeIntervals([[1, 4], [4, 5]]), [[1, 5]]);
assert.equal(mergeIntervals([[1, 2], [3, 4]]), [[1, 2], [3, 4]]);` },

      { name: 'работает с отрицательными границами',
        body: `assert.equal(mergeIntervals([[-5, -3], [-4, 0], [2, 2]]), [[-5, 0], [2, 2]]);` },

      { name: 'не мутирует ни внешний массив, ни сами интервалы',
        body: `const src = [[3, 4], [1, 10], [2, 3]];
const before = [[3, 4], [1, 10], [2, 3]];
mergeIntervals(src);
assert.equal(src, before, 'sort мутирует массив — нужна копия перед сортировкой');` },
    ],
  },

  tx44: {
    env: 'worker',
    entry: 'binarySearch',
    starter: `function binarySearch(arr, target, compare) {
  // ваш код
}

function lowerBound(arr, target, compare) {
  // ваш код
}`,
    cases: [
      { name: 'находит элемент в середине массива',
        body: `assert.equal(binarySearch([1, 3, 5, 7, 9], 7), 3);
assert.equal(binarySearch([1, 3, 5, 7, 9], 5), 2);` },

      { name: 'находит крайние элементы',
        body: `assert.equal(binarySearch([1, 3, 5, 7, 9], 1), 0, 'первый элемент часто теряется из-за границ цикла');
assert.equal(binarySearch([1, 3, 5, 7, 9], 9), 4, 'последний элемент теряется по той же причине');
assert.equal(binarySearch([1, 2, 3, 4], 4), 3);` },

      { name: 'пустой массив и массив из одного элемента не ломают поиск',
        body: `assert.equal(binarySearch([], 1), -1);
assert.equal(binarySearch([5], 5), 0);
assert.equal(binarySearch([5], 1), -1);
assert.equal(binarySearch([5], 9), -1);` },

      { name: 'возвращает минус один для отсутствующего элемента',
        body: `assert.equal(binarySearch([1, 2, 3], 0), -1, 'значение меньше всех');
assert.equal(binarySearch([1, 2, 3], 10), -1, 'значение больше всех');
assert.equal(binarySearch([1, 2, 4], 3), -1, 'значение внутри диапазона, но его нет в массиве');` },

      { name: 'поддерживает компаратор для массива объектов',
        body: `const cmp = function (a, b) { return a.v - b.v; };
const arr = [{ v: 1 }, { v: 3 }, { v: 5 }];
assert.equal(binarySearch(arr, { v: 3 }, cmp), 1);
assert.equal(binarySearch(arr, { v: 4 }, cmp), -1);` },

      { name: 'lowerBound даёт позицию для вставки, а не минус один',
        body: `assert.ok(typeof lowerBound === 'function', 'нужна функция lowerBound');
assert.equal(lowerBound([1, 3, 5], 4), 2);
assert.equal(lowerBound([1, 3, 5], 0), 0, 'элемент меньше всех вставляется в начало');
assert.equal(lowerBound([1, 3, 5], 9), 3, 'элемент больше всех вставляется в конец');
assert.equal(lowerBound([], 1), 0);` },

      { name: 'lowerBound указывает на первое из одинаковых значений',
        body: `assert.equal(lowerBound([1, 2, 2, 2, 3], 2), 1, 'нижняя граница — самая левая позиция, куда можно вставить');
assert.equal(lowerBound([2, 2, 2], 2), 0);
assert.equal(lowerBound([1, 3, 5], 3), 1);` },

      { name: 'не зацикливается на большом массиве',
        body: `const arr = [];
for (let i = 0; i < 100000; i++) arr.push(i * 2);
assert.equal(binarySearch(arr, 199998), 99999);
assert.equal(binarySearch(arr, 3), -1);
assert.equal(lowerBound(arr, 3), 2);` },
    ],
  },

  tx45: {
    env: 'worker',
    entry: 'topKFrequent',
    starter: `function topKFrequent(items, k) {
  // ваш код
}`,
    cases: [
      { name: 'возвращает k самых частых элементов',
        body: `assert.equal(topKFrequent([1, 1, 1, 2, 2, 3], 2), [1, 2]);` },

      { name: 'порядок результата — по убыванию частоты',
        body: `assert.equal(topKFrequent(['a', 'b', 'b', 'c', 'c', 'c'], 3), ['c', 'b', 'a']);` },

      { name: 'пустой массив и k равное нулю дают пустой результат',
        body: `assert.equal(topKFrequent([], 1), []);
assert.equal(topKFrequent([1, 2, 3], 0), []);` },

      { name: 'k больше числа различных элементов не ломает результат',
        body: `const res = topKFrequent([1, 2], 5);
assert.equal(res.length, 2, 'вернуть больше, чем есть различных элементов, нельзя');
assert.equal(res.slice().sort(), [1, 2]);` },

      { name: 'один повторяющийся элемент возвращается один раз',
        body: `assert.equal(topKFrequent([7, 7, 7], 1), [7]);
assert.equal(topKFrequent(['x'], 1), ['x']);` },

      { name: 'при равных частотах возвращается ровно k подходящих элементов',
        body: `const res = topKFrequent([1, 1, 2, 2, 3], 2);
assert.equal(res.length, 2);
assert.equal(res.slice().sort(), [1, 2], 'редкий элемент 3 не должен вытеснить частые');` },

      { name: 'частоты считаются по значению, а не по позиции',
        body: `assert.equal(topKFrequent(['a', 'b', 'a', 'c', 'b', 'a'], 1), ['a']);
assert.equal(topKFrequent([5, 1, 5, 1, 5, 2], 2).slice(0, 1), [5]);` },
    ],
  },

  /* ─────────────────────── Асинхронность ─────────────────────── */

  tx46: {
    env: 'worker',
    entry: 'withTimeout',
    starter: `function sleep(ms, signal) {
  // ваш код
}

function withTimeout(promise, ms, message) {
  // ваш код
}`,
    cases: [
      { name: 'sleep не завершается раньше указанного времени',
        body: `let done = false;
const before = Date.now();
const p = sleep(100);
p.then(function () { done = true; });
assert.equal(Date.now(), before, 'sleep не должен сам двигать время — он только планирует таймер');
await clock.tick(50);
assert.equal(done, false, 'на середине срока промис ещё не должен быть выполнен');
await clock.tick(50);
assert.equal(done, true, 'по истечении срока промис обязан выполниться');` },

      { name: 'sleep выполняется ровно по истечении срока',
        body: `let at = -1;
sleep(100).then(function () { at = Date.now(); });
await clock.tick(200);
assert.equal(at, 100, 'таймер должен сработать на 100-й миллисекунде, не раньше и не позже');` },

      { name: 'withTimeout пропускает результат, если промис успел',
        body: `const p = withTimeout(sleep(50).then(function () { return 'готово'; }), 100);
await clock.tick(50);
assert.equal(await p, 'готово');` },

      { name: 'withTimeout отклоняется, когда время вышло',
        body: `const pending = new Promise(function () {});
const p = withTimeout(pending, 100);
let state = 'ожидание';
p.then(function () { state = 'успех'; }, function () { state = 'отклонён'; });
await clock.tick(99);
assert.equal(state, 'ожидание', 'до истечения срока отклонять нельзя');
await clock.tick(1);
assert.equal(state, 'отклонён');` },

      { name: 'withTimeout кладёт переданное сообщение в ошибку',
        body: `const pending = new Promise(function () {});
const p = withTimeout(pending, 100, 'слишком долго');
const check = assert.rejects(p);
await clock.tick(100);
const err = await check;
assert.ok(err instanceof Error, 'отклонять надо объектом ошибки, а не строкой');
assert.equal(err.message, 'слишком долго');` },

      { name: 'withTimeout пробрасывает исходную ошибку, а не подменяет её таймаутом',
        body: `const failing = sleep(10).then(function () { throw new Error('сеть недоступна'); });
const p = withTimeout(failing, 1000);
const check = assert.rejects(p);
await clock.tick(10);
const err = await check;
assert.equal(err.message, 'сеть недоступна');` },

      { name: 'withTimeout не отклоняется после того, как промис уже завершился',
        body: `let rejected = false;
const p = withTimeout(sleep(10).then(function () { return 'ок'; }), 100);
p.catch(function () { rejected = true; });
await clock.tick(10);
assert.equal(await p, 'ок');
await clock.tick(10000);
assert.equal(rejected, false, 'таймер обязан сниматься после успешного завершения');` },

      { name: 'sleep отменяется через AbortSignal',
        body: `const controller = new AbortController();
const p = sleep(1000, controller.signal);
const check = assert.rejects(p, 'при отмене sleep должен отклониться');
controller.abort();
await clock.tick(0);
await check;
let finished = false;
sleep(50, controller.signal).catch(function () { finished = true; });
await clock.tick(0);
assert.equal(finished, true, 'уже отменённый сигнал должен отклонять sleep сразу');` },
    ],
  },

  tx47: {
    env: 'worker',
    entry: 'mapSeries',
    starter: `async function mapSeries(items, asyncFn) {
  // ваш код
}`,
    cases: [
      { name: 'возвращает результаты в порядке входного массива',
        body: `const res = await mapSeries([1, 2, 3], async function (x) { return x * 2; });
assert.equal(res, [2, 4, 6]);` },

      { name: 'пустой массив даёт пустой результат',
        body: `assert.equal(await mapSeries([], async function () { return 1; }), []);` },

      { name: 'передаёт в колбэк элемент и его индекс',
        body: `const args = [];
await mapSeries(['a', 'b'], async function (item, index) { args.push([item, index]); return item; });
assert.equal(args, [['a', 0], ['b', 1]]);` },

      { name: 'следующий элемент стартует только после завершения предыдущего',
        body: `const order = [];
const p = mapSeries([1, 2, 3], async function (x) {
  order.push('старт' + x);
  await new Promise(function (r) { setTimeout(r, 10); });
  order.push('финиш' + x);
  return x;
});
await clock.tick(0);
assert.equal(order, ['старт1'], 'все три задачи не должны стартовать сразу');
await clock.tick(10);
await clock.tick(0);
assert.equal(order, ['старт1', 'финиш1', 'старт2']);
await clock.tick(100);
await p;
assert.equal(order, ['старт1', 'финиш1', 'старт2', 'финиш2', 'старт3', 'финиш3']);` },

      { name: 'три задачи по 10 мс занимают 30 мс, а не 10',
        body: `const times = [];
const p = mapSeries([1, 2, 3], function () {
  return new Promise(function (r) {
    setTimeout(function () { times.push(Date.now()); r(); }, 10);
  });
});
await clock.tick(100);
await p;
assert.equal(times, [10, 20, 30], 'map с async-колбэком запустил бы всё параллельно и дал бы [10, 10, 10]');` },

      { name: 'ошибка прерывает обработку и отклоняет общий промис',
        body: `const seen = [];
const p = mapSeries([1, 2, 3], async function (x) {
  seen.push(x);
  if (x === 2) throw new Error('второй упал');
  return x;
});
const err = await assert.rejects(p);
assert.equal(err.message, 'второй упал');
assert.equal(seen, [1, 2], 'после ошибки третий элемент не должен запускаться');` },

      { name: 'работает и с колбэком, возвращающим обычное значение',
        body: `assert.equal(await mapSeries([1, 2], function (x) { return x + 1; }), [2, 3], 'не-промис тоже допустим');` },

      { name: 'вариант через reduce ведёт себя так же',
        body: `assert.ok(typeof mapSeriesReduce === 'function', 'нужна вторая реализация mapSeriesReduce');
const times = [];
const p = mapSeriesReduce([1, 2], function (x) {
  return new Promise(function (r) {
    setTimeout(function () { times.push(Date.now()); r(x * 3); }, 10);
  });
});
await clock.tick(0);
await clock.tick(100);
assert.equal(await p, [3, 6]);
assert.equal(times, [10, 20], 'цепочка через reduce тоже обязана быть последовательной');` },
    ],
  },

  tx48: {
    env: 'worker',
    entry: 'myAllSettled',
    starter: `function myAllSettled(iterable) {
  // ваш код
}

function myRace(iterable) {
  // ваш код
}

function myAny(iterable) {
  // ваш код
}`,
    cases: [
      { name: 'allSettled собирает и успехи, и ошибки',
        body: `const res = await myAllSettled([Promise.resolve(1), Promise.reject(new Error('упал')), 3]);
assert.equal(res.length, 3);
assert.equal(res[0], { status: 'fulfilled', value: 1 });
assert.equal(res[1].status, 'rejected', 'отклонённый промис не должен ронять весь набор');
assert.equal(res[1].reason.message, 'упал');
assert.equal(res[2], { status: 'fulfilled', value: 3 }, 'обычные значения тоже допустимы');` },

      { name: 'allSettled сохраняет порядок входа, а не порядок завершения',
        body: `const slow = new Promise(function (r) { setTimeout(function () { r('медленный'); }, 100); });
const fast = Promise.resolve('быстрый');
const p = myAllSettled([slow, fast]);
await clock.tick(100);
const res = await p;
assert.equal(res.map(function (x) { return x.value; }), ['медленный', 'быстрый'], 'результаты кладутся по индексу, а не через push');` },

      { name: 'allSettled на пустом входе сразу отдаёт пустой массив',
        body: `assert.equal(await myAllSettled([]), []);` },

      { name: 'allSettled принимает любой итерируемый, не только массив',
        body: `const res = await myAllSettled(new Set(['a', 'b']));
assert.equal(res.length, 2);
assert.equal(res.map(function (x) { return x.value; }), ['a', 'b']);` },

      { name: 'race отдаёт результат первого завершившегося',
        body: `assert.ok(typeof myRace === 'function', 'нужна функция myRace');
const p = myRace([
  new Promise(function (r) { setTimeout(function () { r('медленный'); }, 100); }),
  new Promise(function (r) { setTimeout(function () { r('быстрый'); }, 10); })
]);
await clock.tick(100);
assert.equal(await p, 'быстрый');` },

      { name: 'race отклоняется, если первым завершился отклонённый промис',
        body: `const p = myRace([
  new Promise(function (r, j) { setTimeout(function () { j(new Error('упал первым')); }, 10); }),
  new Promise(function (r) { setTimeout(function () { r('поздний успех'); }, 50); })
]);
const check = assert.rejects(p);
await clock.tick(100);
const err = await check;
assert.equal(err.message, 'упал первым');` },

      { name: 'any пропускает ранние ошибки и ждёт первого успеха',
        body: `assert.ok(typeof myAny === 'function', 'нужна функция myAny');
const p = myAny([
  Promise.reject(new Error('первый упал')),
  new Promise(function (r) { setTimeout(function () { r('успех'); }, 10); }),
  Promise.reject(new Error('третий упал'))
]);
await clock.tick(10);
assert.equal(await p, 'успех');` },

      { name: 'any отклоняется AggregateError, когда провалились все',
        body: `const p = myAny([Promise.reject(new Error('a')), Promise.reject(new Error('b'))]);
const check = assert.rejects(p);
const err = await check;
assert.equal(err.name, 'AggregateError');
assert.equal(err.errors.map(function (e) { return e.message; }), ['a', 'b'], 'ошибки собираются в порядке входа');
const empty = await assert.rejects(myAny([]));
assert.equal(empty.name, 'AggregateError', 'на пустом входе any отклоняется сразу');` },
    ],
  },

  tx49: {
    env: 'worker',
    entry: 'createBatcher',
    starter: `// options: { maxBatchSize }
function createBatcher(batchFn, options) {
  // ваш код

  return function load(id) {
    // ваш код
  };
}`,
    cases: [
      { name: 'вызовы за один тик уходят одним батчем',
        body: `const batches = [];
const load = createBatcher(async function (ids) {
  batches.push(ids.slice());
  return ids.map(function (id) { return 'v' + id; });
});
const p = Promise.all([load(1), load(2), load(3)]);
assert.equal(await p, ['v1', 'v2', 'v3']);
assert.equal(batches, [[1, 2, 3]], 'три синхронных вызова должны дать ровно один вызов batchFn');` },

      { name: 'каждому вызывающему достаётся его собственный результат',
        body: `const load = createBatcher(async function (ids) {
  return ids.map(function (id) { return 'пользователь-' + id; });
});
const res = await Promise.all([load(3), load(1), load(2)]);
assert.equal(res, ['пользователь-3', 'пользователь-1', 'пользователь-2'], 'результаты раздаются по позиции id в батче');` },

      { name: 'одинаковые id внутри батча схлопываются',
        body: `const batches = [];
const load = createBatcher(async function (ids) {
  batches.push(ids.slice());
  return ids.map(function (id) { return id * 2; });
});
const res = await Promise.all([load(5), load(5), load(6)]);
assert.equal(batches, [[5, 6]], 'дублирующийся id не должен попадать в запрос дважды');
assert.equal(res, [10, 10, 12], 'оба вызывающих получают один и тот же результат');` },

      { name: 'вызовы в разных тиках попадают в разные батчи',
        body: `const batches = [];
const load = createBatcher(async function (ids) {
  batches.push(ids.slice());
  return ids;
});
const first = load(1);
await first;
const second = load(2);
await second;
assert.equal(batches, [[1], [2]], 'батч не должен собираться между тиками');` },

      { name: 'размер батча ограничивается опцией maxBatchSize',
        body: `const batches = [];
const load = createBatcher(async function (ids) {
  batches.push(ids.slice());
  return ids.map(function (id) { return id * 10; });
}, { maxBatchSize: 2 });
const res = await Promise.all([load(1), load(2), load(3), load(4), load(5)]);
assert.equal(batches, [[1, 2], [3, 4], [5]]);
assert.equal(res, [10, 20, 30, 40, 50], 'остаток очереди должен уехать следующими батчами, а не потеряться');` },

      { name: 'ошибка батча долетает до всех его участников',
        body: `const load = createBatcher(async function () { throw new Error('нет связи'); });
const p1 = load(1);
const p2 = load(2);
const c1 = assert.rejects(p1);
const c2 = assert.rejects(p2);
const e1 = await c1;
const e2 = await c2;
assert.equal(e1.message, 'нет связи');
assert.equal(e2.message, 'нет связи', 'второй вызывающий не должен зависнуть навсегда');` },

      { name: 'одиночный вызов работает так же, как батч',
        body: `const batches = [];
const load = createBatcher(async function (ids) {
  batches.push(ids.slice());
  return ids.map(function (id) { return id + '!'; });
});
assert.equal(await load('a'), 'a!');
assert.equal(batches, [['a']]);` },
    ],
  },

  tx50: {
    env: 'worker',
    entry: 'run',
    starter: `function run(generatorFn) {
  // ваш код
}`,
    cases: [
      { name: 'возвращает промис с итоговым значением генератора',
        body: `const load = run(function* () { return 42; });
const result = load();
assert.ok(result && typeof result.then === 'function', 'run должен вернуть функцию, отдающую промис');
assert.equal(await result, 42);` },

      { name: 'значение разрешённого промиса возвращается в генератор',
        body: `const load = run(function* (x) {
  const a = yield Promise.resolve(x + 1);
  const b = yield Promise.resolve(a * 2);
  return b;
});
assert.equal(await load(1), 4, 'результат yield должен приходить обратно через next(value)');` },

      { name: 'yield обычного значения тоже работает',
        body: `const load = run(function* () {
  const a = yield 5;
  return a + 1;
});
assert.equal(await load(), 6);` },

      { name: 'ошибка промиса ловится обычным try/catch внутри генератора',
        body: `const load = run(function* () {
  try {
    yield Promise.reject(new Error('нет сети'));
    return 'сюда попасть нельзя';
  } catch (e) {
    return 'поймал: ' + e.message;
  }
});
assert.equal(await load(), 'поймал: нет сети', 'ошибку надо отдавать внутрь генератора методом throw');` },

      { name: 'непойманная ошибка промиса отклоняет общий промис',
        body: `const load = run(function* () { yield Promise.reject(new Error('провал')); });
const err = await assert.rejects(load());
assert.equal(err.message, 'провал');` },

      { name: 'синхронное исключение в генераторе превращается в отклонение',
        body: `const load = run(function* () { throw new Error('сломалось сразу'); });
const err = await assert.rejects(load());
assert.equal(err.message, 'сломалось сразу', 'исключение при вызове next тоже должно стать reject, а не улететь наружу');` },

      { name: 'шаги ждут друг друга, а не запускаются разом',
        body: `const times = [];
const load = run(function* () {
  yield new Promise(function (r) { setTimeout(function () { times.push(Date.now()); r(); }, 10); });
  yield new Promise(function (r) { setTimeout(function () { times.push(Date.now()); r(); }, 10); });
  return 'готово';
});
const p = load();
await clock.tick(100);
assert.equal(await p, 'готово');
assert.equal(times, [10, 20], 'второй yield должен стартовать только после первого');` },

      { name: 'аргументы и контекст вызова долетают до генератора',
        body: `const sum = run(function* (a, b) { return a + b; });
assert.equal(await sum(2, 3), 5);
const obj = { name: 'контекст', read: run(function* () { return this.name; }) };
assert.equal(await obj.read(), 'контекст', 'this должен долетать до тела генератора');` },
    ],
  },
};
