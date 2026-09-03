#!/usr/bin/env node
/**
 * Прогоняет наборы тестов против эталонных решений из research/tasks.js
 * и базового набора в src/app.template.html.
 *
 *   node verify-tests.js                    все файлы research/tests-*.js
 *   node verify-tests.js research/tests-a.js  один файл
 *
 * Набор считается годным, только если ВСЕ его проверки проходят на эталонном
 * решении. Провал означает ошибку в тесте, а не в решении.
 */

const fs = require('fs');
const path = require('path');
const { runCases } = require('./src/sandbox/harness.js');
const { createDomHelpers, stripModuleSyntax, reactScope } = require('./src/sandbox/dom-harness.js');

const ROOT = __dirname;

/**
 * Окружение для наборов dom и react: jsdom плюс React.
 * Возвращает null, если зависимости не установлены — тогда такие наборы
 * пропускаются с понятным сообщением, а не роняют весь прогон.
 */
function createBrowserEnv() {
  let JSDOM, React, ReactDOM, transform;
  try {
    ({ JSDOM } = require('jsdom'));
  } catch (e) {
    return null;
  }

  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const { window } = dom;

  // React 18 в тестовом окружении требует этот флаг, иначе сыплет предупреждениями про act
  global.IS_REACT_ACT_ENVIRONMENT = true;
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement',
    'HTMLTextAreaElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'Node', 'getComputedStyle']) {
    if (global[key] === undefined) global[key] = window[key];
  }

  // react-dom определяет canUseDOM один раз при загрузке модуля: если window ещё нет,
  // он считает, что DOM отсутствует, и переключает onChange на полифилл для IE8.
  // Тогда type() перестаёт доходить до React — поэтому грузим его строго после jsdom.
  try {
    React = require('react');
    ReactDOM = require('react-dom/client');
    ({ transform } = require('sucrase'));
  } catch (e) {
    return null;
  }

  const helpers = createDomHelpers({ document: window.document, window, React, ReactDOM });
  const jsx = (code) => transform(stripModuleSyntax(code), { transforms: ['jsx'], production: true }).code;

  let ReactDOMFull = null;
  try { ReactDOMFull = require('react-dom'); } catch (e) { /* необязательно */ }
  return { helpers, React, ReactDOM, ReactDOMFull, window, jsx };
}

/** Все задачи: и новые из research/tasks.js, и базовые из шаблона */
function loadTasks() {
  const tasks = new Map();

  // Файлы задач из research/: имя файла -> имя объявляемой константы
  for (const [file, constName] of [['tasks.js', 'TASKS_EXTRA'], ['tasks-algo.js', 'TASKS_ALGO'], ['tasks-testing.js', 'TASKS_TESTING']]) {
    const extraPath = path.join(ROOT, 'research', file);
    if (!fs.existsSync(extraPath)) continue;
    const src = fs.readFileSync(extraPath, 'utf8');
    for (const task of new Function(src + '; return ' + constName + ';')()) tasks.set(task.id, task);
  }

  const template = fs.readFileSync(path.join(ROOT, 'src', 'app.template.html'), 'utf8');
  const body = template.match(/<script>([\s\S]*)<\/script>/)[1];
  const start = body.indexOf('const TASKS = [');
  const end = body.indexOf('const PLAN = [');
  const base = new Function(body.slice(start, end) + '; return TASKS;')();
  for (const task of base) if (!tasks.has(task.id)) tasks.set(task.id, task);

  return tasks;
}

function loadTestFiles(explicit) {
  const dir = path.join(ROOT, 'research');
  const files = explicit
    ? [explicit]
    : fs.readdirSync(dir).filter(f => /^tests-.*\.js$/.test(f)).map(f => path.join(dir, f));

  const suites = {};
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const name = (src.match(/const\s+(TESTS_[A-Z0-9_]+)\s*=/) || [])[1];
    if (!name) {
      console.error('✗ ' + path.basename(file) + ': не найдено объявление const TESTS_…');
      process.exitCode = 1;
      continue;
    }
    const suite = new Function(src + '; return ' + name + ';')();
    for (const [id, testCase] of Object.entries(suite)) {
      if (suites[id]) console.error('⚠ дубль набора для ' + id);
      suites[id] = { ...testCase, __file: path.basename(file) };
    }
  }
  return suites;
}

async function main() {
  const tasks = loadTasks();
  const suites = loadTestFiles(process.argv[2]);
  const ids = Object.keys(suites);

  if (!ids.length) {
    console.log('Наборов тестов не найдено (ожидаются файлы research/tests-*.js)');
    return;
  }

  let okSuites = 0;
  let failedSuites = 0;
  let skipped = 0;
  let totalCases = 0;
  const problems = [];

  const needsBrowser = Object.values(suites).some(s => s.env === 'dom' || s.env === 'react');
  const browser = needsBrowser ? createBrowserEnv() : null;
  if (needsBrowser && !browser) {
    console.log('⚠ jsdom / react не установлены — наборы dom и react пропускаются.');
    console.log('  Установить: npm i --save-dev jsdom react react-dom sucrase\n');
  }

  for (const id of ids) {
    const suite = suites[id];
    const task = tasks.get(id);

    if (!task) {
      problems.push({ id, file: suite.__file, reason: 'нет задачи с таким id' });
      failedSuites++;
      continue;
    }
    let options = {};
    if (suite.env === 'dom' || suite.env === 'react') {
      if (!browser) {
        skipped++;
        continue;
      }
      options = {
        // Реальные таймеры: React и jsdom рассчитывают на настоящий цикл событий
        fakeTimers: false,
        timeout: 5000,
        transform: browser.jsx,
        globals: {
          ...browser.helpers,
          ...reactScope(browser.React),
          createPortal: browser.ReactDOMFull && browser.ReactDOMFull.createPortal,
          flushSync: browser.ReactDOMFull && browser.ReactDOMFull.flushSync,
          React: browser.React,
          ReactDOM: browser.ReactDOM,
          window: browser.window,
          document: browser.window.document,
        },
        afterEach: () => browser.helpers.cleanup(),
      };
    }

    const results = await runCases(task.code, suite, options);
    totalCases += results.length;
    const failed = results.filter(r => !r.passed);

    if (failed.length) {
      failedSuites++;
      problems.push({
        id, file: suite.__file, title: task.title,
        reason: failed.length + ' из ' + results.length + ' проверок не проходят на эталонном решении',
        details: failed.map(f => '     · ' + f.name + ' — ' + f.error +
          (f.hasDiff ? '\n       получено: ' + f.actual + '\n       ожидалось: ' + f.expected : '')),
      });
    } else {
      okSuites++;
    }
  }

  for (const p of problems) {
    console.log('✗ ' + p.id + (p.title ? ' (' + p.title + ')' : '') + ' — ' + p.reason);
    if (p.details) console.log(p.details.join('\n'));
  }

  console.log('\n' + okSuites + ' наборов проходят, ' + failedSuites + ' с проблемами' +
    (skipped ? ', ' + skipped + ' пропущено' : '') + ', проверок всего ' + totalCases);
  if (failedSuites) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
