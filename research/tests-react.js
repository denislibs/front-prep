/**
 * Наборы тестов для режима react.
 *
 * Особенности окружения (важно при правке):
 *  - render / click / press / type асинхронные, всегда await;
 *  - таймеры настоящие, clock.tick не работает: ждём через
 *    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
 *  - обновления состояния вне хелперов дают предупреждение про act,
 *    поэтому любое ожидание таймера и любое ручное событие оборачиваем в act;
 *  - отсутствующие в jsdom API (localStorage, IntersectionObserver, fetch)
 *    подменяются заглушкой прямо в теле проверки.
 *
 * Ниже — куски-заготовки, которые приклеиваются к телам проверок конкатенацией.
 * Все они объявлены функциями, поэтому всплывают и доступны с первой строки тела.
 */

/** Промис, которым управляет сам тест */
const R_DEFERRED = `
function deferred() {
  const box = {};
  box.promise = new Promise(function (resolve, reject) {
    box.resolve = resolve;
    box.reject = reject;
  });
  return box;
}
`;

/** Подменяет window.localStorage: в jsdom его нет для opaque origin */
const R_STORAGE = `
function installStorage(win, initial) {
  const store = { data: Object.assign({}, initial) };
  const api = {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(store.data, key) ? store.data[key] : null;
    },
    setItem: function (key, value) { store.data[key] = String(value); },
    removeItem: function (key) { delete store.data[key]; },
    clear: function () { store.data = {}; },
    key: function (index) { return Object.keys(store.data)[index] || null; },
  };
  Object.defineProperty(api, 'length', { get: function () { return Object.keys(store.data).length; } });
  Object.defineProperty(win, 'localStorage', { configurable: true, value: api });
  return store;
}
`;

/** Заглушка IntersectionObserver плюс подопытный компонент бесконечного списка */
const R_INTERSECTION = R_DEFERRED + `
function installIntersectionObserver() {
  const observers = [];
  function FakeObserver(callback, options) {
    this.callback = callback;
    this.options = options;
    this.nodes = [];
    this.disconnected = false;
    observers.push(this);
  }
  FakeObserver.prototype.observe = function (node) { this.nodes.push(node); };
  FakeObserver.prototype.unobserve = function (node) {
    this.nodes = this.nodes.filter(function (item) { return item !== node; });
  };
  FakeObserver.prototype.disconnect = function () { this.disconnected = true; this.nodes = []; };
  FakeObserver.prototype.takeRecords = function () { return []; };
  FakeObserver.prototype.trigger = function (isIntersecting) {
    this.callback(this.nodes.map(function (node) {
      return {
        isIntersecting: isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
        target: node,
      };
    }), this);
  };
  globalThis.IntersectionObserver = FakeObserver;
  window.IntersectionObserver = FakeObserver;
  return observers;
}

function InfiniteProbe(props) {
  const state = useInfiniteList(props.fetchPage);
  const items = state.items || [];
  return (
    <div>
      <ul>{items.map(function (item, i) { return <li key={i}>{item}</li>; })}</ul>
      <p>{'состояние: ' + (state.isLoading ? 'загрузка' : 'готово')}</p>
      <p>{'ещё есть: ' + (state.hasMore ? 'да' : 'нет')}</p>
      <p>{'ошибка: ' + (state.error ? state.error.message : 'нет')}</p>
      <div ref={state.sentinelRef}>сентинел</div>
    </div>
  );
}
`;

/**
 * createPortal живёт в react-dom, а в область видимости песочницы кладётся только React.
 * Берём настоящую реализацию, если ReactDOM доступен, иначе собираем портал сами:
 * это ровно тот объект, который возвращает ReactDOM.createPortal.
 */
const R_PORTAL = `
function installPortal() {
  const reactDom = globalThis.ReactDOM || (window && window.ReactDOM) || null;
  globalThis.createPortal = (reactDom && reactDom.createPortal) || function (children, container, key) {
    return {
      $$typeof: Symbol.for('react.portal'),
      key: key == null ? null : String(key),
      children: children,
      containerInfo: container,
      implementation: null,
    };
  };
}
`;

/** Глушит вывод React о пойманной границей ошибке — иначе прогон тонет в стектрейсах */
const R_QUIET = `
function silenceReactErrors() {
  const target = globalThis.console;
  const originalError = target.error;
  const originalWarn = target.warn;
  target.error = function () {};
  target.warn = function () {};
  return {
    restore: function () { target.error = originalError; target.warn = originalWarn; },
  };
}
`;

/** Управляемый сервер вместо fetch: тест сам решает, когда и чем ответить */
const R_FETCH = `
function installFetch() {
  const server = { pending: {}, calls: [] };
  globalThis.fetch = function (url, options) {
    const signal = options && options.signal;
    const entry = { url: url, signal: signal };
    entry.promise = new Promise(function (resolve, reject) {
      entry.respond = function (response) {
        resolve({
          ok: response.ok !== false,
          status: response.status || 200,
          json: function () { return Promise.resolve(response.body); },
        });
      };
      entry.failWith = function (error) { reject(error); };
      if (signal) {
        signal.addEventListener('abort', function () {
          const error = new Error('The operation was aborted.');
          error.name = 'AbortError';
          reject(error);
        });
      }
    });
    server.calls.push(url);
    server.pending[url] = entry;
    return entry.promise;
  };
  return server;
}
`;

/**
 * Autocomplete в эталоне опирается на useDebounce из соседней задачи.
 * Кладём запасную реализацию в глобальную область: если кандидат написал свою,
 * его объявление окажется ближе по цепочке областей видимости и победит.
 */
const R_DEBOUNCE = `
function installDebounce() {
  globalThis.useDebounce = function (value, ms) {
    const [current, setCurrent] = useState(value);
    useEffect(function () {
      const timer = setTimeout(function () { setCurrent(value); }, ms);
      return function () { clearTimeout(timer); };
    }, [value, ms]);
    return current;
  };
}
`;

