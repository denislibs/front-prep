/**
 * Наборы проверок для задач режима dom (tx21…tx28).
 *
 * Особенности режима: настоящий DOM, настоящие таймеры (clock.tick не работает),
 * доступны document, window и хелперы из dom-harness (mount, click, press, fire,
 * tick, getByText, queryAll и т.д.).
 *
 * IntersectionObserver и History API в jsdom доступны не полностью, поэтому в
 * телах соответствующих проверок стоят заглушки.
 */
const TESTS_DOM = {

  /* ── tx21 · delegate ───────────────────────────────────────── */
  tx21: {
    env: 'dom',
    entry: 'delegate',
    starter: `function delegate(root, selector, type, handler, options) {
  // ваш код
}`,
    cases: [
      { name: 'вызывает обработчик при клике по подходящему потомку',
        body: `const root = mount('<div><button class="btn">Кнопка</button></div>');
const calls = spy();
delegate(root, '.btn', 'click', calls);
await click(root.querySelector('.btn'));
assert.equal(calls.count, 1, 'обработчик должен сработать один раз');` },

      { name: 'не реагирует на клик вне селектора',
        body: `const root = mount('<div><button class="btn">Да</button><button class="other">Нет</button></div>');
const calls = spy();
delegate(root, '.btn', 'click', calls);
await click(root.querySelector('.other'));
assert.equal(calls.count, 0, 'клик по элементу, не подходящему под селектор, игнорируется');` },

      { name: 'передаёт найденный элемент вторым аргументом и как this',
        body: `const root = mount('<div><button class="btn"><span class="ico">+</span> Добавить</button></div>');
let received = null;
let context = null;
delegate(root, '.btn', 'click', function (event, el) { context = this; received = el; });
await click(root.querySelector('.ico'));
const button = root.querySelector('.btn');
assert.ok(received === button, 'вторым аргументом приходит элемент, подошедший под селектор, а не event.target');
assert.ok(context === button, 'this внутри обработчика — тот же элемент');` },

      { name: 'не поднимается выше контейнера при поиске элемента',
        body: `const wrap = mount('<div class="zone"><div class="root"><button class="btn">Кнопка</button></div></div>');
const root = wrap.querySelector('.root');
const calls = spy();
delegate(root, '.zone', 'click', calls);
await click(root.querySelector('.btn'));
assert.equal(calls.count, 0, 'элемент .zone лежит выше root — обработчик не должен вызываться');` },

      { name: 'работает для элементов, добавленных после подписки',
        body: `const root = mount('<div class="list"></div>');
const calls = spy();
delegate(root, '.btn', 'click', calls);
const later = document.createElement('button');
later.className = 'btn';
later.textContent = 'Новая';
root.querySelector('.list').appendChild(later);
await click(later);
assert.equal(calls.count, 1, 'в этом и смысл делегирования: слушатель один, элементы могут появляться позже');` },

      { name: 'возвращает функцию отписки, снимающую слушатель',
        body: `const root = mount('<div><button class="btn">Кнопка</button></div>');
const calls = spy();
const off = delegate(root, '.btn', 'click', calls);
assert.equal(typeof off, 'function', 'delegate должен вернуть функцию отписки');
await click(root.querySelector('.btn'));
off();
await click(root.querySelector('.btn'));
assert.equal(calls.count, 1, 'после отписки обработчик больше не вызывается');` },

      { name: 'ловит события, которые не всплывают (focus)',
        body: `const root = mount('<div><input class="field" /><input class="other" /></div>');
const calls = spy();
delegate(root, '.field', 'focus', calls);
fire(root.querySelector('.field'), 'focus', { bubbles: false });
assert.equal(calls.count, 1, 'focus не всплывает — нужна фаза перехвата или focusin');
fire(root.querySelector('.other'), 'focus', { bubbles: false });
assert.equal(calls.count, 1, 'чужой элемент не должен вызывать обработчик');` },
    ],
  },

  /* ── tx22 · свой querySelectorAll ──────────────────────────── */
  tx22: {
    env: 'dom',
    entry: 'queryAll',
    starter: `function queryAll(root, predicate) {
  // ваш код
}`,
    cases: [
      { name: 'возвращает потомков, для которых предикат истинен',
        body: `const root = mount('<div><p class="hit">1</p><p>2</p><span class="hit">3</span></div>').firstElementChild;
const found = queryAll(root, function (el) { return el.classList.contains('hit'); });
assert.equal(found.map(function (el) { return el.textContent; }), ['1', '3']);` },

      { name: 'не включает в результат сам root',
        body: `const root = mount('<div class="hit"><span class="hit">внутри</span></div>').firstElementChild;
const found = queryAll(root, function (el) { return el.classList.contains('hit'); });
assert.equal(found.length, 1, 'root подходит под предикат, но обходится только его поддерево');
assert.ok(found[0] === root.querySelector('span'));` },

      { name: 'отдаёт элементы в порядке документа при вложенности',
        body: `const root = mount('<div><a id="a"><b id="b"></b><c id="c"><d id="d"></d></c></a><e id="e"></e></div>').firstElementChild;
const found = queryAll(root, function () { return true; });
assert.equal(found.map(function (el) { return el.id; }), ['a', 'b', 'c', 'd', 'e'], 'порядок документа — это pre-order обход');` },

      { name: 'обходит только элементы, пропуская текст и комментарии',
        body: `const root = mount('<div>текст сверху<!-- комментарий --><p>абзац</p>ещё текст</div>').firstElementChild;
const found = queryAll(root, function () { return true; });
assert.equal(found.length, 1, 'текстовые узлы и комментарии в результат не попадают');
assert.equal(found[0].tagName, 'P');` },

      { name: 'возвращает пустой массив, если ничего не подошло',
        body: `const root = mount('<div><p>раз</p><p>два</p></div>').firstElementChild;
assert.equal(queryAll(root, function () { return false; }), []);
const empty = mount('<div></div>').firstElementChild;
assert.equal(queryAll(empty, function () { return true; }), []);` },

      { name: 'обходит глубокое дерево без переполнения стека',
        body: `const host = mount('<div></div>').firstElementChild;
let cursor = host;
for (let i = 0; i < 5000; i++) {
  const next = document.createElement('div');
  next.className = 'level';
  cursor.appendChild(next);
  cursor = next;
}
const found = queryAll(host, function (el) { return el.className === 'level'; });
assert.equal(found.length, 5000, 'обход должен быть итеративным, рекурсия здесь ляжет');` },
    ],
  },

  /* ── tx23 · createFocusTrap ────────────────────────────────── */
  tx23: {
    env: 'dom',
    needsFocus: true,
    entry: 'createFocusTrap',
    starter: `function createFocusTrap(container, onEscape) {
  // ваш код
}`,
    cases: [
      { name: 'при активации переводит фокус на первый доступный элемент',
        body: `const root = mount('<div class="modal"><button class="one">Раз</button><button class="two">Два</button></div>');
const modal = root.querySelector('.modal');
Array.prototype.forEach.call(modal.querySelectorAll('*'), function (el) {
  Object.defineProperty(el, 'offsetWidth', { value: 10, configurable: true });
});
const trap = createFocusTrap(modal);
trap.activate();
assert.ok(document.activeElement === modal.querySelector('.one'), 'фокус должен уехать внутрь модалки');
trap.deactivate();` },

      { name: 'пропускает disabled и скрытые элементы',
        body: `const root = mount('<div class="modal"><button class="off" disabled>Нельзя</button><button class="hidden" hidden>Спрятана</button><input class="field" /><button class="last">Готово</button></div>');
const modal = root.querySelector('.modal');
Array.prototype.forEach.call(modal.querySelectorAll('*'), function (el) {
  Object.defineProperty(el, 'offsetWidth', { value: el.hasAttribute('hidden') ? 0 : 10, configurable: true });
});
const trap = createFocusTrap(modal);
trap.activate();
assert.ok(document.activeElement === modal.querySelector('.field'), 'первым доступным должен оказаться input, а не disabled или скрытая кнопка');
trap.deactivate();` },

      { name: 'по Tab с последнего элемента возвращает фокус на первый',
        body: `const root = mount('<div class="modal"><button class="one">Раз</button><input class="field" /><button class="last">Три</button></div>');
const modal = root.querySelector('.modal');
Array.prototype.forEach.call(modal.querySelectorAll('*'), function (el) {
  Object.defineProperty(el, 'offsetWidth', { value: 10, configurable: true });
});
const trap = createFocusTrap(modal);
trap.activate();
modal.querySelector('.last').focus();
await press(modal.querySelector('.last'), 'Tab');
assert.ok(document.activeElement === modal.querySelector('.one'), 'фокус должен пойти по кругу на первый элемент');
trap.deactivate();` },

      { name: 'по Shift+Tab с первого элемента переводит фокус на последний',
        body: `const root = mount('<div class="modal"><button class="one">Раз</button><input class="field" /><button class="last">Три</button></div>');
const modal = root.querySelector('.modal');
Array.prototype.forEach.call(modal.querySelectorAll('*'), function (el) {
  Object.defineProperty(el, 'offsetWidth', { value: 10, configurable: true });
});
const trap = createFocusTrap(modal);
trap.activate();
modal.querySelector('.one').focus();
fire(modal.querySelector('.one'), 'keydown', { key: 'Tab', shiftKey: true });
assert.ok(document.activeElement === modal.querySelector('.last'), 'Shift+Tab с первого элемента уходит на последний');
trap.deactivate();` },

      { name: 'сообщает о нажатии Escape',
        body: `const root = mount('<div class="modal"><button class="one">Раз</button></div>');
const modal = root.querySelector('.modal');
Array.prototype.forEach.call(modal.querySelectorAll('*'), function (el) {
  Object.defineProperty(el, 'offsetWidth', { value: 10, configurable: true });
});
const onEscape = spy();
const trap = createFocusTrap(modal, onEscape);
trap.activate();
await press(modal.querySelector('.one'), 'Escape');
assert.equal(onEscape.count, 1, 'по Escape ловушка должна дёрнуть переданный колбэк');
trap.deactivate();` },

      { name: 'при деактивации возвращает фокус туда, откуда открыли',
        body: `const outside = mount('<button class="opener">Открыть</button>').querySelector('.opener');
const root = mount('<div class="modal"><button class="one">Раз</button><button class="last">Два</button></div>');
const modal = root.querySelector('.modal');
Array.prototype.forEach.call(modal.querySelectorAll('*'), function (el) {
  Object.defineProperty(el, 'offsetWidth', { value: 10, configurable: true });
});
Object.defineProperty(outside, 'offsetWidth', { value: 10, configurable: true });
outside.focus();
const trap = createFocusTrap(modal);
trap.activate();
assert.ok(document.activeElement !== outside, 'после активации фокус внутри модалки');
trap.deactivate();
assert.ok(document.activeElement === outside, 'после закрытия фокус обязан вернуться на элемент-открыватель');` },

      { name: 'после деактивации больше не перехватывает Tab',
        body: `const root = mount('<div class="modal"><button class="one">Раз</button><button class="last">Два</button></div>');
const modal = root.querySelector('.modal');
Array.prototype.forEach.call(modal.querySelectorAll('*'), function (el) {
  Object.defineProperty(el, 'offsetWidth', { value: 10, configurable: true });
});
const trap = createFocusTrap(modal);
trap.activate();
trap.deactivate();
const last = modal.querySelector('.last');
last.focus();
await press(last, 'Tab');
assert.ok(document.activeElement === last, 'слушатель снят — ловушка не должна двигать фокус');` },
    ],
  },

  /* ── tx24 · ленивая загрузка картинок ──────────────────────── */
  tx24: {
    env: 'dom',
    entry: 'lazyLoadImages',
    starter: `function lazyLoadImages(root, options) {
  // ваш код
}`,
    cases: [
      { name: 'до попадания во вьюпорт картинка не грузится',
        body: `const io = { observed: [], cb: null, options: null };
globalThis.IntersectionObserver = function (callback, options) {
  io.cb = callback; io.options = options || {};
  this.observe = function (el) { if (io.observed.indexOf(el) < 0) io.observed.push(el); };
  this.unobserve = function (el) { const i = io.observed.indexOf(el); if (i >= 0) io.observed.splice(i, 1); };
  this.disconnect = function () { io.observed.length = 0; };
};
const root = mount('<div><img class="pic" data-src="https://cdn.test/a.jpg" /></div>');
lazyLoadImages(root);
const img = root.querySelector('.pic');
assert.equal(img.getAttribute('src'), null, 'src подставляется только при пересечении');
io.cb([{ target: img, isIntersecting: false }]);
assert.equal(img.getAttribute('src'), null, 'запись без пересечения обрабатывать не нужно');` },

      { name: 'подставляет src из data-src, когда картинка приближается к вьюпорту',
        body: `const io = { observed: [], cb: null, options: null };
globalThis.IntersectionObserver = function (callback, options) {
  io.cb = callback; io.options = options || {};
  this.observe = function (el) { if (io.observed.indexOf(el) < 0) io.observed.push(el); };
  this.unobserve = function (el) { const i = io.observed.indexOf(el); if (i >= 0) io.observed.splice(i, 1); };
  this.disconnect = function () { io.observed.length = 0; };
};
const root = mount('<div><img class="a" data-src="https://cdn.test/a.jpg" /><img class="b" data-src="https://cdn.test/b.jpg" /></div>');
lazyLoadImages(root);
assert.equal(io.observed.length, 2, 'обе картинки должны попасть под наблюдение');
io.cb(io.observed.slice().map(function (el) { return { target: el, isIntersecting: true }; }));
assert.equal(root.querySelector('.a').getAttribute('src'), 'https://cdn.test/a.jpg');
assert.equal(root.querySelector('.b').getAttribute('src'), 'https://cdn.test/b.jpg');
assert.equal(root.querySelector('.a').hasAttribute('data-src'), false, 'data-src после загрузки не нужен');` },

      { name: 'перестаёт наблюдать за уже загруженной картинкой',
        body: `const io = { observed: [], cb: null, options: null };
globalThis.IntersectionObserver = function (callback, options) {
  io.cb = callback; io.options = options || {};
  this.observe = function (el) { if (io.observed.indexOf(el) < 0) io.observed.push(el); };
  this.unobserve = function (el) { const i = io.observed.indexOf(el); if (i >= 0) io.observed.splice(i, 1); };
  this.disconnect = function () { io.observed.length = 0; };
};
const root = mount('<div><img class="a" data-src="https://cdn.test/a.jpg" /><img class="b" data-src="https://cdn.test/b.jpg" /></div>');
lazyLoadImages(root);
const first = root.querySelector('.a');
io.cb([{ target: first, isIntersecting: true }]);
assert.equal(io.observed.indexOf(first), -1, 'после подстановки src нужен unobserve');
assert.equal(io.observed.length, 1, 'вторая картинка остаётся под наблюдением');` },

      { name: 'начинает загрузку заранее, до появления во вьюпорте',
        body: `const io = { observed: [], cb: null, options: null };
globalThis.IntersectionObserver = function (callback, options) {
  io.cb = callback; io.options = options || {};
  this.observe = function (el) { if (io.observed.indexOf(el) < 0) io.observed.push(el); };
  this.unobserve = function (el) { const i = io.observed.indexOf(el); if (i >= 0) io.observed.splice(i, 1); };
  this.disconnect = function () { io.observed.length = 0; };
};
const root = mount('<div><img class="a" data-src="https://cdn.test/a.jpg" /></div>');
lazyLoadImages(root);
assert.ok(io.options && typeof io.options.rootMargin === 'string', 'наблюдателю нужен rootMargin');
assert.ok(io.options.rootMargin.indexOf('200px') >= 0, 'запас в 200px даёт картинке время загрузиться: получено ' + io.options.rootMargin);` },

      { name: 'подхватывает картинки, добавленные после инициализации',
        body: `const io = { observed: [], cb: null, options: null };
globalThis.IntersectionObserver = function (callback, options) {
  io.cb = callback; io.options = options || {};
  this.observe = function (el) { if (io.observed.indexOf(el) < 0) io.observed.push(el); };
  this.unobserve = function (el) { const i = io.observed.indexOf(el); if (i >= 0) io.observed.splice(i, 1); };
  this.disconnect = function () { io.observed.length = 0; };
};
const root = mount('<div class="feed"></div>');
const api = lazyLoadImages(root);
const fresh = document.createElement('img');
fresh.className = 'fresh';
fresh.setAttribute('data-src', 'https://cdn.test/new.jpg');
root.querySelector('.feed').appendChild(fresh);
api.observeNew();
assert.equal(io.observed.length, 1, 'новая картинка должна попасть под наблюдение');
io.cb([{ target: fresh, isIntersecting: true }]);
assert.equal(fresh.getAttribute('src'), 'https://cdn.test/new.jpg');` },

      { name: 'отключает наблюдателя при уничтожении',
        body: `const io = { observed: [], cb: null, options: null, disconnected: false };
globalThis.IntersectionObserver = function (callback, options) {
  io.cb = callback; io.options = options || {};
  this.observe = function (el) { if (io.observed.indexOf(el) < 0) io.observed.push(el); };
  this.unobserve = function (el) { const i = io.observed.indexOf(el); if (i >= 0) io.observed.splice(i, 1); };
  this.disconnect = function () { io.observed.length = 0; io.disconnected = true; };
};
const root = mount('<div><img class="a" data-src="https://cdn.test/a.jpg" /></div>');
const api = lazyLoadImages(root);
assert.equal(typeof api.destroy, 'function', 'нужен способ отписаться, иначе утечка при уходе со страницы');
api.destroy();
assert.equal(io.disconnected, true, 'destroy должен вызвать observer.disconnect()');
assert.equal(io.observed.length, 0);` },

      { name: 'без IntersectionObserver грузит все картинки сразу',
        body: `delete globalThis.IntersectionObserver;
const root = mount('<div><img class="a" data-src="https://cdn.test/a.jpg" /><img class="b" data-src="https://cdn.test/b.jpg" /></div>');
lazyLoadImages(root);
assert.equal(root.querySelector('.a').getAttribute('src'), 'https://cdn.test/a.jpg', 'в старом браузере фоллбэк грузит всё сразу');
assert.equal(root.querySelector('.b').getAttribute('src'), 'https://cdn.test/b.jpg');` },
    ],
  },

  /* ── tx25 · виртуальный скролл ─────────────────────────────── */
  tx25: {
    env: 'dom',
    entry: 'createVirtualList',
    starter: `// config: { container, items, itemHeight, renderItem, overscan }
function createVirtualList(config) {
  // ваш код
}`,
    cases: [
      { name: 'держит в DOM только видимую часть списка',
        body: `const requestAnimationFrame = function (cb) { return window.requestAnimationFrame(cb); };
const box = mount('<div class="box"></div>').querySelector('.box');
Object.defineProperty(box, 'clientHeight', { value: 100, configurable: true });
let scrolled = 0;
Object.defineProperty(box, 'scrollTop', { configurable: true, get: function () { return scrolled; }, set: function (v) { scrolled = v; } });
const items = Array.from({ length: 1000 }, function (_, i) { return { title: 'item ' + i }; });
createVirtualList({
  container: box, items: items, itemHeight: 20,
  renderItem: function (item) { const el = document.createElement('div'); el.className = 'row'; el.textContent = item.title; return el; },
});
const rows = box.querySelectorAll('.row');
assert.ok(rows.length >= 5, 'видимую часть надо всё-таки отрисовать, получено строк: ' + rows.length);
assert.ok(rows.length <= 30, '1000 строк в DOM — это не виртуальный список, получено строк: ' + rows.length);
assert.equal(rows[0].textContent, 'item 0');` },

      { name: 'создаёт скроллбар на всю длину списка',
        body: `const requestAnimationFrame = function (cb) { return window.requestAnimationFrame(cb); };
const box = mount('<div class="box"></div>').querySelector('.box');
Object.defineProperty(box, 'clientHeight', { value: 100, configurable: true });
let scrolled = 0;
Object.defineProperty(box, 'scrollTop', { configurable: true, get: function () { return scrolled; }, set: function (v) { scrolled = v; } });
const items = Array.from({ length: 1000 }, function (_, i) { return { title: 'item ' + i }; });
createVirtualList({
  container: box, items: items, itemHeight: 20,
  renderItem: function (item) { const el = document.createElement('div'); el.className = 'row'; el.textContent = item.title; return el; },
});
const full = Array.prototype.some.call(box.querySelectorAll('*'), function (el) { return el.style.height === '20000px'; });
assert.ok(full, 'нужна распорка высотой items.length * itemHeight, иначе скроллбар врёт');` },

      { name: 'после прокрутки показывает строки из середины списка',
        body: `const requestAnimationFrame = function (cb) { return window.requestAnimationFrame(cb); };
const box = mount('<div class="box"></div>').querySelector('.box');
Object.defineProperty(box, 'clientHeight', { value: 100, configurable: true });
let scrolled = 0;
Object.defineProperty(box, 'scrollTop', { configurable: true, get: function () { return scrolled; }, set: function (v) { scrolled = v; } });
const items = Array.from({ length: 1000 }, function (_, i) { return { title: 'item ' + i }; });
createVirtualList({
  container: box, items: items, itemHeight: 20,
  renderItem: function (item) { const el = document.createElement('div'); el.className = 'row'; el.textContent = item.title; return el; },
});
box.scrollTop = 800;
fire(box, 'scroll');
await tick();
await tick();
const titles = Array.prototype.map.call(box.querySelectorAll('.row'), function (el) { return el.textContent; });
assert.ok(titles.indexOf('item 40') >= 0, 'на 800px при высоте строки 20 видна сороковая строка, отрисовано: ' + titles.join(', '));
assert.equal(titles.indexOf('item 0'), -1, 'начало списка уже уехало и не должно висеть в DOM');` },

      { name: 'смещает окно так, чтобы строки стояли на своих местах',
        body: `const requestAnimationFrame = function (cb) { return window.requestAnimationFrame(cb); };
const box = mount('<div class="box"></div>').querySelector('.box');
Object.defineProperty(box, 'clientHeight', { value: 100, configurable: true });
let scrolled = 0;
Object.defineProperty(box, 'scrollTop', { configurable: true, get: function () { return scrolled; }, set: function (v) { scrolled = v; } });
const items = Array.from({ length: 1000 }, function (_, i) { return { title: 'item ' + i }; });
createVirtualList({
  container: box, items: items, itemHeight: 20,
  renderItem: function (item) { const el = document.createElement('div'); el.className = 'row'; el.textContent = item.title; return el; },
});
box.scrollTop = 800;
fire(box, 'scroll');
await tick();
await tick();
const first = box.querySelector('.row');
const index = Number(first.textContent.replace('item ', ''));
const offset = index * 20 + 'px';
const shifted = Array.prototype.some.call(box.querySelectorAll('*'), function (el) {
  return (el.style.transform || '').indexOf('translateY(' + offset + ')') >= 0;
}) || first.style.top === offset;
assert.ok(shifted, 'первая отрисованная строка (' + first.textContent + ') должна стоять на отметке ' + offset);` },

      { name: 'не перерисовывает список, если видимый диапазон не изменился',
        body: `const requestAnimationFrame = function (cb) { return window.requestAnimationFrame(cb); };
const box = mount('<div class="box"></div>').querySelector('.box');
Object.defineProperty(box, 'clientHeight', { value: 100, configurable: true });
let scrolled = 0;
Object.defineProperty(box, 'scrollTop', { configurable: true, get: function () { return scrolled; }, set: function (v) { scrolled = v; } });
const items = Array.from({ length: 1000 }, function (_, i) { return { title: 'item ' + i }; });
let built = 0;
createVirtualList({
  container: box, items: items, itemHeight: 20,
  renderItem: function (item) { built++; const el = document.createElement('div'); el.className = 'row'; el.textContent = item.title; return el; },
});
const afterFirst = built;
box.scrollTop = 5;
fire(box, 'scroll');
await tick();
await tick();
assert.equal(built, afterFirst, 'прокрутка на 5px не меняет диапазон — перерисовывать нечего');` },

      { name: 'перестаёт реагировать на прокрутку после уничтожения',
        body: `const requestAnimationFrame = function (cb) { return window.requestAnimationFrame(cb); };
const box = mount('<div class="box"></div>').querySelector('.box');
Object.defineProperty(box, 'clientHeight', { value: 100, configurable: true });
let scrolled = 0;
Object.defineProperty(box, 'scrollTop', { configurable: true, get: function () { return scrolled; }, set: function (v) { scrolled = v; } });
const items = Array.from({ length: 1000 }, function (_, i) { return { title: 'item ' + i }; });
const destroy = createVirtualList({
  container: box, items: items, itemHeight: 20,
  renderItem: function (item) { const el = document.createElement('div'); el.className = 'row'; el.textContent = item.title; return el; },
});
assert.equal(typeof destroy, 'function', 'createVirtualList должен вернуть функцию очистки');
destroy();
box.scrollTop = 800;
fire(box, 'scroll');
await tick();
await tick();
assert.equal(box.querySelector('.row').textContent, 'item 0', 'слушатель скролла снят — содержимое не меняется');` },
    ],
  },

  /* ── tx26 · createStore ────────────────────────────────────── */
  tx26: {
    env: 'dom',
    entry: 'createStore',
    starter: `function createStore(reducer, preloadedState) {
  // ваш код
}`,
    cases: [
      { name: 'берёт начальное состояние из редьюсера',
        body: `function reducer(state, action) {
  if (state === undefined) state = { count: 0 };
  return state;
}
const store = createStore(reducer);
assert.equal(store.getState(), { count: 0 }, 'при создании редьюсер вызывается служебным экшеном и отдаёт значение по умолчанию');` },

      { name: 'предпочитает переданное начальное состояние',
        body: `function reducer(state, action) {
  if (state === undefined) state = { count: 0 };
  return state;
}
const store = createStore(reducer, { count: 7 });
assert.equal(store.getState(), { count: 7 });` },

      { name: 'обновляет состояние через dispatch',
        body: `function reducer(state, action) {
  if (state === undefined) state = { count: 0 };
  if (action.type === 'inc') return { count: state.count + 1 };
  return state;
}
const store = createStore(reducer);
store.dispatch({ type: 'inc' });
store.dispatch({ type: 'inc' });
assert.equal(store.getState(), { count: 2 });
store.dispatch({ type: 'unknown' });
assert.equal(store.getState(), { count: 2 }, 'неизвестный экшен состояние не меняет');` },

      { name: 'оповещает подписчиков после каждого dispatch',
        body: `function reducer(state, action) {
  if (state === undefined) state = 0;
  return action.type === 'inc' ? state + 1 : state;
}
const store = createStore(reducer);
const listener = spy();
store.subscribe(listener);
assert.equal(listener.count, 0, 'сама подписка оповещения не вызывает');
store.dispatch({ type: 'inc' });
store.dispatch({ type: 'inc' });
assert.equal(listener.count, 2);` },

      { name: 'отписка прекращает оповещения',
        body: `function reducer(state, action) {
  if (state === undefined) state = 0;
  return action.type === 'inc' ? state + 1 : state;
}
const store = createStore(reducer);
const listener = spy();
const off = store.subscribe(listener);
assert.equal(typeof off, 'function', 'subscribe должен вернуть функцию отписки');
store.dispatch({ type: 'inc' });
off();
store.dispatch({ type: 'inc' });
off();
assert.equal(listener.count, 1, 'повторный вызов отписки тоже не должен ничего ломать');` },

      { name: 'отписка во время оповещения не пропускает следующего слушателя',
        body: `function reducer(state, action) {
  if (state === undefined) state = 0;
  return action.type === 'inc' ? state + 1 : state;
}
const store = createStore(reducer);
const order = [];
const offFirst = store.subscribe(function () { order.push('первый'); offFirst(); });
store.subscribe(function () { order.push('второй'); });
store.dispatch({ type: 'inc' });
assert.equal(order, ['первый', 'второй'], 'обходить надо копию списка подписчиков');` },

      { name: 'запрещает dispatch внутри редьюсера',
        body: `let store = null;
function reducer(state, action) {
  if (state === undefined) state = 0;
  if (action.type === 'bad') store.dispatch({ type: 'inc' });
  return action.type === 'inc' ? state + 1 : state;
}
store = createStore(reducer);
assert.throws(function () { store.dispatch({ type: 'bad' }); }, 'редьюсер обязан быть чистым — вложенный dispatch должен падать');
store.dispatch({ type: 'inc' });
assert.equal(store.getState(), 1, 'после ошибки стор остаётся рабочим');` },
    ],
  },

  /* ── tx27 · mini-VDOM ──────────────────────────────────────── */
  tx27: {
    env: 'dom',
    entry: 'h',
    starter: `function h(type, props, ...children) {
  // ваш код
}

function createDom(vnode) {
  // ваш код
}

function patch(parent, oldVNode, newVNode, index) {
  // ваш код
}`,
    cases: [
      { name: 'создаёт элемент с атрибутами и текстом',
        body: `const el = createDom(h('a', { href: '/next', id: 'link' }, 'Дальше'));
assert.equal(el.tagName, 'A');
assert.equal(el.getAttribute('href'), '/next');
assert.equal(el.textContent, 'Дальше');` },

      { name: 'разворачивает вложенные массивы детей и отбрасывает пустые',
        body: `const el = createDom(h('ul', null, [h('li', null, 'раз'), h('li', null, 'два')], null, false, h('li', null, 'три')));
const items = el.querySelectorAll('li');
assert.equal(items.length, 3, 'массив детей должен раскрываться, а null и false — пропускаться');
assert.equal(Array.prototype.map.call(items, function (li) { return li.textContent; }), ['раз', 'два', 'три']);` },

      { name: 'вешает обработчики событий, а не пишет их атрибутом',
        body: `const onClick = spy();
const el = createDom(h('button', { onClick: onClick }, 'Жми'));
mount('<div class="host"></div>').querySelector('.host').appendChild(el);
await click(el);
assert.equal(onClick.count, 1, 'props вида onClick вешаются через addEventListener');
assert.equal(el.getAttribute('onclick'), null, 'обработчик не должен превращаться в атрибут');` },

      { name: 'добавляет узел, если старого не было, и удаляет, если нового нет',
        body: `const host = mount('<div class="host"></div>').querySelector('.host');
patch(host, null, h('span', null, 'привет'), 0);
assert.equal(host.childNodes.length, 1);
assert.equal(host.textContent, 'привет');
patch(host, h('span', null, 'привет'), null, 0);
assert.equal(host.childNodes.length, 0, 'нового узла нет — старый надо удалить');` },

      { name: 'заменяет узел при смене типа',
        body: `const host = mount('<div class="host"></div>').querySelector('.host');
const before = h('div', null, 'старый');
host.appendChild(createDom(before));
patch(host, before, h('p', null, 'новый'), 0);
assert.equal(host.childNodes.length, 1);
assert.equal(host.firstChild.tagName, 'P');
assert.equal(host.textContent, 'новый');` },

      { name: 'не пересоздаёт узел, если тип совпал: обновляет только атрибуты',
        body: `const host = mount('<div class="host"></div>').querySelector('.host');
const before = h('div', { id: 'same', title: 'старый', 'data-keep': 'да' }, 'текст');
host.appendChild(createDom(before));
const node = host.firstChild;
patch(host, before, h('div', { id: 'same', title: 'новый' }, 'текст'), 0);
assert.ok(host.firstChild === node, 'узел того же типа должен переиспользоваться, а не создаваться заново');
assert.equal(node.getAttribute('title'), 'новый');
assert.equal(node.getAttribute('data-keep'), null, 'исчезнувший атрибут надо снять');` },

      { name: 'сверяет детей: обновляет текст, дорисовывает и убирает лишних',
        body: `const host = mount('<div class="host"></div>').querySelector('.host');
const before = h('ul', null, h('li', null, 'раз'), h('li', null, 'два'));
host.appendChild(createDom(before));
const list = host.firstChild;
patch(host, before, h('ul', null, h('li', null, 'ОДИН'), h('li', null, 'два'), h('li', null, 'три')), 0);
assert.ok(host.firstChild === list, 'сам список пересоздавать незачем');
assert.equal(Array.prototype.map.call(list.querySelectorAll('li'), function (li) { return li.textContent; }), ['ОДИН', 'два', 'три']);
patch(host, h('ul', null, h('li', null, 'ОДИН'), h('li', null, 'два'), h('li', null, 'три')), h('ul', null, h('li', null, 'ОДИН')), 0);
assert.equal(list.querySelectorAll('li').length, 1, 'лишние дети должны удаляться');` },
    ],
  },

  /* ── tx28 · createRouter ───────────────────────────────────── */
  tx28: {
    env: 'dom',
    entry: 'createRouter',
    starter: `// routes: [{ path: '/users/:id', handler }], options: { notFound }
function createRouter(routes, options) {
  // ваш код
}`,
    cases: [
      { name: 'вызывает обработчик подходящего маршрута сразу при создании',
        body: `const place = { origin: 'https://app.test', pathname: '/users', search: '' };
const location = place;
const history = { pushState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; }, replaceState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; } };
const onUsers = spy();
const router = createRouter([{ path: '/users', handler: onUsers }]);
try {
  assert.equal(onUsers.count, 1, 'роутер обязан отрисовать текущий адрес при старте');
} finally { router.destroy(); }` },

      { name: 'извлекает параметры пути при переходе',
        body: `const place = { origin: 'https://app.test', pathname: '/', search: '' };
const location = place;
const history = { pushState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; }, replaceState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; } };
const onUser = spy();
const router = createRouter([{ path: '/users/:id', handler: onUser }]);
try {
  router.navigate('/users/42');
  assert.equal(onUser.count, 1, 'после navigate нужно отрисовать маршрут вручную: popstate на свой pushState не приходит');
  assert.equal(onUser.lastArgs[0].params, { id: '42' });
  assert.equal(place.pathname, '/users/42', 'адрес в истории должен обновиться');
} finally { router.destroy(); }` },

      { name: 'разбирает query-строку отдельно от параметров пути',
        body: `const place = { origin: 'https://app.test', pathname: '/', search: '' };
const location = place;
const history = { pushState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; }, replaceState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; } };
const onSearch = spy();
const router = createRouter([{ path: '/search', handler: onSearch }]);
try {
  router.navigate('/search?q=окна&page=2');
  assert.equal(onSearch.lastArgs[0].query, { q: 'окна', page: '2' });
  assert.equal(onSearch.lastArgs[0].params, {});
} finally { router.destroy(); }` },

      { name: 'отдаёт неизвестный адрес маршруту 404',
        body: `const place = { origin: 'https://app.test', pathname: '/users/1', search: '' };
const location = place;
const history = { pushState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; }, replaceState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; } };
const onUser = spy();
const notFound = spy();
const router = createRouter([{ path: '/users/:id', handler: onUser }], { notFound: notFound });
try {
  assert.equal(notFound.count, 0, 'известный адрес до 404 доходить не должен');
  router.navigate('/nothing/here');
  assert.equal(onUser.count, 1, 'обработчик известного маршрута на чужом адресе не вызывается');
  assert.equal(notFound.count, 1, 'для неизвестного пути должен вызываться notFound');
} finally { router.destroy(); }` },

      { name: 'перерисовывает страницу при нажатии «Назад»',
        body: `const place = { origin: 'https://app.test', pathname: '/', search: '' };
const location = place;
const history = { pushState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; }, replaceState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; } };
const onHome = spy();
const onUser = spy();
const router = createRouter([{ path: '/', handler: onHome }, { path: '/users/:id', handler: onUser }]);
try {
  router.navigate('/users/7');
  assert.equal(onUser.count, 1);
  // браузер сам вернул адрес назад и прислал popstate
  place.pathname = '/';
  window.dispatchEvent(new window.Event('popstate'));
  assert.equal(onHome.count, 2, 'на popstate роутер обязан перерисовать страницу');
} finally { router.destroy(); }` },

      { name: 'перехватывает клик по внутренней ссылке вместо перезагрузки',
        body: `const place = { origin: 'https://app.test', pathname: '/', search: '' };
const location = place;
const history = { pushState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; }, replaceState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; } };
const onUser = spy();
const router = createRouter([{ path: '/users/:id', handler: onUser }]);
const guard = function (event) { event.preventDefault(); };
document.addEventListener('click', guard);
try {
  const root = mount('<a class="link" href="https://app.test/users/7">Профиль</a>');
  await click(root.querySelector('.link'));
  assert.equal(onUser.count, 1, 'клик по внутренней ссылке должен обрабатываться роутером');
  assert.equal(onUser.lastArgs[0].params, { id: '7' });
  assert.equal(place.pathname, '/users/7');
} finally { document.removeEventListener('click', guard); router.destroy(); }` },

      { name: 'не трогает ссылки на другой домен и открываемые в новой вкладке',
        body: `const place = { origin: 'https://app.test', pathname: '/', search: '' };
const location = place;
const history = { pushState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; }, replaceState: function (state, title, path) { const url = new URL(path, place.origin); place.pathname = url.pathname; place.search = url.search; } };
const onAny = spy();
const router = createRouter([{ path: '/users/:id', handler: onAny }]);
const guard = function (event) { event.preventDefault(); };
document.addEventListener('click', guard);
try {
  const root = mount('<div><a class="ext" href="https://other.test/users/7">Наружу</a><a class="blank" href="https://app.test/users/9" target="_blank">В новой вкладке</a></div>');
  await click(root.querySelector('.ext'));
  assert.equal(onAny.count, 0, 'внешнюю ссылку надо отдать браузеру');
  await click(root.querySelector('.blank'));
  assert.equal(onAny.count, 0, 'target="_blank" тоже перехватывать нельзя');
  assert.equal(place.pathname, '/', 'адрес меняться не должен');
} finally { document.removeEventListener('click', guard); router.destroy(); }` },
    ],
  },
};
