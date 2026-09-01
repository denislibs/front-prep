#!/usr/bin/env node
/**
 * Собирает app.html из шаблона src/app.template.html, вставляя вместо
 * маркера /*__RESEARCH_DATA__*​/ колоды из research/*.js.
 *
 * Запуск: node build.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, 'src', 'app.template.html');
const OUTPUT = path.join(ROOT, 'app.html');
const RESEARCH = path.join(ROOT, 'research');
const MARKER = '/*__RESEARCH_DATA__*/';

// Порядок важен только для читаемости итогового файла
const FILES = [
  ['deck-js.js', 'DECK_JS_EXTRA'],
  ['deck-ts.js', 'DECK_TS_EXTRA'],
  ['deck-react.js', 'DECK_REACT_EXTRA'],
  ['deck-css.js', 'DECK_CSS'],
  ['deck-web.js', 'DECK_WEB_EXTRA'],
  ['deck-sd.js', 'DECK_SD_EXTRA'],
  ['deck-beh.js', 'DECK_BEH_EXTRA'],
  ['tasks.js', 'TASKS_EXTRA'],
  // Разбор мессенджера — отдельным файлом, вливается в колоду System Design
  ['deck-messenger.js', 'DECK_MESSENGER'],
];

function fail(message) {
  console.error('✗ ' + message);
  process.exit(1);
}

const VENDOR_MARKER = '<!--__VENDOR__-->';
const SANDBOX_MARKER = '/*__SANDBOX__*/';
const VENDOR_DIR = path.join(ROOT, 'src', 'vendor');

// Скриптом на страницу подключается только редактор — он нужен самому приложению
const VENDOR_FILES = ['codemirror.js'];

// Окружение проверок нужно песочнице внутри воркера и iframe, поэтому
// встраивается строками. Оно маленькое и лежит в странице всегда.
const SOURCE_CONSTANTS = [
  ['harness', 'src/sandbox/harness.js'],
  ['dom', 'src/sandbox/dom-harness.js'],
];

// А это тяжёлое и нужно не всем: React с транспайлером — только для
// задач с DOM и React, редактор — только в разделе лайвкодинга.
// В сборке для Pages они выносятся в отдельные файлы и грузятся по
// требованию; в самодостаточной версии для артефакта остаются внутри.
const LAZY_SOURCES = [
  ['react', 'src/vendor/react-bundle.js'],
  ['sucrase', 'src/vendor/sucrase.js'],
];
const EDITOR_FILE = 'src/vendor/codemirror.js';
const RUNNER_FILE = 'src/sandbox/runner.js';

/**
 * Превращает исходник в строковый литерал JS.
 * JSON.stringify закрывает кавычки, переводы строк и экранирование, но не знает
 * про </script — его дописываем поверх, уже внутри литерала.
 */
const asJsString = (source) => JSON.stringify(source).replace(/<\/script/gi, '<\\/script');

const template = fs.readFileSync(TEMPLATE, 'utf8');
if (!template.includes(MARKER)) fail('в шаблоне нет маркера ' + MARKER);

/** Литеральный </script> внутри инлайн-скрипта досрочно закрыл бы тег */
const escapeScript = (source) => source.replace(/<\/(script)/gi, '<\\/$1');

const chunks = [];
const report = [];

for (const [file, constName] of FILES) {
  const full = path.join(RESEARCH, file);
  if (!fs.existsSync(full)) {
    report.push([file, 'нет файла', 0]);
    continue;
  }

  // Синтаксис проверяем до склейки — так ошибка указывает на конкретный файл
  try {
    execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
  } catch (e) {
    fail(file + ' не проходит node --check:\n' + e.stderr.toString());
  }

  const source = fs.readFileSync(full, 'utf8');
  if (!source.includes(constName)) fail(file + ' не объявляет ' + constName);

  // Считаем элементы массива, исполнив файл в изолированном контексте
  let count = 0;
  const ids = [];
  try {
    const items = new Function(source + '\nreturn ' + constName + ';')();
    if (!Array.isArray(items)) fail(constName + ' в ' + file + ' — не массив');
    count = items.length;
    for (const item of items) {
      if (!item || typeof item.id !== 'string') fail(file + ': элемент без строкового id');
      ids.push(item.id);
    }
  } catch (e) {
    fail('не удалось выполнить ' + file + ': ' + e.message);
  }

  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) fail(file + ': повторяющиеся id — ' + [...new Set(dupes)].join(', '));

  chunks.push('/* ── ' + file + ' ── */\n' + escapeScript(source.trim()));
  report.push([file, constName, count]);
}

