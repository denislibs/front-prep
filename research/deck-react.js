const DECK_REACT_EXTRA = [
  { id: 'rx1',
    q: 'Когда useReducer объективно лучше useState? Приведи критерии, а не вкусовщину.',
    a: `<p>Критерий не «много полей», а <strong>связанность переходов</strong>. Если следующее состояние зависит от предыдущего и от типа события, и одно действие меняет сразу несколько полей согласованно — это редьюсер.</p>
    <p>Практические маркеры: больше 3-4 связанных <code>useState</code>, которые всегда обновляются вместе; невалидные промежуточные комбинации (loading=true и error одновременно); одна и та же логика перехода вызывается из нескольких мест; нужно логировать или тестировать переходы отдельно от React.</p>
    <p>Бонусы: <code>dispatch</code> стабилен по ссылке навсегда, поэтому его безопасно класть в зависимости эффектов и прокидывать через контекст без <code>useCallback</code>. Редьюсер — чистая функция, её тестируешь без рендера. Ещё это позволяет уйти от stale closure: вся логика читает актуальный <code>state</code> из аргумента.</p>
    <p>Минусы честно: больше кода, индирекция (чтобы понять, что делает кнопка, идёшь в редьюсер), хуже точечная типизация. Для одного булева флага это оверинжиниринг.</p>`,
    code: `type State = { status: 'idle' | 'loading' | 'ok' | 'err'; data: Item[]; error: string | null };
type Action =
  | { type: 'fetch' }
  | { type: 'ok'; data: Item[] }
  | { type: 'err'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'fetch': return { status: 'loading', data: [], error: null };
    case 'ok':    return { status: 'ok', data: action.data, error: null };
    case 'err':   return { status: 'err', data: [], error: action.error };
    default:      return state;
  }
}

const [state, dispatch] = useReducer(reducer, initialState);`,
    tip: 'Скажи, что редьюсер делает невозможные состояния непредставимыми - это переводит разговор с useState vs useReducer на моделирование домена, что сильно повышает уровень ответа.' },

  { id: 'rx2',
    q: 'Как построить связку useReducer + Context так, чтобы она не убивала производительность?',
    a: `<p>Главная проблема наивной реализации: один провайдер отдаёт объект <code>{ state, dispatch }</code>, он новый на каждом рендере, и все подписчики перерисовываются даже если им нужен только <code>dispatch</code>.</p>
    <p>Решение — <strong>два отдельных контекста</strong>: <code>StateContext</code> и <code>DispatchContext</code>. Dispatch стабилен, поэтому его потребители (кнопки, формы) не ререндерятся вообще никогда при смене состояния. Это самый дешёвый выигрыш в таких архитектурах.</p>
    <p>Если состояние крупное, дальше режем по доменам: несколько узких контекстов вместо одного «god context». Альтернатива для реально горячих мест — держать состояние во внешнем сторе и читать через <code>useSyncExternalStore</code> с селекторами, тогда контекст отдаёт только неизменяемую ссылку на стор.</p>
    <p>Ограничение честно: контекст не умеет селекторы, любое изменение значения будит всех потребителей. Мемоизация значения помогает только когда значение реально не менялось.</p>`,
    code: `const StateCtx = createContext<State | null>(null);
const DispatchCtx = createContext<React.Dispatch<Action> | null>(null);

export function Provider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, init);
  return (
    <StateCtx value={state}>
      <DispatchCtx value={dispatch}>{children}</DispatchCtx>
    </StateCtx>
  );
}
// React 19: <Context value={...}> вместо <Context.Provider value={...}>`,
    tip: 'Упомяни, что в React 19 сам Context можно рендерить как провайдер, а Context.Provider объявлен устаревшим - это показывает, что ты следишь за релизами.' },

  { id: 'rx3',
    q: 'Зачем нужен useImperativeHandle и почему им злоупотребляют?',
    a: `<p><code>useImperativeHandle</code> позволяет компоненту решать, <strong>что именно</strong> увидит родитель через ref, вместо того чтобы отдавать голый DOM-узел. Это инкапсуляция: наружу торчит <code>focus()</code>, <code>scrollToError()</code>, <code>play()</code>, а не весь элемент, которым родитель может сделать что угодно.</p>
    <p>Легитимные кейсы: фокус и выделение, скролл к элементу, императивные медиа-API, интеграция со сторонними библиотеками, сброс формы. Общее у них — это <strong>действия, а не состояние</strong>: их нельзя выразить как «отрендерить по-другому».</p>
    <p>Злоупотребление начинается, когда через хендл прокидывают <code>setOpen()</code> или <code>setValue()</code>. Это обходит декларативную модель: React не знает про такие изменения, они не батчатся с остальным потоком данных и не воспроизводятся при повторном рендере. Такое надо делать пропсами или поднятием состояния.</p>
    <p>Технически: второй аргумент — фабрика хендла, третий — массив зависимостей. Если зависимости опущены, хендл пересоздаётся каждый рендер (обычно неважно, но при подписках может укусить).</p>`,
    code: `type FieldHandle = { focus: () => void; scrollIntoView: () => void };

function Field({ ref, ...props }: Props & { ref?: React.Ref<FieldHandle> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    scrollIntoView: () => inputRef.current?.scrollIntoView({ block: 'center' }),
  }), []);
  return <input ref={inputRef} {...props} />;
}`,
    tip: 'Формулировка, которая заходит: императивный хендл уместен для глаголов (focus, play, reset) и неуместен для существительных (value, isOpen).' },

  { id: 'rx4',
    q: 'Что изменилось с forwardRef в React 19 и как теперь правильно пробрасывать ref?',
    a: `<p>В React 19 <code>ref</code> — обычный проп функционального компонента. <code>forwardRef</code> больше не нужен, он объявлен устаревшим и будет удалён; в репозитории React есть codemod для автоматической миграции.</p>
    <p>Практическое следствие: компонент просто деструктурирует <code>ref</code> из пропсов и вешает на нужный узел. Пропадает лишний слой обёртки, который ломал дженерики (типизировать <code>forwardRef</code> для дженерик-компонента было больно и требовало приведения типов) и портил отображаемое имя в DevTools.</p>
    <p>Второе изменение: <strong>ref-колбэк теперь может возвращать cleanup-функцию</strong>. React вызовет её при отмонтировании вместо того, чтобы вызывать колбэк с <code>null</code>. Из-за этого стрелки вида <code>ref={el => (myRef.current = el)}</code> теперь ошибка: неявный возврат значения React примет за cleanup. Нужны фигурные скобки.</p>
    <p>Классовые компоненты по-прежнему получают ref через <code>ref</code> как специальный атрибут, там ничего не поменялось.</p>`,
    code: `// React 19
function Input({ ref, ...rest }: React.ComponentPropsWithRef<'input'>) {
  return <input ref={ref} {...rest} />;
}

// ref-колбэк с cleanup
<div ref={(node) => {
  const ro = new ResizeObserver(onResize);
  if (node) ro.observe(node);
  return () => ro.disconnect();
}} />

// ЛОВУШКА: неявный возврат теперь считается cleanup
<div ref={el => (nodeRef.current = el)} />        // ошибка
<div ref={el => { nodeRef.current = el; }} />     // правильно`,
    tip: 'Отдельно отметь ловушку с неявным возвратом в стрелке - это самая частая реальная поломка при апгрейде на React 19.' },

  { id: 'rx5',
    q: 'Зачем нужен useId и почему нельзя обойтись Math.random или счётчиком?',
    a: `<p><code>useId</code> генерирует стабильный уникальный идентификатор, <strong>одинаковый на сервере и на клиенте</strong>. Это его единственный смысл: без него SSR-разметка и гидратация разъедутся, потому что <code>Math.random()</code> или глобальный счётчик дадут разные значения в двух средах.</p>
    <p>Внутри id выводится из позиции компонента в дереве Fiber (путь от корня), поэтому он детерминирован. Формат вида <code>:r1:</code> специально содержит символы, недопустимые в CSS-селекторах — чтобы никто не пытался использовать id как хук для стилей.</p>
    <p>Основной кейс — связывание <code>label</code> и <code>input</code>, <code>aria-describedby</code>, <code>aria-labelledby</code> в переиспользуемых компонентах, где нельзя захардкодить id, потому что компонент может быть на странице десять раз.</p>
    <p>Чего <code>useId</code> НЕ делает: это не ключ для списков (там нужен id из данных) и не идентификатор сущности. Для нескольких связанных полей берут один id и добавляют суффиксы, а не вызывают хук пять раз.</p>`,
    code: `function PasswordField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id + '-input'}>Пароль</label>
      <input id={id + '-input'} aria-describedby={id + '-hint'} type="password" />
      <p id={id + '-hint'}>Минимум 8 символов</p>
    </>
  );
}
// Для нескольких инстансов приложения на странице задают identifierPrefix у createRoot`,
    tip: 'Добавь, что при нескольких React-рутах на одной странице нужен identifierPrefix в createRoot, иначе id столкнутся.' },

  { id: 'rx6',
    q: 'Как ты применяешь useTransition на практике? Что он реально даёт и чего не даёт?',
    a: `<p><code>useTransition</code> помечает обновление как неприоритетное. React может прервать такой рендер, чтобы обработать срочное событие (ввод, клик), и вернуться к нему позже. Плюс даёт флаг <code>isPending</code> для индикации.</p>
    <p>Классический кейс: тяжёлый список фильтруется по вводу. Значение инпута обновляем срочно (иначе поле лагает), а результат фильтрации — внутри <code>startTransition</code>. Второй кейс — клиентская навигация между тяжёлыми вкладками без фриза.</p>
    <p>Что он НЕ делает: не ускоряет ваш код. Если один рендер списка занимает 300мс без точек прерывания, транзишен не спасёт — он спасает от <strong>блокировки инпута</strong>, а не от медленного рендера. Сначала виртуализация и мемоизация, потом транзишены.</p>
    <p>В React 19 <code>startTransition</code> принимает async-функции — это фундамент Actions: пока промис не зарезолвился, <code>isPending</code> остаётся true. Важная деталь: обновление состояния должно быть <strong>синхронно внутри</strong> колбэка (или после await в async-варианте), иначе React не свяжет его с транзишеном.</p>`,
    code: `const [isPending, startTransition] = useTransition();
const [query, setQuery] = useState('');
const [results, setResults] = useState<Item[]>([]);

function onChange(e: React.ChangeEvent<HTMLInputElement>) {
  setQuery(e.target.value);              // срочно: инпут отзывчив
  startTransition(() => {
    setResults(filterHuge(e.target.value)); // неприоритетно, прерываемо
  });
}

// React 19: async-actions
startTransition(async () => {
  const err = await saveName(name);
  if (err) setError(err);
});`,
    tip: 'Уточни, что startTransition НЕ делает обновление debounce - React стартует рендер сразу, просто готов его бросить. Это частая путаница.' },

  { id: 'rx7',
    q: 'useTransition или useDeferredValue — как выбрать?',
    a: `<p>Разница чисто механическая: <code>useTransition</code> нужен, когда у тебя <strong>есть доступ к сеттеру</strong> и ты можешь обернуть само обновление. <code>useDeferredValue</code> — когда значение приходит извне (проп, результат хука, параметр URL) и обернуть его установку негде.</p>
    <p><code>useDeferredValue</code> возвращает «отстающую» копию: при смене значения сначала идёт рендер со старым, потом React в фоне пробует отрендерить с новым. Ты сравниваешь <code>value !== deferred</code>, чтобы показать состояние «устаревает» (обычно приглушённая прозрачность).</p>
    <p>Ключевое дополнение: сам по себе <code>useDeferredValue</code> ничего не даст, если дочерний компонент не мемоизирован. Отложенное значение имеет смысл только когда компонент, который его читает, обёрнут в <code>memo</code> — иначе он перерисуется вместе с родителем и вся экономия испарится.</p>
    <p>И это не замена debounce для сети: он не уменьшает число запросов, он уменьшает блокировку главного потока. Для сети всё равно нужен debounce или отмена.</p>`,
    code: `function SearchPage({ query }: { query: string }) {   // query приходит пропом
  const deferred = useDeferredValue(query);
  const stale = query !== deferred;
  return (
    <div style={{ opacity: stale ? 0.6 : 1, transition: 'opacity .2s' }}>
      <Results query={deferred} />
    </div>
  );
}
const Results = memo(function Results({ query }: { query: string }) { /* ... */ });

// React 19: initialValue для первого рендера
const deferred = useDeferredValue(query, '');`,
    tip: 'Сильный ответ: назови memo обязательным условием работы useDeferredValue - большинство кандидатов этого не знают и объясняют его как встроенный debounce.' },

  { id: 'rx8',
    q: 'Объясни механику Suspense: что именно его активирует, а что нет?',
    a: `<p>Suspense — это граница, которая ловит «приостановку» во время <strong>рендера</strong>. Компонент, которому не хватает данных, бросает промис (в новом API это делает <code>use()</code>); React ловит его, откатывает рендер поддерева, показывает <code>fallback</code> и повторяет попытку, когда промис зарезолвится.</p>
    <p>Активируют границу: <code>lazy()</code>, чтение промиса через <code>use()</code>, данные Server Components, стриминг HTML при SSR, стили с <code>precedence</code>. В React 19+ ещё шрифты и изображения при <code>ViewTransition</code>.</p>
    <p><strong>Не активируют</strong>: фетч в <code>useEffect</code> с последующим <code>setState</code>, запросы в обработчиках событий, обычная асинхронность. Это чаще всего и спрашивают: «почему мой Suspense не показывает фолбэк» — потому что данные грузятся не в рендере.</p>
    <p>Важные оговорки: состояние поддерева <strong>не сохраняется</strong>, если оно приостановилось до первого монтирования — React рендерит его с нуля. При повторной приостановке уже показанного контента React делает cleanup layout-эффектов. И реавилы батчатся примерно раз в 300мс, чтобы не было мигания.</p>`,
    code: `// НЕ приостанавливает
function Bad() {
  const [data, setData] = useState(null);
  useEffect(() => { fetchData().then(setData); }, []);
  return data ? <View data={data} /> : null;  // Suspense не увидит
}

// Приостанавливает
function Good({ promise }: { promise: Promise<Data> }) {
  const data = use(promise);                  // Suspense увидит
  return <View data={data} />;
}`,
    tip: 'Фраза-ключ: Suspense видит только то, что происходит во время рендера. Всё, что в эффекте или в хендлере, для него не существует.' },

  { id: 'rx9',
    q: 'Что такое Suspense-водопад и как ты его лечишь?',
    a: `<p>Водопад — это когда запросы выстраиваются последовательно, хотя могли идти параллельно. Возникает двумя способами. Первый: реальная зависимость по данным — <code>use(fetchUser())</code>, затем <code>use(fetchOrders(user.id))</code> в том же компоненте. Второй, более коварный: <strong>структурный водопад</strong>, когда родитель приостановился и дочерние компоненты даже не начали рендериться, а значит и не начали свои запросы.</p>
    <p>Лечение по слоям. Первое — <strong>поднять старт запросов вверх и не await-ить их сразу</strong>: инициируем все промисы одновременно, а <code>use()</code> вызываем в разных дочерних компонентах под своими границами. Второе — <code>Promise.all</code> там, где зависимости нет. Третье — префетч на уровне роутера или RSC-лоадера.</p>
    <p>В Next App Router то же самое: не ставить <code>await</code> подряд в одном серверном компоненте, а раздать промисы в дочерние компоненты, обёрнутые в <code>Suspense</code>, — тогда стриминг отдаёт куски по мере готовности.</p>
    <p>Диагностика: вкладка Network со ступенькой запросов и React DevTools Profiler. Если запросы стартуют с задержкой ровно на время предыдущего — это водопад.</p>`,
    code: `// Водопад: второй await ждёт первого
async function Page() {
  const user = await getUser();
  const orders = await getOrders();   // не зависит от user, но ждёт
  ...
}

// Параллельно
async function Page() {
  const userP = getUser();            // стартуем оба сразу
  const ordersP = getOrders();
  const [user, orders] = await Promise.all([userP, ordersP]);
}

// Стриминг: раздаём промисы вниз, каждый со своей границей
function Page() {
  const userP = getUser();
  const ordersP = getOrders();
  return (
    <>
      <Suspense fallback={<UserSkeleton />}><User p={userP} /></Suspense>
      <Suspense fallback={<OrdersSkeleton />}><Orders p={ordersP} /></Suspense>
    </>
  );
}`,
    tip: 'Различай водопад по данным (неизбежен, лечится дедупликацией и префетчем) и водопад по структуре компонентов (искусственный, лечится границами Suspense).' },

  { id: 'rx10',
    q: 'Что такое хук use() и чем он отличается от остальных хуков?',
    a: `<p><code>use()</code> читает значение из ресурса: промиса или контекста. Ключевое отличие — <strong>на него не распространяются правила хуков</strong>: его можно вызывать условно, в ветках <code>if</code> и внутри циклов. Это возможно потому, что он не хранит состояние в слоте хуков, а работает через механизм приостановки.</p>
    <p>С промисом: если промис в pending — компонент приостанавливается и ближайший <code>Suspense</code> показывает фолбэк. Если промис отклонён — ошибка летит в ближайший Error Boundary. Оба состояния обрабатываются декларативно, без <code>isLoading</code> и <code>error</code> в стейте.</p>
    <p>Критичное ограничение: <strong>нельзя создавать промис прямо в рендере клиентского компонента</strong>. Рендер может повториться, промис создастся заново, и получится бесконечный цикл. Промис должен приходить из Server Component, из кеша фреймворка или из библиотеки с дедупликацией. Есть <code>cache()</code> в RSC для мемоизации на время запроса.</p>
    <p>С контекстом <code>use(ThemeContext)</code> — это условный <code>useContext</code>: удобно, когда контекст нужен только в одной ветке.</p>`,
    code: `// Server Component создаёт промис, Client Component его читает
async function Page() {
  const commentsPromise = getComments();   // без await
  return (
    <Suspense fallback={<Spinner />}>
      <Comments promise={commentsPromise} />
    </Suspense>
  );
}

'use client';
function Comments({ promise }: { promise: Promise<Comment[]> }) {
  const comments = use(promise);   // приостановит до резолва
  return <ul>{comments.map(c => <li key={c.id}>{c.text}</li>)}</ul>;
}`,
    tip: 'Подчеркни, что use() можно вызывать условно - это единственный такой API в React, и интервьюеры любят этот факт.' },

  { id: 'rx11',
    q: 'Как устроены Server Actions под капотом? Что реально происходит при сабмите?',
    a: `<p><code>'use server'</code> помечает функцию как серверную. Бандлер не отправляет её тело на клиент — вместо этого создаётся <strong>ссылка на серверную функцию</strong> (уникальный id). На клиенте импорт превращается в объект-прокси, который при вызове делает POST на текущий роут с этим id и сериализованными аргументами.</p>
    <p>Сервер находит функцию по id, десериализует аргументы, выполняет, а в ответ возвращает не JSON, а <strong>RSC-payload</strong>: результат функции плюс обновлённое дерево серверных компонентов, если было <code>revalidatePath</code>. React мержит это в существующее дерево без полной перезагрузки — состояние клиентских компонентов сохраняется.</p>
    <p>Отсюда три важных следствия. Первое: экшен — это <strong>публичный HTTP-эндпоинт</strong>, id угадать не нужно, он лежит в бандле. Авторизацию и валидацию делать обязательно внутри самого экшена. Второе: аргументы и возвращаемое значение должны быть сериализуемыми (нет функций, классов, Symbol; есть Date, Map, Set, FormData). Третье: экшены выполняются <strong>последовательно</strong> внутри одной формы, а вызовы оборачиваются в транзишен.</p>`,
    code: `'use server';
import { z } from 'zod';
import { auth } from '@/lib/auth';

const Schema = z.object({ title: z.string().min(3), body: z.string().max(5000) });

export async function createPost(prev: State, formData: FormData): Promise<State> {
  const session = await auth();                     // 1. авторизация ВНУТРИ
  if (!session) return { error: 'Не авторизован' };

  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {                            // 2. валидация ВНУТРИ
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  await db.post.create({ data: { ...parsed.data, userId: session.userId } });
  revalidatePath('/posts');                         // 3. инвалидация кеша
  return { ok: true };
}`,
    tip: 'Обязательно скажи фразу: Server Action - это публичный эндпоинт, а не приватная функция. Это отделяет сеньора от миддла в этой теме.' },

  { id: 'rx12',
    q: 'Где и как валидировать данные в Server Actions? Что с ошибками валидации на клиенте?',
    a: `<p>Валидация обязательна <strong>на сервере</strong>, всегда — потому что экшен это открытый эндпоинт. Клиентская валидация — только UX, не безопасность. Практика: одна схема Zod, используемая в обоих местах; на клиенте через resolver в React Hook Form для мгновенной обратной связи, на сервере — <code>safeParse</code> в экшене.</p>
    <p>Ошибки валидации <strong>возвращаем как значение</strong>, а не бросаем. Брошенное исключение улетит в Error Boundary и сотрёт всю форму — для «поле обязательно» это дикий UX. Возвращаем объект <code>{ fieldErrors, values }</code>, который <code>useActionState</code> отдаст в рендер. Бросаем только реально исключительные вещи (упала БД).</p>
    <p>Обязательно возвращать введённые значения в стейте — иначе при ошибке без JS форма очистится. Также <code>safeParse</code> вместо <code>parse</code>, чтобы не полагаться на try/catch.</p>
    <p>Отдельно: не доверяем скрытым полям. Всё, что относится к правам (userId, роль, цена), берём из сессии на сервере, а не из <code>formData</code> — иначе пользователь подменит их в DevTools.</p>`,
    code: `// схема общая для клиента и сервера
export const PostSchema = z.object({
  title: z.string().min(3, 'Минимум 3 символа'),
  body: z.string().min(1),
});

// сервер: ошибки как возвращаемое значение
const parsed = PostSchema.safeParse(raw);
if (!parsed.success) {
  return {
    fieldErrors: parsed.error.flatten().fieldErrors,
    values: raw,          // чтобы форма не очистилась
  };
}

// клиент
const [state, formAction, isPending] = useActionState(createPost, { values: {} });
<input name="title" defaultValue={state.values?.title} aria-invalid={!!state.fieldErrors?.title} />
{state.fieldErrors?.title && <p role="alert">{state.fieldErrors.title[0]}</p>}`,
    tip: 'Скажи: ожидаемые ошибки возвращаем, неожиданные бросаем. Это простое правило сразу расставляет всё по местам.' },

  { id: 'rx13',
    q: 'Что даёт useActionState и чем он отличается от связки useState + обработчик?',
    a: `<p><code>useActionState(action, initialState, permalink?)</code> возвращает <code>[state, formAction, isPending]</code>. Он берёт на себя три вещи, которые раньше писали руками: хранение результата экшена, флаг ожидания и обёртку вызова в транзишен.</p>
    <p>Сигнатура экшена меняется: он получает <strong>предыдущее состояние первым аргументом</strong> и <code>formData</code> вторым. По сути это редьюсер, у которого переход асинхронный и живёт на сервере. Возвращённое значение становится новым состоянием.</p>
    <p>Главное преимущество перед ручным вариантом — <strong>прогрессивное улучшение</strong>: если передать <code>formAction</code> в <code>action</code> формы, форма работает и до гидратации, и вообще без JS. Обработчик <code>onSubmit</code> так не умеет. Третий аргумент <code>permalink</code> задаёт URL для редиректа в no-JS сценарии.</p>
    <p>Ограничения: состояние не сбрасывается автоматически, форма очищается только при успехе и только если она uncontrolled; для оптимистичных обновлений нужен отдельный <code>useOptimistic</code>. В React 18 это <code>useFormState</code> из <code>react-dom</code>, в 19 — <code>useActionState</code> из <code>react</code>.</p>`,
    code: `'use client';
import { useActionState } from 'react';

const initial = { message: '', fieldErrors: {} as Record<string, string[]> };

export function PostForm() {
  const [state, formAction, isPending] = useActionState(createPost, initial);
  return (
    <form action={formAction}>
      <input name="title" />
      {state.fieldErrors.title && <p role="alert">{state.fieldErrors.title[0]}</p>}
      <button disabled={isPending}>{isPending ? 'Сохраняем...' : 'Сохранить'}</button>
    </form>
  );
}`,
    tip: 'Назови useActionState асинхронным редьюсером - метафора точная и хорошо запоминается интервьюером.' },

  { id: 'rx14',
    q: 'Как работает useOptimistic и в чём его тонкости?',
    a: `<p><code>useOptimistic(actualState, updateFn)</code> возвращает <code>[optimisticState, addOptimistic]</code>. Пока идёт транзишен, React рендерит состояние, полученное применением <code>updateFn</code> к реальному. Как только транзишен завершается — оптимистичное значение <strong>автоматически отбрасывается</strong> и UI показывает реальное.</p>
    <p>Это и есть его главная фича: <strong>откат при ошибке бесплатный</strong>. Не надо вручную возвращать старое значение в catch — React просто перестаёт применять оптимистичный слой. Именно поэтому <code>addOptimistic</code> обязан вызываться внутри транзишена или Action, иначе он не сработает.</p>
    <p>Тонкость с ключами в списках: у оптимистичного элемента ещё нет серверного id. Ставят временный id (nanoid, crypto.randomUUID) и флаг <code>pending</code>, чтобы визуально пригасить элемент. После ревалидации сервер вернёт настоящий элемент, а оптимистичный исчезнет.</p>
    <p>Где не подходит: длинные операции (оплата, генерация отчёта) — врать пользователю на 10 секунд плохо. И операции, где вероятность ошибки высока: постоянный откат раздражает сильнее, чем спиннер.</p>`,
    code: `const [optimisticTodos, addOptimistic] = useOptimistic(
  todos,
  (state: Todo[], newText: string) => [
    ...state,
    { id: 'tmp-' + crypto.randomUUID(), text: newText, pending: true },
  ]
);

async function action(formData: FormData) {
  const text = formData.get('text') as string;
  addOptimistic(text);          // внутри Action -> транзишен есть
  await createTodo(text);       // ошибка -> откат сам собой
}

<ul>{optimisticTodos.map(t => (
  <li key={t.id} style={{ opacity: t.pending ? 0.5 : 1 }}>{t.text}</li>
))}</ul>`,
    tip: 'Ключевая мысль: useOptimistic не хранит состояние, он накладывает временный слой поверх реального. Отсюда автоматический откат.' },

  { id: 'rx15',
    q: 'Что такое useFormStatus и почему его нельзя вызвать в самом компоненте формы?',
    a: `<p><code>useFormStatus</code> из <code>react-dom</code> возвращает <code>{ pending, data, method, action }</code> для ближайшей формы <strong>выше по дереву</strong>. Он читает статус через контекст, который React ставит на <code>&lt;form&gt;</code>.</p>
    <p>Отсюда ограничение: хук работает только в компоненте, отрендеренном <strong>внутри</strong> формы. Если вызвать его в том же компоненте, который рендерит <code>&lt;form&gt;</code>, вернётся <code>pending: false</code> — форма ещё не выше, она на том же уровне.</p>
    <p>Зачем он вообще нужен, если <code>useActionState</code> уже даёт <code>isPending</code>: чтобы делать переиспользуемые компоненты вроде <code>&lt;SubmitButton /&gt;</code> в дизайн-системе, которые ничего не знают о конкретной форме и не требуют прокидывания пропсов. Кнопка просто вставляется в любую форму и сама блокируется.</p>
    <p>Поле <code>data</code> — это FormData отправляемой формы, из него можно показать «Отправляем сообщение для X» прямо во время запроса.</p>`,
    code: `'use client';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending, data } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? 'Отправляем ' + (data?.get('name') ?? '') : children}
    </button>
  );
}

// использование - кнопка ничего не знает о форме
<form action={formAction}>
  <input name="name" />
  <SubmitButton>Отправить</SubmitButton>
</form>`,
    tip: 'Готовый ответ на подвох: если useFormStatus вернул pending false - почти всегда хук вызван в том же компоненте, где объявлен form.' },

  { id: 'rx16',
    q: 'Что такое прогрессивное улучшение форм в React 19 / Next и зачем оно нужно в 2026?',
    a: `<p>Прогрессивное улучшение — форма работает как обычная HTML-форма, пока JS не загрузился или не выполнился, а после гидратации превращается в SPA-взаимодействие. React 19 делает это возможным: <code>&lt;form action={serverAction}&gt;</code> до гидратации отправляется браузером обычным POST, после — перехватывается React.</p>
    <p>Зачем реально: медленные сети и слабые устройства (окно между FCP и гидратацией на 3G это секунды, и клики в нём теряются), заблокированный JS корпоративными политиками, ошибки загрузки чанков, боты и краулеры. Плюс SEO и доступность идут бонусом.</p>
    <p>Практические требования: все поля должны иметь <code>name</code>; состояние берём из <code>defaultValue</code>, а не из <code>value</code> с <code>onChange</code> (иначе без JS поле не заполнится); нельзя полагаться на <code>onSubmit</code> с <code>preventDefault</code>; ошибки должны рендериться серверно.</p>
    <p>Честная оговорка: за это платят. Полностью контролируемые формы с богатой инлайн-валидацией и прогрессивное улучшение — разные подходы. В админке за логином прогрессивное улучшение почти никогда не стоит усилий; в публичных формах (регистрация, чекаут, поиск) — стоит.</p>`,
    code: `// работает без JS: обычный POST, ответ - серверный HTML с ошибками
export function Subscribe() {
  const [state, formAction] = useActionState(subscribe, { error: null });
  return (
    <form action={formAction}>
      <input name="email" type="email" required defaultValue={state.email} />
      {state.error && <p role="alert">{state.error}</p>}
      <SubmitButton>Подписаться</SubmitButton>
    </form>
  );
}
// required и type="email" - это тоже прогрессивное улучшение: браузерная валидация бесплатно`,
    tip: 'Хороший ход - назвать конкретную цену: контролируемые поля и мгновенная валидация плохо совместимы с no-JS. Показать, что ты видишь компромисс, а не только пользу.' },

  { id: 'rx17',
    q: 'Что React 19 принёс для метаданных документа и ресурсов? Заменяет ли это react-helmet?',
    a: `<p>React 19 умеет <strong>хостить теги</strong>: <code>&lt;title&gt;</code>, <code>&lt;meta&gt;</code>, <code>&lt;link&gt;</code>, рендерённые в любом месте дерева, автоматически поднимаются в <code>&lt;head&gt;</code> — и при SSR, и на клиенте. Для типовых случаев это действительно закрывает react-helmet без библиотеки.</p>
    <p>Стили: <code>&lt;link rel="stylesheet" precedence="default"&gt;</code> — React дедуплицирует их и управляет порядком вставки по precedence, а на клиенте <strong>ждёт загрузки стиля перед коммитом</strong>, что убирает вспышку нестилизованного контента. Стиль с precedence также приостанавливает Suspense.</p>
    <p>Скрипты: <code>&lt;script async src&gt;</code> можно рендерить где угодно, React дедуплицирует по src. Плюс императивные API из <code>react-dom</code>: <code>preload</code>, <code>preinit</code>, <code>preconnect</code>, <code>prefetchDNS</code> — для управления приоритетами загрузки.</p>
    <p>Оговорка: React не решает конфликты, если два компонента отрендерят разный <code>&lt;title&gt;</code> — победит последний в порядке коммита, детерминированной приоритизации как у Helmet нет. В Next App Router для метаданных всё равно используют экспорт <code>metadata</code> и <code>generateMetadata</code>, потому что они работают на этапе стриминга head.</p>`,
    code: `function Article({ post }: { post: Post }) {
  return (
    <article>
      <title>{post.title} — Блог</title>
      <meta name="description" content={post.excerpt} />
      <link rel="canonical" href={'https://site.ru/posts/' + post.slug} />
      <link rel="stylesheet" href="/article.css" precedence="default" />
      <h1>{post.title}</h1>
    </article>
  );
}

import { preload, preinit } from 'react-dom';
preload('/fonts/inter.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });`,
    tip: 'Отметь нюанс: в Next App Router нативный metadata API остаётся предпочтительным, потому что он участвует в стриминге head раньше, чем отрендерятся компоненты.' },

  { id: 'rx18',
    q: 'Что такое Actions в React 19 как концепция, а не набор хуков?',
    a: `<p>Actions — это соглашение: <strong>асинхронная функция, выполненная внутри транзишена</strong>, автоматически получает управление pending-состоянием, обработкой ошибок и откатом оптимистичных обновлений. React 19 разрешил передавать async-функции в <code>startTransition</code> — это фундамент всего остального.</p>
    <p>Поверх этого построены: <code>&lt;form action={fn}&gt;</code> (сабмит запускает Action), <code>useActionState</code> (Action как редьюсер), <code>useFormStatus</code> (статус ближайшей формы), <code>useOptimistic</code> (временный слой поверх состояния). Плюс атрибуты <code>formAction</code> на кнопках, чтобы одна форма имела несколько экшенов.</p>
    <p>Что это убирает из кода: ручные <code>isLoading</code>, <code>error</code>, <code>try/catch/finally</code>, ручной сброс формы (uncontrolled-форма очищается сама при успехе), ручной откат оптимистики. Плюс несколько последовательных Actions React ставит в очередь, а не гонит параллельно.</p>
    <p>Важно: Actions не привязаны к серверу. Обычная клиентская async-функция, вызывающая fetch, — тоже Action. Server Actions это частный случай, где функция физически исполняется на сервере.</p>`,
    code: `// Action без всякого сервера
function Profile() {
  const [error, submit, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const res = await fetch('/api/name', { method: 'POST', body: formData });
      if (!res.ok) return 'Не удалось сохранить';
      return null;
    },
    null
  );
  return (
    <form action={submit}>
      <input name="name" />
      <button disabled={isPending}>Сохранить</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}`,
    tip: 'Проведи границу явно: Actions - это про транзишены и жизненный цикл мутации, Server Actions - про то, где код исполняется. Их часто смешивают.' },

  { id: 'rx19',
    q: 'Как работает React Compiler? Что он делает с кодом?',
    a: `<p>React Compiler — это плагин к Babel/SWC, который на этапе сборки анализирует компоненты и хуки и <strong>вставляет мемоизацию автоматически</strong>. Результат — в компонент добавляется массив-кеш (внутренний хук <code>useMemoCache</code>), где по слотам хранятся значения и их зависимости.</p>
    <p>Механика: компилятор строит промежуточное представление (HIR), делает анализ псевдонимов и мутаций, определяет, какие значения реактивны и от чего зависят, и генерирует эквивалент <code>useMemo</code>/<code>useCallback</code>/<code>memo</code> — но <strong>гранулярнее</strong>, чем это делают руками: он может мемоизировать отдельные части JSX-дерева, а не только компонент целиком.</p>
    <p>Ключевое отличие от ручной мемоизации: компилятор мемоизирует по умолчанию всё, что можно, а разработчик — только то, где заметил проблему. Плюс компилятор не ошибается в массиве зависимостей.</p>
    <p>Важно: он не ускоряет медленные вычисления и не убирает лишние эффекты. Он убирает <strong>каскадные ререндеры</strong> из-за нестабильных ссылок. Если ваша проблема в 5000 DOM-узлов, компилятор не поможет — нужна виртуализация.</p>`,
    code: `// вы пишете так
function Cart({ items, onRemove }) {
  const total = items.reduce((s, i) => s + i.price, 0);
  return <List items={items} total={total} onRemove={onRemove} />;
}

// компилятор генерирует примерно это
function Cart({ items, onRemove }) {
  const $ = useMemoCache(4);
  let total;
  if ($[0] !== items) {
    total = items.reduce((s, i) => s + i.price, 0);
    $[0] = items; $[1] = total;
  } else { total = $[1]; }
  // ... аналогично кешируется JSX-элемент
}`,
    tip: 'Скажи, что компилятор мемоизирует части JSX, а не только вычисления - это то, чего ручной useMemo практически не делает.' },

  { id: 'rx20',
    q: 'Что ломает React Compiler и когда он отказывается оптимизировать компонент?',
    a: `<p>Компилятор консервативен: если он не может доказать безопасность, он <strong>пропускает компонент</strong> целиком (bail out), а не генерирует неправильный код. Смотреть, что пропущено, можно через eslint-плагин и через флаг компилятора в отчёте сборки.</p>
    <p>Что вызывает пропуск: нарушение правил хуков; мутация пропсов или значений, полученных снаружи; чтение и запись рефов во время рендера; использование <code>this</code>; нестандартный синтаксис, который он не понимает; директива <code>'use no memo'</code>, поставленная вручную.</p>
    <p>Что реально <strong>ломается</strong> (не пропускается, а меняет поведение): код, который случайно полагался на то, что объект пересоздаётся каждый рендер. Например, эффект с зависимостью от объекта, который раньше срабатывал постоянно, а теперь не срабатывает. Или сравнение по ссылке, которое раньше всегда давало false. Это не баг компилятора — это был скрытый баг в коде.</p>
    <p>Отдельно: нестабильные объекты из сторонних хуков компилятор не чинит — он не видит их внутренностей. Ручная мемоизация остаётся нужной для интеграции с чужими библиотеками и для измеренных узких мест.</p>`,
    code: `// компилятор пропустит: мутация пропа
function Bad({ config }) {
  config.mode = 'dark';          // мутация внешнего значения
  return <View config={config} />;
}

// компилятор пропустит: чтение рефа в рендере
function Bad2() {
  const ref = useRef(0);
  return <div>{ref.current}</div>;   // нарушение чистоты
}

// точечное отключение
function Legacy() {
  'use no memo';
  // ...
}`,
    tip: 'Сильная формулировка: компилятор не создаёт баги, он проявляет уже существующие нарушения чистоты рендера. Именно так это и подают в команде React.' },

  { id: 'rx21',
    q: 'Зачем StrictMode вызывает эффекты дважды и что именно он проверяет?',
    a: `<p>В dev StrictMode делает три вещи: двойной вызов рендер-функций (и <code>useMemo</code>, редьюсеров, инициализаторов состояния), двойной цикл эффектов (setup → cleanup → setup) и предупреждения об устаревших API.</p>
    <p>Двойной рендер ловит <strong>нечистоту</strong>: мутацию внешних переменных, запись в рефы во время рендера, зависимость от <code>Date.now()</code>. Если результат двух рендеров различается — компонент нечист, и это сломается при конкурентном рендеринге, где React может рендерить, бросать и перезапускать работу.</p>
    <p>Двойной цикл эффектов симулирует <strong>размонтирование и повторное монтирование</strong>. Это готовит код к будущим фичам вроде сохранения состояния при возврате назад (Offscreen/Activity), где компонент реально может смонтироваться повторно. Ловит: утёкшие подписки, незакрытые сокеты, неотменённые таймеры, дублирующиеся запросы.</p>
    <p>Правильная реакция на «эффект вызвался дважды» — <strong>не считать вызовы, а написать корректный cleanup</strong>. Если эффект идемпотентен с cleanup, двойной вызов ничего не ломает. Костыли с <code>useRef(false)</code> маскируют реальную проблему.</p>`,
    code: `// плохо: маскируем симптом
const done = useRef(false);
useEffect(() => {
  if (done.current) return;
  done.current = true;
  fetchData();
}, []);

// хорошо: cleanup делает эффект безопасным
useEffect(() => {
  const ac = new AbortController();
  fetchData({ signal: ac.signal })
    .then(setData)
    .catch(e => { if (e.name !== 'AbortError') setError(e); });
  return () => ac.abort();
}, []);`,
    tip: 'Ключевая фраза: StrictMode не создаёт проблему, он делает видимым отсутствие cleanup. И добавь, что в проде двойного вызова нет.' },

  { id: 'rx22',
    q: 'Как порталы взаимодействуют с всплытием событий? Куда всплывёт клик из портала?',
    a: `<p>Портал меняет <strong>место в DOM</strong>, но не место в React-дереве. Поэтому синтетическое событие всплывает по React-дереву: клик внутри модалки, отрендеренной в <code>document.body</code>, придёт в <code>onClick</code> родительского компонента, хотя в DOM они не вложены друг в друга.</p>
    <p>Это удобно (контекст, темы, обработчики работают как обычно), но регулярно приводит к багу: выпадающее меню в портале закрывается по «клику снаружи», навешанному через нативный listener на document — потому что нативно клик действительно вне контейнера, а React считает иначе. Смешивать нативные и синтетические обработчики в одном сценарии опасно.</p>
    <p>Второй классический баг: портал внутри элемента с <code>onClick</code>, который что-то закрывает — клик по модалке неожиданно закрывает подложку. Лечится <code>stopPropagation</code> в портале либо переносом обработчика.</p>
    <p>Зачем порталы нужны: обход <code>overflow: hidden</code>, <code>z-index</code>-стеков и <code>transform</code> (который создаёт containing block для fixed). Для модалок в 2026 часто вместо портала берут нативный <code>&lt;dialog&gt;</code> с top layer — там проблем со стекингом нет вовсе.</p>`,
    code: `function Modal({ children, onClose }: Props) {
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}

// Ловушка: этот листенер видит нативный target, а не React-дерево
useEffect(() => {
  const h = (e: MouseEvent) => {
    if (!menuRef.current?.contains(e.target as Node)) close();  // портал => contains false
  };
  document.addEventListener('click', h);
  return () => document.removeEventListener('click', h);
}, []);`,
    tip: 'Назови конкретный баг с click-outside и порталом - это показывает, что ты писал модалки в проде, а не читал доку.' },

  { id: 'rx23',
    q: 'Как устроены синтетические события и что изменилось в React 17+?',
    a: `<p>React не вешает listener на каждый элемент. Он использует <strong>делегирование</strong>: один набор обработчиков на корневой контейнер, а дальше React сам восстанавливает путь всплытия по Fiber-дереву и вызывает нужные <code>onClick</code>. Событие оборачивается в SyntheticEvent — кроссбраузерную обёртку с нормализованным API.</p>
    <p>Главное изменение React 17: обработчики вешаются на <strong>корневой контейнер</strong> (то, что передали в <code>createRoot</code>), а не на <code>document</code>. Это позволило спокойно держать на странице несколько версий React и постепенно мигрировать, а также перестало ломать интеграцию с не-React виджетами: раньше <code>stopPropagation</code> в чужом коде не спасал, потому что React уже поймал событие на document.</p>
    <p>Второе изменение React 17: <strong>убран event pooling</strong>. Больше не нужно вызывать <code>e.persist()</code>, чтобы прочитать поля события в асинхронном коде.</p>
    <p>Также в React 17 <code>onScroll</code> перестал всплывать (соответствует нативному поведению), а <code>onFocus</code>/<code>onBlur</code> под капотом используют <code>focusin</code>/<code>focusout</code>. Не все события делегируются: media-события, <code>scroll</code>, некоторые другие вешаются напрямую на элемент.</p>`,
    code: `// React 17+: pooling нет, это работает
function onChange(e: React.ChangeEvent<HTMLInputElement>) {
  setTimeout(() => console.log(e.target.value), 100);  // ок без e.persist()
}

// Нативный listener в capture-фазе выполнится РАНЬШЕ React-обработчика,
// потому что React слушает на корневом контейнере
useEffect(() => {
  const el = ref.current!;
  el.addEventListener('click', native);      // порядок относительно onClick надо проверять
  return () => el.removeEventListener('click', native);
}, []);`,
    tip: 'Мало кто помнит вторую часть - зачем именно переносили на root: чтобы можно было держать два React на странице при постепенной миграции. Назови эту причину.' },

  { id: 'rx24',
    q: 'Как работают ref-колбэки и что там с cleanup в React 19?',
    a: `<p>Ref-колбэк вызывается с DOM-узлом при монтировании. Исторически при размонтировании React вызывал его повторно с <code>null</code> — приходилось писать <code>if (node) {...} else {...}</code>. В React 19 колбэк может <strong>вернуть функцию очистки</strong>, и тогда React вызовет её вместо повторного вызова с null. Код становится симметричным как в эффекте.</p>
    <p>Вторая важная деталь: <strong>инлайновый ref-колбэк пересоздаётся каждый рендер</strong>, поэтому React отвяжет его (вызовет cleanup или null) и привяжет заново — на каждом рендере. Если внутри дорогая работа (создание observer, подписка), её надо стабилизировать через <code>useCallback</code>.</p>
    <p>Ref-колбэк — единственный способ узнать о появлении узла <strong>синхронно и точечно</strong>: он вызывается до эффектов и в момент, когда узел реально появился. Это делает его подходящим для измерений, для рефов на элементы списка (объект-ref не умеет в динамическую коллекцию) и для интеграции с observer-ами.</p>
    <p>Ловушка React 19: стрелка с неявным возвратом <code>ref={el =&gt; (map[id] = el)}</code> теперь считается возвратом cleanup и падает с ошибкой. Обязательно фигурные скобки.</p>`,
    code: `// React 19: cleanup прямо в ref
const measureRef = useCallback((node: HTMLElement | null) => {
  if (!node) return;
  const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
  ro.observe(node);
  return () => ro.disconnect();
}, []);

<div ref={measureRef} />

// коллекция рефов для списка
const nodes = useRef(new Map<string, HTMLElement>());
{items.map(i => (
  <li key={i.id} ref={(el) => {
    if (el) nodes.current.set(i.id, el); else nodes.current.delete(i.id);
  }}>{i.text}</li>
))}`,
    tip: 'Обязательно упомяни, что инлайновый ref-колбэк отвязывается и привязывается на каждом рендере - это реальный источник багов с observer-ами.' },

  { id: 'rx25',
    q: 'В каком порядке выполняются эффекты и cleanup при обновлении дерева?',
    a: `<p>Порядок обхода — <strong>снизу вверх</strong> (дети раньше родителей), потому что React завершает работу над Fiber-узлом только после всех потомков. Это касается и <code>useEffect</code>, и <code>useLayoutEffect</code>.</p>
    <p>При обновлении React делает это в две фазы: сначала <strong>все cleanup</strong> по дереву, потом <strong>все setup</strong>. Не «cleanup+setup для каждого компонента по очереди». Это важно: cleanup родителя выполнится раньше, чем setup ребёнка. Внутри одного компонента несколько эффектов идут в порядке объявления, cleanup — тоже в порядке объявления (не в обратном).</p>
    <p>Layout-эффекты выполняются синхронно в фазе commit, до отрисовки браузером. Обычные эффекты — асинхронно после paint. Значит все <code>useLayoutEffect</code> всего дерева отработают раньше первого <code>useEffect</code>.</p>
    <p>Практический вывод: не полагаться на порядок эффектов между братскими компонентами и не строить на нём логику. Если нужен гарантированный порядок (замерить, потом подписаться) — это два эффекта в одном компоненте или явная координация через ref.</p>`,
    code: `// Дерево: Parent > Child
// Монтирование:
//   Child layout -> Parent layout -> paint -> Child effect -> Parent effect
// Обновление:
//   Child layout cleanup -> Parent layout cleanup
//   -> Child layout setup  -> Parent layout setup -> paint
//   -> Child effect cleanup -> Parent effect cleanup
//   -> Child effect setup   -> Parent effect setup

useEffect(() => { console.log('A setup'); return () => console.log('A cleanup'); });
useEffect(() => { console.log('B setup'); return () => console.log('B cleanup'); });
// обновление: A cleanup, B cleanup, A setup, B setup`,
    tip: 'Ключевой факт, который проверяют: при обновлении сначала все cleanup по дереву, только потом все setup. Многие думают, что это чередуется покомпонентно.' },

  { id: 'rx26',
    q: 'Что такое автоматический батчинг и когда нужен flushSync?',
    a: `<p>Батчинг — объединение нескольких <code>setState</code> в один рендер. До React 18 батчились только обновления внутри React-обработчиков; в промисах, <code>setTimeout</code> и нативных listener-ах каждый setState давал отдельный рендер. С React 18 и <code>createRoot</code> батчинг <strong>автоматический везде</strong>.</p>
    <p>Механически это микротаск: React ставит обновления в очередь и планирует рендер, а не рендерит синхронно. Поэтому сразу после <code>setState</code> в переменной всё ещё старое значение.</p>
    <p><code>flushSync</code> из <code>react-dom</code> заставляет React выполнить рендер и коммит <strong>синхронно</strong> до выхода из вызова. Легитимные кейсы: нужно сразу после обновления прочитать реальный DOM (измерить высоту после добавления элемента, проскроллить к новому узлу, поставить фокус на только что появившийся инпут). Ещё — интеграция со сторонним кодом, ожидающим синхронный DOM, и печать через <code>window.print()</code>.</p>
    <p>Цена высокая: <code>flushSync</code> ломает батчинг, заставляет React отрендерить всё дерево синхронно, блокирует поток и отменяет преимущества конкурентного рендеринга. React явно предупреждает о деградации производительности. Это скальпель, а не инструмент по умолчанию.</p>`,
    code: `import { flushSync } from 'react-dom';

function addAndScroll(item: Item) {
  flushSync(() => {
    setItems(prev => [...prev, item]);   // коммит произойдёт до следующей строки
  });
  listRef.current!.scrollTop = listRef.current!.scrollHeight;  // DOM уже обновлён
}

// без flushSync здесь был бы старый scrollHeight

// Отказ от батчинга не нужен для чтения состояния - для этого функциональный апдейт
setCount(c => c + 1);
setCount(c => c + 1);   // 2, а не 1`,
    tip: 'Назови конкретный кейс - измерить DOM или проскроллить к новому элементу. Абстрактное нужен синхронный рендер звучит как заученная фраза.' },

  { id: 'rx27',
    q: 'Что такое ленивая инициализация useState и когда её реально надо применять?',
    a: `<p>Если передать в <code>useState</code> значение, выражение вычислится <strong>на каждом рендере</strong>, хотя React использует его только при первом. Передача функции-инициализатора решает это: React вызовет её только один раз при монтировании.</p>
    <p>Разница видна там, где вычисление дорогое: парсинг из <code>localStorage</code> (это ещё и синхронный доступ к диску), <code>JSON.parse</code> большой строки, генерация коллекции, создание Map из массива на тысячи элементов. На каждом рендере это чистая потеря.</p>
    <p>То же самое для <code>useReducer</code>: третий аргумент — функция <code>init</code>, которая получает второй аргумент и возвращает начальное состояние. Удобно, чтобы переиспользовать её для сброса при <code>dispatch({type:'reset'})</code>.</p>
    <p>Что важно понимать: ленивый инициализатор экономит вычисление, а не «правильность» — на результат это не влияет. И типичная ошибка: <code>useState(createStore())</code> вместо <code>useState(createStore)</code> — во втором случае функция передана, в первом вызвана. А если начальное значение само функция, её надо обернуть: <code>useState(() =&gt; myFn)</code>.</p>`,
    code: `// плохо: JSON.parse на каждом рендере
const [state, setState] = useState(JSON.parse(localStorage.getItem('draft') ?? '{}'));

// хорошо: один раз при монтировании
const [state, setState] = useState(() => {
  try { return JSON.parse(localStorage.getItem('draft') ?? '{}'); }
  catch { return {}; }
});

// useReducer с init - переиспользуем для сброса
function init(items: Item[]) { return { items, index: new Map(items.map(i => [i.id, i])) }; }
const [state, dispatch] = useReducer(reducer, rawItems, init);`,
    tip: 'Добавь ловушку: если начальное состояние само является функцией, useState вызовет её как инициализатор - нужно двойное оборачивание.' },

  { id: 'rx28',
    q: 'Что такое производный стейт и почему синхронизация через useEffect — антипаттерн?',
    a: `<p>Производное состояние — то, что вычисляется из пропсов и другого состояния. Правило: <strong>если можно вычислить в рендере — вычисляй в рендере</strong>, не храни в <code>useState</code> и не синхронизируй эффектом.</p>
    <p>Почему эффект плох. Во-первых, лишний цикл: рендер со старым значением → коммит → эффект → setState → второй рендер. Пользователь на кадр видит неактуальные данные. Во-вторых, появляется два источника истины, которые рассинхронизируются при любой забытой зависимости. В-третьих, при SSR первый HTML содержит неправильное значение.</p>
    <p>Правильные альтернативы по возрастанию сложности: просто вычислить в теле; обернуть в <code>useMemo</code>, если вычисление дорогое (замеренно, а не «на всякий случай»); при необходимости <strong>сбросить</strong> состояние при смене пропа — использовать <code>key</code> на компоненте; в редком случае «частичного сброса» — паттерн React с хранением предыдущего пропа и корректировкой прямо в рендере (React перезапустит рендер, не показав промежуточный кадр — это дешевле эффекта).</p>
    <p>Легитимные случаи для эффекта — только реальная синхронизация с внешним миром: подписка, таймер, ручной DOM, аналитика.</p>`,
    code: `// антипаттерн
const [full, setFull] = useState('');
useEffect(() => { setFull(first + ' ' + last); }, [first, last]);  // лишний рендер

// правильно
const full = first + ' ' + last;

// сброс состояния при смене сущности - через key, а не через эффект
<ProfileForm key={userId} userId={userId} />

// редкий случай: корректировка в рендере (быстрее эффекта)
const [prevId, setPrevId] = useState(userId);
if (userId !== prevId) {
  setPrevId(userId);
  setSelection(null);       // React перезапустит рендер до отрисовки
}`,
    tip: 'Скажи про третий вариант - корректировку состояния прямо в рендере. Это официально задокументированный паттерн, и его почти никто не называет.' },

  { id: 'rx29',
    q: 'Как использовать key для сброса состояния компонента и когда это лучше useEffect?',
    a: `<p>При изменении <code>key</code> React считает элемент <strong>другим компонентом</strong>: размонтирует старый (со всеми cleanup) и монтирует новый с чистым состоянием. Это самый декларативный способ сказать «здесь теперь другая сущность».</p>
    <p>Типовые кейсы: форма редактирования при переключении пользователя (<code>key={userId}</code>), сброс аккордеона/табов при смене раздела, перезапуск Suspense-границы или Error Boundary при повторной попытке, сброс сторонней библиотеки, которая не умеет обновляться по пропсам.</p>
    <p>Почему лучше эффекта: нет промежуточного кадра со старым состоянием, нет ручного перечисления полей для сброса, ничего не забудешь при добавлении нового состояния. Сброс происходит в один проход рендера.</p>
    <p>Цена: полный размонтаж — теряется вообще всё, включая позицию скролла, фокус, незакоммиченные значения, и все эффекты перезапускаются. Если нужно сбросить только часть состояния, key избыточен — тогда либо корректировка в рендере, либо вынести сбрасываемую часть в отдельный подкомпонент со своим key.</p>`,
    code: `// сброс формы при смене пользователя
<ProfileForm key={user.id} user={user} />

// перезапуск Error Boundary
const [attempt, setAttempt] = useState(0);
<ErrorBoundary key={attempt} fallback={<Retry onRetry={() => setAttempt(a => a + 1)} />}>
  <Widget />
</ErrorBoundary>

// сброс только части состояния: выносим её в подкомпонент
<Layout>
  <Sidebar />                        {/* сохраняет состояние */}
  <Content key={sectionId} />        {/* сбрасывается */}
</Layout>`,
    tip: 'Уточни, что key на компоненте - это ещё и способ перезапустить Suspense или Error Boundary; типовой вопрос про кнопку Повторить.' },

  { id: 'rx30',
    q: 'Controlled vs uncontrolled компоненты: как выбираешь и где граница?',
    a: `<p>Controlled: значение живёт в React-состоянии, DOM — производная (<code>value</code> + <code>onChange</code>). Uncontrolled: значение живёт в DOM, React читает его через ref или из <code>FormData</code> (<code>defaultValue</code>).</p>
    <p>Controlled нужен, когда значение <strong>влияет на рендер прямо сейчас</strong>: валидация на лету, зависимые поля, маски и форматирование, счётчик символов, дизейбл кнопки по содержимому, синхронизация с URL. Цена — рендер на каждое нажатие клавиши, что на большой форме заметно.</p>
    <p>Uncontrolled уместен, когда значение нужно только при сабмите: обычные CRUD-формы, поиск, фильтры. Плюс он обязателен для <code>&lt;input type="file"&gt;</code> (значение нельзя задать программно) и сильно проще для прогрессивного улучшения — форма работает без JS.</p>
    <p>Практика в 2026: React Hook Form по умолчанию uncontrolled и подписывается на конкретные поля, поэтому не перерисовывает форму на каждый ввод — это компромисс, дающий и производительность, и валидацию. Ключевая ловушка контролируемого поля: <code>value={undefined}</code> делает поле неконтролируемым, а последующая установка строки даёт варнинг о смене режима; всегда <code>?? ''</code>.</p>`,
    code: `// controlled: нужен для зависимой логики
<input value={query} onChange={e => setQuery(e.target.value)} />

// uncontrolled: значение читается при сабмите
<form onSubmit={e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget));
}}>
  <input name="email" defaultValue={user.email} />
</form>

// ловушка: undefined делает поле неконтролируемым
<input value={user.name ?? ''} onChange={onChange} />`,
    tip: 'Разграничение, которое звучит по-сеньорски: контролируемое поле нужно тогда, когда значение влияет на рендер до сабмита. Всё остальное - неконтролируемое.' },

  { id: 'rx31',
    q: 'Почему React Hook Form быстрее контролируемых форм и в чём его подводные камни?',
    a: `<p>RHF по умолчанию работает с <strong>неконтролируемыми полями</strong>: <code>register</code> вешает ref и нативные обработчики, значения живут в DOM и в внутреннем сторе библиотеки, а не в React-состоянии. Ввод символа не вызывает ререндер формы вообще — только точечную подписку, если она есть.</p>
    <p>Подписки построены на прокси: <code>formState</code> отслеживает, к каким полям вы реально обратились. Если вы не читаете <code>errors.email</code>, изменение этой ошибки не вызовет рендер. Отсюда правило: деструктурировать <code>formState</code> надо до рендера, иначе прокси не зафиксирует подписку.</p>
    <p>Точечные ререндеры делаются через <code>useWatch</code> и <code>Controller</code> в конкретном месте, а не через <code>watch()</code> на уровне всей формы (последний перерисовывает всю форму).</p>
    <p>Подводные камни: сторонние UI-киты с контролируемыми инпутами требуют <code>Controller</code>, и там производительность возвращается к обычной; динамические поля через <code>useFieldArray</code> нуждаются в правильных ключах (<code>field.id</code>, не индекс); значения по умолчанию, приходящие асинхронно, требуют <code>reset</code> или асинхронного <code>defaultValues</code>; и <code>register</code> нужно спредить, а не вызывать как проп.</p>`,
    code: `const { register, handleSubmit, control, formState: { errors, isSubmitting } } =
  useForm<FormValues>({ resolver: zodResolver(Schema), mode: 'onBlur' });

<form onSubmit={handleSubmit(onValid)}>
  <input {...register('email')} aria-invalid={!!errors.email} />
  {errors.email && <p role="alert">{errors.email.message}</p>}

  {/* сторонний контролируемый компонент */}
  <Controller name="country" control={control}
    render={({ field }) => <Select {...field} options={countries} />} />

  {/* точечная подписка вместо watch() на всю форму */}
  <Total control={control} />
</form>

function Total({ control }) {
  const items = useWatch({ control, name: 'items' });   // перерисуется только Total
  return <b>{items.reduce((s, i) => s + i.price, 0)}</b>;
}`,
    tip: 'Упомяни прокси в formState и требование деструктурировать его до рендера - это неочевидная деталь, которая доказывает реальный опыт с библиотекой.' },

  { id: 'rx32',
    q: 'Форма на 100+ полей тормозит при вводе. Как ты будешь её чинить?',
    a: `<p>Сначала измеряю: React DevTools Profiler в режиме записи ввода. Смотрю, что именно рендерится на нажатие клавиши и сколько это стоит. Обычно виновата одна из трёх вещей: контролируемое состояние на уровне всей формы, валидация всей схемы на каждый keystroke, или тяжёлые дочерние компоненты без мемоизации.</p>
    <p>Шаг первый — <strong>убрать состояние формы из React</strong>: перейти на RHF/uncontrolled, чтобы ввод не рендерил дерево. Это обычно даёт основной выигрыш.</p>
    <p>Шаг второй — <strong>режим валидации</strong>: <code>onBlur</code> или <code>onTouched</code> вместо <code>onChange</code>, а после первой ошибки — <code>reValidateMode: 'onChange'</code>. Тяжёлые проверки (уникальность email) — debounce и отмена.</p>
    <p>Шаг третий — <strong>структура</strong>: разбить форму на секции-подкомпоненты (шаги, аккордеон, табы), рендерить только видимую; для длинных повторяющихся блоков — виртуализация; мемоизировать поля через <code>memo</code>, чтобы точечная подписка не тянула соседей.</p>
    <p>Если поля реально контролируемые по требованию бизнеса — изолировать состояние на уровне поля (локальный useState + onBlur наверх) вместо подъёма всего в родителя. И на крайний случай — <code>useDeferredValue</code> для дорогого превью, зависящего от формы.</p>`,
    code: `// изоляция состояния в поле вместо подъёма всей формы наверх
const Field = memo(function Field({ name, defaultValue, onCommit }) {
  const [local, setLocal] = useState(defaultValue);
  return (
    <input
      value={local}
      onChange={e => setLocal(e.target.value)}          // рендерится только это поле
      onBlur={() => onCommit(name, local)}              // наверх - только при уходе
    />
  );
});

// дорогое превью не блокирует ввод
const deferredValues = useDeferredValue(values);
<Preview values={deferredValues} />`,
    tip: 'Начни ответ со слова измерю и назови конкретный инструмент. Кандидаты, которые сразу сыплют оптимизациями без профилирования, теряют очки.' },

  { id: 'rx33',
    q: 'Как ты организуешь валидацию форм: где схема, где ошибки, что показывать пользователю?',
    a: `<p>Одна схема — <strong>единственный источник истины</strong>. Zod/Valibot схема лежит в общем модуле, тип формы выводится из неё через <code>z.infer</code>, resolver подключает её к RHF на клиенте, и та же схема валидирует на сервере. Ни одного повторно описанного правила.</p>
    <p>Три уровня валидации, и их надо различать: <strong>браузерная</strong> (required, type, pattern — работает без JS, бесплатно), <strong>клиентская схемная</strong> (быстрая обратная связь), <strong>серверная</strong> (единственная, которой можно доверять; плюс проверки, невозможные на клиенте — уникальность, права, остатки на складе).</p>
    <p>UX-правила: не показывать ошибку, пока поле не тронуто (<code>onTouched</code>), после первой ошибки валидировать на каждый ввод, чтобы пользователь видел исправление; фокус на первое невалидное поле при сабмите; ошибка связана с полем через <code>aria-describedby</code> и <code>aria-invalid</code>, контейнер с ошибкой имеет <code>role="alert"</code>.</p>
    <p>Серверные ошибки надо уметь класть на конкретные поля (<code>setError('email', ...)</code>), а не показывать общей плашкой — иначе пользователь не поймёт, что чинить.</p>`,
    code: `export const Schema = z.object({
  email: z.string().email('Некорректный email'),
  age: z.coerce.number().int().min(18, 'Только 18+'),
});
export type FormValues = z.infer<typeof Schema>;

const { setError, handleSubmit } = useForm<FormValues>({
  resolver: zodResolver(Schema),
  mode: 'onTouched',
  reValidateMode: 'onChange',
});

async function onValid(values: FormValues) {
  const res = await api.register(values);
  if (res.fieldErrors) {
    for (const [field, msgs] of Object.entries(res.fieldErrors)) {
      setError(field as keyof FormValues, { message: msgs[0] });  // серверные ошибки на поля
    }
  }
}`,
    tip: 'Назови три уровня валидации явно - браузерный, клиентский схемный, серверный. Это структурирует ответ и звучит как опыт, а не теория.' },

  { id: 'rx34',
    q: 'Когда нужна виртуализация списка и какие проблемы она приносит?',
    a: `<p>Виртуализация нужна, когда узкое место — <strong>количество DOM-узлов</strong>, а не количество React-рендеров. Признаки: тормозит скролл, а не обновление; память растёт линейно; профайлер показывает долгий commit, а не render. Порог сильно зависит от сложности строки: 200 тяжёлых карточек могут быть хуже 5000 простых строк.</p>
    <p>Механика: рендерим только видимое окно плюс overscan, остальное заменяем распорками нужной высоты. Библиотеки: <code>react-window</code> — самый лёгкий для фиксированных размеров (позиции считаются математически, без измерений), <code>@tanstack/react-virtual</code> — headless, лучший для таблиц, динамических высот и горизонтальной виртуализации, <code>react-virtuoso</code> — самый «из коробки» для сложных фидов.</p>
    <p>Что ломается: <strong>Ctrl+F по странице</strong> и печать (элементов физически нет); доступность (нужны корректные <code>aria-setsize</code>, <code>aria-posinset</code> и роль <code>listbox</code>/<code>grid</code>); якорные ссылки и восстановление скролла; sticky-заголовки; анимации входа/выхода. Динамические высоты требуют измерения и вызывают «прыжки» скролла, если оценка неточная.</p>
    <p>Альтернативы, которые часто дешевле: пагинация, <code>content-visibility: auto</code> в CSS (браузер сам пропускает отрисовку невидимого), упрощение разметки строки.</p>`,
    code: `import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48,
  overscan: 8,
});

<div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
  <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
    {rowVirtualizer.getVirtualItems().map(v => (
      <div key={rows[v.index].id}
           ref={rowVirtualizer.measureElement}
           data-index={v.index}
           style={{ position: 'absolute', top: 0, left: 0, width: '100%',
                    transform: 'translateY(' + v.start + 'px)' }}>
        <Row row={rows[v.index]} />
      </div>
    ))}
  </div>
</div>`,
    tip: 'Скажи про content-visibility auto как про более дешёвую альтернативу для средних списков - это редко называют, а решение часто рабочее.' },

  { id: 'rx35',
    q: 'Как ты профилируешь React-приложение в DevTools? Что смотришь в flamegraph и ranked?',
    a: `<p>Записываю профиль конкретного взаимодействия — не «приложение вообще», а «клик по фильтру» или «ввод символа». Дальше три вида.</p>
    <p><strong>Flamegraph</strong> показывает дерево одного коммита: ширина — время, серые узлы не рендерились. Здесь я ищу <strong>структурную</strong> проблему: почему при клике на кнопке перерисовалось всё дерево от корня — обычно это состояние, поднятое слишком высоко, или нестабильное значение контекста.</p>
    <p><strong>Ranked</strong> сортирует компоненты этого коммита по времени. Здесь я ищу <strong>точечную</strong> проблему: один компонент, который стоит 40мс. Обычно это тяжёлое вычисление или огромный список.</p>
    <p>Ключевая настройка — «Record why each component rendered»: она подписывает причину (изменились пропсы, состояние, контекст, родитель перерендерился) и конкретные пропы. Это отвечает на главный вопрос отладки. Также полезна полоса коммитов сверху: если на одно действие 5 коммитов вместо одного — есть каскад из эффектов.</p>
    <p>Дополнительно: подсветка обновлений в настройках DevTools для быстрой визуальной диагностики, компонент <code>&lt;Profiler&gt;</code> для программного сбора метрик в проде, и Performance-вкладка браузера с треком React для связи с long tasks и INP.</p>`,
    code: `// программный замер конкретного поддерева
<Profiler id="OrdersTable" onRender={(id, phase, actual, base, start, commit) => {
  if (actual > 16) analytics.track('slow_render', { id, phase, actual });
}}>
  <OrdersTable />
</Profiler>
// phase: 'mount' | 'update' | 'nested-update'
// actual - фактическое время, base - оценка без мемоизации`,
    tip: 'Проговори разницу назначения: flamegraph отвечает на вопрос кто виноват в каскаде, ranked - что именно медленно. Кандидаты обычно знают только про flamegraph.' },

  { id: 'rx36',
    q: 'Компонент перерендеривается, хотя пропсы «не менялись». Как ты найдёшь причину?',
    a: `<p>Сначала уточняю утверждение: «не менялись» обычно значит «не менялись по значению», а React сравнивает <strong>по ссылке</strong>. Объектный литерал, массив, стрелка, результат <code>.map()</code> в JSX — всё это новые ссылки каждый рендер.</p>
    <p>Порядок действий. Первое — Profiler с включённым «why did this render»: он прямо назовёт изменившийся проп или скажет «parent rendered». Второе — если причина «parent rendered», то компонент просто не мемоизирован: <code>memo</code> или передача через <code>children</code> (элемент, созданный выше, не пересоздаётся и потому не тригерит перерендер).</p>
    <p>Третье — если причина «context changed», значит значение контекста нестабильно или контекст слишком широкий: мемоизировать значение, разделить контекст, вынести dispatch.</p>
    <p>Четвёртое, менее очевидное — сторонние хуки, возвращающие новый объект каждый раз, и селекторы стора без сравнения (в Zustand/Redux нужен <code>useShallow</code> или <code>shallowEqual</code>). Пятое — <code>memo</code> есть, но кастомный компаратор написан неправильно или проп-функция не мемоизирована.</p>
    <p>Для отладки в конкретном месте — хук, сравнивающий пропсы с предыдущими и печатающий дифф.</p>`,
    code: `function useWhyDidYouUpdate(name: string, props: Record<string, unknown>) {
  const prev = useRef<Record<string, unknown>>();
  useEffect(() => {
    if (prev.current) {
      const changed = Object.entries(props)
        .filter(([k, v]) => prev.current![k] !== v)
        .map(([k, v]) => [k, { from: prev.current![k], to: v }]);
      if (changed.length) console.log('[why-update]', name, Object.fromEntries(changed));
    }
    prev.current = props;
  });
}

// частая причина: новая ссылка в JSX
<Table columns={[{ key: 'name' }]} onRow={r => open(r)} />   // оба пропа новые каждый рендер`,
    tip: 'Отдельно назови селекторы сторов без shallow-сравнения - это очень частая реальная причина, о которой почти не говорят на собеседованиях.' },

  { id: 'rx37',
    q: 'Как правильно мемоизировать значение контекста и когда нужно разделять контексты?',
    a: `<p>Контекст сравнивает значение <strong>по ссылке</strong> (Object.is). Если провайдер отдаёт литерал <code>{{ user, setUser }}</code>, ссылка новая на каждом рендере провайдера, и все потребители перерисовываются. Первый шаг — <code>useMemo</code> вокруг значения со всеми реальными зависимостями.</p>
    <p>Но мемоизация не решает вторую проблему: контекст не поддерживает селекторы. Если значение реально изменилось, обновятся <strong>все</strong> потребители, даже те, кому нужно другое поле. Отсюда разделение контекстов по частоте изменения и по домену: медленно меняющееся (тема, локаль, текущий пользователь) отдельно от быстро меняющегося (позиция курсора, черновик формы).</p>
    <p>Отдельный приём — вынести стабильные функции (dispatch, actions) в собственный контекст. Их потребители тогда не ререндерятся никогда.</p>
    <p>Ещё один слой оптимизации: провайдер, который рендерит <code>{children}</code> — дети приходят как готовые элементы сверху и не пересоздаются при рендере провайдера. И если всё это не хватает — переходить на внешний стор с <code>useSyncExternalStore</code> и селекторами, отдавая через контекст только ссылку на стор (она не меняется никогда).</p>`,
    code: `function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const actions = useMemo(() => ({
    login: (u: User) => setUser(u),
    logout: () => setUser(null),
  }), []);                                     // стабильно навсегда

  return (
    <UserCtx value={user}>
      <ActionsCtx value={actions}>{children}</ActionsCtx>
    </UserCtx>
  );
  // children пришли сверху - не пересоздаются при рендере провайдера
}`,
    tip: 'Сформулируй критерий разделения контекстов как разную частоту изменения, а не разный домен. Так решение звучит обоснованно, а не по вкусу.' },

  { id: 'rx38',
    q: 'Как ты проектируешь кастомные хуки? Какие правила отличают хороший хук от плохого?',
    a: `<p>Хук — это <strong>переиспользование логики, связанной с состоянием</strong>, а не способ спрятать код. Если функция не использует хуки внутри — это обычная утилита, не надо префикса use.</p>
    <p>Правила, которых я держусь. <strong>Одна ответственность</strong>: <code>useUser</code> не должен заодно ходить в аналитику. <strong>Стабильные ссылки на выходе</strong>: функции через <code>useCallback</code>, объект результата через <code>useMemo</code> — иначе хук становится источником лишних рендеров у всех потребителей. <strong>Явный контракт</strong>: возвращать кортеж для двух-трёх значений, объект — когда больше, чтобы не запоминать порядок.</p>
    <p><strong>Хук не должен решать за компонент, как рендерить</strong> — он возвращает данные и действия, а не JSX. <strong>Не делать хуки-обёртки над одним useState</strong> ради красоты. <strong>Разделять хуки данных и хуки UI</strong>: <code>useOrders</code> (запросы) и <code>useOrdersTable</code> (сортировка, выделение) — тестируются и переиспользуются независимо.</p>
    <p>Отдельный сильный приём — параметр-объект вместо позиционных аргументов для расширяемости, и приём событий (<code>onSuccess</code>) через ref, чтобы нестабильный колбэк не перезапускал эффект.</p>`,
    code: `function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// приём: нестабильный колбэк через ref, чтобы не перезапускать подписку
function useEvent<T extends (...args: any[]) => any>(fn: T) {
  const ref = useRef(fn);
  useLayoutEffect(() => { ref.current = fn; });
  return useCallback(((...args) => ref.current(...args)) as T, []);
}`,
    tip: 'Правило стабильные ссылки на выходе - самое ценное здесь. Хук, возвращающий новый объект каждый рендер, ломает мемоизацию всем своим потребителям.' },

  { id: 'rx39',
    q: 'Как ты тестируешь кастомные хуки?',
    a: `<p>Основной способ — <code>renderHook</code> из React Testing Library (с React 18 он вернулся в основной пакет, отдельная <code>@testing-library/react-hooks</code> больше не нужна). Он даёт <code>result.current</code> и <code>rerender</code> для смены пропсов.</p>
    <p>Обновления состояния оборачиваю в <code>act</code>, асинхронные — жду через <code>waitFor</code> по <code>result.current</code>. Проверяю не только значения, но и <strong>стабильность ссылок</strong>: что возвращаемая функция не пересоздаётся между рендерами — это часть контракта хука.</p>
    <p>Если хуку нужен контекст или провайдер (QueryClient, роутер, стор), передаю их через опцию <code>wrapper</code>. Сетевые вызовы мокирую через MSW, а не через мок <code>fetch</code>: тест тогда проверяет реальный код запроса, включая URL и тело.</p>
    <p>Важный принцип: если хук неразрывно связан с UI, я тестирую его <strong>через компонент</strong>, а не изолированно — тест ближе к реальному использованию и не ломается от рефакторинга внутренностей. <code>renderHook</code> оставляю для универсальных хуков библиотечного уровня.</p>`,
    code: `import { renderHook, act, waitFor } from '@testing-library/react';

test('дебаунсит значение', async () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(
    ({ v }) => useDebouncedValue(v, 300),
    { initialProps: { v: 'a' } }
  );
  rerender({ v: 'b' });
  expect(result.current).toBe('a');
  act(() => { vi.advanceTimersByTime(300); });
  expect(result.current).toBe('b');
});

test('возвращает стабильную функцию', () => {
  const { result, rerender } = renderHook(() => useToggle());
  const first = result.current[1];
  rerender();
  expect(result.current[1]).toBe(first);
});`,
    tip: 'Мысль, которая выделяет: проверять стабильность возвращаемых ссылок как часть контракта хука. Почти никто про это не думает в тестах.' },

  { id: 'rx40',
    q: 'Как ты выбираешь запросы в Testing Library и почему порядок именно такой?',
    a: `<p>Приоритет запросов отражает философию библиотеки: тест должен искать элемент так, как его находит <strong>пользователь</strong>. Порядок: <code>getByRole</code> (с опцией <code>name</code>) → <code>getByLabelText</code> для полей форм → <code>getByPlaceholderText</code> → <code>getByText</code> → <code>getByDisplayValue</code> → <code>getByAltText</code>/<code>getByTitle</code> → и только в крайнем случае <code>getByTestId</code>.</p>
    <p><code>getByRole</code> первый не из эстетики: он читает <strong>дерево доступности</strong>. Если тест находит кнопку по роли и доступному имени, значит и скринридер её найдёт. Тест становится ещё и проверкой доступности бесплатно. Div с onClick по роли не находится — и это правильный сигнал.</p>
    <p><code>getByTestId</code> оправдан там, где нет ни роли, ни текста: контейнеры, обёртки, элементы с динамическим содержимым. Он не проверяет ничего пользовательского, поэтому используется как escape hatch.</p>
    <p>Три семейства: <code>getBy</code> — элемент есть сейчас (бросает, если нет), <code>queryBy</code> — единственный способ проверить <strong>отсутствие</strong> (возвращает null), <code>findBy</code> — асинхронный, это <code>getBy</code> внутри <code>waitFor</code>, для элементов, которые появятся. Плюс варианты <code>AllBy</code>.</p>`,
    code: `// хорошо: по роли и доступному имени
await userEvent.click(screen.getByRole('button', { name: /сохранить/i }));
expect(screen.getByRole('textbox', { name: /email/i })).toHaveValue('a@b.ru');

// отсутствие - только queryBy
expect(screen.queryByRole('alert')).not.toBeInTheDocument();

// появится позже - findBy, а не waitFor + getBy
expect(await screen.findByRole('alert')).toHaveTextContent('Сохранено');

// плохо: тест не проверяет доступность и ломается при рефакторинге разметки
expect(container.querySelector('.btn-primary')).toBeTruthy();`,
    tip: 'Объясни причину, а не список: getByRole читает accessibility tree, поэтому тест заодно проверяет доступность. Это и есть аргумент за такой порядок.' },

  { id: 'rx41',
    q: 'Когда нужен act, когда waitFor, и почему тесты «мигают» в CI?',
    a: `<p><code>act</code> гарантирует, что все обновления состояния и эффекты, вызванные внутри, применены до продолжения теста. RTL уже оборачивает в <code>act</code> вызовы <code>render</code>, <code>fireEvent</code> и <code>userEvent</code>, поэтому вручную его почти не пишут. Ручной <code>act</code> нужен, когда состояние меняется <strong>вне</strong> этих хелперов: прокрутка фейковых таймеров, ручной резолв промиса, вызов колбэка из мока.</p>
    <p><code>waitFor</code> — про ожидание условия: он повторяет колбэк, пока тот не перестанет бросать. Использую, когда нужно дождаться побочного эффекта (мок вызвался, стор обновился). Для «элемент появится» лучше <code>findBy</code> — он читается яснее и уже включает <code>waitFor</code>.</p>
    <p>Причины мигания в CI: асинхронное обновление без ожидания (тест успевает проверить до того, как данные пришли); <code>waitFor</code> с несколькими ассертами, где падает не та, что ожидалась; фейковые таймеры вперемешку с <code>userEvent</code> (нужно передать <code>advanceTimers</code>); неочищенные моки и таймеры между тестами; зависимость тестов от порядка выполнения. CI просто медленнее и параллельнее — он обнажает гонки, которых локально не видно.</p>
    <p>Правило: <strong>ноль произвольных задержек</strong>. Ни одного <code>setTimeout</code> на 100мс в тесте — только ожидание конкретного условия.</p>`,
    code: `// userEvent + фейковые таймеры: обязательно связать
const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

// ручной act нужен только вне хелперов RTL
act(() => { vi.advanceTimersByTime(1000); });

// один ассерт внутри waitFor
await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
expect(saveMock).toHaveBeenCalledWith({ id: 1 });   // остальное - снаружи

// предпочтительно вместо waitFor + getBy
expect(await screen.findByText('Готово')).toBeVisible();`,
    tip: 'Совет, который звучит опытно: держать в waitFor ровно одну ассерцию. Иначе при падении непонятно, какая именно проверка не прошла.' },

  { id: 'rx42',
    q: 'Зачем MSW вместо мока fetch и как ты организуешь моки сети в тестах?',
    a: `<p>MSW перехватывает запросы на уровне сети (Service Worker в браузере, интерсептор в Node), а не подменяет <code>fetch</code>. Это значит, что тестируется <strong>реальный код запроса</strong>: URL, метод, заголовки, сериализация тела, обработка статусов, ретраи, отмена. Мок <code>fetch</code> всё это пропускает и проверяет только то, что вы вызвали функцию.</p>
    <p>Второй большой плюс — <strong>переиспользование</strong>: одни и те же хендлеры работают в юнит-тестах, в Storybook, в E2E и в локальной разработке без бэкенда. Мок fetch живёт только в тестах.</p>
    <p>Организация: базовые хендлеры «счастливого пути» в общем файле, сервер стартует в <code>beforeAll</code>, <code>resetHandlers()</code> в <code>afterEach</code> (иначе моки протекают между тестами), <code>close()</code> в <code>afterAll</code>. Специфичные для теста сценарии — через <code>server.use()</code> локально в тесте.</p>
    <p>Обязательно тестировать не только успех: 500, 401, пустой список, таймаут, медленный ответ (для проверки скелетона). Настройка <code>onUnhandledRequest: 'error'</code> ловит забытые моки — иначе тест пойдёт в реальную сеть и будет мигать.</p>`,
    code: `// handlers.ts
export const handlers = [
  http.get('/api/orders', () => HttpResponse.json([{ id: 1, total: 100 }])),
];

// setup.ts
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// в конкретном тесте - переопределяем сценарий ошибки
test('показывает ошибку при 500', async () => {
  server.use(http.get('/api/orders', () => new HttpResponse(null, { status: 500 })));
  render(<Orders />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось/i);
});`,
    tip: 'Аргумент, который решает спор: MSW тестирует ваш слой запросов, мок fetch тестирует, что вы вызвали свою же функцию. Плюс переиспользование в Storybook.' },

  { id: 'rx43',
    q: 'Как типизировать дженерик-компонент в React с TypeScript?',
    a: `<p>Обычная функция-компонент типизируется дженериком напрямую — TypeScript выведет <code>T</code> из пропсов на месте использования. Проблема возникала с <code>forwardRef</code> и <code>memo</code>: они возвращают не-дженерик тип, и параметр терялся. В React 19 <code>forwardRef</code> не нужен, поэтому основная боль ушла.</p>
    <p>Типовой кейс — универсальный <code>&lt;List&gt;</code>, где <code>items: T[]</code> связан с <code>renderItem: (item: T) =&gt; ReactNode</code> и <code>getKey: (item: T) =&gt; string</code>. Дженерик тут не украшение: он гарантирует, что рендер получит именно тот тип, что в массиве.</p>
    <p>Тонкости: в <code>.tsx</code> синтаксис <code>&lt;T&gt;</code> в стрелочной функции парсится как JSX — нужен <code>&lt;T,&gt;</code> или <code>extends unknown</code>. Для сужения используют <code>T extends { id: string }</code>. Чтобы вывод не схлопывался в юнион, иногда добавляют <code>const</code>-параметр (<code>&lt;const T&gt;</code> в TS 5+).</p>
    <p>Для <code>memo</code> дженерик-компонента до сих пор нужно приведение типа обёртки — обычная практика в дизайн-системах.</p>`,
    code: `type ListProps<T> = {
  items: readonly T[];
  getKey: (item: T) => React.Key;
  renderItem: (item: T, index: number) => React.ReactNode;
  empty?: React.ReactNode;
};

export function List<T>({ items, getKey, renderItem, empty }: ListProps<T>) {
  if (!items.length) return <>{empty}</>;
  return <ul>{items.map((it, i) => <li key={getKey(it)}>{renderItem(it, i)}</li>)}</ul>;
}

// memo теряет дженерик - возвращаем его приведением
export const MemoList = memo(List) as typeof List;

// в .tsx стрелка требует запятой, иначе парсится как JSX
const identity = <T,>(v: T): T => v;`,
    tip: 'Упомяни, что memo и forwardRef стирают дженерик и требуют приведения. Это боль всех, кто писал дизайн-систему, и её узнают сразу.' },

  { id: 'rx44',
    q: 'Как сделать полиморфный компонент с пропом as и корректной типизацией?',
    a: `<p>Полиморфный компонент рендерится как разный тег: <code>&lt;Button as="a" href="..."&gt;</code>. Типизация должна давать <strong>ровно те пропсы</strong>, которые допустимы для выбранного тега — href для a, type для button, — и ошибку при недопустимых.</p>
    <p>Схема: дженерик <code>C extends React.ElementType</code> со значением по умолчанию; собственные пропсы объединяются с <code>React.ComponentPropsWithoutRef&lt;C&gt;</code>; из последних вычитаются ключи собственных пропсов через <code>Omit</code>, чтобы не было конфликта имён. Ref типизируется отдельно как <code>React.ComponentPropsWithRef&lt;C&gt;['ref']</code>.</p>
    <p>Плата за это высокая, и её надо назвать честно: заметно ухудшается производительность tsserver в больших проектах (эти типы разворачиваются в огромные объединения), сообщения об ошибках становятся нечитаемыми, автодополнение подтормаживает. Плюс легко потерять доступность: <code>as="div"</code> у кнопки убивает клавиатурное управление.</p>
    <p>Поэтому современная альтернатива — паттерн <code>asChild</code> (Radix): компонент клонирует единственного ребёнка и передаёт ему пропсы. Типизация тривиальная, семантика остаётся за разработчиком, tsserver не страдает.</p>`,
    code: `type AsProp<C extends React.ElementType> = { as?: C };
type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

type Polymorphic<C extends React.ElementType, Props = {}> =
  React.PropsWithChildren<Props & AsProp<C>> &
  Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, Props>> &
  { ref?: React.ComponentPropsWithRef<C>['ref'] };

type TextProps = { size?: 'sm' | 'lg' };

export function Text<C extends React.ElementType = 'span'>(
  { as, size = 'sm', children, ...rest }: Polymorphic<C, TextProps>
) {
  const Tag = as || 'span';
  return <Tag data-size={size} {...rest}>{children}</Tag>;
}

<Text as="a" href="/docs">Док</Text>      // href разрешён
<Text as="span" href="/docs" />           // ошибка типов`,
    tip: 'Назови цену полиморфных типов - деградацию tsserver и нечитаемые ошибки - и предложи asChild как альтернативу. Это ответ архитектора, а не разработчика.' },

  { id: 'rx45',
    q: 'Как ты типизируешь пропсы компонента и refs в TypeScript? Какие утилиты используешь?',
    a: `<p>Базовый набор. <code>React.ComponentProps&lt;'button'&gt;</code> — все пропсы тега, включая ref в React 19; <code>ComponentPropsWithoutRef</code> и <code>ComponentPropsWithRef</code> — явные варианты. <code>React.ComponentProps&lt;typeof MyComp&gt;</code> достаёт пропсы чужого компонента, если он их не экспортировал.</p>
    <p>Для расширения нативного элемента: <code>interface Props extends ComponentPropsWithoutRef&lt;'button'&gt; { variant: 'primary' | 'ghost' }</code> — компонент сразу принимает onClick, disabled, aria-*. Если нужно переопределить проп с конфликтующим типом, оборачиваем в <code>Omit</code>.</p>
    <p>Дети: <code>React.ReactNode</code> для любого содержимого, <code>React.ReactElement</code> — если нужен именно элемент. <code>React.FC</code> я не использую: он навязывает неявные children (в React 18 типах уже убрали) и мешает дженерикам.</p>
    <p>Рефы: <code>useRef&lt;HTMLInputElement&gt;(null)</code> даёт <code>RefObject</code> с nullable current; <code>useRef&lt;number&gt;(0)</code> — мутабельный. Для приёма ref снаружи в React 19 просто <code>ref?: React.Ref&lt;HTMLInputElement&gt;</code> в пропсах. Для императивных хендлов — <code>React.Ref&lt;MyHandle&gt;</code> в паре с <code>useImperativeHandle</code>. Обработчики берём как <code>React.ChangeEventHandler&lt;HTMLInputElement&gt;</code>, а не пишем сигнатуру руками.</p>`,
    code: `interface ButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  variant?: 'primary' | 'ghost';
  ref?: React.Ref<HTMLButtonElement>;      // React 19: ref обычный проп
}

export function Button({ variant = 'primary', className, ref, ...rest }: ButtonProps) {
  return <button ref={ref} data-variant={variant} className={className} {...rest} />;
}

// переопределение конфликтующего пропа
type InputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'onChange'> & {
  onChange: (value: string) => void;
};

// пропсы чужого компонента без экспорта типа
type DatePickerProps = React.ComponentProps<typeof DatePicker>;`,
    tip: 'Скажи, почему не используешь React.FC - это короткий маркер, по которому видно, что ты типизируешь React осознанно, а не по шаблону из туториала.' },

  { id: 'rx46',
    q: 'Как ты делаешь анимации в React? Что даёт Framer Motion и что такое layout animations?',
    a: `<p>Иерархия по стоимости. Простые состояния (hover, появление) — CSS-переходы и <code>@keyframes</code>: ноль JS, работают в компоузинге браузера. Появление и удаление из DOM — здесь CSS уже не хватает, потому что элемент исчезает мгновенно; нужна библиотека, удерживающая элемент до конца анимации (<code>AnimatePresence</code>).</p>
    <p><strong>Layout animations</strong> (Motion/Framer Motion) — самая ценная фича: элемент с <code>layout</code> автоматически анимирует изменение своих позиции и размера, вызванное <strong>изменением вёрстки</strong>, а не явными значениями. Реализовано техникой FLIP: библиотека измеряет позицию до и после, применяет обратный <code>transform</code> и анимирует его к нулю. Анимируются только transform и opacity, поэтому нет layout thrashing.</p>
    <p><code>layoutId</code> даёт shared-element переходы: два элемента с одинаковым id в разных местах дерева анимируются друг в друга — так делают «карточка разворачивается в модалку».</p>
    <p>Обязательные оговорки: анимировать только <code>transform</code>/<code>opacity</code>; уважать <code>prefers-reduced-motion</code>; помнить о размере бандла (брать <code>LazyMotion</code> с урезанными фичами); не анимировать в списках без стабильных ключей. Для навигации между страницами в 2026 всё чаще берут нативный View Transitions API.</p>`,
    code: `import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

function Card({ item, expanded, onToggle }) {
  const reduce = useReducedMotion();
  return (
    <motion.div layout layoutId={'card-' + item.id} onClick={onToggle}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}>
      <motion.h3 layout="position">{item.title}</motion.h3>
      <AnimatePresence>
        {expanded && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {item.body}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}`,
    tip: 'Объясни layout animations через FLIP - измерить, инвертировать трансформом, анимировать к нулю. Знание механики отличает от знания названия пропа.' },

  { id: 'rx47',
    q: 'Что такое View Transitions и как они соотносятся с React?',
    a: `<p>View Transitions API — браузерный механизм: браузер делает снимок текущего состояния, вы синхронно меняете DOM внутри <code>document.startViewTransition</code>, браузер делает второй снимок и анимирует переход между ними через псевдоэлементы. Элементы с одинаковым <code>view-transition-name</code> связываются в morph-переход.</p>
    <p>Ключевое отличие от JS-анимаций: анимирует <strong>компоузитор браузера</strong>, а не главный поток. Это дешевле Framer Motion и переживает даже тяжёлый рендер.</p>
    <p>Проблема с React — асинхронность: React обновляет DOM когда захочет, а API требует синхронного изменения внутри колбэка. Раньше это лечили <code>flushSync</code>, что убивало конкурентный рендеринг. React решил это компонентом <code>&lt;ViewTransition&gt;</code>: React сам оборачивает нужный коммит и знает, когда снимать «до» и «после». Переходы запускаются для обновлений внутри <code>startTransition</code> и при реавиле Suspense.</p>
    <p>В Next App Router переходы между страницами так закрывают cross-document навигацию. Обязательно: уважать <code>prefers-reduced-motion</code>, проверять поддержку (<code>document.startViewTransition</code> может отсутствовать), и <code>view-transition-name</code> должен быть уникален в момент перехода — два одинаковых имени ломают анимацию.</p>`,
    code: `// нативный API
function navigate(url: string) {
  if (!document.startViewTransition) { setRoute(url); return; }
  document.startViewTransition(() => flushSync(() => setRoute(url)));
}

// React: без flushSync
import { unstable_ViewTransition as ViewTransition } from 'react';

<ViewTransition>
  <Suspense fallback={<Skeleton />}>
    <Page id={id} />
  </Suspense>
</ViewTransition>

// CSS
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*) { animation: none; }
}`,
    tip: 'Назови конкретную причину, почему View Transitions плохо дружили с React: API требует синхронного изменения DOM, а React обновляет асинхронно. Отсюда и появился компонент ViewTransition.' },

  { id: 'rx48',
    q: 'Как ты организуешь интернационализацию в React/Next приложении?',
    a: `<p>Три слоя решений. <strong>Хранение переводов</strong>: JSON по неймспейсам, ключи семантические (<code>checkout.submit</code>), не по тексту. <strong>Форматирование</strong>: нативный <code>Intl</code> (<code>NumberFormat</code>, <code>DateTimeFormat</code>, <code>RelativeTimeFormat</code>, <code>PluralRules</code>, <code>ListFormat</code>) — никаких самописных склонений. <strong>Библиотека</strong>: next-intl или i18next в зависимости от роутинга.</p>
    <p>Главная техническая ошибка — конкатенация строк. Правильно — <strong>ICU MessageFormat</strong> с плейсхолдерами и plural-правилами: в русском четыре формы (one/few/many/other), в английском две, и склеить их вручную невозможно.</p>
    <p>В App Router локаль обычно живёт в сегменте пути (<code>/[locale]/...</code>), определяется в middleware по заголовку <code>Accept-Language</code> и cookie, а провайдер отдаёт словарь. Важно грузить <strong>только нужную локаль</strong> — это чистый вес бандла. В RSC перевод можно делать полностью на сервере, тогда словарь вообще не едет на клиент.</p>
    <p>Не забыть: <code>lang</code> и <code>dir</code> на <code>&lt;html&gt;</code> (RTL — это ещё и логические CSS-свойства вместо left/right), hreflang и локализованные метаданные для SEO, интерполяция React-элементов в перевод (Trans-компонент) вместо dangerouslySetInnerHTML.</p>`,
    code: `// ICU: плюрализация, а не конкатенация
{
  "cart.items": "{count, plural, one {# товар} few {# товара} many {# товаров} other {# товара}}",
  "order.status": "Заказ {id} от {date, date, medium}"
}

// форматирование через Intl, без самописных функций
new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(1990);
new Intl.RelativeTimeFormat('ru', { numeric: 'auto' }).format(-1, 'day');   // вчера

// Next App Router
export function generateStaticParams() {
  return ['ru', 'en'].map(locale => ({ locale }));
}`,
    tip: 'Скажи про четыре плюральные формы в русском и ICU MessageFormat - это сразу показывает, что ты делал i18n, а не подключал библиотеку по инструкции.' },

  { id: 'rx49',
    q: 'Что ты проверяешь в React-компоненте с точки зрения доступности?',
    a: `<p>Первое правило — <strong>семантика вместо ARIA</strong>. Нативный <code>&lt;button&gt;</code> даёт фокус, Enter/Space, роль и состояние disabled бесплатно; <code>&lt;div onClick&gt;</code> не даёт ничего, и починить его пятью ARIA-атрибутами хуже, чем взять правильный тег.</p>
    <p>Что смотрю в компоненте: доступное имя у каждого интерактивного элемента (текст, <code>aria-label</code>, <code>aria-labelledby</code>); связь label с полем через <code>htmlFor</code>+<code>id</code> (генерируем через <code>useId</code>); <code>aria-invalid</code> и <code>aria-describedby</code> для ошибок; порядок фокуса и его видимость (<code>:focus-visible</code>, не <code>outline: none</code>); клавиатурная навигация целиком без мыши.</p>
    <p>Для динамики: изменения, о которых надо сообщить, — в live-регион (<code>role="status"</code> для нейтральных, <code>role="alert"</code> для ошибок). Для модалок: фокус внутрь при открытии, ловушка фокуса, Escape, возврат фокуса на триггер, <code>aria-modal</code>, скрытие фона — либо нативный <code>&lt;dialog&gt;</code>, который делает большую часть сам.</p>
    <p>Инструменты в процессе, а не постфактум: <code>eslint-plugin-jsx-a11y</code> в линте, <code>axe-core</code> в тестах и Storybook, ручная проверка клавиатурой и скринридером. И <code>getByRole</code> в тестах, который сам заставляет писать доступную разметку.</p>`,
    code: `// автоматическая проверка в тестах
import { axe } from 'jest-axe';
test('без нарушений a11y', async () => {
  const { container } = render(<Checkout />);
  expect(await axe(container)).toHaveNoViolations();
});

// live-регион для асинхронного результата
<div role="status" aria-live="polite">{saved && 'Изменения сохранены'}</div>

// ошибка поля правильно связана
const id = useId();
<input id={id} aria-invalid={!!error} aria-describedby={error ? id + '-err' : undefined} />
{error && <p id={id + '-err'} role="alert">{error}</p>}`,
    tip: 'Свяжи a11y с тестами: getByRole в Testing Library не найдёт div с onClick, поэтому доступная разметка получается побочным эффектом хороших тестов.' },

  { id: 'rx50',
    q: 'Расскажи про Feature-Sliced Design: слои, правила импортов и где он не работает.',
    a: `<p>FSD задаёт три измерения. <strong>Слои</strong> (сверху вниз): app, processes (устарел), pages, widgets, features, entities, shared. <strong>Слайсы</strong> внутри слоя — деление по домену (user, order, cart). <strong>Сегменты</strong> внутри слайса — по технической природе: ui, model, api, lib, config.</p>
    <p>Главное правило одно: <strong>модуль может импортировать только из слоёв строго ниже себя</strong>. Внутри одного слоя слайсы друг друга не видят — это убивает циклические зависимости и делает удаление фичи предсказуемым. Публичный доступ только через <code>index.ts</code> слайса; ходить во внутренности запрещено.</p>
    <p>Что реально даёт: понятно, куда положить новый код; удаление фичи не оставляет хвостов; ревью проще, потому что нарушения архитектуры ловятся линтером (<code>steiger</code>, eslint-boundaries), а не спорами.</p>
    <p>Где болит, и это надо признать: слой <code>features</code> разрастается и превращается в свалку; сущность, нужная двум слайсам одного слоя, вынуждает либо дублировать, либо тащить в shared, где ей не место; типовой спор «это widget или feature» отнимает время. В FSD 2.1 официально рекомендуют <strong>pages-first подход</strong>: начинать со страниц и выносить в нижние слои только при реальном переиспользовании, а не заранее.</p>`,
    code: `src/
  app/        # провайдеры, роутер, стили - знает про всё
  pages/      # композиция страниц
  widgets/    # самостоятельные блоки UI (Header, OrderCard)
  features/   # пользовательские сценарии (AddToCart, LoginForm)
  entities/   # бизнес-сущности (User, Product) + их ui и model
  shared/     # ui-kit, api-клиент, утилиты - не знает ни про что

// нарушение: entities импортирует из features
import { addToCart } from 'features/add-to-cart';   // запрещено линтером

// правильно: features использует entities
import { ProductCard } from 'entities/product';`,
    tip: 'Обязательно скажи про pages-first из FSD 2.1 и про то, что преждевременное вынесение в features - главная реальная ошибка. Это показывает опыт эксплуатации, а не чтения доки.' },

  { id: 'rx51',
    q: 'Атомарный дизайн, FSD, слоистая архитектура — как выбрать и как они сочетаются?',
    a: `<p>Они решают разные задачи и не конкурируют напрямую. <strong>Atomic Design</strong> — про UI-компоненты: atoms → molecules → organisms → templates → pages. Он ничего не говорит про бизнес-логику, состояние и API. <strong>FSD</strong> — про деление приложения по бизнес-доменам и направление зависимостей. <strong>Слоистая/чистая архитектура</strong> — про изоляцию домена от инфраструктуры.</p>
    <p>Рабочая комбинация: Atomic Design внутри <code>shared/ui</code> (там он честно про кнопки и инпуты), FSD — для всего остального. Пытаться классифицировать бизнес-компоненты как «организмы» бессмысленно: спор «это молекула или организм» не имеет объективного ответа и съедает время ревью.</p>
    <p>Критерий выбора по масштабу. Небольшой продукт до 3-5 человек — плоская структура по фичам без церемоний, FSD будет оверхедом. Крупный продукт с несколькими командами — нужны жёсткие границы и линтер, тут FSD окупается. Микрофронтенды — границы модулей важнее внутренней структуры.</p>
    <p>Что важнее любой методологии: <strong>направление зависимостей проверяется автоматически</strong>. Архитектура без линтера деградирует за квартал независимо от того, как она названа.</p>`,
    code: `// Комбинация на практике
src/
  shared/ui/       # Atomic Design живёт здесь: Button, Input, Icon
  entities/user/
    ui/UserAvatar.tsx
    model/store.ts
    api/queries.ts
  features/auth/

// граница проверяется линтером
// eslint-plugin-boundaries / steiger
{
  "boundaries/elements": [
    { "type": "shared",   "pattern": "src/shared/*" },
    { "type": "entities", "pattern": "src/entities/*" }
  ],
  "boundaries/element-types": [{ "from": "entities", "allow": ["shared"] }]
}`,
    tip: 'Ключевая фраза: архитектура, не проверяемая линтером, разрушается за квартал. Она переводит разговор с названий методологий на реальную дисциплину.' },

  { id: 'rx52',
    q: 'Как устроена обработка ошибок в RSC и Next App Router? В чём разница error.tsx и global-error.tsx?',
    a: `<p><code>error.tsx</code> — это клиентский Error Boundary (обязательно <code>'use client'</code>), автоматически оборачивающий сегмент маршрута. Он ловит ошибки рендера этого сегмента и его детей, но <strong>не ловит ошибки собственного layout</strong> — потому что рендерится внутри него. Получает <code>error</code> и <code>reset</code>.</p>
    <p><code>global-error.tsx</code> лежит в корне <code>app/</code> и ловит ошибки корневого layout. Он <strong>заменяет</strong> корневой layout целиком, поэтому обязан рендерить собственные <code>&lt;html&gt;</code> и <code>&lt;body&gt;</code> — забыть это значит получить белый экран. Работает только в проде.</p>
    <p>Особенность серверных ошибок: в продакшене Next <strong>вырезает сообщение и стек</strong> и отдаёт только <code>error.digest</code> — хеш, по которому ошибку находят в логах сервера. Это защита от утечки данных, и это надо объяснить команде, иначе будут искать текст ошибки в браузере.</p>
    <p>Отдельно: ошибки в Server Actions лучше <strong>возвращать значением</strong>, а не бросать — брошенная попадёт в error.tsx и сотрёт форму. Специальные функции <code>notFound()</code> и <code>redirect()</code> работают черезброс исключения, поэтому их нельзя вызывать внутри try/catch — блок перехватит управляющее исключение.</p>`,
    code: `'use client';
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { logToSentry(error); }, [error]);   // иначе ошибка невидима для мониторинга
  return (
    <div role="alert">
      <p>Что-то пошло не так</p>
      {error.digest && <code>{error.digest}</code>}
      <button onClick={reset}>Повторить</button>
    </div>
  );
}

// ЛОВУШКА: redirect бросает исключение
try {
  await save();
  redirect('/done');       // будет поймано catch ниже!
} catch (e) { /* ... */ }
// правильно: redirect после try/catch`,
    tip: 'Назови две неочевидности: error.tsx не ловит ошибки своего же layout, и redirect/notFound работают через throw, поэтому ломаются внутри try/catch.' },

  { id: 'rx53',
    q: 'Как работает стриминг в Next App Router и что делает loading.tsx?',
    a: `<p>Стриминг — сервер отдаёт HTML кусками по мере готовности, а не ждёт самых медленных данных. Технически это <code>renderToReadableStream</code> React: сначала уходит «оболочка» (shell) со всем, что готово, и заглушками на месте приостановленных Suspense-границ; затем по мере резолва промисов дописываются куски HTML вместе с инлайновым скриптом, который вставляет их на место фолбэка.</p>
    <p>Выигрыш измеряется в метриках: TTFB и FCP резко падают, потому что первый байт не ждёт БД. LCP улучшается, если важный контент попал в shell.</p>
    <p><code>loading.tsx</code> — синтаксический сахар: Next автоматически оборачивает <code>page.tsx</code> сегмента в <code>&lt;Suspense fallback={&lt;Loading /&gt;}&gt;</code>. Он даёт мгновенную реакцию на навигацию и один фолбэк на весь сегмент.</p>
    <p>Практический нюанс: <code>loading.tsx</code> — грубая гранулярность, весь сегмент показывает один скелетон. Точнее — расставлять <code>&lt;Suspense&gt;</code> вручную вокруг конкретных медленных блоков, чтобы быстрая часть страницы появилась сразу. Ограничения стриминга: заголовки и статус ответа уже отправлены, поэтому после начала стрима нельзя сделать redirect или поменять статус; некоторые прокси и CDN буферизуют ответ, убивая эффект.</p>`,
    code: `// грубо: весь сегмент под одним скелетоном
// app/orders/loading.tsx
export default function Loading() { return <OrdersSkeleton />; }

// точнее: быстрое сразу, медленное - потоком
export default function Page() {
  return (
    <>
      <Header />                                  {/* в shell, мгновенно */}
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />                                 {/* медленный запрос */}
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <OrdersTable />                           {/* очень медленный */}
      </Suspense>
    </>
  );
}`,
    tip: 'Скажи про ограничение: после начала стриминга статус ответа и заголовки уже ушли, поэтому редирект и 404 надо решать до первого байта.' },

  { id: 'rx54',
    q: 'Что такое параллельные маршруты в Next и какие задачи они решают?',
    a: `<p>Параллельные маршруты — слоты, объявленные папками с <code>@</code> (<code>app/@team</code>, <code>app/@analytics</code>). Layout получает каждый слот <strong>отдельным пропом</strong> и размещает их сам. Каждый слот имеет собственную навигацию, собственные <code>loading.tsx</code> и <code>error.tsx</code>.</p>
    <p>Что это даёт по сравнению с обычной композицией: слоты <strong>независимы</strong>. Ошибка в аналитике не роняет команду; медленный слот стримится отдельно и не задерживает остальные; каждый может иметь свой URL-сегмент. Именно поэтому это основной паттерн для сложных дашбордов.</p>
    <p>Ключевая, и самая болезненная деталь — <code>default.tsx</code>. При <strong>полной перезагрузке страницы</strong> Next не помнит, что было в слоте, и рендерит <code>default.tsx</code>; при клиентской навигации сохраняется предыдущее состояние слота. Забытый <code>default.tsx</code> — это 404 при обновлении страницы, и это самый частый баг.</p>
    <p>Второй кейс — условный рендер целых разделов: layout по роли пользователя рендерит либо <code>{admin}</code>, либо <code>{user}</code>, при этом оба слота имеют полноценные маршруты внутри.</p>`,
    code: `app/
  layout.tsx
  @team/page.tsx
  @team/default.tsx        # обязателен: иначе 404 при полной перезагрузке
  @analytics/page.tsx
  @analytics/default.tsx
  page.tsx

export default function Layout({
  children, team, analytics,
}: { children: React.ReactNode; team: React.ReactNode; analytics: React.ReactNode }) {
  const role = getRole();
  return (
    <div className="grid">
      {children}
      {role === 'admin' ? analytics : null}
      {team}
    </div>
  );
}`,
    tip: 'default.tsx и разница между клиентской навигацией и полной перезагрузкой - главный практический подвох параллельных маршрутов. Назови его сам.' },

  { id: 'rx55',
    q: 'Что такое перехватывающие маршруты и как сделать модалку с сохранением URL?',
    a: `<p>Перехватывающие маршруты позволяют при <strong>клиентской навигации</strong> отрендерить один маршрут в контексте другого, не уходя со страницы. Синтаксис относительный: <code>(.)</code> — тот же уровень, <code>(..)</code> — на уровень выше, <code>(..)(..)</code> — на два, <code>(...)</code> — от корня <code>app</code>.</p>
    <p>Каноничный кейс — модалка с собственным URL, как галерея в соцсетях. Клик по фото в ленте открывает модалку поверх ленты и меняет URL на <code>/photo/123</code>. Прямой заход по этому URL или обновление страницы отдаёт полноценную страницу фото. Шеринг ссылки работает, кнопка «назад» закрывает модалку.</p>
    <p>Реализуется в связке с параллельным маршрутом: слот <code>@modal</code> плюс перехват <code>@modal/(.)photo/[id]</code>. При полной загрузке слот отдаёт <code>default.tsx</code> с <code>null</code>, поэтому модалки нет — и рендерится настоящая страница.</p>
    <p>Подводные камни: перехват работает только при навигации через <code>&lt;Link&gt;</code>/router, не при <code>window.location</code>; закрытие модалки — это <code>router.back()</code>, а не размонтирование компонента; уровни <code>(..)</code> считаются по <strong>сегментам маршрута</strong>, а не по папкам файловой системы, из-за чего группы <code>(group)</code> путают счёт.</p>`,
    code: `app/
  feed/page.tsx
  photo/[id]/page.tsx                 # полная страница (прямой заход)
  @modal/default.tsx                  # return null
  @modal/(.)photo/[id]/page.tsx       # перехват при клиентской навигации
  layout.tsx                          # рендерит {children} и {modal}

// @modal/(.)photo/[id]/page.tsx
'use client';
export default function PhotoModal({ params }) {
  const router = useRouter();
  return (
    <Dialog open onOpenChange={() => router.back()}>   {/* назад, а не unmount */}
      <Photo id={params.id} />
    </Dialog>
  );
}`,
    tip: 'Уточни, что уровни в скобках считаются по сегментам маршрута, а не по папкам - route groups в скобках сегмент не создают, и на этом все спотыкаются.' },

  { id: 'rx56',
    q: 'Для чего используется middleware в Next и какие у него ограничения?',
    a: `<p>Middleware — код в <code>middleware.ts</code>, выполняющийся <strong>до</strong> обработки запроса, на всех путях, подходящих под <code>matcher</code>. Умеет: <code>redirect</code>, <code>rewrite</code> (URL в адресной строке не меняется), установку заголовков и cookie, ранний ответ.</p>
    <p>Хорошие кейсы: определение локали и редирект на <code>/ru/...</code>, A/B-тесты через rewrite на разные варианты, геороутинг, добавление security-заголовков и CSP-nonce, лёгкая проверка наличия сессионной куки, флаги фич.</p>
    <p>Плохие кейсы — и это главное, что проверяют: <strong>полноценная авторизация в middleware</strong>. Оно исполняется в Edge Runtime, где нет Node.js API, нет доступа к базе, ограничен размер бандла и время выполнения; библиотеки вроде bcrypt или драйверы БД там не работают. Плюс middleware выполняется на <strong>каждом</strong> подходящем запросе, включая префетчи — это заметная плата по латентности и деньгам.</p>
    <p>Правильный паттерн: в middleware — только дешёвая проверка наличия и формальной валидности токена и редирект неавторизованных; реальная проверка прав и доступ к данным — в layout/page/Server Action, ближе к данным. Матчер надо сужать, исключая статику и <code>_next</code>.</p>`,
    code: `export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export function middleware(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  if (!token && req.nextUrl.pathname.startsWith('/app')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(url);          // дешёвая проверка
  }
  const res = NextResponse.next();
  res.headers.set('x-nonce', crypto.randomUUID());
  return res;
}
// реальная проверка прав - в самом page/action, не здесь`,
    tip: 'Формулировка, которая заходит: middleware проверяет наличие токена, а не права. Права проверяются там, где происходит доступ к данным.' },

  { id: 'rx57',
    q: 'Edge Runtime или Node.js Runtime — как выбираешь?',
    a: `<p>Edge Runtime — урезанная среда на базе Web API (V8 isolates, не полноценный Node). Есть <code>fetch</code>, <code>Request</code>/<code>Response</code>, <code>Web Crypto</code>, <code>TextEncoder</code>. Нет <code>fs</code>, <code>net</code>, <code>child_process</code>, нативных модулей; жёсткие лимиты на размер бандла и CPU-время.</p>
    <p>Плюсы: околонулевой холодный старт и исполнение географически близко к пользователю. Это выигрывает там, где <strong>важна латентность, а работы мало</strong>: middleware, редиректы, A/B, геолокация, простые проверки, стриминг ответа, персонализация заголовков.</p>
    <p>Ловушка, о которой часто забывают: если функция на Edge ходит в базу, находящуюся в одном регионе, выигрыш от близости <strong>обнуляется или становится отрицательным</strong> — запрос летит от пользователя к ближайшему эджу, оттуда через полмира к БД и обратно. Edge хорош при данных, реплицированных глобально, или при работе без БД вовсе.</p>
    <p>Node Runtime — по умолчанию для всего остального: тяжёлые вычисления, ORM и драйверы БД, работа с файлами, генерация изображений и PDF, любые npm-пакеты с нативными зависимостями. В Next выбирается через <code>export const runtime</code>.</p>`,
    code: `// в route handler или page
export const runtime = 'edge';    // или 'nodejs' (по умолчанию)

// Edge: ок - нет БД, важна скорость
export const runtime = 'edge';
export async function GET(req: Request) {
  const country = req.headers.get('x-vercel-ip-country') ?? 'RU';
  return Response.json({ currency: country === 'RU' ? 'RUB' : 'USD' });
}

// Node: обязателен - ORM, нативные зависимости
export const runtime = 'nodejs';
export async function GET() {
  const rows = await prisma.order.findMany();
  return Response.json(rows);
}`,
    tip: 'Про обнуление выигрыша Edge при одном региональном инстансе БД почти никто не говорит. Это самый сильный аргумент в этом вопросе.' },

  { id: 'rx58',
    q: 'Как работает next/image изнутри и какие у него подводные камни?',
    a: `<p>На сборке компонент превращается в <code>&lt;img&gt;</code> с вычисленными <code>srcset</code> и <code>sizes</code>, ссылающимися на роут оптимизатора <code>/_next/image?url=...&amp;w=...&amp;q=...</code>. При первом запросе конкретной комбинации сервер через <code>sharp</code> ресайзит, конвертирует в AVIF/WebP по заголовку <code>Accept</code> и кеширует результат на диске (или на CDN). Дальше отдаётся из кеша.</p>
    <p>Против CLS: для локальных импортов размеры известны на этапе сборки и подставляются автоматически; для внешних URL нужно указывать <code>width</code>/<code>height</code> или <code>fill</code> с позиционированным контейнером. Плюс <code>placeholder="blur"</code> — для статических импортов base64-заглушка генерируется на сборке.</p>
    <p>Ключевые подводные камни. <strong><code>priority</code> на LCP-изображении</strong> обязателен — по умолчанию всё лениво, и герой-картинка получает низкий приоритет, что напрямую портит LCP. <strong><code>sizes</code></strong> при <code>fill</code> — без него браузер считает, что картинка на всю ширину вьюпорта, и грузит самый большой вариант. Домены внешних картинок надо разрешить в <code>remotePatterns</code>. Оптимизация тарифицируется по количеству <strong>уникальных исходных изображений</strong>, поэтому набор <code>deviceSizes</code> лучше сузить под реальные брейкпоинты.</p>
    <p>Когда отключать: если картинки уже оптимизированы CDN (Cloudinary, imgix) — задать <code>loader</code> или <code>unoptimized</code>, чтобы не платить дважды.</p>`,
    code: `// LCP-изображение: priority обязателен
<Image src={hero} alt="" priority sizes="100vw" placeholder="blur" />

// fill: нужен позиционированный контейнер и sizes
<div style={{ position: 'relative', aspectRatio: '16/9' }}>
  <Image src={url} alt={title} fill
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    style={{ objectFit: 'cover' }} />
</div>

// next.config
images: {
  remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com' }],
  deviceSizes: [640, 828, 1200, 1920],   // сузить = меньше вариантов и денег
}`,
    tip: 'Назови priority для LCP и sizes при fill как две ошибки, которые чаще всего съедают Core Web Vitals в реальных проектах.' },

  { id: 'rx59',
    q: 'Что делает next/font под капотом и как он борется с CLS?',
    a: `<p>Две вещи. Первая — <strong>самохостинг</strong>: на этапе сборки файлы шрифта скачиваются (для Google Fonts) и кладутся в статику проекта. В рантайме нет ни одного запроса к <code>fonts.googleapis.com</code>: убирается лишний DNS+TCP+TLS к третьей стороне, устраняется render-blocking CSS-запрос и решается вопрос с приватностью (в ЕС загрузка Google Fonts из браузера пользователя считалась проблемой GDPR).</p>
    <p>Вторая, более интересная — <strong>автоматический fallback с size-adjust</strong>. Next читает метрики файла шрифта (unitsPerEm, ascent, descent, средняя ширина глифа) прямо на сборке и генерирует <code>@font-face</code> для локального системного шрифта с подобранными <code>size-adjust</code>, <code>ascent-override</code>, <code>descent-override</code>. Фолбэк занимает <strong>ровно столько же места</strong>, сколько займёт целевой шрифт, поэтому замена не двигает вёрстку — CLS около нуля даже при <code>display: swap</code>.</p>
    <p>Плюс автоматический сабсеттинг по указанным <code>subsets</code> (для кириллицы обязательно указать <code>['cyrillic', 'latin']</code>, иначе символы отвалятся на фолбэк) и предзагрузка через <code>&lt;link rel="preload"&gt;</code>.</p>
    <p>Важное ограничение: шрифт должен объявляться в <strong>модульной области</strong>, а не внутри компонента — иначе сборщик не может его статически проанализировать. Локальные шрифты подключаются через <code>next/font/local</code>, вариативный формат предпочтителен: один файл вместо набора начертаний.</p>`,
    code: `import { Inter } from 'next/font/display';   // объявление на уровне модуля
const inter = Inter({
  subsets: ['cyrillic', 'latin'],           // без cyrillic русский уйдёт в фолбэк
  display: 'swap',
  variable: '--font-inter',
  adjustFontFallback: true,                 // подбор метрик фолбэка (по умолчанию)
});

export default function RootLayout({ children }) {
  return <html lang="ru" className={inter.variable}><body>{children}</body></html>;
}

// сгенерированный фолбэк выглядит примерно так:
// @font-face { font-family: 'Inter Fallback'; src: local('Arial');
//   size-adjust: 107.12%; ascent-override: 90.2%; descent-override: 22.5%; }`,
    tip: 'Механика size-adjust на основе метрик, прочитанных из файла шрифта на сборке, - самая содержательная часть ответа. Просто самохостинг знают все.' },

  { id: 'rx60',
    q: 'Как ты организуешь миграцию с Pages Router на App Router?',
    a: `<p>Ключевой факт: <strong>роутеры сосуществуют</strong> в одном приложении. Поэтому миграция инкрементальная — по маршруту за раз, а не большим взрывом. При конфликте пути App Router выигрывает.</p>
    <p>Порядок, который работает. Сначала поднять Next и React до нужных мажоров, оставаясь на Pages. Затем создать <code>app/layout.tsx</code> (он заменяет <code>_app</code> и <code>_document</code>: <code>&lt;html&gt;</code> и <code>&lt;body&gt;</code> теперь здесь). Дальше мигрировать <strong>наименее критичный лист-маршрут</strong>, чтобы отладить инфраструктуру, а не главную страницу. Общие провайдеры вынести в клиентский компонент и подключить в корневом layout.</p>
    <p>Что переписывается механически: <code>getServerSideProps</code>/<code>getStaticProps</code> → async Server Component с fetch; <code>next/router</code> → <code>next/navigation</code> (<code>useRouter</code>, <code>usePathname</code>, <code>useSearchParams</code>; больше нет <code>router.events</code>); <code>next/head</code> → экспорт <code>metadata</code>/<code>generateMetadata</code>; API routes → route handlers на Web-стандартах (<code>Request</code>/<code>Response</code>).</p>
    <p>Реальные грабли: библиотеки без <code>'use client'</code>, падающие при серверном рендере; CSS-in-JS, требующий отдельной настройки в RSC; <code>useSearchParams</code>, вынуждающий обернуть компонент в Suspense (иначе весь маршрут становится динамическим); изменившиеся дефолты кеширования; отсутствующий эквивалент <code>router.events</code> для прогресс-баров.</p>`,
    code: `// было: pages/products/[id].tsx
export async function getServerSideProps({ params }) {
  const product = await getProduct(params.id);
  return { props: { product } };
}

// стало: app/products/[id]/page.tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;                  // Next 15: params - промис
  const product = await getProduct(id);
  return <ProductView product={product} />;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: (await getProduct(id)).title };
}

// useSearchParams требует Suspense, иначе маршрут станет полностью динамическим
<Suspense fallback={null}><Filters /></Suspense>`,
    tip: 'Скажи, что мигрируешь сначала неважный лист-маршрут для отладки инфраструктуры, а не главную. Это сразу читается как реальный опыт миграции.' },

  { id: 'rx61',
    q: 'Когда Next.js не нужен и лучше взять Vite + SPA?',
    a: `<p>Next окупается, когда нужны <strong>SEO, быстрый первый контент для холодных пользователей или серверные данные</strong>. Если этих требований нет, вы платите сложностью просто так.</p>
    <p>Vite + SPA лучше, когда: приложение целиком за логином (админка, дашборд, внутренний инструмент) — индексация не нужна, а после логина всё равно всё динамическое; приложение по природе клиентское (редактор, канвас, IDE, карта, чат); нужен статический хостинг без Node-сервера (S3, nginx, GitHub Pages) или деплой в закрытый контур; команда небольшая, и SSR-специфика (гидратация, разделение сервер/клиент, кеширование) станет постоянным налогом.</p>
    <p>Что теряется и надо признать: SEO (решается пререндерингом для лендингов), первый контент на медленных сетях, серверный доступ к секретам без своего бэкенда. Что приобретается: радикально более простая ментальная модель, отсутствие «почему это в RSC не работает», предсказуемый деплой, дешевле хостинг.</p>
    <p>Промежуточные варианты, которые стоит назвать: Vite + TanStack Router + TanStack Query покрывает 90% потребностей SPA с типобезопасным роутингом; Astro — для контентных сайтов с островками React; отдельный лендинг на Next плюс SPA на Vite за логином — вполне рабочее разделение.</p>`,
    code: `// Признаки того, что Next не нужен:
// - всё за авторизацией, SEO не требуется
// - нет собственного бэкенда на Node (или бэкенд на Go/Java/Python)
// - деплой в закрытый контур без SSR-инфраструктуры
// - приложение стейтфул и клиентское по природе (редактор, дашборд реального времени)

// Признаки того, что Next нужен:
// - публичный контент, индексируемый поиском
// - маркетинговые метрики LCP/TTFB критичны для конверсии
// - нужны серверные мутации без отдельного бэкенда
// - ISR/кеширование контента снимает нагрузку с БД`,
    tip: 'Сформулируй критерий одной фразой: если нет SEO и нет требования к быстрому первому контенту для анонимных пользователей - SSR это чистый налог.' },

  { id: 'rx62',
    q: 'Сравни Next.js, React Router 7 (Remix) и TanStack Start. Что выберешь и почему?',
    a: `<p>Три разные философии. <strong>Next.js</strong> строится вокруг React Server Components: серверный рендер по умолчанию, границы <code>'use client'</code>, многоуровневое кеширование, Server Actions. Максимальная экосистема, вакансии, интеграции; цена — сложная модель кеширования и привязка к специфике фреймворка.</p>
    <p><strong>React Router 7</strong> (в него влился Remix) — модель веб-стандартов: <code>loader</code> и <code>action</code> на маршруте, Request/Response, прогрессивное улучшение через нативные формы. Ментальная модель проще всего, RSC не обязателен, хостится где угодно. Цена — меньше «магии» и меньше готовых оптимизаций, руками больше.</p>
    <p><strong>TanStack Start</strong> — ставка на end-to-end типобезопасность: типизированные маршруты, типизированные search params как первоклассное состояние, глубокая интеграция с TanStack Query. Отлично для сложных дашбордов с большим количеством фильтров в URL. Цена — молодость экосистемы и меньше материалов.</p>
    <p>Мой критерий выбора: контентный/публичный продукт с сильными требованиями к SEO и кешу — Next. Приложение с формами и классической серверной моделью, где важна простота и переносимость — React Router 7. Дата-интенсивный дашборд с типизированным URL-состоянием — TanStack Start (осознанно как ранний адоптер). И отдельным пунктом: миграция между ними стоит дорого, поэтому фактор «что знает команда» часто весит больше технических различий.</p>`,
    code: `// React Router 7: loader/action на веб-стандартах
export async function loader({ params }: LoaderFunctionArgs) {
  return json(await getOrder(params.id));
}
export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  return redirect('/orders');
}

// Next: async Server Component + Server Action
export default async function Page({ params }) { const o = await getOrder(params.id); }

// TanStack Start: типизированный маршрут и search params
export const Route = createFileRoute('/orders')({
  validateSearch: z.object({ status: z.enum(['new', 'done']).catch('new') }),
  loader: ({ deps }) => getOrders(deps.status),
});`,
    tip: 'Заверши мыслью, что стоимость миграции между фреймворками выше их технических различий, поэтому опыт команды - легитимный технический аргумент, а не отговорка.' },

  { id: 'rx63',
    q: 'Как ты делишь бандл на чанки в React-приложении и как избегаешь мигания при lazy-загрузке?',
    a: `<p>Базово — <code>React.lazy</code> плюс <code>Suspense</code>: динамический импорт создаёт отдельный чанк, который грузится при первом рендере компонента. Естественные границы деления: маршруты (самое эффективное), тяжёлые модалки и редакторы, редко используемые библиотеки (графики, карты, WYSIWYG, генерация PDF), полифилы.</p>
    <p>Главная проблема наивного подхода — <strong>загрузка начинается только когда компонент уже нужен</strong>, и пользователь видит спиннер. Решения: префетч по <code>onMouseEnter</code>/<code>onFocus</code> на ссылке (даёт 100-300мс форы, часто этого достаточно), префетч по видимости через IntersectionObserver, префетч на idle после гидратации. В Next это делает <code>&lt;Link&gt;</code> автоматически.</p>
    <p>Второй приём — <strong>обернуть переход в <code>startTransition</code></strong>: тогда React не показывает фолбэк, а оставляет старый экран до готовности нового. Это убирает мигание скелетоном при быстрой сети.</p>
    <p>Отдельно: ленивые чанки могут не загрузиться после деплоя (старый хеш файла исчез) — нужен ретрай с перезагрузкой страницы в Error Boundary, иначе пользователь получает белый экран. И измерять реальную пользу: три чанка по 5кб хуже одного по 15кб из-за накладных расходов на запросы.</p>`,
    code: `const Editor = lazy(() => import('./Editor'));

// префетч по наведению - грузим до клика
function EditLink() {
  const prefetch = () => { void import('./Editor'); };
  return <a onMouseEnter={prefetch} onFocus={prefetch} onClick={open}>Редактировать</a>;
}

// переход без мигания фолбэком
startTransition(() => setRoute('/editor'));

// ретрай упавшего чанка после деплоя
const Editor = lazy(() =>
  import('./Editor').catch(() => {
    window.location.reload();
    return new Promise(() => {});
  })
);`,
    tip: 'Проблема протухших чанков после деплоя - реальная продовая боль, которую почти никто не упоминает. Назови её и решение с ретраем.' },

  { id: 'rx64',
    q: 'Что можно и что нельзя передавать между Server и Client компонентами? Как устроена граница?',
    a: `<p>Граница создаётся директивой <code>'use client'</code> в начале файла. Она распространяется <strong>транзитивно вниз</strong>: всё, что импортируется из клиентского модуля, тоже становится клиентским. Но она не распространяется через <code>children</code>: серверный компонент, переданный клиентскому как children или как проп-элемент, остаётся серверным.</p>
    <p>Это ключевой паттерн композиции: клиентская обёртка (провайдер темы, аккордеон, табы) может рендерить серверных детей, если получает их пропсом. Ошибка новичка — импортировать серверный компонент внутрь клиентского, что превращает его в клиентский и тащит на клиент весь его код и зависимости.</p>
    <p>Пропсы через границу должны быть <strong>сериализуемыми</strong> RSC-протоколом. Можно: примитивы, массивы, простые объекты, Date, Map, Set, TypedArray, промисы, JSX-элементы, ссылки на Server Actions. Нельзя: функции (кроме Server Actions), классы и их инстансы, Symbol, объекты с методами и прототипами, замыкания.</p>
    <p>Из этого следует практическое правило: <strong>не передавать целые объекты «на всякий случай»</strong>. Проп <code>user</code> из базы утечёт в HTML целиком, включая хеш пароля и внутренние поля — RSC-payload виден в исходнике страницы. Передавать надо явно выбранные поля.</p>`,
    code: `// ПЛОХО: импорт делает серверный компонент клиентским
'use client';
import ServerChart from './ServerChart';       // ServerChart уедет на клиент
export function Panel() { return <ServerChart />; }

// ХОРОШО: children остаются серверными
'use client';
export function Panel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div>{open && children}</div>;
}
// page.tsx (server)
<Panel><ServerChart /></Panel>                 // ServerChart рендерится на сервере

// ПЛОХО: весь объект из БД уедет в HTML
<ClientProfile user={userFromDb} />
// ХОРОШО
<ClientProfile name={user.name} avatar={user.avatarUrl} />`,
    tip: 'Скажи, что RSC-payload виден в исходном коде страницы, поэтому передача лишних полей объекта - это не только вес, но и утечка данных.' },

  { id: 'rx65',
    q: 'Почему рендер в React должен быть чистым и что такое tearing?',
    a: `<p>Конкурентный рендеринг даёт React право <strong>прервать, выбросить и перезапустить</strong> работу над деревом, а также отрендерить его несколько раз перед коммитом. Это возможно только если рендер — чистая функция: одни и те же пропсы и состояние дают один и тот же результат без побочных эффектов.</p>
    <p>Что нарушает чистоту: мутация пропсов или внешних объектов, запись в ref во время рендера, чтение и запись в DOM, вызов <code>setState</code> чужого компонента, изменение модуль-скоуп переменных, зависимость от <code>Date.now()</code> и <code>Math.random()</code> без стабилизации. StrictMode специально вызывает рендер дважды, чтобы такое всплыло.</p>
    <p><strong>Tearing</strong> — визуальная рассинхронизация: React прерывает рендер, внешний источник данных за это время меняется, и часть дерева отрисовывается со старым значением, часть — с новым. В одном кадре пользователь видит противоречивые данные. До конкурентного режима это было невозможно, потому что рендер был синхронным.</p>
    <p>Решение — <code>useSyncExternalStore</code>: React читает снимок стора синхронно в момент коммита и, обнаружив расхождение, откатывает и перерендеривает всё дерево целиком с одним значением. Именно поэтому все серьёзные сторы (Redux, Zustand, Jotai) переехали на этот хук. Из своего кода это значит: не читать изменяемое внешнее состояние напрямую в рендере — только через подписку.</p>`,
    code: `// нарушение чистоты: мутация внешнего состояния в рендере
let renderCount = 0;
function Bad() {
  renderCount++;                      // побочный эффект в рендере
  return <div>{renderCount}</div>;
}

// tearing: чтение изменяемого внешнего источника напрямую
function Bad2() {
  return <div>{window.innerWidth}</div>;   // может отличаться между кусками дерева
}

// правильно: подписка через useSyncExternalStore
const width = useSyncExternalStore(
  (cb) => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb); },
  () => window.innerWidth,
  () => 1024                          // снимок для SSR
);`,
    tip: 'Определи tearing одной фразой: части одного кадра отрисованы с разными версиями внешних данных. Это точное определение, и его редко дают корректно.' },
];
