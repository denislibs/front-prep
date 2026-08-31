/**
 * Окружение для проверок в песочнице.
 *
 * Один и тот же файл используется в двух местах:
 *  - в браузере (Web Worker и iframe) — как исполнитель тестов;
 *  - в Node — чтобы автор теста мог прогнать набор против эталонного решения.
 *
 * Время внутри песочницы всегда виртуальное: setTimeout, setInterval и Date.now
 * подменяются, а продвигает их только clock.tick(ms). Благодаря этому тесты на
 * debounce, throttle и retry выполняются мгновенно и детерминированно.
 */

function createHarness() {
  /* ── Виртуальное время ─────────────────────────────────────── */

  let now = 0;
  let nextId = 1;
  let timers = [];

  // Именно bind: в браузере вырванный из window setTimeout бросает Illegal invocation
  const realSetTimeout = globalThis.setTimeout.bind(globalThis);
  const realClearTimeout = globalThis.clearTimeout.bind(globalThis);

  function fakeSetTimeout(fn, delay, ...args) {
    const id = nextId++;
    timers.push({ id, at: now + (Number(delay) || 0), fn, args, interval: null });
    return id;
  }

  function fakeSetInterval(fn, delay, ...args) {
    const id = nextId++;
    const period = Math.max(1, Number(delay) || 0);
    timers.push({ id, at: now + period, fn, args, interval: period });
    return id;
  }

  function fakeClearTimer(id) {
    timers = timers.filter(t => t.id !== id);
  }

  /** Даёт очереди микрозадач опустеть — без этого await в коде теста «отстаёт» */
  function flushMicrotasks() {
    return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());
  }

  const clock = {
    async tick(ms) {
      const target = now + (Number(ms) || 0);
      // Таймеры могут порождать новые таймеры — идём по одному, пока есть срочные
      for (let guard = 0; guard < 100000; guard++) {
        const due = timers
          .filter(t => t.at <= target)
          .sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        now = due.at;
        if (due.interval) due.at = now + due.interval;
        else timers = timers.filter(t => t !== due);
        try { due.fn(...due.args); } catch (e) { queueMicrotask(() => { throw e; }); }
        await flushMicrotasks();
      }
      now = target;
      await flushMicrotasks();
    },
    /** Прокрутить время до срабатывания всех запланированных таймеров */
    async runAll() {
      for (let guard = 0; guard < 10000 && timers.length; guard++) {
        const next = Math.min(...timers.map(t => t.at));
        await clock.tick(Math.max(0, next - now));
        if (timers.some(t => t.interval)) break;   // интервалы не кончатся никогда
      }
    },
    get now() { return now; },
  };

  function installTimers(target) {
    target.setTimeout = fakeSetTimeout;
    target.setInterval = fakeSetInterval;
    target.clearTimeout = fakeClearTimer;
    target.clearInterval = fakeClearTimer;
    target.Date = new Proxy(Date, {
      construct: (T, args) => (args.length ? new T(...args) : new T(now)),
      get: (T, prop) => (prop === 'now' ? () => now : Reflect.get(T, prop)),
    });
    if (target.performance) target.performance.now = () => now;
  }

  const sleep = (ms) => clock.tick(ms);

  /* ── Сравнение значений ────────────────────────────────────── */

  function isDeepEqual(a, b, seen = new Set()) {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
    if (seen.has(a)) return true;
    seen.add(a);

    if (a instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof RegExp) return String(a) === String(b);
    if (a instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [k, v] of a) if (!b.has(k) || !isDeepEqual(v, b.get(k), seen)) return false;
      return true;
    }
    if (a instanceof Set) {
      if (a.size !== b.size) return false;
      for (const v of a) if (!b.has(v)) return false;
      return true;
    }
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => isDeepEqual(v, b[i], seen));
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(k => Object.prototype.hasOwnProperty.call(b, k) && isDeepEqual(a[k], b[k], seen));
  }

  function show(value, depth = 0) {
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'function') return value.name ? 'function ' + value.name : 'function';
    if (typeof value === 'bigint') return String(value) + 'n';
    if (value instanceof Map) return 'Map(' + value.size + ') {' + [...value].map(([k, v]) => show(k) + ' => ' + show(v)).join(', ') + '}';
    if (value instanceof Set) return 'Set(' + value.size + ') {' + [...value].map(v => show(v)).join(', ') + '}';
    if (value instanceof Error) return value.name + ': ' + value.message;
    if (value === undefined) return 'undefined';
    if (depth > 3) return '…';
    try { return JSON.stringify(value, (k, v) => (typeof v === 'function' ? '[function]' : v)) ?? String(value); }
    catch (e) { return String(value); }
  }

  class AssertionError extends Error {
    constructor(message, actual, expected) {
      super(message);
      this.name = 'AssertionError';
      this.actual = actual;
      this.expected = expected;
      this.hasDiff = arguments.length > 1;
    }
  }

  const assert = {
    equal(actual, expected, message) {
      if (!isDeepEqual(actual, expected)) {
        throw new AssertionError(message || 'значения не совпадают', actual, expected);
      }
    },
    notEqual(actual, expected, message) {
      if (isDeepEqual(actual, expected)) {
        throw new AssertionError(message || 'значения не должны совпадать', actual, expected);
      }
    },
    ok(value, message) {
      if (!value) throw new AssertionError(message || 'ожидалось истинное значение', value, true);
    },
    close(actual, expected, epsilon = 1e-9, message) {
      if (!(Math.abs(actual - expected) <= epsilon)) {
        throw new AssertionError(message || 'числа слишком далеки', actual, expected);
      }
    },
    throws(fn, message) {
      try { fn(); } catch (e) { return e; }
      throw new AssertionError(message || 'ожидалось исключение, но его не было');
    },
    async rejects(promise, message) {
      try { await promise; }
      catch (e) { return e; }
      throw new AssertionError(message || 'ожидался отклонённый промис, но он выполнился');
    },
    fail(message) {
      throw new AssertionError(message || 'проверка провалена');
    },
  };

  /* ── Шпион ─────────────────────────────────────────────────── */

  function spy(implementation) {
    const fn = function (...args) {
      fn.calls.push(args);
      fn.contexts.push(this);
      fn.count = fn.calls.length;
      fn.lastArgs = args;
      if (implementation) return implementation.apply(this, args);
    };
    fn.calls = [];
    fn.contexts = [];
    fn.count = 0;
    fn.lastArgs = null;
    return fn;
  }

  return { assert, AssertionError, spy, clock, sleep, installTimers, isDeepEqual, show,
           realSetTimeout, realClearTimeout };
}

