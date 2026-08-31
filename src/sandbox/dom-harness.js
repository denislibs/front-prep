/**
 * Хелперы для тестов, которым нужен DOM или React.
 *
 * Один и тот же модуль работает в двух окружениях:
 *  - в браузере (внутри изолированного iframe песочницы);
 *  - в Node через jsdom — чтобы автор теста мог проверить набор против эталона.
 *
 * Никаких зависимостей: только DOM API и глобальные React/ReactDOM, если они переданы.
 */

function createDomHelpers(env) {
  const doc = env.document;
  const React = env.React || null;
  const ReactDOM = env.ReactDOM || null;
  const win = env.window || (typeof globalThis !== 'undefined' ? globalThis : undefined);

  const mounted = [];
  const roots = [];

  /**
   * Даёт применённым эффектам и перерисовкам дойти до DOM.
   * Ждём таймерами, а не requestAnimationFrame: если фрейм не рисует кадры,
   * колбэк rAF не придёт вовсе и ожидание повиснет. Пауза с запасом на кадр
   * при этом даёт сработать rAF в коде пользователя, когда кадры идут.
   */
  function macrotask() {
    const Channel = win && win.MessageChannel;
    if (!Channel) return new Promise(resolve => setTimeout(resolve, 0));
    return new Promise((resolve) => {
      const channel = new Channel();
      channel.port1.onmessage = () => { channel.port1.close(); resolve(); };
      channel.port2.postMessage(0);
    });
  }

  async function tick() {
    await Promise.resolve();
    // MessageChannel не троттлится в фоне и им же планирует работу React 18
    await macrotask();
    // Одно короткое ожидание по таймеру: решения, которые обновляют DOM
    // из requestAnimationFrame, иначе не успевают отрисоваться
    await new Promise(resolve => setTimeout(resolve, 20));
    await macrotask();
    await Promise.resolve();
  }

  /**
   * React в тестовом окружении просит оборачивать обновления в act.
   * Свой act не пишем: используем то, что есть, иначе просто ждём tick.
   */
  async function act(fn) {
    const reactAct = React && React.act;
    if (reactAct) {
      try {
        let result;
        await reactAct(async () => { result = await fn(); });
        return result;
      } catch (error) {
        // В production-сборке React act бросает сразу, не выполнив колбэк:
        // тогда просто выполняем действие и ждём, пока React применит рендер.
        // Любую другую ошибку — из самого действия — пробрасываем как есть.
        const message = String((error && error.message) || '');
        if (!message.includes('production')) throw error;
      }
    }
    const result = await fn();
    await tick();
    return result;
  }

  /** Создаёт фикстуру из HTML и возвращает её корневой элемент */
  function mount(html) {
    const host = doc.createElement('div');
    host.innerHTML = html || '';
    doc.body.appendChild(host);
    mounted.push(host);
    return host;
  }

  /**
   * Монтирует React-элемент и возвращает контейнер.
   * Асинхронный: React 18 применяет рендер не синхронно, поэтому в тесте
   * нужно писать именно `const root = await render(<Comp />)`.
   */
  async function render(element) {
    if (!React || !ReactDOM) throw new Error('React недоступен в этом режиме песочницы');
    const host = doc.createElement('div');
    doc.body.appendChild(host);
    mounted.push(host);

    if (ReactDOM.createRoot) {
      const root = ReactDOM.createRoot(host);
      roots.push(root);
      await act(async () => { root.render(element); });
    } else {
      await act(async () => { ReactDOM.render(element, host); });
    }
    return host;
  }

  /** Размонтирование тоже вызывает обновление React, поэтому идёт через act */
  async function cleanup() {
    if (roots.length) {
      await act(async () => {
        for (const root of roots) { try { root.unmount(); } catch (e) { /* уже размонтирован */ } }
      });
      roots.length = 0;
    }
    for (const host of mounted) { try { host.remove(); } catch (e) { /* уже удалён */ } }
    mounted.length = 0;
  }

  /* ── События ───────────────────────────────────────────────── */

  function fire(el, type, init) {
    if (!el) throw new Error('Элемент не найден: событие ' + type + ' некому отправить');
    const Ctor = type.startsWith('key') ? win.KeyboardEvent
      : type.startsWith('mouse') || type === 'click' ? win.MouseEvent
      : win.Event;
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, ...init }));
  }

  const click = (el) => act(async () => {
    fire(el, 'mousedown'); fire(el, 'mouseup'); fire(el, 'click');
  });

  const press = (el, key) => act(async () => {
    fire(el, 'keydown', { key });
    fire(el, 'keyup', { key });
  });

  /** Печатает текст в поле так, как это делает React: через нативный сеттер */
  const type = (el, text) => act(async () => {
    const proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, text);
    fire(el, 'input');
    fire(el, 'change');
  });

  /* ── Поиск элементов ───────────────────────────────────────── */

  const visibleText = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

  // Служебные теги не отображаются пользователю, поэтому в поиск не попадают:
  // иначе текст из <script> песочницы находится как «видимый на странице»
  const NON_RENDERED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'LINK', 'META', 'TITLE']);

  function queryAll(root, selector) {
    return Array.from((root || doc.body).querySelectorAll(selector))
      .filter(el => !NON_RENDERED.has(el.tagName));
  }

  function queryByText(root, text) {
    const needle = String(text).toLowerCase();
    const all = queryAll(root, '*').filter(el => !el.querySelector('*'));
    return all.find(el => visibleText(el).toLowerCase().includes(needle)) || null;
  }

  function getByText(root, text) {
    const found = queryByText(root, text);
    if (!found) throw new Error('Не найден элемент с текстом ' + JSON.stringify(String(text)));
    return found;
  }

  const IMPLICIT_ROLES = {
    button: 'button', a: 'link', input: 'textbox', textarea: 'textbox',
    select: 'combobox', ul: 'list', ol: 'list', li: 'listitem',
    table: 'table', h1: 'heading', h2: 'heading', h3: 'heading',
    nav: 'navigation', dialog: 'dialog', form: 'form', img: 'img',
  };

  function roleOf(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'search') return 'searchbox';
      return 'textbox';
    }
    return IMPLICIT_ROLES[tag] || null;
  }

  function queryAllByRole(root, role, options = {}) {
    return queryAll(root, '*').filter(el => {
      if (roleOf(el) !== role) return false;
      if (options.name != null) {
        const label = el.getAttribute('aria-label') || visibleText(el);
        if (!label.toLowerCase().includes(String(options.name).toLowerCase())) return false;
      }
      if (options.selected != null &&
          String(el.getAttribute('aria-selected')) !== String(options.selected)) return false;
      if (options.expanded != null &&
          String(el.getAttribute('aria-expanded')) !== String(options.expanded)) return false;
      return true;
    });
  }

  function getByRole(root, role, options) {
    const found = queryAllByRole(root, role, options);
    if (!found.length) {
      throw new Error('Не найден элемент с ролью ' + JSON.stringify(role) +
        (options && options.name ? ' и названием ' + JSON.stringify(options.name) : ''));
    }
    return found[0];
  }

  return {
    mount, render, cleanup, act, tick,
    click, press, type, fire,
    getByText, queryByText, getByRole, queryAllByRole, queryAll,
    text: visibleText,
  };
}