// Замена через функцию: в контенте встречаются $1, $& и подобное из примеров
// с регулярными выражениями — строковая замена трактовала бы их как спецпаттерны
// Наборы автотестов лежат отдельными файлами research/tests-*.js и объявляют
// каждый свою константу — сводим их в одну таблицу по id задачи
const testFiles = fs.existsSync(RESEARCH)
  ? fs.readdirSync(RESEARCH).filter(f => /^tests-.*\.js$/.test(f) && !f.startsWith('tests-sample')).sort()
  : [];
const testConstNames = [];

for (const file of testFiles) {
  const full = path.join(RESEARCH, file);
  try {
    execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
  } catch (e) {
    fail(file + ' не проходит node --check:\n' + e.stderr.toString());
  }
  const source = fs.readFileSync(full, 'utf8');
  const name = (source.match(/const\s+(TESTS_[A-Z0-9_]+)\s*=/) || [])[1];
  if (!name) fail(file + ': не найдено объявление const TESTS_…');

  let count = 0;
  try {
    count = Object.keys(new Function(source + '; return ' + name + ';')()).length;
  } catch (e) {
    fail('не удалось выполнить ' + file + ': ' + e.message);
  }

  testConstNames.push(name);
  chunks.push('/* ── ' + file + ' ── */\n' + escapeScript(source.trim()));
  report.push([file, name, count]);
}

chunks.push('const TASK_TESTS = Object.assign({}' +
  testConstNames.map(n => ', ' + n).join('') + ');');

// Тестовые вопросы — файлы research/quiz-*.js, каждый со своей константой
const quizFiles = fs.existsSync(RESEARCH)
  ? fs.readdirSync(RESEARCH).filter(f => /^quiz-.*\.js$/.test(f)).sort()
  : [];
const quizConstNames = [];

for (const file of quizFiles) {
  const full = path.join(RESEARCH, file);
  try {
    execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
  } catch (e) {
    fail(file + ' не проходит node --check:\n' + e.stderr.toString());
  }
  const source = fs.readFileSync(full, 'utf8');
  const name = (source.match(/const\s+(QUIZ_[A-Z0-9_]+)\s*=/) || [])[1];
  if (!name) fail(file + ': не найдено объявление const QUIZ_…');

  let count = 0;
  try {
    const items = new Function(source + '; return ' + name + ';')();
    if (!Array.isArray(items)) fail(name + ' в ' + file + ' — не массив');
    count = items.length;
    for (const item of items) {
      if (!Array.isArray(item.options) || item.options.length !== 4) {
        fail(file + ': у вопроса ' + item.id + ' должно быть ровно 4 варианта');
      }
      if (!(item.correct >= 0 && item.correct <= 3)) {
        fail(file + ': у вопроса ' + item.id + ' поле correct вне диапазона 0–3');
      }
    }
  } catch (e) {
    fail('не удалось выполнить ' + file + ': ' + e.message);
  }

  quizConstNames.push(name);
  chunks.push('/* ── ' + file + ' ── */\n' + escapeScript(source.trim()));
  report.push([file, name, count]);
}

chunks.push('const QUIZ = [].concat(' + (quizConstNames.join(', ') || '') + ');');

// Частота вопросов — файлы research/freq-*.js, сводятся в одну таблицу id → 1..3
const freqFiles = fs.existsSync(RESEARCH)
  ? fs.readdirSync(RESEARCH).filter(f => /^freq-.*\.js$/.test(f)).sort()
  : [];
const freqConstNames = [];

for (const file of freqFiles) {
  const full = path.join(RESEARCH, file);
  try {
    execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
  } catch (e) {
    fail(file + ' не проходит node --check:\n' + e.stderr.toString());
  }
  const source = fs.readFileSync(full, 'utf8');
  const name = (source.match(/const\s+(FREQ_[A-Z0-9_]+)\s*=/) || [])[1];
  if (!name) fail(file + ': не найдено объявление const FREQ_…');

  let count = 0;
  try {
    const map = new Function(source + '; return ' + name + ';')();
    for (const [id, value] of Object.entries(map)) {
      if (![1, 2, 3].includes(value)) fail(file + ': у ' + id + ' частота ' + value + ', ожидалось 1, 2 или 3');
    }
    count = Object.keys(map).length;
  } catch (e) {
    fail('не удалось выполнить ' + file + ': ' + e.message);
  }

  freqConstNames.push(name);
  chunks.push('/* ── ' + file + ' ── */\n' + escapeScript(source.trim()));
  report.push([file, name, count]);
}

chunks.push('const FREQUENCY = Object.assign({}' +
  freqConstNames.map(n => ', ' + n).join('') + ');');

// mergeCards объявлена функцией в шаблоне, поэтому доступна здесь по всплытию
chunks.push("if (typeof DECK_MESSENGER !== 'undefined') mergeCards('sd', DECK_MESSENGER);");