/**
 * Прогоняет набор проверок против кода решения.
 * Возвращает [{ name, passed, error, actual, expected, logs }].
 */
async function runCases(solutionCode, testCase, options = {}) {
  const { entry, cases } = testCase;
  const transform = options.transform || testCase.transform;
  const results = [];

  for (const item of cases) {
    const h = createHarness();
    const logs = [];
    const consoleShim = {
      log: (...args) => logs.push(args.map(a => h.show(a)).join(' ')),
      warn: (...args) => logs.push('⚠ ' + args.map(a => h.show(a)).join(' ')),
      error: (...args) => logs.push('✗ ' + args.map(a => h.show(a)).join(' ')),
    };

    const scope = {};
    const useFakeTimers = options.fakeTimers !== false;
    if (useFakeTimers) h.installTimers(scope);

    const userCode = transform ? transform(solutionCode) : solutionCode;
    const bodyCode = transform ? transform(item.body) : item.body;

    // Имена параметров собираются динамически: в режимах dom и react сверху
    // докладываются хелперы работы с разметкой и React
    const globals = {
      assert: h.assert, spy: h.spy, clock: h.clock, sleep: h.sleep, console: consoleShim,
      ...(useFakeTimers ? {
        setTimeout: scope.setTimeout, setInterval: scope.setInterval,
        clearTimeout: scope.clearTimeout, clearInterval: scope.clearInterval, Date: scope.Date,
      } : {}),
      ...(options.globals || {}),
      __entry: entry,
    };
    const names = Object.keys(globals);

    const source = `
      "use strict";
      return (async function (${names.join(', ')}) {
        ${userCode}
        ;
        if (typeof ${entry} === 'undefined') {
          throw new Error('В коде не объявлен ' + __entry + ' — тесты ищут именно это имя.');
        }
        ${bodyCode}
      });`;

    let passed = false;
    let error = null;
    let actual, expected, hasDiff = false;

    try {
      const factory = new Function(source)();
      const call = factory(...names.map(n => globals[n]));
      await withTimeout(call, options.timeout || 3000, h);
      passed = true;
    } catch (e) {
      error = e && e.message ? e.message : String(e);
      if (e && e.hasDiff) {
        hasDiff = true;
        actual = h.show(e.actual);
        expected = h.show(e.expected);
      }
      if (e && e.name === 'SyntaxError') error = 'Синтаксическая ошибка: ' + error;
    }

    results.push({ name: item.name, passed, error, actual, expected, hasDiff, logs });

    if (options.afterEach) {
      try { await options.afterEach(); } catch (e) { /* очистка не должна валить прогон */ }
    }
  }

  return results;
}

/** Таймаут на одну проверку — считает реальное время, а не виртуальное */
function withTimeout(promise, ms, h) {
  return new Promise((resolve, reject) => {
    const timer = h.realSetTimeout(() => {
      reject(new Error('Проверка не завершилась за ' + ms + ' мс — похоже на зацикливание или незавершённое ожидание.'));
    }, ms);
    Promise.resolve(promise).then(
      (v) => { h.realClearTimeout(timer); resolve(v); },
      (e) => { h.realClearTimeout(timer); reject(e); }
    );
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createHarness, runCases };
}
