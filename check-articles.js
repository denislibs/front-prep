#!/usr/bin/env node
/**
 * Проверяет статьи в articles/ без запуска сборки.
 *
 * Нужен, потому что VitePress держит общий каталог .vitepress/.temp:
 * две сборки одновременно дерутся за него и падают. Эта проверка ловит
 * те же ошибки, что и сборка, но мгновенно и не мешает соседям.
 *
 *   node check-articles.js              все статьи
 *   node check-articles.js chat-system  одна
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'articles');
const only = process.argv[2];

const files = fs.readdirSync(DIR)
  .filter(f => f.endsWith('.md'))
  .filter(f => !only || f.includes(only));

const known = new Set(fs.readdirSync(DIR).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')));

let problems = 0;

for (const file of files) {
  const source = fs.readFileSync(path.join(DIR, file), 'utf8');
  const issues = [];

  // Заголовок в шапке нужен для меню и вкладки браузера
  if (!/^---\n[\s\S]*?\btitle:\s*.+/m.test(source)) issues.push('нет title в frontmatter');

  // Вырезаем всё, где угловые скобки и усы безопасны
  const prose = source
    .replace(/```[\s\S]*?```/g, '')            // блоки кода
    .replace(/(`+)[\s\S]*?\1/g, '')            // строчный код
    .replace(/<figure[\s\S]*?<\/figure>/g, ''); // схемы: там SVG и это нормально

  for (const match of prose.matchAll(/<[a-zA-Z/][^>\n]{0,40}>?/g)) {
    issues.push('угловая скобка вне кода: ' + JSON.stringify(match[0].slice(0, 28)) +
      ' — оберни в обратные кавычки или замени на &lt;');
  }
  if (prose.includes('{{')) {
    issues.push('двойные фигурные скобки вне кода — Vue примет их за подстановку');
  }

  // Ссылки на соседние статьи должны вести в существующие файлы
  for (const link of source.matchAll(/\]\(\.\/([a-z0-9-]+)\)/g)) {
    if (!known.has(link[1])) issues.push('ссылка в несуществующую статью: ./' + link[1]);
  }

  // Схемы: без viewBox не тянутся по ширине, без описания недоступны
  for (const svg of source.matchAll(/<svg[^>]*>/g)) {
    if (!svg[0].includes('viewBox')) issues.push('в схеме нет viewBox');
    if (!svg[0].includes('aria-label')) issues.push('в схеме нет aria-label');
  }

  const words = source
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .split(/\s+/).filter(Boolean).length;

  const name = file.replace(/\.md$/, '');
  if (issues.length) {
    problems += issues.length;
    console.log('✗ ' + name + ' (' + words + ' слов)');
    for (const issue of [...new Set(issues)].slice(0, 6)) console.log('    ' + issue);
  } else {
    console.log('✓ ' + name.padEnd(34) + words + ' слов, ' +
      (source.match(/figure class="diagram"/g) || []).length + ' схем');
  }
}

console.log(problems ? '\n✗ проблем: ' + problems : '\n✓ все статьи в порядке');
process.exitCode = problems ? 1 : 0;
