/**
 * Браузерная часть песочницы: запускает код пользователя против набора проверок.
 *
 * Два исполнителя:
 *  - Web Worker для чистого JS: полная изоляция, зацикливание лечится terminate;
 *  - изолированный iframe для DOM и React: нужен настоящий документ.
 *
 * Оба создаются на время прогона и уничтожаются после — состояние между
 * запусками не протекает, а зависший код не может утащить за собой приложение.
 */

const SANDBOX = (() => {
  /** Предохранитель на весь прогон: зависит от числа проверок, но не безграничен */
  const hardTimeout = (suite) => Math.min(60000, 8000 + suite.cases.length * 5000);

  /** Собирает исходник окружения, общий для обоих исполнителей */
  function buildEnvSource() {
    return [
      SANDBOX_SOURCES.harness,   // таблицу заполняет сборщик
      SANDBOX_SOURCES.dom,
    ].join('\n;\n');
  }

  /* ── Исполнитель на Web Worker ─────────────────────────────── */

  function workerSource() {
    return `
      ${buildEnvSource()}
      self.onmessage = async (event) => {
        const { code, suite } = event.data;
        try {
          const results = await runCases(code, suite, { timeout: 3000 });
          self.postMessage({ ok: true, results });
        } catch (error) {
          self.postMessage({ ok: false, error: String(error && error.message || error) });
        }
      };
    `;
  }

  function runInWorker(code, suite) {
    return new Promise((resolve) => {
      const blob = new Blob([workerSource()], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);

      const finish = (payload) => {
        clearTimeout(timer);
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve(payload);
      };

      const limit = hardTimeout(suite);
      const timer = setTimeout(() => finish({
        ok: false,
        error: 'Код не завершился за ' + Math.round(limit / 1000) + ' секунд — похоже на бесконечный цикл. Выполнение остановлено.',
      }), limit);

      worker.onmessage = (event) => finish(event.data);
      worker.onerror = (event) => finish({
        ok: false,
        error: event.message || 'Ошибка в коде до запуска проверок',
      });

      worker.postMessage({ code, suite: serializeSuite(suite) });
    });
  }

  /* ── Исполнитель на iframe (DOM и React) ───────────────────── */

  function frameSource(needsReact) {
    const libs = needsReact
      ? '<script>' + SANDBOX_SOURCES.react + '<\/script>'
      : '';
    // Скрипты песочницы держим в head: в body они стали бы частью документа,
    // который проверяют тесты, и попадали бы в выборки по тексту
    return '<!doctype html><html><head><meta charset="utf-8">'
      + libs
      + '<script>' + SANDBOX_SOURCES.sucrase + '<\/script>'
      + '<script>' + buildEnvSource() + '<\/script>'
      + '<script>' + FRAME_BOOT + '<\/script>'
      + '</head><body></body></html>';
  }

  /** Код, который живёт внутри iframe и слушает команды родителя */
  const FRAME_BOOT = `
    // Скрытому фрейму браузер может не выдавать кадры, и тогда настоящий
    // requestAnimationFrame не сработает никогда. Дублируем его таймером:
    // сработает то, что придёт первым, колбэк вызывается ровно один раз.
    (function () {
      const nativeRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = function (callback) {
        let called = false;
        const fire = () => {
          if (called) return;
          called = true;
          callback(performance.now());
        };
        const timer = setTimeout(fire, 16);
        if (nativeRaf) nativeRaf.call(window, fire);
        return timer;
      };
      window.cancelAnimationFrame = function (id) { clearTimeout(id); };
    })();

    window.addEventListener('message', async (event) => {
      const { code, suite, token } = event.data || {};
      if (!code) return;
      const reply = (payload) => parent.postMessage({ ...payload, token }, '*');
      try {
        const React = window.React || null;
        const ReactDOM = window.ReactDOMClient || window.ReactDOM || null;
        const ReactDOMFull = window.ReactDOMFull || null;
        const helpers = createDomHelpers({ document, window, React, ReactDOM });
        const jsx = (source) => Sucrase.transform(
          stripModuleSyntax(source), { transforms: ['jsx'], production: true }
        ).code;

        const results = await runCases(code, suite, {
          fakeTimers: false,
          timeout: 5000,
          transform: jsx,
          globals: {
            ...helpers,
            ...(React ? reactScope(React) : {}),
            // createPortal живёт в react-dom, а не в react — кладём отдельно,
            // иначе решение задачи про модалку не сможет его вызвать
            createPortal: ReactDOMFull && ReactDOMFull.createPortal,
            flushSync: ReactDOMFull && ReactDOMFull.flushSync,
            React, ReactDOM, window, document,
          },
          afterEach: () => helpers.cleanup(),
        });
        reply({ ok: true, results });
      } catch (error) {
        reply({ ok: false, error: String((error && error.message) || error) });
      }
    });
    parent.postMessage({ ready: true }, '*');
  `;

  function runInFrame(code, suite) {
    return new Promise((resolve) => {
      const needsReact = suite.env === 'react';
      const frame = document.createElement('iframe');
      // Изолированный фрейм получает opaque origin, и Chrome запрещает в нём
      // программный focus(). Задачам, где фокус и есть предмет проверки,
      // изоляцию ослабляем точечно — ценой того, что зацикливание в них
      // подвесит страницу до перезагрузки вкладки.
      frame.setAttribute('sandbox', suite.needsFocus
        ? 'allow-scripts allow-same-origin'
        : 'allow-scripts');
      frame.setAttribute('aria-hidden', 'true');
      // Не display:none и не за пределами экрана: скрытый фрейм не рисует кадры,
      // а значит requestAnimationFrame в коде пользователя не сработает вовсе
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:320px;height:240px;'
        + 'opacity:0.01;pointer-events:none;z-index:-1;border:0;';
      const token = 'run-' + Math.random().toString(36).slice(2);

      const finish = (payload) => {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        frame.remove();
        resolve(payload);
      };

      const limit = hardTimeout(suite);
      const timer = setTimeout(() => finish({
        ok: false,
        error: 'Код не завершился за ' + Math.round(limit / 1000) + ' секунд — похоже на бесконечный цикл. Выполнение остановлено.',
      }), limit);

      function onMessage(event) {
        if (event.source !== frame.contentWindow) return;
        const data = event.data || {};
        if (data.ready) {
          frame.contentWindow.postMessage({ code, suite: serializeSuite(suite), token }, '*');
          return;
        }
        if (data.token === token) finish(data);
      }

      window.addEventListener('message', onMessage);
      frame.srcdoc = frameSource(needsReact);
      document.body.appendChild(frame);
    });
  }

  /** В воркер и iframe уходит только то, что переживает структурное копирование */
  function serializeSuite(suite) {
    return {
      env: suite.env,
      entry: suite.entry,
      needsFocus: !!suite.needsFocus,
      cases: suite.cases.map(c => ({ name: c.name, body: c.body })),
    };
  }

  /**
   * Запускает набор проверок. Возвращает
   * { ok, results?: [{name, passed, error, actual, expected, hasDiff, logs}], error? }
   */
  async function run(code, suite) {
    if (!suite || !suite.cases || !suite.cases.length) {
      return { ok: false, error: 'Для этой задачи ещё нет автотестов' };
    }
    if (suite.env === 'worker') return runInWorker(code, suite);

    // Задачам с DOM и React нужен транспайлер, а React-задачам ещё и сам React
    if (!SANDBOX_SOURCES.sucrase && !(await ensureSandboxLibs())) {
      return { ok: false, error: 'Не удалось загрузить окружение для этой задачи' };
    }
    return runInFrame(code, suite);
  }

  return { run };
})();