/**
 * Снимает модульный синтаксис: в песочнице код исполняется как обычная функция,
 * поэтому import и export до неё не доживают. Хуки при этом всё равно доступны —
 * их кладёт в область видимости сам исполнитель.
 */
function stripModuleSyntax(code) {
  return code
    // import { a, b } from 'x';  |  import x from 'x';  |  import 'x';
    .replace(/^[ \t]*import\s+[\s\S]*?from\s*['"][^'"]+['"][ \t]*;?[ \t]*$/gm, '')
    .replace(/^[ \t]*import\s*['"][^'"]+['"][ \t]*;?[ \t]*$/gm, '')
    // export default function X  |  export function X  |  export const X
    .replace(/^[ \t]*export\s+default\s+/gm, '')
    .replace(/^[ \t]*export\s+(?=(function|const|let|var|class|async)\b)/gm, '')
    // export { A, B };
    .replace(/^[ \t]*export\s*\{[^}]*\}[ \t]*;?[ \t]*$/gm, '');
}

/** Имена, которые React-код ожидает найти в области видимости без импорта */
const REACT_SCOPE_KEYS = [
  'useState', 'useEffect', 'useLayoutEffect', 'useRef', 'useMemo', 'useCallback',
  'useReducer', 'useContext', 'useId', 'useTransition', 'useDeferredValue',
  'useImperativeHandle', 'useSyncExternalStore', 'createContext', 'createElement',
  'forwardRef', 'memo', 'Fragment', 'Children', 'cloneElement', 'isValidElement',
  // границы ошибок до сих пор пишут только классом — без Component задача не запустится
  'Component', 'PureComponent',
];

function reactScope(React) {
  const scope = {};
  for (const key of REACT_SCOPE_KEYS) if (React[key]) scope[key] = React[key];
  return scope;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createDomHelpers, stripModuleSyntax, reactScope, REACT_SCOPE_KEYS };
}
