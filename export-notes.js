#!/usr/bin/env node
/**
 * Достаёт колоды и задачи из собранного app.html и раскладывает их
 * в читаемые markdown-конспекты в notes/ — чтобы материал был
 * доступен и без тренажёра (поиск по репозиторию, печать, чтение оффлайн).
 *
 * Запуск: node export-notes.js   (после node build.js)
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const NOTES = path.join(ROOT, 'notes');

const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
// Скриптов в файле несколько (библиотеки и приложение) — нужен последний,
// в нём лежат данные. Жадный поиск склеил бы их в один невалидный кусок.
const scripts = html.match(/<script>[\s\S]*?<\/script>/g);
if (!scripts || !scripts.length) throw new Error('в app.html не найден блок <script>');

// Берём только секцию с данными — до начала состояния приложения
const body = scripts[scripts.length - 1]
  .replace(/^<script>/, '')
  .replace(/<\/script>$/, '');
const cut = body.indexOf('/* ══ STATE');
if (cut < 0) throw new Error('в app.html не найден маркер секции STATE');

const { DECKS, TASKS, taskCat } = new Function(
  body.slice(0, cut) + '; return { DECKS, TASKS, taskCat };'
)();

/** Грубая, но достаточная конвертация нашего ограниченного HTML в markdown */
function toMarkdown(html) {
  return html
    .replace(/\s*\n\s*/g, ' ')
    // нумерованные списки конвертируем первыми, чтобы сохранить порядок пунктов
    .replace(/<ol>([\s\S]*?)<\/ol>/g, (_, inner) => {
      let n = 0;
      return '\n' + inner.replace(/<li>([\s\S]*?)<\/li>/g, (__, item) => '\n' + (++n) + '. ' + item.trim()) + '\n';
    })
    .replace(/<\/p>\s*<p>/g, '\n\n')
    .replace(/<p>|<\/p>/g, '\n\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/?ul>/g, '\n')
    .replace(/<li>\s*/g, '\n- ')
    .replace(/<\/li>/g, '')
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<code>(.*?)<\/code>/g, '`$1`')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n\s*\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

fs.mkdirSync(NOTES, { recursive: true });
for (const file of fs.readdirSync(NOTES)) fs.unlinkSync(path.join(NOTES, file));

const index = ['# Конспекты', '', 'Сгенерировано из тренажёра (`node export-notes.js`). Правки вносить в `research/` и `src/app.template.html`, а не здесь.', ''];

DECKS.forEach((deck, i) => {
  const lines = ['# ' + deck.title, '', deck.sub, '', '_Вопросов: ' + deck.cards.length + '_', ''];
  deck.cards.forEach((card, n) => {
    lines.push('## ' + (n + 1) + '. ' + card.q, '');
    lines.push(toMarkdown(card.a), '');
    if (card.code) lines.push('```js', card.code.trim(), '```', '');
    if (card.tip) lines.push('> **Что добавит очков.** ' + card.tip, '');
  });
  const name = String(i + 1).padStart(2, '0') + '-' + deck.id + '.md';
  fs.writeFileSync(path.join(NOTES, name), lines.join('\n'), 'utf8');
  index.push('- [' + deck.title + '](' + name + ') — ' + deck.cards.length + ' вопросов');
});

// Задачи на лайвкодинг — отдельным файлом, сгруппированные по категориям
const byCat = new Map();
for (const task of TASKS) {
  const cat = taskCat(task);
  if (!byCat.has(cat)) byCat.set(cat, []);
  byCat.get(cat).push(task);
}

const taskLines = ['# Лайвкодинг', '', '_Задач: ' + TASKS.length + '_', '',
  'Сначала решай сам и проговаривай вслух, только потом смотри решение.', ''];
for (const [cat, items] of byCat) {
  taskLines.push('## ' + cat, '');
  for (const task of items) {
    taskLines.push('### ' + task.title + (task.must ? ' — спрашивают часто' : ''), '');
    taskLines.push(toMarkdown(task.prompt), '');
    taskLines.push('**Подсказки:**', '');
    for (const hint of task.hints) taskLines.push('- ' + hint);
    taskLines.push('', '<details><summary>Решение</summary>', '', '```js', task.code.trim(), '```', '');
    taskLines.push(toMarkdown(task.notes), '', '</details>', '');
  }
}
fs.writeFileSync(path.join(NOTES, '99-livecoding.md'), taskLines.join('\n'), 'utf8');
index.push('- [Лайвкодинг](99-livecoding.md) — ' + TASKS.length + ' задач');

fs.writeFileSync(path.join(NOTES, 'README.md'), index.join('\n') + '\n', 'utf8');

const totalCards = DECKS.reduce((sum, d) => sum + d.cards.length, 0);
console.log('✓ notes/ обновлён: ' + DECKS.length + ' конспектов, ' +
  totalCards + ' вопросов, ' + TASKS.length + ' задач');
