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

// Остальное встраивается строками: эти исходники нужны не странице, а песочнице,
// которая поднимает их внутри воркера и iframe. Так они не дублируются по весу.
const SOURCE_CONSTANTS = [
  ['HARNESS_SOURCE', 'src/sandbox/harness.js'],
  ['DOM_HARNESS_SOURCE', 'src/sandbox/dom-harness.js'],
  ['REACT_SOURCE', 'src/vendor/react-bundle.js'],
  ['SUCRASE_SOURCE', 'src/vendor/sucrase.js'],
];
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

let output = template.replace(MARKER, () => chunks.join('\n\n'));

// Песочница: исходники окружения строками плюс сам исполнитель
if (output.includes(SANDBOX_MARKER)) {
  const parts = [];
  for (const [name, file] of SOURCE_CONSTANTS) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) fail('нет файла ' + file + ', нужного песочнице');
    const source = fs.readFileSync(full, 'utf8');
    parts.push('const ' + name + ' = ' + asJsString(source) + ';');
    report.push([file, name, Math.round(source.length / 1024)]);
  }
  const runner = fs.readFileSync(path.join(ROOT, RUNNER_FILE), 'utf8');
  parts.push(escapeScript(runner));
  report.push([RUNNER_FILE, 'исполнитель', Math.round(runner.length / 1024)]);
  output = output.replace(SANDBOX_MARKER, () => parts.join('\n\n'));
}

// Библиотеки идут отдельным тегом до приложения: UMD-сборкам нужен верхний
// уровень скрипта, чтобы объявить React, Sucrase и CM как глобальные
if (output.includes(VENDOR_MARKER)) {
  const parts = [];
  for (const file of VENDOR_FILES) {
    const full = path.join(VENDOR_DIR, file);
    if (!fs.existsSync(full)) fail('нет библиотеки src/vendor/' + file + ' (см. src/vendor/README.md)');
    const source = fs.readFileSync(full, 'utf8');
    parts.push('/* ' + file + ' */\n' + escapeScript(source));
    report.push(['vendor/' + file, 'библиотека', Math.round(source.length / 1024)]);
  }
  output = output.replace(VENDOR_MARKER, () => '<script>\n' + parts.join('\n;\n') + '\n</script>');
}
fs.writeFileSync(OUTPUT, output, 'utf8');
// index.html — то же самое под именем, которое ждёт GitHub Pages
fs.writeFileSync(path.join(ROOT, 'index.html'), output, 'utf8');

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
