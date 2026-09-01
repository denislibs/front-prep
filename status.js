#!/usr/bin/env node
/**
 * Быстрая сводка по контенту: сколько карточек в каждой колоде, сколько
 * переписано в подробном формате, какая средняя длина ответа.
 *
 * Главное здесь — колонка с числом карточек. Если оно упало относительно
 * ожидаемого, значит файл переписали целиком и часть карточек потерялась;
 * восстанавливается из git: git checkout -- research/<файл>
 *
 * Запуск: node status.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const DECKS = [
  ['deck-js.js', 'DECK_JS_EXTRA', 65],
  ['deck-ts.js', 'DECK_TS_EXTRA', 40],
  ['deck-react.js', 'DECK_REACT_EXTRA', 65],
  ['deck-css.js', 'DECK_CSS', 45],
  ['deck-web.js', 'DECK_WEB_EXTRA', 45],
  ['deck-sd.js', 'DECK_SD_EXTRA', 50],
  ['deck-beh.js', 'DECK_BEH_EXTRA', 35],
  ['deck-messenger.js', 'DECK_MESSENGER', 14],
];

const words = (html) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

let lost = 0;
let done = 0;
let total = 0;

console.log('файл             карточек   подробных   средняя длина');
console.log('─'.repeat(58));

for (const [file, name, expected] of DECKS) {
  const full = path.join(ROOT, 'research', file);
  if (!fs.existsSync(full)) {
    console.log(file.padEnd(16) + '  ещё не создан');
    continue;
  }
  let cards;
  try {
    cards = new Function(fs.readFileSync(full, 'utf8') + '; return ' + name + ';')();
  } catch (e) {
    console.log(file.padEnd(16) + '  ✗ не парсится: ' + e.message.slice(0, 40));
    lost++;
    continue;
  }

  const detailed = cards.filter(c => /<h4>/.test(c.a)).length;
  const avg = Math.round(cards.reduce((sum, c) => sum + words(c.a), 0) / cards.length);
  const missing = expected - cards.length;
  if (missing > 0) lost += missing;
  done += detailed;
  total += expected;

  console.log(
    file.padEnd(16) +
    (cards.length + '/' + expected).padStart(9) +
    (detailed + '/' + cards.length).padStart(12) +
    String(avg).padStart(13) + ' сл.' +
    (missing > 0 ? '   ⚠ потеряно ' + missing : '')
  );
}

console.log('─'.repeat(58));
console.log('переписано ' + done + ' из ' + total + ' карточек' +
  (lost ? ',  ⚠ ПОТЕРЯНО ' + lost + ' — восстанови из git' : ''));
process.exitCode = lost ? 1 : 0;