let output = template.replace(MARKER, () => chunks.join('\n\n'));

/**
 * Собирает страницу в двух видах:
 *
 *  app.html   — самодостаточный: библиотеки внутри. Нужен артефакту,
 *               который состоит из одного файла и не может подтягивать соседей.
 *  index.html — для Pages: тяжёлые библиотеки вынесены в assets/ и грузятся
 *               по требованию. React с транспайлером нужен только задачам
 *               с DOM и React, редактор — только в лайвкодинге, а первая
 *               загрузка не должна тащить полтора мегабайта ради этого.
 */
function assemble({ inlineHeavy }) {
  let page = output;
  const assets = {};

  const sandboxParts = [];
  const sources = {};
  for (const [name, file] of SOURCE_CONSTANTS) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) fail('нет файла ' + file + ', нужного песочнице');
    sources[name] = fs.readFileSync(full, 'utf8');
  }

  const heavy = {};
  for (const [name, file] of LAZY_SOURCES) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) fail('нет файла ' + file + ', нужного песочнице');
    heavy[name] = fs.readFileSync(full, 'utf8');
  }

  // Таблица исходников песочницы: лёгкое всегда внутри, тяжёлое — по режиму
  const table = Object.entries(sources)
    .map(([name, src]) => '  ' + name + ': ' + asJsString(src) + ',')
    .concat(Object.keys(heavy).map(name => inlineHeavy
      ? '  ' + name + ': ' + asJsString(heavy[name]) + ','
      : '  ' + name + ': null,'));
  sandboxParts.push('const SANDBOX_SOURCES = {\n' + table.join('\n') + '\n};');

  if (!inlineHeavy) {
    const bundle = Object.entries(heavy)
      .map(([name, src]) => 'SANDBOX_SOURCES.' + name + ' = ' + asJsString(src) + ';')
      .join('\n');
    assets['sandbox-libs.js'] = bundle;
    sandboxParts.push("const LAZY_ASSETS = { sandbox: 'assets/sandbox-libs.js', editor: 'assets/codemirror.js' };");
  }

  const runner = fs.readFileSync(path.join(ROOT, RUNNER_FILE), 'utf8');
  sandboxParts.push(escapeScript(runner));
  page = page.replace(SANDBOX_MARKER, () => sandboxParts.join('\n\n'));

  // Редактор: внутри страницы для артефакта, отдельным файлом для Pages
  const editor = fs.readFileSync(path.join(ROOT, EDITOR_FILE), 'utf8');
  if (inlineHeavy) {
    page = page.replace(VENDOR_MARKER, () => '<script>\n' + escapeScript(editor) + '\n</script>');
  } else {
    assets['codemirror.js'] = editor;
    page = page.replace(VENDOR_MARKER, () => '');
  }

  return { page, assets };
}

const monolith = assemble({ inlineHeavy: true });
fs.writeFileSync(OUTPUT, monolith.page, 'utf8');

const split = assemble({ inlineHeavy: false });
fs.writeFileSync(path.join(ROOT, 'index.html'), split.page, 'utf8');

const assetsDir = path.join(ROOT, 'assets');
fs.rmSync(assetsDir, { recursive: true, force: true });
fs.mkdirSync(assetsDir, { recursive: true });
for (const [name, content] of Object.entries(split.assets)) {
  fs.writeFileSync(path.join(assetsDir, name), content, 'utf8');
  report.push(['assets/' + name, 'по требованию', Math.round(content.length / 1024)]);
}

output = monolith.page;   // дальнейшие проверки идут по самодостаточной версии

// Финальная проверка: код приложения должен быть валидным JS.
// Библиотеки не проверяем — они уже собраны и это экономит секунды на каждой сборке.
const scripts = output.match(/<script>([\s\S]*?)<\/script>/g) || [];
const appScript = scripts[scripts.length - 1] || '';
const body = appScript.replace(/^<script>/, '').replace(/<\/script>$/, '');
const tmp = path.join(ROOT, '.build-check.js');
fs.writeFileSync(tmp, body, 'utf8');
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
} catch (e) {
  fail('итоговый app.html содержит невалидный JS:\n' + e.stderr.toString());
} finally {
  fs.unlinkSync(tmp);
}

const width = Math.max(...report.map(r => r[0].length));
for (const [file, name, count] of report) {
  console.log('  ' + file.padEnd(width) + '  ' + String(count).padStart(4) + '  ' + name);
}
const total = report.reduce((sum, r) => sum + r[2], 0);
const size = (fs.statSync(OUTPUT).size / 1024).toFixed(0);
console.log('\n✓ app.html собран: ' + total + ' элементов из research/, ' + size + ' КБ');