const TESTS_REACT = {

  /* ──────────────────────────────────────────────────────────────
     tx29 — useLocalStorage(key, initialValue)
     ────────────────────────────────────────────────────────────── */
  tx29: {
    env: 'react',
    entry: 'useLocalStorage',
    starter: `function useLocalStorage(key, initialValue) {
  // ваш код
}`,
    cases: [
      { name: 'отдаёт начальное значение, когда в хранилище пусто',
        body: R_STORAGE + `
installStorage(window, {});
function Probe() {
  const [value] = useLocalStorage('tx29-a', 'пусто');
  return <p>{'значение: ' + value}</p>;
}
const root = await render(<Probe />);
assert.ok(queryByText(root, 'значение: пусто'), 'без записи в хранилище должно вернуться initialValue');` },

      { name: 'читает сохранённое значение при монтировании',
        body: R_STORAGE + `
installStorage(window, { 'tx29-b': JSON.stringify('из хранилища') });
function Probe() {
  const [value] = useLocalStorage('tx29-b', 'пусто');
  return <p>{'значение: ' + value}</p>;
}
const root = await render(<Probe />);
assert.ok(queryByText(root, 'значение: из хранилища'), 'значение должно подтянуться из localStorage');` },

      { name: 'записывает новое значение в localStorage',
        body: R_STORAGE + `
const store = installStorage(window, {});
function Probe() {
  const [value, setValue] = useLocalStorage('tx29-c', 0);
  return (
    <div>
      <p>{'значение: ' + value}</p>
      <button type="button" onClick={() => setValue(7)}>записать</button>
    </div>
  );
}
const root = await render(<Probe />);
await click(getByRole(root, 'button', { name: 'записать' }));
assert.ok(queryByText(root, 'значение: 7'), 'состояние должно обновиться');
assert.equal(store.data['tx29-c'], '7', 'значение должно уехать в хранилище сериализованным');` },

      { name: 'поддерживает функциональное обновление setValue(prev => ...)',
        body: R_STORAGE + `
installStorage(window, {});
function Probe() {
  const [value, setValue] = useLocalStorage('tx29-d', 1);
  return (
    <div>
      <p>{'значение: ' + value}</p>
      <button type="button" onClick={() => setValue((prev) => prev + 1)}>плюс</button>
    </div>
  );
}
const root = await render(<Probe />);
await click(getByRole(root, 'button', { name: 'плюс' }));
await click(getByRole(root, 'button', { name: 'плюс' }));
assert.ok(queryByText(root, 'значение: 3'), 'два функциональных апдейта подряд должны дать 3');` },

      { name: 'падает на начальное значение, если в хранилище битый JSON',
        body: R_STORAGE + `
installStorage(window, { 'tx29-e': '{это не json' });
function Probe() {
  const [value] = useLocalStorage('tx29-e', 'запасное');
  return <p>{'значение: ' + value}</p>;
}
const root = await render(<Probe />);
assert.ok(queryByText(root, 'значение: запасное'), 'JSON.parse должен быть обёрнут в try/catch');` },

      { name: 'не падает, когда localStorage недоступен',
        body: `const boom = function () { throw new Error('доступ запрещён'); };
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: { getItem: boom, setItem: boom, removeItem: boom, key: boom, clear: boom, length: 0 },
});
function Probe() {
  const [value, setValue] = useLocalStorage('tx29-f', 'по умолчанию');
  return (
    <div>
      <p>{'значение: ' + value}</p>
      <button type="button" onClick={() => setValue('новое')}>записать</button>
    </div>
  );
}
const root = await render(<Probe />);
assert.ok(queryByText(root, 'значение: по умолчанию'), 'при недоступном хранилище берём initialValue');
await click(getByRole(root, 'button', { name: 'записать' }));
assert.ok(queryByText(root, 'значение: новое'), 'состояние должно обновиться даже без записи в хранилище');` },

      { name: 'подхватывает изменение из другой вкладки по событию storage',
        body: R_STORAGE + `
const store = installStorage(window, { 'tx29-g': JSON.stringify('своё') });
function Probe() {
  const [value] = useLocalStorage('tx29-g', 'пусто');
  return <p>{'значение: ' + value}</p>;
}
const root = await render(<Probe />);
assert.ok(queryByText(root, 'значение: своё'));
await act(async () => {
  store.data['tx29-g'] = JSON.stringify('из соседней вкладки');
  const event = new window.Event('storage');
  event.key = 'tx29-g';
  event.oldValue = JSON.stringify('своё');
  event.newValue = JSON.stringify('из соседней вкладки');
  event.storageArea = window.localStorage;
  window.dispatchEvent(event);
});
assert.ok(queryByText(root, 'значение: из соседней вкладки'), 'нужна подписка на событие storage');` },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     tx30 — useEventListener(eventType, handler, target, options)
     ────────────────────────────────────────────────────────────── */
  tx30: {
    env: 'react',
    entry: 'useEventListener',
    starter: `function useEventListener(eventType, handler, target, options) {
  // ваш код
}`,
    cases: [
      { name: 'по умолчанию слушает window',
        body: `const handler = spy();
function Probe() {
  useEventListener('keydown', handler);
  return <p>готово</p>;
}
await render(<Probe />);
await act(async () => {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'a' }));
});
assert.equal(handler.count, 1, 'без третьего аргумента цель — window');` },

      { name: 'подписывается на элемент, переданный через ref',
        body: `const handler = spy();
function Probe() {
  const ref = useRef(null);
  useEventListener('click', handler, ref);
  return <button ref={ref} type="button">кнопка</button>;
}
const root = await render(<Probe />);
await click(getByRole(root, 'button'));
assert.equal(handler.count, 1, 'ref нужно разворачивать через target.current внутри эффекта');` },

      { name: 'снимает подписку при размонтировании',
        body: `const handler = spy();
function Probe() {
  useEventListener('keydown', handler);
  return <p>готово</p>;
}
await render(<Probe />);
await act(async () => {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'a' }));
});
assert.equal(handler.count, 1);
await cleanup();
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'b' }));
assert.equal(handler.count, 1, 'после размонтирования слушатель должен быть снят');` },

      { name: 'не пересоздаёт подписку при смене колбэка',
        body: `const target = {
  addEventListener: spy(),
  removeEventListener: spy(),
};
function Probe() {
  const [count, setCount] = useState(0);
  useEventListener('ping', () => {}, target);
  return <button type="button" onClick={() => setCount(count + 1)}>{'рендер ' + count}</button>;
}
const root = await render(<Probe />);
assert.equal(target.addEventListener.count, 1);
await click(getByRole(root, 'button'));
await click(getByRole(root, 'button'));
assert.ok(queryByText(root, 'рендер 2'), 'компонент должен был перерендериться');
assert.equal(target.addEventListener.count, 1, 'колбэк держат в ref, а не в зависимостях эффекта');
assert.equal(target.removeEventListener.count, 0, 'лишних отписок быть не должно');` },

      { name: 'вызывает свежий колбэк, а не тот, что был при подписке',
        body: `let listener = null;
const target = {
  addEventListener: function (type, fn) { listener = fn; },
  removeEventListener: function () { listener = null; },
};
const seen = [];
function Probe() {
  const [count, setCount] = useState(0);
  useEventListener('ping', () => { seen.push(count); }, target);
  return <button type="button" onClick={() => setCount(count + 1)}>{'рендер ' + count}</button>;
}
const root = await render(<Probe />);
await act(async () => { listener({ type: 'ping' }); });
await click(getByRole(root, 'button'));
await act(async () => { listener({ type: 'ping' }); });
assert.equal(seen, [0, 1], 'обработчик должен видеть актуальное состояние');` },

      { name: 'переподписывается при смене типа события',
        body: `const calls = [];
const target = {
  addEventListener: function (type) { calls.push('+' + type); },
  removeEventListener: function (type) { calls.push('-' + type); },
};
function Probe() {
  const [type, setType] = useState('ping');
  useEventListener(type, () => {}, target);
  return <button type="button" onClick={() => setType('pong')}>сменить</button>;
}
const root = await render(<Probe />);
await click(getByRole(root, 'button', { name: 'сменить' }));
assert.equal(calls, ['+ping', '-ping', '+pong'], 'смена типа события должна пересоздать подписку');` },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     tx31 — Tabs (набор перенесён из tests-sample-react.js без изменений)
     ────────────────────────────────────────────────────────────── */
  tx31: {
    env: 'react',
    entry: 'Tabs',
    starter: `function Tabs({ items, defaultIndex = 0 }) {
  // ваш код
}`,
    cases: [
      { name: 'рендерит вкладку на каждый элемент',
        body: `const items = [{ id: 1, title: 'Первая', content: 'A' }, { id: 2, title: 'Вторая', content: 'B' }];
const root = await render(<Tabs items={items} />);
assert.equal(queryAllByRole(root, 'tab').length, 2);` },

      { name: 'показывает содержимое активной вкладки',
        body: `const items = [{ id: 1, title: 'Первая', content: 'A' }, { id: 2, title: 'Вторая', content: 'B' }];
const root = await render(<Tabs items={items} />);
assert.ok(queryByText(root, 'A'), 'содержимое первой вкладки должно быть видно');` },

      { name: 'переключает вкладку по клику',
        body: `const items = [{ id: 1, title: 'Первая', content: 'A' }, { id: 2, title: 'Вторая', content: 'B' }];
const root = await render(<Tabs items={items} />);
await click(getByRole(root, 'tab', { name: 'Вторая' }));
assert.ok(queryByText(root, 'B'), 'после клика должно показаться содержимое второй вкладки');` },

      { name: 'переключает вкладку стрелкой вправо',
        body: `const items = [{ id: 1, title: 'Первая', content: 'A' }, { id: 2, title: 'Вторая', content: 'B' }];
const root = await render(<Tabs items={items} />);
await press(getByRole(root, 'tab', { name: 'Первая' }), 'ArrowRight');
assert.equal(getByRole(root, 'tab', { name: 'Вторая' }).getAttribute('aria-selected'), 'true');` },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     tx32 — Modal через createPortal
     ────────────────────────────────────────────────────────────── */
  tx32: {
    env: 'react',
    needsFocus: true,
    entry: 'Modal',
    starter: `function Modal({ isOpen, onClose, title, children }) {
  // ваш код
}`,
    cases: [
      { name: 'ничего не рендерит, пока isOpen равен false',
        body: R_PORTAL + `
installPortal();
const onClose = spy();
await render(<Modal isOpen={false} onClose={onClose} title="Диалог"><p>Внутри</p></Modal>);
assert.equal(queryAllByRole(document.body, 'dialog').length, 0, 'закрытой модалки не должно быть в DOM');
assert.equal(queryByText(document.body, 'Внутри'), null);` },

      { name: 'рендерит содержимое порталом, вне контейнера компонента',
        body: R_PORTAL + `
installPortal();
const onClose = spy();
const root = await render(<Modal isOpen={true} onClose={onClose} title="Диалог"><p>Внутри</p></Modal>);
assert.equal(text(root), '', 'содержимое не должно лежать в контейнере компонента');
const dialog = getByRole(document.body, 'dialog');
assert.equal(dialog.getAttribute('aria-modal'), 'true', 'диалогу нужен aria-modal');
assert.ok(queryByText(document.body, 'Внутри'), 'дети должны отрендериться внутри портала');` },

      { name: 'закрывается по нажатию Escape',
        body: R_PORTAL + `
installPortal();
const onClose = spy();
await render(<Modal isOpen={true} onClose={onClose} title="Диалог"><p>Внутри</p></Modal>);
await press(document.body, 'Enter');
assert.equal(onClose.count, 0, 'посторонние клавиши модалку не закрывают');
await press(document.body, 'Escape');
assert.equal(onClose.count, 1, 'слушатель Escape вешают на document в эффекте');` },

      { name: 'закрывается по клику на подложку, но не по клику внутри',
        body: R_PORTAL + `
installPortal();
const onClose = spy();
await render(<Modal isOpen={true} onClose={onClose} title="Диалог"><p>Внутри</p></Modal>);
const dialog = getByRole(document.body, 'dialog');
await click(getByText(document.body, 'Внутри'));
assert.equal(onClose.count, 0, 'клик внутри контента закрывать не должен');
await click(dialog.parentElement);
assert.equal(onClose.count, 1, 'клик по подложке закрывает — сравнивайте target и currentTarget');` },

      { name: 'блокирует скролл body на время показа и возвращает как было',
        body: R_PORTAL + `
installPortal();
document.body.style.overflow = 'auto';
function App() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Открыть</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Диалог"><p>Внутри</p></Modal>
    </div>
  );
}
const root = await render(<App />);
assert.equal(document.body.style.overflow, 'auto');
await click(getByRole(root, 'button', { name: 'Открыть' }));
assert.equal(document.body.style.overflow, 'hidden', 'на время показа скролл body блокируется');
await press(document.body, 'Escape');
assert.equal(document.body.style.overflow, 'auto', 'прежнее значение overflow надо вернуть, а не затереть пустой строкой');
document.body.style.overflow = '';` },

      { name: 'возвращает фокус на элемент, который её открыл',
        body: R_PORTAL + `
installPortal();
function App() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Открыть</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Диалог"><p>Внутри</p></Modal>
    </div>
  );
}
const root = await render(<App />);
const opener = getByRole(root, 'button', { name: 'Открыть' });
opener.focus();
await click(opener);
assert.notEqual(document.activeElement, opener, 'при открытии фокус уходит внутрь модалки');
await press(document.body, 'Escape');
assert.equal(document.activeElement, opener, 'после закрытия фокус возвращается на открывашку');` },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     tx33 — useIntersectionObserver + бесконечный скролл
     ────────────────────────────────────────────────────────────── */
  tx33: {
    env: 'react',
    entry: 'useInfiniteList',
    starter: `function useIntersectionObserver(options) {
  // ваш код: [ref, isIntersecting]
}

function useInfiniteList(fetchPage) {
  // ваш код: { items, hasMore, isLoading, error, sentinelRef }
}`,
    cases: [
      { name: 'не запрашивает данные, пока сентинел не попал во вьюпорт',
        body: R_INTERSECTION + `
const observers = installIntersectionObserver();
const fetchPage = spy(function () { return Promise.resolve({ items: ['первый'], hasMore: false }); });
await render(<InfiniteProbe fetchPage={fetchPage} />);
await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
assert.equal(fetchPage.count, 0, 'загрузка стартует только по пересечению');
assert.equal(observers.length, 1, 'на узел сентинела должен быть навешен наблюдатель');` },

      { name: 'подгружает страницу, когда сентинел появился во вьюпорте',
        body: R_INTERSECTION + `
const observers = installIntersectionObserver();
const gate = deferred();
const fetchPage = spy(function () { return gate.promise; });
const root = await render(<InfiniteProbe fetchPage={fetchPage} />);
await act(async () => { observers[0].trigger(true); });
assert.equal(fetchPage.count, 1);
assert.ok(queryByText(root, 'состояние: загрузка'), 'на время запроса нужен флаг загрузки');
await act(async () => { observers[0].trigger(false); });
await act(async () => { gate.resolve({ items: ['Полтава', 'Псков'], hasMore: true }); });
assert.ok(queryByText(root, 'Полтава'), 'полученные элементы должны появиться в списке');
assert.ok(queryByText(root, 'Псков'));
assert.ok(queryByText(root, 'состояние: готово'));` },

      { name: 'не отправляет второй запрос, пока идёт загрузка',
        body: R_INTERSECTION + `
const observers = installIntersectionObserver();
const gate = deferred();
const fetchPage = spy(function () { return gate.promise; });
await render(<InfiniteProbe fetchPage={fetchPage} />);
await act(async () => { observers[0].trigger(true); });
await act(async () => { observers[0].trigger(false); });
await act(async () => { observers[0].trigger(true); });
await act(async () => { observers[0].trigger(false); });
assert.equal(fetchPage.count, 1, 'повторное пересечение во время загрузки не должно плодить запросы');
await act(async () => { gate.resolve({ items: ['Тула'], hasMore: false }); });` },

      { name: 'перестаёт запрашивать, когда сервер сказал, что данных больше нет',
        body: R_INTERSECTION + `
const observers = installIntersectionObserver();
const gate = deferred();
const fetchPage = spy(function () { return gate.promise; });
const root = await render(<InfiniteProbe fetchPage={fetchPage} />);
await act(async () => { observers[0].trigger(true); });
await act(async () => { observers[0].trigger(false); });
await act(async () => { gate.resolve({ items: ['Омск'], hasMore: false }); });
assert.ok(queryByText(root, 'ещё есть: нет'), 'hasMore должен прийти из ответа');
await act(async () => { observers[0].trigger(true); });
await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
assert.equal(fetchPage.count, 1, 'в конце списка новых запросов быть не должно');` },

      { name: 'показывает ошибку и снимает флаг загрузки, если запрос упал',
        body: R_INTERSECTION + `
const observers = installIntersectionObserver();
const gate = deferred();
const fetchPage = spy(function () { return gate.promise; });
const root = await render(<InfiniteProbe fetchPage={fetchPage} />);
await act(async () => { observers[0].trigger(true); });
await act(async () => { observers[0].trigger(false); });
await act(async () => { gate.reject(new Error('сеть отвалилась')); await Promise.resolve(); });
assert.ok(queryByText(root, 'ошибка: сеть отвалилась'), 'ошибку нужно положить в состояние, а не проглотить');
assert.ok(queryByText(root, 'состояние: готово'), 'после провала загрузка должна закончиться');` },

      { name: 'отключает наблюдателя при размонтировании',
        body: R_INTERSECTION + `
const observers = installIntersectionObserver();
const fetchPage = spy(function () { return new Promise(function () {}); });
await render(<InfiniteProbe fetchPage={fetchPage} />);
assert.equal(observers[0].disconnected, false);
await cleanup();
assert.equal(observers[0].disconnected, true, 'в cleanup эффекта нужен observer.disconnect()');` },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     tx34 — форма с валидацией
     ────────────────────────────────────────────────────────────── */
  tx34: {
    env: 'react',
    entry: 'SignUpForm',
    starter: `function SignUpForm({ onSubmit }) {
  // ваш код: email, пароль и подтверждение пароля
}`,
    cases: [
      { name: 'не показывает ошибку, пока пользователь печатает первый раз',
        body: `const onSubmit = spy(function () { return Promise.resolve(); });
const root = await render(<SignUpForm onSubmit={onSubmit} />);
await type(queryAll(root, 'input')[0], 'ко');
assert.equal(queryAllByRole(root, 'alert').length, 0,
  'ошибку показывают после blur или сабмита, а не с первого символа');` },

      { name: 'показывает ошибку формата email после потери фокуса',
        body: `const onSubmit = spy(function () { return Promise.resolve(); });
const root = await render(<SignUpForm onSubmit={onSubmit} />);
const email = queryAll(root, 'input')[0];
await type(email, 'не-почта');
await act(async () => { fire(email, 'focusout'); });
assert.ok(queryAllByRole(root, 'alert').length > 0, 'после blur ошибка должна появиться');
assert.equal(email.getAttribute('aria-invalid'), 'true', 'поле с ошибкой помечают aria-invalid');
assert.ok(email.getAttribute('aria-describedby'), 'ошибку связывают с полем через aria-describedby');` },

      { name: 'ругается на несовпадающие пароли',
        body: `const onSubmit = spy(function () { return Promise.resolve(); });
const root = await render(<SignUpForm onSubmit={onSubmit} />);
const inputs = queryAll(root, 'input');
await type(inputs[1], 'ochenSlozhniy1');
await type(inputs[2], 'drugoyParol1');
await act(async () => { fire(inputs[2], 'focusout'); });
const messages = queryAllByRole(root, 'alert').map(function (el) { return text(el); }).join(' | ');
assert.ok(/не совпад/i.test(messages),
  'нужна кросс-полевая проверка совпадения паролей, показано: ' + messages);` },

      { name: 'не отправляет невалидную форму и показывает все ошибки сразу',
        body: `const onSubmit = spy(function () { return Promise.resolve(); });
const root = await render(<SignUpForm onSubmit={onSubmit} />);
await act(async () => { fire(queryAll(root, 'form')[0], 'submit'); });
assert.equal(onSubmit.count, 0, 'невалидную форму отправлять нельзя');
assert.ok(queryAllByRole(root, 'alert').length >= 2,
  'после сабмита все поля считаются тронутыми и показывают ошибки');` },

      { name: 'отправляет валидные данные',
        body: `const onSubmit = spy(function () { return Promise.resolve(); });
const root = await render(<SignUpForm onSubmit={onSubmit} />);
const inputs = queryAll(root, 'input');
await type(inputs[0], 'anna@example.com');
await type(inputs[1], 'ochenSlozhniy1');
await type(inputs[2], 'ochenSlozhniy1');
await act(async () => { fire(queryAll(root, 'form')[0], 'submit'); });
assert.equal(onSubmit.count, 1, 'валидная форма должна уйти в onSubmit');
assert.equal(onSubmit.lastArgs[0].email, 'anna@example.com');
assert.equal(onSubmit.lastArgs[0].password, 'ochenSlozhniy1');` },

      { name: 'блокирует кнопку, пока идёт отправка',
        body: R_DEFERRED + `
const gate = deferred();
const onSubmit = spy(function () { return gate.promise; });
const root = await render(<SignUpForm onSubmit={onSubmit} />);
const inputs = queryAll(root, 'input');
await type(inputs[0], 'anna@example.com');
await type(inputs[1], 'ochenSlozhniy1');
await type(inputs[2], 'ochenSlozhniy1');
const button = queryAll(root, 'button[type="submit"]')[0];
assert.ok(button, 'форме нужна кнопка отправки');
assert.equal(button.disabled, false, 'до отправки кнопка активна');
await act(async () => { fire(queryAll(root, 'form')[0], 'submit'); });
assert.equal(button.disabled, true, 'пока запрос в полёте, кнопку нужно заблокировать');
await act(async () => { gate.resolve(); });
assert.equal(button.disabled, false, 'после ответа кнопку возвращают в строй');` },

      { name: 'показывает ошибку сервера после неудачной отправки',
        body: `const onSubmit = spy(function () { return Promise.reject(new Error('Такой email уже занят')); });
const root = await render(<SignUpForm onSubmit={onSubmit} />);
const inputs = queryAll(root, 'input');
await type(inputs[0], 'anna@example.com');
await type(inputs[1], 'ochenSlozhniy1');
await type(inputs[2], 'ochenSlozhniy1');
await act(async () => { fire(queryAll(root, 'form')[0], 'submit'); });
await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
assert.ok(queryByText(root, 'Такой email уже занят'), 'сообщение сервера нужно показать пользователю');` },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     tx35 — секундомер
     ────────────────────────────────────────────────────────────── */
  tx35: {
    env: 'react',
    entry: 'Stopwatch',
    starter: `function Stopwatch() {
  // ваш код: старт, пауза, сброс, круг
}`,
    cases: [
      { name: 'стартует с нулевого времени',
        body: `const root = await render(<Stopwatch />);
const shown = (text(root).match(/\\d\\d:\\d\\d\\.\\d\\d/) || [])[0];
assert.equal(shown, '00:00.00', 'на старте секундомер показывает нули в формате mm:ss.hh');` },

      { name: 'кнопка «Круг» недоступна, пока секундомер стоит',
        body: `const root = await render(<Stopwatch />);
assert.equal(getByRole(root, 'button', { name: 'Круг' }).disabled, true,
  'круг можно снимать только на ходу');` },

      { name: 'отсчитывает время после старта',
        body: `const root = await render(<Stopwatch />);
const read = () => (text(root).match(/\\d\\d:\\d\\d\\.\\d\\d/) || [])[0];
await click(getByRole(root, 'button', { name: 'Старт' }));
await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
const shown = read();
await click(getByRole(root, 'button', { name: 'Пауза' }));
assert.notEqual(shown, '00:00.00', 'после старта время должно идти');
assert.ok(/^00:00\\.\\d\\d$/.test(shown), 'за четверть секунды набегают только сотые, показано: ' + shown);` },

      { name: 'пауза останавливает отсчёт, а не сбрасывает его',
        body: `const root = await render(<Stopwatch />);
const read = () => (text(root).match(/\\d\\d:\\d\\d\\.\\d\\d/) || [])[0];
await click(getByRole(root, 'button', { name: 'Старт' }));
await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
await click(getByRole(root, 'button', { name: 'Пауза' }));
const paused = read();
assert.notEqual(paused, '00:00.00', 'на паузе остаётся накопленное время');
await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
assert.equal(read(), paused, 'на паузе интервал обязан быть очищен');` },

      { name: 'продолжает с накопленного времени, не засчитывая паузу',
        body: `const root = await render(<Stopwatch />);
const hundredths = () => {
  const parts = text(root).match(/(\\d\\d):(\\d\\d)\\.(\\d\\d)/);
  return Number(parts[1]) * 6000 + Number(parts[2]) * 100 + Number(parts[3]);
};
await click(getByRole(root, 'button', { name: 'Старт' }));
await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
await click(getByRole(root, 'button', { name: 'Пауза' }));
const paused = hundredths();
await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
await click(getByRole(root, 'button', { name: 'Старт' }));
await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
const resumed = hundredths();
await click(getByRole(root, 'button', { name: 'Пауза' }));
assert.ok(resumed > paused, 'после возобновления время должно расти дальше');
assert.ok(resumed < paused + 32,
  'время паузы засчитывать нельзя: было ' + paused + ', стало ' + resumed);` },

      { name: 'записывает круги и очищает их сбросом',
        body: `const root = await render(<Stopwatch />);
assert.equal(queryAll(root, 'li').length, 0);
await click(getByRole(root, 'button', { name: 'Старт' }));
await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
await click(getByRole(root, 'button', { name: 'Круг' }));
await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
await click(getByRole(root, 'button', { name: 'Круг' }));
await click(getByRole(root, 'button', { name: 'Пауза' }));
assert.equal(queryAll(root, 'li').length, 2, 'каждый круг добавляет строку в список');
await click(getByRole(root, 'button', { name: 'Сброс' }));
assert.equal(queryAll(root, 'li').length, 0, 'сброс очищает круги');
assert.equal((text(root).match(/\\d\\d:\\d\\d\\.\\d\\d/) || [])[0], '00:00.00', 'сброс обнуляет время');` },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     tx36 — Todo с фильтрами
     ────────────────────────────────────────────────────────────── */
  tx36: {
    env: 'react',
    entry: 'TodoApp',
    starter: `function TodoApp() {
  // ваш код: добавление, отметка, удаление, фильтры all / active / done
}`,
    cases: [
      { name: 'добавляет задачу по отправке формы',
        body: `const root = await render(<TodoApp />);
await type(getByRole(root, 'textbox'), 'купить хлеб');
await act(async () => { fire(queryAll(root, 'form')[0], 'submit'); });
assert.ok(queryByText(root, 'купить хлеб'), 'задача должна появиться в списке');
assert.equal(queryAll(root, 'li').length, 1);
assert.equal(getByRole(root, 'textbox').value, '', 'после добавления поле очищается');` },

      { name: 'не добавляет задачу из одних пробелов',
        body: `const root = await render(<TodoApp />);
await type(getByRole(root, 'textbox'), '   ');
await act(async () => { fire(queryAll(root, 'form')[0], 'submit'); });
assert.equal(queryAll(root, 'li').length, 0, 'текст надо тримить, а пустой отбрасывать');` },

      { name: 'считает оставшиеся задачи и уменьшает счётчик при отметке',
        body: `const root = await render(<TodoApp />);
for (const title of ['первая', 'вторая']) {
  await type(getByRole(root, 'textbox'), title);
  await act(async () => { fire(queryAll(root, 'form')[0], 'submit'); });
}
assert.ok(queryByText(root, 'Осталось: 2'), 'счётчик активных задач считают от списка');
await click(queryAllByRole(root, 'checkbox')[0]);
assert.ok(queryByText(root, 'Осталось: 1'), 'выполненная задача уходит из счётчика');` },

      { name: 'удаляет задачу, не трогая соседние',
        body: `const root = await render(<TodoApp />);
for (const title of ['первая', 'вторая']) {
  await type(getByRole(root, 'textbox'), title);
  await act(async () => { fire(queryAll(root, 'form')[0], 'submit'); });
}
await click(queryAllByRole(root, 'button', { name: 'Удалить' })[0]);
assert.equal(queryAll(root, 'li').length, 1);
assert.ok(queryByText(root, 'вторая'), 'вторая задача должна остаться');
assert.equal(queryByText(root, 'первая'), null);` },

      { name: 'фильтры показывают только активные и только выполненные',
        body: `const root = await render(<TodoApp />);
for (const title of ['активная', 'сделанная']) {
  await type(getByRole(root, 'textbox'), title);
  await act(async () => { fire(queryAll(root, 'form')[0], 'submit'); });
}
await click(queryAllByRole(root, 'checkbox')[1]);
await click(getByRole(root, 'button', { name: 'active' }));
assert.equal(queryAll(root, 'li').length, 1);
assert.ok(queryByText(root, 'активная'));
await click(getByRole(root, 'button', { name: 'done' }));
assert.equal(queryAll(root, 'li').length, 1);
assert.ok(queryByText(root, 'сделанная'));
await click(getByRole(root, 'button', { name: 'all' }));
assert.equal(queryAll(root, 'li').length, 2);` },

      { name: 'очистка выполненных убирает только отмеченные',
        body: `const root = await render(<TodoApp />);
for (const title of ['останется', 'уйдёт']) {
  await type(getByRole(root, 'textbox'), title);
  await act(async () => { fire(queryAll(root, 'form')[0], 'submit'); });
}
await click(queryAllByRole(root, 'checkbox')[1]);
await click(getByRole(root, 'button', { name: 'Очистить выполненные' }));
assert.equal(queryAll(root, 'li').length, 1);
assert.ok(queryByText(root, 'останется'));
assert.ok(queryByText(root, 'Осталось: 1'));` },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     tx37 — звёздный рейтинг
     ────────────────────────────────────────────────────────────── */
  tx37: {
    env: 'react',
    entry: 'StarRating',
    starter: `function StarRating({ max = 5, value, defaultValue = 0, onChange, readOnly = false }) {
  // ваш код
}`,
    cases: [
      { name: 'рендерит группу с нужным числом звёзд',
        body: `const root = await render(<StarRating />);
assert.equal(queryAllByRole(root, 'radiogroup').length, 1, 'группе нужна роль radiogroup');
assert.equal(queryAllByRole(root, 'radio').length, 5, 'по умолчанию пять звёзд');
const custom = await render(<StarRating max={3} />);
assert.equal(queryAllByRole(custom, 'radio').length, 3, 'число звёзд задаёт проп max');` },

      { name: 'в неконтролируемом режиме запоминает выбранную оценку',
        body: `const onChange = spy();
const root = await render(<StarRating defaultValue={0} onChange={onChange} />);
await click(queryAllByRole(root, 'radio')[2]);
assert.equal(onChange.count, 1);
assert.equal(onChange.lastArgs[0], 3, 'наружу отдают номер звезды, а не индекс');
assert.equal(queryAllByRole(root, 'radio')[2].checked, true,
  'без пропа value компонент хранит выбор сам');` },

      { name: 'в контролируемом режиме не меняет оценку сам',
        body: `const onChange = spy();
const root = await render(<StarRating value={2} onChange={onChange} />);
assert.equal(queryAllByRole(root, 'radio')[1].checked, true);
await click(queryAllByRole(root, 'radio')[3]);
assert.equal(onChange.lastArgs[0], 4, 'о выборе надо сообщить наружу');
assert.equal(queryAllByRole(root, 'radio')[1].checked, true,
  'при переданном value значение задаёт родитель');` },

      { name: 'подсвечивает звёзды при наведении',
        body: `const root = await render(<StarRating defaultValue={1} />);
const filled = () => (text(root).match(/★/g) || []).length;
assert.equal(filled(), 1, 'до наведения закрашено выбранное значение');
const stars = queryAll(root, 'label span');
await act(async () => { fire(stars[3], 'mouseover', { relatedTarget: null }); });
assert.equal(filled(), 4, 'при наведении на четвёртую звезду закрашиваются четыре');` },

      { name: 'сбрасывает подсветку, когда мышь уходит с группы',
        body: `const root = await render(<StarRating defaultValue={2} />);
const filled = () => (text(root).match(/★/g) || []).length;
const stars = queryAll(root, 'label span');
await act(async () => { fire(stars[4], 'mouseover', { relatedTarget: null }); });
assert.equal(filled(), 5);
await act(async () => { fire(getByRole(root, 'radiogroup'), 'mouseout', { relatedTarget: null }); });
assert.equal(filled(), 2, 'после ухода мыши показывают выбранное значение, а не подсветку');` },

      { name: 'в режиме только для чтения не даёт изменить оценку',
        body: `const onChange = spy();
const root = await render(<StarRating value={3} onChange={onChange} readOnly={true} />);
const radios = queryAllByRole(root, 'radio');
assert.equal(radios[0].disabled, true, 'в readOnly радиокнопки отключены');
await click(radios[0]);
assert.equal(onChange.count, 0, 'в readOnly onChange звать нельзя');
const before = (text(root).match(/★/g) || []).length;
await act(async () => { fire(queryAll(root, 'label span')[4], 'mouseover', { relatedTarget: null }); });
assert.equal((text(root).match(/★/g) || []).length, before, 'в readOnly подсветки при наведении нет');` },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     tx38 — ErrorBoundary
     ────────────────────────────────────────────────────────────── */
  tx38: {
    env: 'react',
    entry: 'ErrorBoundary',
    starter: `class ErrorBoundary extends React.Component {
  // ваш код: fallback, onError, resetKeys
}`,
    cases: [
      { name: 'показывает детей, пока ошибок нет',
        body: `const root = await render(
  <ErrorBoundary fallback={<p>Что-то сломалось</p>}><p>Спокойный контент</p></ErrorBoundary>
);
assert.ok(queryByText(root, 'Спокойный контент'));
assert.equal(queryByText(root, 'Что-то сломалось'), null);` },

      { name: 'показывает фоллбэк вместо упавшего поддерева',
        body: R_QUIET + `
const quiet = silenceReactErrors();
try {
  function Boom() { throw new Error('поддерево упало'); }
  const root = await render(
    <ErrorBoundary fallback={<p>Что-то сломалось</p>}><Boom /></ErrorBoundary>
  );
  assert.ok(queryByText(root, 'Что-то сломалось'),
    'нужен getDerivedStateFromError, переводящий границу в состояние ошибки');
} finally { quiet.restore(); }` },

      { name: 'сообщает об ошибке наружу через onError',
        body: R_QUIET + `
const quiet = silenceReactErrors();
try {
  const onError = spy();
  function Boom() { throw new Error('поддерево упало'); }
  await render(
    <ErrorBoundary fallback={<p>Что-то сломалось</p>} onError={onError}><Boom /></ErrorBoundary>
  );
  assert.equal(onError.count, 1, 'логируют в componentDidCatch');
  assert.equal(onError.lastArgs[0].message, 'поддерево упало');
  assert.ok(onError.lastArgs[1] && typeof onError.lastArgs[1].componentStack === 'string',
    'вторым аргументом приходит errorInfo с componentStack');
} finally { quiet.restore(); }` },

      { name: 'передаёт фоллбэку-функции ошибку и функцию сброса',
        body: R_QUIET + `
const quiet = silenceReactErrors();
try {
  function Boom() { throw new Error('поддерево упало'); }
  const fallback = ({ error, reset }) => (
    <div>
      <p>{'причина: ' + error.message}</p>
      <button type="button" onClick={reset}>Повторить</button>
    </div>
  );
  const root = await render(<ErrorBoundary fallback={fallback}><Boom /></ErrorBoundary>);
  assert.ok(queryByText(root, 'причина: поддерево упало'), 'фоллбэк-функция получает error');
  assert.ok(queryAllByRole(root, 'button', { name: 'Повторить' }).length, 'и функцию reset');
} finally { quiet.restore(); }` },

      { name: 'сбрасывает ошибку, когда фоллбэк вызывает reset',
        body: R_QUIET + `
const quiet = silenceReactErrors();
try {
  let broken = true;
  function Boom() {
    if (broken) throw new Error('поддерево упало');
    return <p>Снова работает</p>;
  }
  const fallback = ({ reset }) => (
    <button type="button" onClick={() => { broken = false; reset(); }}>Повторить</button>
  );
  const root = await render(<ErrorBoundary fallback={fallback}><Boom /></ErrorBoundary>);
  await click(getByRole(root, 'button', { name: 'Повторить' }));
  assert.ok(queryByText(root, 'Снова работает'), 'reset должен вернуть границу к рендеру детей');
} finally { quiet.restore(); }` },

      { name: 'сбрасывается сам при смене resetKeys',
        body: R_QUIET + `
const quiet = silenceReactErrors();
try {
  let broken = true;
  function Boom() {
    if (broken) throw new Error('поддерево упало');
    return <p>Снова работает</p>;
  }
  function App() {
    const [key, setKey] = useState('/страница-1');
    return (
      <div>
        <button type="button" onClick={() => { broken = false; setKey('/страница-2'); }}>Перейти</button>
        <ErrorBoundary fallback={<p>Что-то сломалось</p>} resetKeys={[key]}><Boom /></ErrorBoundary>
      </div>
    );
  }
  const root = await render(<App />);
  assert.ok(queryByText(root, 'Что-то сломалось'));
  await click(getByRole(root, 'button', { name: 'Перейти' }));
  assert.ok(queryByText(root, 'Снова работает'), 'смена resetKeys должна снимать состояние ошибки');
  assert.equal(queryByText(root, 'Что-то сломалось'), null);
} finally { quiet.restore(); }` },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     t12 — useDebounce и usePrevious
     ────────────────────────────────────────────────────────────── */
  t12: {
    env: 'react',
    entry: 'useDebounce',
    starter: `function useDebounce(value, ms) {
  // ваш код
}

function usePrevious(value) {
  // ваш код
}`,
    cases: [
      { name: 'сразу отдаёт начальное значение',
        body: `function Probe() {
  const debounced = useDebounce('первое', 50);
  return <p>{'дебаунс: ' + debounced}</p>;
}
const root = await render(<Probe />);
assert.ok(queryByText(root, 'дебаунс: первое'), 'на первом рендере ждать нечего');` },

      { name: 'не отдаёт новое значение, пока идёт задержка',
        body: `function Probe() {
  const [value, setValue] = useState('а');
  const debounced = useDebounce(value, 150);
  return (
    <div>
      <p>{'значение: ' + value}</p>
      <p>{'дебаунс: ' + debounced}</p>
      <button type="button" onClick={() => setValue('б')}>сменить</button>
    </div>
  );
}
const root = await render(<Probe />);
await click(getByRole(root, 'button', { name: 'сменить' }));
assert.ok(queryByText(root, 'значение: б'), 'исходное значение меняется сразу');
assert.ok(queryByText(root, 'дебаунс: а'), 'отложенное значение обязано отставать');` },

      { name: 'отдаёт новое значение после задержки',
        body: `function Probe() {
  const [value, setValue] = useState('а');
  const debounced = useDebounce(value, 50);
  return (
    <div>
      <p>{'дебаунс: ' + debounced}</p>
      <button type="button" onClick={() => setValue('б')}>сменить</button>
    </div>
  );
}
const root = await render(<Probe />);
await click(getByRole(root, 'button', { name: 'сменить' }));
await act(async () => { await new Promise((r) => setTimeout(r, 130)); });
assert.ok(queryByText(root, 'дебаунс: б'), 'по истечении задержки значение должно догнать');` },

      { name: 'отменяет предыдущий таймер: промежуточное значение не всплывает',
        body: `const seen = [];
function Probe() {
  const [value, setValue] = useState('а');
  const debounced = useDebounce(value, 200);
  seen.push(debounced);
  return (
    <div>
      <p>{'дебаунс: ' + debounced}</p>
      <button type="button" onClick={() => setValue('б')}>б</button>
      <button type="button" onClick={() => setValue('в')}>в</button>
    </div>
  );
}
const root = await render(<Probe />);
await click(getByRole(root, 'button', { name: 'б' }));
await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
await click(getByRole(root, 'button', { name: 'в' }));
// две паузы вместо одной: между ними React успевает отрисовать значение,
// которое просочилось бы из неотменённого таймера
await act(async () => { await new Promise((r) => setTimeout(r, 160)); });
await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
assert.ok(queryByText(root, 'дебаунс: в'), 'должно приехать последнее значение');
assert.equal(seen.indexOf('б'), -1,
  'без clearTimeout в cleanup промежуточное значение успевает проскочить');` },

      { name: 'usePrevious на первом рендере не знает прошлого значения',
        body: `function Probe() {
  const previous = usePrevious(1);
  return <p>{'раньше: ' + String(previous)}</p>;
}
const root = await render(<Probe />);
assert.ok(queryByText(root, 'раньше: undefined'), 'до первого эффекта в ref пусто');` },

      { name: 'usePrevious возвращает значение прошлого рендера, а не текущее',
        body: `function Probe() {
  const [count, setCount] = useState(1);
  const previous = usePrevious(count);
  return (
    <div>
      <p>{'сейчас: ' + count}</p>
      <p>{'раньше: ' + String(previous)}</p>
      <button type="button" onClick={() => setCount(count + 1)}>плюс</button>
    </div>
  );
}
const root = await render(<Probe />);
await click(getByRole(root, 'button', { name: 'плюс' }));
assert.ok(queryByText(root, 'сейчас: 2'));
assert.ok(queryByText(root, 'раньше: 1'), 'ref обновляется в эффекте, то есть уже после рендера');
await click(getByRole(root, 'button', { name: 'плюс' }));
assert.ok(queryByText(root, 'сейчас: 3'));
assert.ok(queryByText(root, 'раньше: 2'));` },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     t13 — useFetch с отменой
     ────────────────────────────────────────────────────────────── */
  t13: {
    env: 'react',
    entry: 'useFetch',
    starter: `function useFetch(url) {
  // ваш код: { status, data, error }
}`,
    cases: [
      { name: 'начинает с состояния загрузки',
        body: R_FETCH + `
installFetch();
function Probe() {
  const state = useFetch('/users');
  return <p>{'статус: ' + state.status}</p>;
}
const root = await render(<Probe />);
assert.ok(queryByText(root, 'статус: loading'), 'до ответа состояние — loading');` },

      { name: 'отдаёт данные после успешного ответа',
        body: R_FETCH + `
const server = installFetch();
function Probe() {
  const state = useFetch('/users');
  return (
    <div>
      <p>{'статус: ' + state.status}</p>
      <p>{'данные: ' + JSON.stringify(state.data)}</p>
    </div>
  );
}
const root = await render(<Probe />);
await act(async () => {
  server.pending['/users'].respond({ ok: true, status: 200, body: { name: 'Анна' } });
});
assert.ok(queryByText(root, 'статус: success'));
assert.ok(queryByText(root, 'данные: {"name":"Анна"}'), 'данные берут из res.json()');` },

      { name: 'считает ошибкой ответ 500 — fetch сам на нём не реджектится',
        body: R_FETCH + `
const server = installFetch();
function Probe() {
  const state = useFetch('/users');
  return (
    <div>
      <p>{'статус: ' + state.status}</p>
      <p>{'ошибка: ' + (state.error ? state.error.message : 'нет')}</p>
    </div>
  );
}
const root = await render(<Probe />);
await act(async () => {
  server.pending['/users'].respond({ ok: false, status: 500, body: {} });
});
assert.ok(queryByText(root, 'статус: error'), 'res.ok надо проверять руками');
assert.ok(queryByText(root, 'ошибка: HTTP 500'));` },

      { name: 'отменяет предыдущий запрос при смене url',
        body: R_FETCH + `
const server = installFetch();
function App() {
  const [url, setUrl] = useState('/first');
  const state = useFetch(url);
  return (
    <div>
      <button type="button" onClick={() => setUrl('/second')}>сменить</button>
      <p>{'статус: ' + state.status}</p>
    </div>
  );
}
const root = await render(<App />);
const first = server.pending['/first'];
assert.ok(first, 'запрос по первому url должен уйти');
await click(getByRole(root, 'button', { name: 'сменить' }));
assert.equal(first.signal.aborted, true, 'в cleanup эффекта нужен controller.abort()');
assert.ok(server.pending['/second'], 'после смены url уходит новый запрос');` },

      { name: 'не превращает собственную отмену в ошибку',
        body: R_FETCH + `
const server = installFetch();
function App() {
  const [url, setUrl] = useState('/first');
  const state = useFetch(url);
  return (
    <div>
      <button type="button" onClick={() => setUrl('/second')}>сменить</button>
      <p>{'статус: ' + state.status}</p>
      <p>{'ошибка: ' + (state.error ? state.error.name : 'нет')}</p>
    </div>
  );
}
const root = await render(<App />);
await click(getByRole(root, 'button', { name: 'сменить' }));
await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
assert.ok(queryByText(root, 'ошибка: нет'), 'AbortError нужно отфильтровать');
assert.ok(queryByText(root, 'статус: loading'),
  'после отмены ждут ответ нового запроса, а не показывают ошибку');
await act(async () => {
  server.pending['/second'].respond({ ok: true, status: 200, body: { name: 'Борис' } });
});
assert.ok(queryByText(root, 'статус: success'));` },

      { name: 'отменяет запрос при размонтировании',
        body: R_FETCH + `
const server = installFetch();
function Probe() {
  const state = useFetch('/users');
  return <p>{'статус: ' + state.status}</p>;
}
await render(<Probe />);
const request = server.pending['/users'];
assert.equal(request.signal.aborted, false);
await cleanup();
assert.equal(request.signal.aborted, true, 'висящий запрос после размонтирования — утечка');` },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     t14 — Autocomplete
     ────────────────────────────────────────────────────────────── */
  t14: {
    env: 'react',
    entry: 'Autocomplete',
    starter: `function Autocomplete({ search, onSelect }) {
  // ваш код: search(query, signal) отдаёт промис со списком { id, label }
}`,
    cases: [
      { name: 'не запрашивает подсказки, пока введено меньше двух символов',
        body: R_DEBOUNCE + `
installDebounce();
const search = spy(function () { return Promise.resolve([]); });
const root = await render(<Autocomplete search={search} onSelect={spy()} />);
await type(getByRole(root, 'textbox'), 'м');
await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
assert.equal(search.count, 0, 'на один символ ходить на сервер незачем');` },

      { name: 'показывает подсказки списком после паузы',
        body: R_DEBOUNCE + `
installDebounce();
const search = spy(function () {
  return Promise.resolve([{ id: 1, label: 'Москва' }, { id: 2, label: 'Минск' }]);
});
const root = await render(<Autocomplete search={search} onSelect={spy()} />);
await type(getByRole(root, 'textbox'), 'ми');
await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
assert.equal(search.count, 1);
assert.equal(search.lastArgs[0], 'ми', 'в поиск уходит отложенный запрос');
assert.equal(queryAllByRole(root, 'option').length, 2, 'каждая подсказка — элемент с ролью option');
assert.ok(queryByText(root, 'Москва'));` },

      { name: 'не шлёт запрос на каждый символ',
        body: R_DEBOUNCE + `
installDebounce();
const search = spy(function () { return Promise.resolve([{ id: 1, label: 'Москва' }]); });
const root = await render(<Autocomplete search={search} onSelect={spy()} />);
const input = getByRole(root, 'textbox');
await type(input, 'мо');
await type(input, 'мос');
await type(input, 'моск');
await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
assert.equal(search.count, 0, 'пока идёт задержка, запросов быть не должно');
await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
assert.equal(search.count, 1, 'после паузы уходит ровно один запрос');
assert.equal(search.lastArgs[0], 'моск', 'и именно с последним введённым текстом');` },

      { name: 'отменяет предыдущий запрос при новом вводе',
        body: R_DEBOUNCE + `
installDebounce();
const signals = [];
const search = spy(function (query, signal) {
  signals.push(signal);
  return new Promise(function () {});
});
const root = await render(<Autocomplete search={search} onSelect={spy()} />);
const input = getByRole(root, 'textbox');
await type(input, 'мо');
await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
assert.equal(search.count, 1);
await type(input, 'мос');
await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
assert.equal(search.count, 2);
assert.ok(signals[0], 'вторым аргументом в search приходит signal');
assert.equal(signals[0].aborted, true, 'старый запрос отменяют в cleanup эффекта');
assert.equal(signals[1].aborted, false);` },

      { name: 'стрелкой вниз подсвечивает первую подсказку, Enter её выбирает',
        body: R_DEBOUNCE + `
installDebounce();
const onSelect = spy();
const search = spy(function () {
  return Promise.resolve([{ id: 1, label: 'Москва' }, { id: 2, label: 'Минск' }]);
});
const root = await render(<Autocomplete search={search} onSelect={onSelect} />);
const input = getByRole(root, 'textbox');
await type(input, 'ми');
await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
await press(input, 'ArrowDown');
assert.equal(queryAllByRole(root, 'option')[0].getAttribute('aria-selected'), 'true',
  'активную подсказку помечают aria-selected');
await press(input, 'Enter');
assert.equal(onSelect.count, 1);
assert.equal(onSelect.lastArgs[0].label, 'Москва', 'Enter выбирает подсвеченную подсказку');` },

      { name: 'Escape закрывает список подсказок',
        body: R_DEBOUNCE + `
installDebounce();
const search = spy(function () { return Promise.resolve([{ id: 1, label: 'Москва' }]); });
const root = await render(<Autocomplete search={search} onSelect={spy()} />);
const input = getByRole(root, 'textbox');
await type(input, 'мо');
await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
assert.equal(queryAllByRole(root, 'option').length, 1);
assert.equal(getByRole(root, 'combobox').getAttribute('aria-expanded'), 'true');
await press(input, 'Escape');
assert.equal(queryAllByRole(root, 'option').length, 0, 'Escape должен закрывать список');
assert.equal(getByRole(root, 'combobox').getAttribute('aria-expanded'), 'false');` },

      { name: 'выбирает подсказку мышью',
        body: R_DEBOUNCE + `
installDebounce();
const onSelect = spy();
const search = spy(function () {
  return Promise.resolve([{ id: 1, label: 'Москва' }, { id: 2, label: 'Минск' }]);
});
const root = await render(<Autocomplete search={search} onSelect={onSelect} />);
await type(getByRole(root, 'textbox'), 'ми');
await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
await click(queryAllByRole(root, 'option')[1]);
assert.equal(onSelect.count, 1);
assert.equal(onSelect.lastArgs[0].label, 'Минск');` },
    ],
  },
};
