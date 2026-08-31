const DECK_TS_EXTRA = [
  { id: 'tsx1',
    q: 'Что такое user-defined type guard и чем он опасен?',
    a: `<p>Функция с возвращаемым типом <code>x is T</code> — предикат, который сообщает компилятору результат сужения. Внутри самой функции TS <strong>не проверяет</strong>, что логика действительно соответствует предикату: тело может вернуть <code>true</code> для чего угодно, и это скомпилируется. То есть type guard — это <strong>обещание</strong> разработчика, ровно такое же по надёжности, как <code>as</code>, просто локализованное в одном месте.</p>
    <ul><li>Плюс: точка недоверия одна, её легко покрыть тестами и заменить на схему валидации.</li>
    <li>Минус: рассинхрон с реальностью не ловится компилятором — классический баг после рефакторинга модели.</li>
    <li>С TS 5.5 появился <strong>вывод предикатов</strong>: если функция просто возвращает булево выражение над параметром, компилятор сам выведет <code>x is T</code>, и <code>arr.filter(isDefined)</code> начал работать без явной аннотации.</li></ul>
    <p>Для внешних данных предикат руками писать не стоит — лучше zod/valibot, где предикат генерируется из схемы и не расходится с типом.</p>`,
    code: `function isUser(v: unknown): v is User {
  return typeof v === 'object' && v !== null && 'id' in v;
}

// TS 5.5: предикат выводится сам
const notNull = (x: string | null) => x !== null;
const clean = ['a', null].filter(notNull); // string[]`,
    tip: 'Скажите, что предикат — это as с человеческим лицом, и что с 5.5 многие ручные предикаты стали не нужны.' },

  { id: 'tsx2',
    q: 'Что такое assertion function и чем она отличается от type guard?',
    a: `<p>Assertion function объявляется как <code>asserts x is T</code> (или <code>asserts x</code>) и не возвращает значение: она либо кидает исключение, либо помечает переменную как сужённую <strong>для всего остального кода после вызова</strong>, а не только внутри <code>if</code>. Это удобно для инвариантов: <code>assertNever</code>, <code>invariant</code>, проверка конфигов на старте.</p>
    <ul><li>Жёсткое ограничение: assertion-функцию нельзя вызвать через переменную без явной аннотации типа — TS требует, чтобы вызываемое было объявленной сущностью (const с явным типом или function declaration). Иначе ошибка «Assertions require every name in the call target to have an explicit type annotation».</li>
    <li>Не работает с методами объекта в общем случае и не переживает деструктуризацию.</li>
    <li>Как и предикат, компилятором не верифицируется — гарантия только на совести автора.</li></ul>`,
    code: `function assertDefined<T>(v: T, msg?: string): asserts v is NonNullable<T> {
  if (v == null) throw new Error(msg ?? 'expected value');
}

const el = document.querySelector('#root');
assertDefined(el);
el.classList.add('ok'); // Element, не null`,
    tip: 'Упомяните ошибку про explicit type annotation — её ловят почти все, кто впервые пишет invariant как стрелочную функцию.' },

  { id: 'tsx3',
    q: 'Какими встроенными способами сужается тип и где у каждого ловушки?',
    a: `<p>Сужение работает через control flow analysis: <code>typeof</code>, <code>instanceof</code>, <code>in</code>, literal-сравнения, <code>Array.isArray</code>, truthiness и discriminant.</p>
    <ul><li><code>typeof null === 'object'</code> — классическая дыра: <code>typeof x === 'object'</code> не исключает null.</li>
    <li>Truthiness съедает пустую строку, 0 и NaN: <code>if (str)</code> сужает не так, как <code>if (str !== undefined)</code>.</li>
    <li><code>instanceof</code> ломается через realm-границы (iframe, worker, vm) и на транспилированных классах.</li>
    <li><code>in</code> сужает union по наличию ключа, но не отличает <code>undefined</code>-значение от отсутствия ключа; с TS 4.9 <code>in</code> ещё и добавляет ключ в тип <code>unknown</code>-подобных значений.</li>
    <li><code>Array.isArray</code> на <code>ReadonlyArray</code> даёт <code>any[]</code> в старых lib.d.ts — проверяйте сигнатуру.</li></ul>
    <p>Сужение живёт только до первой операции, которую анализ не может отследить: присваивание из другой функции, await, вызов колбэка.</p>`,
    tip: 'Хорошо звучит фраза: сужение — это статическая модель потока управления, и она консервативна там, где не может доказать неизменность.' },

  { id: 'tsx4',
    q: 'Почему тип «разсуживается» внутри колбэка и как с этим жить?',
    a: `<p>Сужение основано на предположении, что переменная не изменилась. Для <code>let</code> и для свойств объекта компилятор не может доказать неизменность через границу функции: любой вызов может переприсвоить значение, а колбэк может быть выполнен позже. Поэтому внутри стрелки TS откатывает переменную к объявленному типу.</p>
    <ul><li>Свойства объекта (<code>obj.value</code>) разсуживаются почти всегда после вызова любой функции — компилятор не отслеживает алиасинг.</li>
    <li><code>const</code>-переменная примитива сужение сохраняет; <code>let</code> — нет.</li>
    <li>С TS 4.4 работает <strong>aliased condition</strong>: результат проверки, сохранённый в <code>const</code>, сужает переменную.</li></ul>
    <p>Лечится копированием в локальный <code>const</code> перед колбэком, деструктуризацией или явным предикатом. Массовое лечение через <code>!</code> — плохой знак на интервью.</p>`,
    code: `let v: string | null = get();
if (v !== null) {
  setTimeout(() => v.length, 0); // ошибка: v может стать null
}

const local = v;
if (local !== null) {
  setTimeout(() => local.length, 0); // ок
}`,
    tip: 'Ключевая фраза: TS не делает escape-анализ и не отслеживает алиасинг, поэтому консервативно сбрасывает сужение.' },

  { id: 'tsx5',
    q: 'Как работают ограничения дженериков и вывод типов? Где обычно теряется точность?',
    a: `<p><code>T extends C</code> — одновременно ограничение и подсказка для вывода. Компилятор собирает кандидатов из позиций вывода, выбирает общий супертип и затем проверяет ограничение. Точность теряется в трёх местах.</p>
    <ul><li><strong>Расширение литералов</strong>: без ограничения <code>T extends string</code> аргумент <code>'a'</code> выведется как <code>string</code>. Ограничение на литеральный супертип заставляет вывести литерал.</li>
    <li><strong>Порядок кандидатов</strong>: если <code>T</code> встречается и в возвращаемом типе, и в параметре, вывод идёт по параметру; возвратный тип — не источник вывода, а только контекст (contextual typing идёт снаружи внутрь).</li>
    <li><strong>Дефолт против вывода</strong>: <code>T = X</code> применяется только когда кандидатов нет вообще, а не когда вывод неудачен.</li></ul>
    <p>Отдельная беда — «дженерик ради дженерика»: если <code>T</code> используется в сигнатуре ровно один раз, он не даёт связи между входом и выходом и должен быть заменён на обычный тип.</p>`,
    code: `declare function pick<T extends string>(v: T): T;
pick('a'); // 'a' — литерал сохранён

declare function bad<T>(v: T): void; // T использован один раз — бессмысленно`,
    tip: 'Правило «дженерик должен появляться минимум дважды» — короткий и сильный ответ на вопрос про плохие сигнатуры.' },

  { id: 'tsx6',
    q: 'Что такое NoInfer и зачем управлять источниками вывода?',
    a: `<p><code>NoInfer&lt;T&gt;</code> (TS 5.4) помечает позицию как <strong>не участвующую в выводе</strong>: кандидат оттуда не берётся, но проверка присваиваемости остаётся. Классический кейс — функция, где один аргумент задаёт множество, а второй должен быть его элементом.</p>
    <ul><li>Без <code>NoInfer</code> второй аргумент расширяет <code>T</code>, и ошибки не будет: <code>createSet(['a','b'], 'c')</code> выведет <code>T = 'a'|'b'|'c'</code>.</li>
    <li>С <code>NoInfer</code> <code>T</code> выводится только из первого аргумента, и <code>'c'</code> честно падает.</li>
    <li>До 5.4 тот же эффект достигался хаком <code>T &amp; {}</code> или вторым фиктивным параметром — на интервью это хорошо показывает возраст знаний.</li></ul>`,
    code: `declare function createSet<T extends string>(
  items: T[], initial: NoInfer<T>
): Set<T>;

createSet(['a', 'b'], 'c'); // ошибка, как и хотелось`,
    tip: 'Свяжите NoInfer с реальной задачей — типобезопасные роуты, i18n-ключи, варианты дизайн-системы.' },

  { id: 'tsx7',
    q: 'Что делают const type parameters и когда они лучше as const на месте вызова?',
    a: `<p><code>&lt;const T&gt;</code> (TS 5.0) заставляет компилятор выводить аргумент так, как будто на месте вызова написан <code>as const</code>: литералы не расширяются, массивы становятся readonly-кортежами. Ответственность переносится с потребителя API на автора API.</p>
    <ul><li>Работает только для позиций вывода из литеральных выражений; переменную, объявленную заранее, это не «дозаморозит».</li>
    <li>Тип станет <code>readonly</code>, поэтому ограничение должно быть <code>readonly unknown[]</code>, а не <code>unknown[]</code> — иначе вызов перестанет проходить.</li>
    <li>Хорошо для конфигов, роутеров, схем таблиц; плохо для больших объектов — заметно раздувает тип и время проверки.</li></ul>`,
    code: `declare function route<const T extends readonly string[]>(p: T): T;
const r = route(['users', 'id']); // readonly ['users', 'id']`,
    tip: 'Фраза «const type parameter убирает as const из пользовательского кода» — ровно то, что хотят услышать.' },

  { id: 'tsx8',
    q: 'Расскажите про вариантность в TypeScript и что меняет strictFunctionTypes.',
    a: `<p>Вариантность описывает, как отношение подтипов у <code>T</code> переносится на <code>F&lt;T&gt;</code>. В TS она не объявляется, а <strong>выводится структурно</strong>.</p>
    <ul><li><strong>Ковариантность</strong> — по возвращаемым значениям и по свойствам: <code>Dog[]</code> присваивается <code>Animal[]</code> (и это дыра — массивы в TS ковариантны и потому небезопасны при записи).</li>
    <li><strong>Контравариантность</strong> — по параметрам функции: функция, принимающая <code>Animal</code>, безопасно подставляется туда, где ждут функцию с <code>Dog</code>.</li>
    <li><code>strictFunctionTypes</code> (часть <code>strict</code>) включает контравариантную проверку параметров для <strong>функциональных типов</strong>. Но она сознательно <strong>не применяется к методам</strong>, объявленным сокращённым синтаксисом — там осталась бивариантность ради совместимости с DOM и Array.</li></ul>
    <p>Практический вывод: обработчики событий пишите как свойства-функции, если хотите строгую проверку.</p>`,
    code: `type Fn = (a: Animal) => void;
let f: (a: Dog) => void = (d) => d.bark();
const g: Fn = f; // ошибка при strictFunctionTypes

interface Bi { on(a: Dog): void }   // метод — бивариантен, ошибки не будет`,
    tip: 'Отдельно упомяните, что ковариантность массивов — известный компромисс, а не баг компилятора.' },

  { id: 'tsx9',
    q: 'Зачем нужны аннотации вариантности in/out и когда их писать?',
    a: `<p>С TS 4.7 можно явно писать <code>in</code> (контравариантный), <code>out</code> (ковариантный) и <code>in out</code> (инвариантный) у параметров типа. Это <strong>не меняет</strong> семантику проверки в общем случае, а даёт две вещи.</p>
    <ul><li><strong>Скорость</strong>: компилятор перестаёт выводить вариантность структурно для сложных рекурсивных типов — это заметно на больших дженериках и взаимно-рекурсивных структурах.</li>
    <li><strong>Документация и защита</strong>: если реальное использование противоречит аннотации, TS выдаст ошибку прямо в объявлении, а не в далёком месте применения.</li></ul>
    <p>Писать стоит в библиотечных типах и в d.ts; в прикладном коде это почти всегда преждевременная оптимизация.</p>`,
    code: `interface State<in out T> { get(): T; set(v: T): void }
interface Producer<out T> { get(): T }
interface Consumer<in T> { set(v: T): void }`,
    tip: 'Правильный акцент: главный мотив фичи — производительность компилятора, а не строгость.' },

  { id: 'tsx10',
    q: 'Чем тип метода отличается от свойства-функции и что такое bivariance hack?',
    a: `<p>Две записи выглядят одинаково, но проверяются по-разному:</p>
    <ul><li><code>on(cb: Dog): void</code> — метод, параметры проверяются <strong>бивариантно</strong> даже при <code>strictFunctionTypes</code>.</li>
    <li><code>on: (cb: Dog) =&gt; void</code> — свойство, параметры <strong>контравариантны</strong>, проверка строгая.</li></ul>
    <p>Так называемый bivariance hack — это осознанное объявление члена методом, чтобы <strong>ослабить</strong> проверку. Он используется в типах React (<code>React.Component</code>, старые типы событий), в типах массива (<code>push</code>, <code>filter</code>) и в тех API, где строгость сделала бы библиотеку неудобной. Обратный приём — переписать метод в свойство, чтобы включить строгость точечно.</p>
    <p>Senior-ответ: это не баг, а компромисс между звучностью типовой системы и практичностью для существующих JS-библиотек.</p>`,
    code: `interface Strict { handle: (e: MouseEvent) => void }  // контравариантно
interface Loose  { handle(e: MouseEvent): void }        // бивариантно`,
    tip: 'Хорошо добавить: если в код-ревью хочется строгости у колбэков — переводите методы в свойства.' },

  { id: 'tsx11',
    q: 'Как связаны keyof, typeof и indexed access types? Приведите нетривиальный пример.',
    a: `<p><code>typeof x</code> в type-позиции поднимает значение в тип, <code>keyof T</code> даёт union ключей, <code>T[K]</code> — тип значения по ключу. Вместе они позволяют выводить типы <strong>из данных</strong>, а не дублировать их.</p>
    <ul><li><code>T[keyof T]</code> — union всех значений; на <code>as const</code>-объекте это заменяет enum.</li>
    <li><code>T[number]</code> на массиве/кортеже даёт тип элемента — база для «union из массива».</li>
    <li><code>keyof</code> на объекте с числовыми ключами вернёт <code>number</code>, а не строки; <code>keyof any</code> — это <code>string | number | symbol</code>.</li>
    <li>Индексная сигнатура делает <code>keyof T</code> бесполезно широким (<code>string</code>), что рушит точность мапперов — частая причина, почему «мой Record ничего не проверяет».</li></ul>`,
    code: `const ROLES = ['admin', 'user'] as const;
type Role = typeof ROLES[number]; // 'admin' | 'user'

const cfg = { host: 'x', port: 1 } as const;
type Key = keyof typeof cfg;      // 'host' | 'port'
type Port = typeof cfg['port'];   // 1`,
    tip: 'Скажите, что это основной приём «single source of truth»: константа рантайма порождает тип, а не наоборот.' },

  { id: 'tsx12',
    q: 'Что такое перемаппинг ключей через as в mapped types и какие задачи он решает?',
    a: `<p>Синтаксис <code>{ [K in keyof T as NewKey]: ... }</code> (TS 4.1) позволяет <strong>переименовывать</strong> и <strong>фильтровать</strong> ключи. Возврат <code>never</code> из выражения ключа удаляет свойство — это идиоматический способ отсеять члены по типу значения или по имени.</p>
    <ul><li>Генерация геттеров/сеттеров и имён событий вместе с template literal types.</li>
    <li>Выбор только методов или только не-функций из типа.</li>
    <li>Приведение к DTO: убрать приватные поля, переименовать snake_case в camelCase.</li></ul>
    <p>Важные детали: модификаторы <code>+/-readonly</code> и <code>+/-?</code> применяются здесь же; гомоморфность (сохранение опциональности и readonly) теряется, если писать <code>K in keyof T as ...</code> с изменением ключа, поэтому такие мапперы часто «съедают» <code>?</code>.</p>`,
    code: `type Getters<T> = {
  [K in keyof T & string as 'get' | Capitalize<K>]: () => T[K]
};

type OnlyFns<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K]
};`,
    tip: 'Упомяните потерю гомоморфности — этот нюанс отличает того, кто писал такие типы, от того, кто читал про них.' },

  { id: 'tsx13',
    q: 'Что такое template literal types и где они реально полезны?',
    a: `<p>Это типы-строки, собираемые из литералов и плейсхолдеров; при подстановке union они <strong>дистрибутивно разворачиваются</strong> в декартово произведение. Плюс встроенные интринзики <code>Uppercase</code>, <code>Lowercase</code>, <code>Capitalize</code>, <code>Uncapitalize</code>.</p>
    <ul><li>Типобезопасные пути к вложенным полям, ключи i18n, имена CSS-переменных и токенов дизайн-системы.</li>
    <li>Парсинг строк на уровне типов через <code>infer</code>: разбор роута <code>/users/:id</code> в объект параметров.</li>
    <li>Тайпчек событий: <code>on</code> плюс имя поля.</li></ul>
    <p>Главная опасность — комбинаторный взрыв: произведение двух union по 50 элементов — это 2500 литералов, а трёх — уже сотни тысяч, и компилятор упирается в лимит 100000 членов union. В горячих типах лучше ограничивать глубину и не разворачивать всё сразу.</p>`,
    code: `type Ev<T extends string> = \`on\${Capitalize<T>}\`;
type A = Ev<'click' | 'focus'>; // 'onClick' | 'onFocus'

type Params<S extends string> =
  S extends \`\${string}:\${infer P}/\${infer R}\` ? P | Params<R>
  : S extends \`\${string}:\${infer P}\` ? P
  : never;`,
    tip: 'Назовите лимит в 100000 членов union — это конкретика, которая сразу отличает практика.' },

  { id: 'tsx14',
    q: 'Как писать рекурсивные типы и где у них предел?',
    a: `<p>Рекурсия по типам работает через conditional types, которые ссылаются на себя. Типичные задачи: <code>DeepPartial</code>, <code>DeepReadonly</code>, пути к вложенным ключам, разбор строк, кортежная арифметика.</p>
    <ul><li>Лимит глубины инстанцирования — порядка 50 уровней для не-хвостовой рекурсии; с TS 4.5 есть <strong>tail-recursion elimination</strong> для conditional types, поднимающий предел до тысяч шагов, но только если рекурсивный вызов стоит в хвостовой позиции ветки.</li>
    <li>Ошибка «Type instantiation is excessively deep and possibly infinite» — сигнал переписать в хвостовую форму с аккумулятором.</li>
    <li>Отложенное вычисление достигается обёрткой в условный тип, иначе TS попытается развернуть всё сразу.</li>
    <li>Рекурсия по объектам должна отсекать <code>Date</code>, <code>Map</code>, функции и массивы, иначе <code>DeepPartial</code> испортит их.</li></ul>`,
    code: `type DeepReadonly<T> =
  T extends (infer U)[] ? readonly DeepReadonly<U>[]
  : T extends Function | Date ? T
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;`,
    tip: 'Упоминание tail-recursion elimination из TS 4.5 и аккумулятора — заметный плюс.' },

  { id: 'tsx15',
    q: 'Что такое дистрибутивность conditional types и когда она мешает?',
    a: `<p>Если проверяемый тип — <strong>голый параметр</strong> (<code>T extends X ? A : B</code>, где T не обёрнут), то при подстановке union условие применяется к каждому члену отдельно, а результаты объединяются. Именно так работает <code>Exclude</code>, <code>Extract</code>, <code>NonNullable</code>.</p>
    <ul><li><code>T = never</code> при дистрибутивности даёт <code>never</code> — union из нуля членов. Это ломает наивные проверки вида «пустой ли тип».</li>
    <li>Дистрибутивность нежелательна, когда нужно рассуждать о union как о целом: проверка «является ли T объединением», <code>UnionToIntersection</code>, точное сравнение типов.</li>
    <li>Отключается обёрткой в кортеж: <code>[T] extends [X] ? A : B</code>.</li></ul>`,
    code: `type IsString<T> = T extends string ? true : false;
type A = IsString<string | number>; // boolean (true | false)

type IsStringStrict<T> = [T] extends [string] ? true : false;
type B = IsStringStrict<string | number>; // false
type C = IsString<never>; // never, а не false`,
    tip: 'Случай T = never — любимая ловушка интервьюеров, назовите его сами.' },

  { id: 'tsx16',
    q: 'Как написать корректный тип «равны ли два типа» и почему это сложно?',
    a: `<p>Наивное <code>A extends B &amp;&amp; B extends A</code> не различает <code>any</code> и остальные типы и путается на union из-за дистрибутивности. Каноническое решение опирается на <strong>внутреннее сравнение отложенных условных типов</strong>: две одинаковые обобщённые функции сравниваются как идентичные только при полном совпадении типов.</p>
    <ul><li>Это неспецифицированное поведение компилятора, а не часть языка — оно менялось между версиями.</li>
    <li>Приём с оборачиванием в кортеж <code>[T] extends [U]</code> убирает дистрибутивность, но не решает <code>any</code>.</li>
    <li>На практике такой Equals нужен почти исключительно для type-тестов (<code>expectTypeOf</code>, <code>tsd</code>), а не для прода.</li></ul>`,
    code: `type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

type A = Equals<any, unknown>;      // false
type B = Equals<{a: 1}, {a: 1}>;    // true`,
    tip: 'Подчеркните, что трюк опирается на деталь реализации компилятора — это честный и сильный ответ.' },

  { id: 'tsx17',
    q: 'Где может стоять infer и что даёт infer extends?',
    a: `<p><code>infer</code> объявляет переменную типа в правой части <code>extends</code> внутри условного типа. Позиции разные, и от позиции зависит стратегия вывода.</p>
    <ul><li><strong>Возвращаемое значение</strong> — ковариантная позиция, при нескольких кандидатах берётся union: <code>T extends () =&gt; infer R</code>.</li>
    <li><strong>Параметры</strong> — контравариантная позиция, кандидаты пересекаются: отсюда классический трюк <code>UnionToIntersection</code>.</li>
    <li><strong>Элементы кортежа</strong> с rest: <code>[infer H, ...infer R]</code> — база для рекурсии по кортежам.</li>
    <li><strong>В template literal</strong>: парсинг строк на уровне типов.</li>
    <li><code>infer R extends number</code> (TS 4.8) добавляет ограничение прямо в вывод: неподходящая ветка отсекается, а для строковых литералов это ещё и приводит тип (<code>infer N extends number</code> в шаблоне даст числовой литерал вместо строкового).</li></ul>`,
    code: `type Ret<T> = T extends (...a: any[]) => infer R ? R : never;
type Head<T> = T extends [infer H, ...unknown[]] ? H : never;

type ToNum<S> = S extends \`\${infer N extends number}\` ? N : never;
type N = ToNum<'42'>; // 42, число`,
    tip: 'Контравариантная позиция параметра и UnionToIntersection — тот пример, который показывает реальное понимание.' },

  { id: 'tsx18',
    q: 'Когда использовать overloads, а когда union или дженерик?',
    a: `<p>Overloads описывают набор допустимых пар «аргументы — результат», когда связь между ними <strong>не выражается</strong> одной сигнатурой. Реализационная сигнатура невидима снаружи и компилятором против перегрузок почти не проверяется — это дыра, сравнимая с <code>as</code>.</p>
    <ul><li>Разрешение перегрузок — <strong>первое совпадение сверху вниз</strong>, без выбора «наиболее подходящей». Порядок важен: узкие сигнатуры ставим первыми.</li>
    <li>Overloads плохо работают со spread-аргументами и с union на входе: <code>f(a: string | number)</code> не подойдёт ни к одной перегрузке, хотя каждая по отдельности валидна.</li>
    <li>Часто лучше conditional return type на дженерике или discriminated union параметров-объектов — они дружат с union и с частичным применением.</li>
    <li>Условный возвращаемый тип, в свою очередь, плохо проверяется внутри реализации и обычно требует <code>as any</code> в теле — компромисс осознанный.</li></ul>`,
    code: `function get(k: 'a'): number;
function get(k: 'b'): string;
function get(k: string): unknown { return null as never; }

// альтернатива
declare function get2<K extends keyof M>(k: K): M[K];`,
    tip: 'Фраза «перегрузки не поддерживают union на входе» — конкретная боль, которую узнают все, кто их писал.' },

  { id: 'tsx19',
    q: 'Что реально даёт readonly и as const, и чего они не дают?',
    a: `<p><code>readonly</code> — <strong>исключительно compile-time</strong> ограничение: рантайма нет, объект не заморожен, а через ссылку с изменяемым типом его можно править. Более того, тип с <code>readonly</code>-свойствами <strong>присваивается</strong> изменяемому типу (readonly-модификаторы игнорируются при проверке присваиваемости объектов), так что защита протекает.</p>
    <ul><li><code>ReadonlyArray</code> и <code>readonly T[]</code> ведут себя строже: изменяемый массив присваивается readonly-массиву, но не наоборот.</li>
    <li><code>as const</code> делает три вещи: сужает литералы, помечает всё <code>readonly</code> рекурсивно и превращает массивы в кортежи. Он не работает на выражениях с вычислениями и не заменяет <code>Object.freeze</code>.</li>
    <li>Комбинация <code>as const</code> плюс <code>typeof</code> плюс <code>[number]</code> — стандартный способ иметь одно определение для рантайма и типов.</li></ul>`,
    code: `const a: readonly number[] = [1, 2];
const b: number[] = a; // ошибка

type P = { readonly x: number };
const p: { x: number } = { x: 1 } as P; // проходит — дыра`,
    tip: 'Назовите то, что readonly-свойства не влияют на присваиваемость объектов — этого почти никто не помнит.' },

  { id: 'tsx20',
    q: 'Что делает Awaited и почему он оказался нетривиальным?',
    a: `<p><code>Awaited&lt;T&gt;</code> (TS 4.5) моделирует поведение <code>await</code>: рекурсивно разворачивает вложенные промисы и корректно обрабатывает thenable-объекты, union и не-промисы. Наивный <code>T extends Promise&lt;infer U&gt; ? U : T</code> ломается на <code>Promise&lt;Promise&lt;X&gt;&gt;</code>, на пользовательских thenable и на <code>any</code>.</p>
    <ul><li><code>Awaited&lt;ReturnType&lt;typeof fn&gt;&gt;</code> — стандартный способ вытащить тип данных из асинхронного загрузчика.</li>
    <li><code>Promise.all</code> типизирован через <code>Awaited</code> по кортежу, поэтому сохраняет позиции; <code>Promise.allSettled</code> даёт union со статусом и требует сужения по <code>status</code>.</li>
    <li>Тонкость: <code>await</code> на не-промисе всё равно откладывает выполнение на микротаск, но типово это no-op — типы не отражают тайминг.</li></ul>`,
    code: `type Data = Awaited<ReturnType<typeof loadUser>>;

const rs = await Promise.allSettled([a(), b()]);
const ok = rs.filter((r) => r.status === 'fulfilled');`,
    tip: 'Пример с Promise.allSettled и сужением по status показывает, что вы работали с этим в проде.' },

  { id: 'tsx21',
    q: 'Как типизировать this в TypeScript?',
    a: `<p>Есть четыре механизма, и их часто путают.</p>
    <ul><li><strong>Параметр this</strong>: фиктивный первый параметр <code>function f(this: HTMLElement, e: Event)</code> — не существует в рантайме, но проверяется при вызове и при присваивании обработчиков.</li>
    <li><strong>Polymorphic this</strong>: тип <code>this</code> внутри класса означает «тип текущего наследника» — база для fluent-API и для того, чтобы методы цепочки возвращали подкласс.</li>
    <li><strong>ThisType&lt;T&gt;</strong>: маркерный тип, задающий контекст <code>this</code> внутри объектных литералов; работает только при <code>noImplicitThis</code> и используется в Vue Options API и подобных фабриках.</li>
    <li><strong>noImplicitThis</strong>: флаг, без которого <code>this</code> в свободных функциях молча становится <code>any</code>.</li></ul>
    <p>Стрелочные функции <code>this</code> не имеют — им параметр <code>this</code> объявить нельзя, и это правильный способ избежать всей темы.</p>`,
    code: `class Q { where(): this { return this } }
class Sub extends Q { limit(): this { return this } }
new Sub().where().limit(); // работает благодаря polymorphic this

declare function on(
  el: Element, cb: (this: Element, e: Event) => void
): void;`,
    tip: 'Упомяните, что параметр this стирается при компиляции — это первый вопрос-подвох после ответа.' },

  { id: 'tsx22',
    q: 'Что такое declaration merging и какие правила слияния важно помнить?',
    a: `<p>TS объединяет несколько объявлений с одним именем в одной области видимости. Сливаются interface с interface, namespace с namespace, а также namespace с class, function или enum.</p>
    <ul><li>Интерфейсы сливаются аддитивно; конфликтующие свойства с разными типами — ошибка, а вот <strong>методы с разными сигнатурами превращаются в перегрузки</strong>, причём объявления из более поздних файлов идут первыми.</li>
    <li><code>type</code> НЕ сливается — это принципиальное отличие от <code>interface</code> и главная причина, по которой публичные API библиотек объявляют интерфейсами.</li>
    <li>Слияние namespace с функцией даёт «функция со статическими свойствами» — так типизируются jQuery-подобные API.</li>
    <li>Внутри namespace сливаются только <code>export</code>-члены.</li></ul>`,
    code: `interface Box { a: string }
interface Box { b: number }   // Box = { a: string; b: number }

function greet(n: string) {}
namespace greet { export const version = '1.0' }`,
    tip: 'Связка «расширяемость — причина, почему библиотеки выставляют interface, а не type» — сильный вывод.' },

  { id: 'tsx23',
    q: 'Как работает module augmentation и когда он необходим?',
    a: `<p>Это расширение типов чужого модуля из своего кода: <code>declare module 'lib'</code> внутри файла-модуля добавляет члены в существующее объявление вместо создания нового. Без хотя бы одного <code>import</code>/<code>export</code> в файле объявление станет глобальным ambient-модулем и <strong>перезатрёт</strong> типы библиотеки — это самая частая ошибка.</p>
    <ul><li>Типовые кейсы: поля в <code>Request</code> у Express, кастомные темы в styled-components/MUI, свои переменные окружения, расширение <code>Window</code> и <code>globalThis</code>.</li>
    <li>Расширять можно только то, что объявлено интерфейсом или namespace: добавить свойство в <code>type</code> из библиотеки нельзя.</li>
    <li>Аугментация глобальна для всей программы, поэтому в монорепе она легко создаёт неявную связанность между пакетами — держите такие файлы в одном месте и явно включайте в <code>types</code>.</li></ul>`,
    code: `import 'express';
declare module 'express-serve-static-core' {
  interface Request { user?: { id: string } }
}

declare global {
  interface Window { __APP_STATE__?: unknown }
}
export {};`,
    tip: 'Скажите про export {} для превращения файла в модуль — на этом спотыкается большинство.' },

  { id: 'tsx24',
    q: 'Нужны ли namespace в 2025 году и где они всё ещё оправданы?',
    a: `<p>Для организации кода — нет: ES-модули полностью их вытеснили, а <code>namespace</code> с генерацией кода (не-<code>declare</code>) конфликтует с <code>isolatedModules</code> и мешает tree-shaking. Официальная рекомендация — не использовать их в новом прикладном коде.</p>
    <p>Где они остаются уместны:</p>
    <ul><li>В <strong>.d.ts</strong> для описания UMD-библиотек и глобальных сущностей (<code>declare namespace NodeJS</code>, <code>declare namespace JSX</code>).</li>
    <li>Для слияния с функцией/классом, чтобы дать типам «пространство имён» рядом со значением: <code>Foo.Props</code>.</li>
    <li>Для группировки типов внутри одного публичного объявления, когда экспорт множества плоских имён загрязняет API.</li></ul>
    <p>Замена в модульном коде — обычный именованный экспорт плюс <code>import * as X</code>.</p>`,
    code: `declare namespace MyLib {
  interface Options { debug?: boolean }
}
declare function MyLib(o?: MyLib.Options): void;`,
    tip: 'Разделение «namespace в .d.ts — нормально, namespace в .ts — легаси» — правильная формулировка.' },

  { id: 'tsx25',
    q: 'Как типизировать внешнюю библиотеку без типов? Что важно в .d.ts?',
    a: `<p>Порядок действий: проверить, есть ли типы в пакете (<code>types</code>/<code>exports</code> в package.json), затем <code>@types/*</code> из DefinitelyTyped, и только потом писать свои.</p>
    <ul><li>Быстрая заглушка — <code>declare module 'lib';</code> (всё станет <code>any</code>) или файл с точечным описанием нужных экспортов. Заглушку кладём в <code>src/types</code> и включаем в <code>include</code>, а не в <code>typeRoots</code>.</li>
    <li>В .d.ts не должно быть исполняемого кода; <code>export =</code> нужен для CommonJS-библиотек и требует <code>esModuleInterop</code> у потребителя.</li>
    <li>Для современных пакетов ключевое — поле <code>exports</code> с условиями и корректный <code>moduleResolution: node16/bundler</code>: типы обязаны разрешаться по тем же условиям, что и рантайм, иначе получите «работает в рантайме, не резолвится в типах».</li>
    <li>Публикуя свои типы, проверяйте их через <code>arethetypeswrong</code> и не тащите зависимости из <code>devDependencies</code> в публичные сигнатуры.</li></ul>`,
    code: `// src/types/legacy-lib.d.ts
declare module 'legacy-lib' {
  export interface Options { retries?: number }
  export default function run(o?: Options): Promise<void>;
}`,
    tip: 'Упоминание arethetypeswrong и dual-package hazard сразу выдаёт человека, который публиковал пакеты.' },

  { id: 'tsx26',
    q: 'Как правильно типизировать переменные окружения и глобальные объекты?',
    a: `<p>По умолчанию <code>process.env.X</code> имеет тип <code>string | undefined</code>, а <code>import.meta.env</code> в Vite — набор из <code>ImportMetaEnv</code>. Соблазн объявить их как <code>string</code> опасен: он маскирует отсутствие переменной в проде.</p>
    <ul><li>Правильный подход — <strong>валидировать один раз на старте</strong> схемой (zod) и экспортировать типизированный объект; все обращения идут через него.</li>
    <li>Аугментация <code>NodeJS.ProcessEnv</code> или <code>ImportMetaEnv</code> уместна как дополнение, а не как замена валидации.</li>
    <li>Глобальные значения из SSR (<code>window.__STATE__</code>) объявляем через <code>declare global</code> и типом <code>unknown</code>, а не готовой моделью, — данные пришли из HTML и по сути недоверенные.</li>
    <li>Помните, что бандлер делает статическую подстановку строк: <code>process.env[key]</code> с вычисляемым ключом не будет заменён и упадёт в браузере.</li></ul>`,
    code: `const Env = z.object({ API_URL: z.string().url() });
export const env = Env.parse(import.meta.env);

declare global {
  interface ImportMetaEnv { readonly API_URL: string }
}`,
    tip: 'Мысль «типы не проверяют наличие переменной в рантайме, поэтому нужен parse на старте» — то, что хотят услышать.' },

  { id: 'tsx27',
    q: 'Как типизировать дженерик-компонент в React, включая forwardRef и полиморфный as?',
    a: `<p>Обычный дженерик-компонент работает: <code>function List&lt;T&gt;(p: Props&lt;T&gt;)</code> выведет <code>T</code> из пропсов. Проблемы начинаются с обёрток.</p>
    <ul><li><code>forwardRef</code> теряет дженерик, потому что его сигнатура возвращает не-дженерик тип. Решения: приведение результата через <code>as</code> к нужной дженерик-сигнатуре, либо (React 19) просто принимать <code>ref</code> как обычный проп и не использовать forwardRef вовсе.</li>
    <li><code>memo</code> имеет ту же проблему; лечится тем же приведением или объявлением <code>const M = memo(C) as typeof C</code>.</li>
    <li>Полиморфный <code>as</code> требует <code>ElementType</code>, <code>ComponentPropsWithoutRef&lt;E&gt;</code> и вычитания собственных пропсов; это дорого для компилятора и заметно ухудшает подсказки в IDE — в дизайн-системах часто ограничивают набор допустимых элементов union-ом вместо полного полиморфизма.</li>
    <li>В .tsx стрелочный дженерик требует запятой: <code>&lt;T,&gt;(...)</code>, иначе парсер видит JSX-тег.</li></ul>`,
    code: `type Props<T> = { items: T[]; render: (i: T) => React.ReactNode };
export function List<T>({ items, render }: Props<T>) {
  return <>{items.map(render)}</>;
}`,
    tip: 'Скажите, что в React 19 forwardRef больше не нужен — это снимает половину боли с дженериками.' },

  { id: 'tsx28',
    q: 'Зачем zod, если есть типы? Где граница между статикой и рантаймом?',
    a: `<p>Типы стираются при компиляции, поэтому любая точка входа данных извне — сеть, localStorage, URL, postMessage, конфиг, форма — статически не защищена. <code>as ApiResponse</code> здесь ровно ничего не гарантирует. Схема даёт <strong>одну</strong> декларацию, из которой выводится и рантайм-проверка, и тип (<code>z.infer</code>).</p>
    <ul><li>Плюсы: контракт не расходится с типом, ошибки локализуются на границе, хорошие сообщения, трансформации и дефолты.</li>
    <li>Цена: размер бандла (zod v3 заметно тяжелее alternatives; valibot и zod v4 mini дают tree-shakable API), стоимость валидации на больших списках и нагрузка на компилятор от сложных схем.</li>
    <li>Разумный компромисс: валидировать полностью на границе критичных данных, для больших однородных массивов — выборочно или через быстрые кодеки; не валидировать то, что пришло из собственного типизированного RPC.</li>
    <li>Альтернатива для контрактов с бэком — генерация типов из OpenAPI/GraphQL: дешевле в рантайме, но не защищает, если бэк нарушил свою же схему.</li></ul>`,
    code: `const User = z.object({ id: z.string(), age: z.number().int() });
type User = z.infer<typeof User>;

const user = User.parse(await res.json());`,
    tip: 'Формулировка «типы — это про рефакторинг, схемы — про доверие к данным» хорошо заходит.' },

  { id: 'tsx29',
    q: 'Какие флаги tsconfig вы включаете и почему strict — это не один флаг?',
    a: `<p><code>strict: true</code> — зонтик над группой: <code>strictNullChecks</code>, <code>noImplicitAny</code>, <code>strictFunctionTypes</code>, <code>strictBindCallApply</code>, <code>strictPropertyInitialization</code>, <code>noImplicitThis</code>, <code>useUnknownInCatchVariables</code>, <code>alwaysStrict</code>. Самый ценный из них — <code>strictNullChecks</code>: без него вся система типов теряет смысл, потому что null входит в каждый тип.</p>
    <p>Сверх strict обычно включают:</p>
    <ul><li><code>noUncheckedIndexedAccess</code> — доступ по индексу даёт <code>| undefined</code>.</li>
    <li><code>exactOptionalPropertyTypes</code> — различает «нет ключа» и «ключ равен undefined».</li>
    <li><code>noImplicitOverride</code>, <code>noFallthroughCasesInSwitch</code>, <code>noPropertyAccessFromIndexSignature</code>.</li>
    <li><code>skipLibCheck: true</code> — почти всегда, ради скорости; <code>isolatedModules</code> и <code>verbatimModuleSyntax</code> — для совместимости со сборщиком.</li></ul>
    <p>Отдельно: <code>noUnusedLocals</code>/<code>noUnusedParameters</code> лучше отдать ESLint — компилятор не умеет автофикс и мешает при отладке.</p>`,
    tip: 'Стратегия миграции легаси: включить strict, но точечно ослабить через отдельный tsconfig для старых папок, а не откладывать целиком.' },

  { id: 'tsx30',
    q: 'Что делают noUncheckedIndexedAccess и exactOptionalPropertyTypes и почему их часто выключают?',
    a: `<p><code>noUncheckedIndexedAccess</code> честно отражает реальность JS: <code>arr[i]</code> и <code>record[key]</code> могут вернуть <code>undefined</code>, поэтому тип становится <code>T | undefined</code>. Это ловит целый класс багов на пустых массивах и отсутствующих ключах.</p>
    <ul><li>Цена: шум в циклах <code>for (let i...)</code>, где индекс заведомо валиден, и в кортежах — там флаг иногда срабатывает избыточно. Спасает <code>for...of</code>, <code>entries()</code> и <code>at()</code>.</li></ul>
    <p><code>exactOptionalPropertyTypes</code> разделяет «свойство отсутствует» и «свойство равно undefined»: при нём <code>{ a?: number }</code> нельзя присвоить <code>{ a: undefined }</code>.</p>
    <ul><li>Это важно для API, где <code>undefined</code> в JSON означает «не трогать», а явный null — «сбросить», и для <code>Object.keys</code>-обходов.</li>
    <li>Ломается на библиотеках (особенно React-пропсах и spread), которые массово пишут <code>{...props, a: undefined}</code> — из-за этого его чаще всего и отключают.</li></ul>`,
    code: `const first = list[0];  // T | undefined при noUncheckedIndexedAccess
if (first) use(first);

type O = { a?: number };
const o: O = { a: undefined }; // ошибка при exactOptionalPropertyTypes`,
    tip: 'Честно скажите про шум и про то, что оба флага дешевле включать на новом коде, чем ретроспективно.' },

  { id: 'tsx31',
    q: 'Что такое isolatedModules и какие конструкции он запрещает?',
    a: `<p>Флаг гарантирует, что каждый файл можно транспилировать <strong>независимо</strong>, без информации о типах из других файлов. Это требование любого однофайлового транспилятора: esbuild, SWC, Babel, Vite.</p>
    <p>Запрещает или требует уточнения:</p>
    <ul><li>Ре-экспорт типа без <code>export type</code>: <code>export { SomeType } from './t'</code> — транспилятор не знает, что это тип, и оставит рантайм-импорт несуществующего значения.</li>
    <li><code>const enum</code> — он требует межфайловой инлайн-подстановки (кроме <code>declare const enum</code> при <code>preserveConstEnums</code>).</li>
    <li>Файлы без импортов/экспортов трактуются как скрипты — нужен <code>export {}</code>.</li>
    <li>Некоторые виды слияния объявлений и <code>export =</code>.</li></ul>
    <p>Практически: включаете его всегда, если сборка идёт не через <code>tsc</code>, а <code>tsc</code> используется только как чекер (<code>noEmit</code>).</p>`,
    code: `import type { User } from './types';
export type { User };          // корректно
// export { User } from './types';  // ошибка при isolatedModules`,
    tip: 'Связка «isolatedModules нужен, потому что esbuild/SWC не видят типы других файлов» — суть в одном предложении.' },

  { id: 'tsx32',
    q: 'Чем moduleResolution bundler отличается от node16 и classic?',
    a: `<p>Резолюция описывает, как TS ищет файл по спецификатору импорта, и должна <strong>совпадать с рантаймом или сборщиком</strong>, иначе типы и код разойдутся.</p>
    <ul><li><code>node10</code> (старый <code>node</code>) — легаси CommonJS-алгоритм: не понимает поле <code>exports</code>, разрешает импорт без расширения. Причина большинства проблем с современными пакетами.</li>
    <li><code>node16</code>/<code>nodenext</code> — реальные правила Node ESM: учитывает <code>exports</code>/<code>imports</code>, требует расширение <code>.js</code> в относительных импортах ESM, различает CJS и ESM по <code>type</code> в package.json и по расширению файла. Самый строгий и самый точный для кода, который запускает Node.</li>
    <li><code>bundler</code> (TS 5.0) — гибрид: понимает <code>exports</code>, но не требует расширений и разрешает ESM-синтаксис в CJS-контексте. Ровно то, как ведут себя Vite, webpack, esbuild. Требует <code>module</code> не ниже <code>es2015</code>.</li>
    <li><code>module: preserve</code> (TS 5.4) подразумевает <code>bundler</code> и сохраняет синтаксис импортов как есть — рекомендуемый вариант для фронтенда.</li></ul>`,
    tip: 'Ключевой тезис: настройка резолюции должна описывать вашу среду выполнения, а не «включить самое новое».' },

  { id: 'tsx33',
    q: 'Что делает verbatimModuleSyntax и какую проблему он решает?',
    a: `<p>Правило простое: импорты и экспорты <strong>без</strong> модификатора <code>type</code> сохраняются в выводе дословно, с модификатором — удаляются целиком. Это убирает исторический механизм «умного» стирания импортов, который смотрел на использование и порождал два класса багов.</p>
    <ul><li><strong>Пропавшие сайд-эффекты</strong>: импорт, использованный только в типовой позиции, вырезался — и вместе с ним исчезала регистрация полифилла или декоратора.</li>
    <li><strong>Лишние рантайм-импорты</strong>: в однофайловых транспиляторах, наоборот, оставался импорт типа, что ломало сборку.</li></ul>
    <p>Следствия: писать <code>import type</code> становится обязательным, а <code>import { type X, y }</code> — идиоматичным. Флаг заменяет старые <code>importsNotUsedAsValues</code> и <code>preserveValueImports</code>, и он же запрещает CJS-синтаксис <code>export =</code> в файлах, которые компилируются в ESM.</p>`,
    code: `import { type User, createUser } from './user';
// в выводе: import { createUser } from './user';`,
    tip: 'Пример с исчезающим полифиллом из-за type-only-использования — самая понятная иллюстрация проблемы.' },

  { id: 'tsx34',
    q: 'Проект собирается медленно, tsc ест минуты. Как диагностировать и что чинить?',
    a: `<p>Сначала измерить: <code>tsc --extendedDiagnostics</code> и <code>--generateTrace</code> с анализом в <code>analyze-trace</code> покажут, какие файлы и какие типы съедают время (check time против instantiation count).</p>
    <p>Типовые причины и лечение:</p>
    <ul><li><strong>Гигантские union и рекурсивные условные типы</strong> — самый частый источник. Ограничить глубину, заменить вычисляемый тип на явно перечисленный, вынести в промежуточный <code>interface</code>.</li>
    <li><code>interface</code> вместо <code>type</code> для объектов: интерфейсы кешируются по имени, а пересечения <code>type</code> перепроверяются структурно при каждом сравнении.</li>
    <li>Явные аннотации возвращаемых типов у экспортируемых функций — компилятору не нужно выводить их заново на каждом использовании (и это же требование <code>isolatedDeclarations</code> в TS 5.5).</li>
    <li><code>skipLibCheck: true</code>, <code>incremental</code>, project references и разделение монорепы на проекты.</li>
    <li>Аннотации вариантности <code>in</code>/<code>out</code> в тяжёлых дженериках.</li></ul>`,
    tip: 'Назовите --generateTrace и analyze-trace: это конкретный инструмент, а не общие слова про «упростить типы».' },

  { id: 'tsx35',
    q: 'Type-level программирование: где польза, а где вред?',
    a: `<p>Польза там, где тип защищает <strong>внешний</strong> контракт и ошибка дорога: типобезопасные роуты и их параметры, ключи i18n, схемы таблиц и ORM-запросы, автодополнение токенов дизайн-системы, невозможные состояния в редьюсерах.</p>
    <p>Вред начинается, когда:</p>
    <ul><li>Сообщения об ошибках становятся нечитаемыми — юниор не сможет исправить ошибку в вашем типе, и это прямой урон скорости команды.</li>
    <li>Растёт время проверки и подсказки в IDE начинают тормозить (это ощущается раньше, чем падает CI).</li>
    <li>Тип дублирует то, что проще проверить в рантайме, или пытается заменить тест.</li>
    <li>Тип полагается на неспецифицированное поведение компилятора и ломается при апгрейде.</li></ul>
    <p>Практическое правило: сложный тип оправдан, если он написан один раз в библиотеке и используется сотнями мест. Внутри фичи — почти никогда.</p>`,
    tip: 'Аргумент «читаемость ошибки для джуна» — самый убедительный критерий, и его редко называют.' },

  { id: 'tsx36',
    q: 'Что такое excess property check и почему он иногда не срабатывает?',
    a: `<p>При присваивании <strong>свежего объектного литерала</strong> целевому типу TS дополнительно ругается на лишние свойства, хотя структурная типизация этого не требует. Это эвристика против опечаток, а не часть системы типов.</p>
    <p>Проверка исчезает, когда литерал перестаёт быть «свежим»:</p>
    <ul><li>через промежуточную переменную;</li>
    <li>при <code>as</code>;</li>
    <li>при spread (<code>{...obj}</code> в некоторых позициях);</li>
    <li>если целевой тип — union и лишнее свойство есть хотя бы в одном члене (частая причина «почему не поймало» на discriminated union);</li>
    <li>если у цели есть индексная сигнатура.</li></ul>
    <p>Для действительно строгого запрета лишних полей нужен явный тип-«exact» через перемаппинг с <code>never</code>, но он ухудшает сообщения об ошибках.</p>`,
    code: `type P = { a: number };
const x: P = { a: 1, b: 2 };        // ошибка
const t = { a: 1, b: 2 };
const y: P = t;                     // ошибки нет`,
    tip: 'Кейс с union — самый показательный: он объясняет, почему на пропсах компонента лишние поля иногда проходят.' },

  { id: 'tsx37',
    q: 'Что такое typeof import и зачем он нужен?',
    a: `<p><code>typeof import('./m')</code> даёт тип пространства модуля целиком без внесения рантайм-импорта. Это работает и в <code>.ts</code>, и в JSDoc, и внутри <code>.d.ts</code>.</p>
    <ul><li>Типизация динамического импорта: <code>type M = typeof import('./heavy')</code>, потом <code>Awaited&lt;ReturnType&lt;...&gt;&gt;</code> для <code>import()</code>.</li>
    <li>Ссылка на тип из модуля внутри глобального <code>declare global</code>, где обычный <code>import</code> недопустим.</li>
    <li>Избежание циклических импортов: тип берём «по требованию», рантайм-зависимости не появляется.</li>
    <li>Мокинг в тестах: <code>vi.mock</code> с типом <code>typeof import('./api')</code> гарантирует, что мок соответствует реальному модулю по сигнатурам.</li></ul>`,
    code: `type Api = typeof import('./api');
declare global { interface Window { api: Api } }

const mod = await import('./heavy'); // typeof import('./heavy')`,
    tip: 'Кейс с моками в тестах — практичный пример, который сразу показывает пользу.' },

  { id: 'tsx38',
    q: 'В чём разница между ts-ignore и ts-expect-error и что выбрать?',
    a: `<p><code>@ts-ignore</code> подавляет ошибку на следующей строке и молчит, даже если ошибки нет. <code>@ts-expect-error</code> подавляет ошибку, но <strong>сам становится ошибкой</strong>, если строка стала валидной. Это принципиальная разница: expect-error самоочищается при апгрейде библиотеки или рефакторинге, ignore превращается в вечный технический долг.</p>
    <ul><li>С TS 5.5 у <code>@ts-expect-error</code> можно требовать описание через ESLint-правило <code>ban-ts-comment</code> с <code>descriptionFormat</code> — заводите ссылку на issue.</li>
    <li>Оба подавляют <strong>все</strong> ошибки строки, а не конкретную — это скрытый риск; лучше сузить строку до минимума.</li>
    <li><code>@ts-nocheck</code> в начале файла — крайняя мера при миграции, а не рабочий инструмент.</li>
    <li>Альтернатива, которую стоит назвать: точечный <code>as unknown as T</code> с комментарием часто честнее, потому что не глушит соседние ошибки.</li></ul>`,
    code: `// @ts-expect-error TODO: обновить типы после релиза lib@3 (issue #421)
legacy.call();`,
    tip: 'Практика «в проекте запрещён ts-ignore линтером, разрешён только ts-expect-error с описанием» — готовый ответ про процессы.' },

  { id: 'tsx39',
    q: 'Почему Object.keys возвращает string[], а не keyof T, и как с этим быть?',
    a: `<p>Потому что структурная типизация допускает, что в рантайме объект <strong>шире</strong> объявленного типа: переменная типа <code>{a: number}</code> может ссылаться на объект с полями a, b, c. Если бы <code>Object.keys</code> возвращал <code>(keyof T)[]</code>, это была бы неверная гарантия. Та же причина у <code>for...in</code> и <code>Object.entries</code>.</p>
    <ul><li>Безопасный вариант — итерироваться по <strong>явному списку</strong> ключей (<code>as const</code>-массив), а не по объекту.</li>
    <li>Если объект вы создали локально и он точно точный — можно локальный хелпер <code>objectKeys</code> с приведением, но это осознанный <code>as</code> с комментарием.</li>
    <li>Для <code>for...in</code> дополнительная опасность — перебор унаследованных свойств; отсюда классический <code>hasOwnProperty</code>, а лучше <code>Object.hasOwn</code>.</li>
    <li>Связанная тема: <code>Object.fromEntries</code> теряет типы ключей и почти всегда требует ручной аннотации.</li></ul>`,
    code: `const KEYS = ['a', 'b'] as const;
for (const k of KEYS) use(obj[k]);   // типобезопасно

function objectKeys<T extends object>(o: T) {
  return Object.keys(o) as (keyof T)[]; // осознанное допущение
}`,
    tip: 'Фраза «объект в рантайме может быть шире типа» — точная формулировка причины, а не «так решили в TS».' },

  { id: 'tsx40',
    q: 'Как типизировать миксины и абстрактные конструкторы?',
    a: `<p>Миксин — функция, принимающая конструктор и возвращающая расширенный класс. Ключ — тип <code>Constructor = new (...args: any[]) =&gt; T</code> и то, что возвращаемый тип выводится компилятором (аннотировать его вручную почти невозможно без потери деталей).</p>
    <ul><li>С TS 4.2 есть <strong>abstract construct signatures</strong>: <code>abstract new (...args: any[]) =&gt; T</code>. Без них нельзя было передать абстрактный класс в дженерик-фабрику, потому что абстрактный класс не присваивается обычной конструкторной сигнатуре.</li>
    <li>Миксины плохо дружат с приватными полями (<code>#x</code> и <code>private</code>): номинальная проверка приватных членов ломает присваиваемость получившихся классов.</li>
    <li>Декларации типов для миксинов часто требуют интерфейса-слияния, потому что выведенный анонимный класс нельзя назвать в d.ts — это ломает <code>declaration: true</code> и <code>isolatedDeclarations</code>.</li>
    <li>Практическая альтернатива в проде — композиция объектов и хуки вместо наследования; миксины остаются в библиотечном коде (Lit, старый Angular).</li></ul>`,
    code: `type Ctor<T = {}> = abstract new (...a: any[]) => T;

function Timestamped<B extends Ctor>(Base: B) {
  abstract class T extends Base { created = Date.now() }
  return T;
}`,
    tip: 'Проблема с declaration: true у миксинов — редкий, но очень убедительный практический нюанс.' }
];
