#!/usr/bin/env node
/**
 * Генерирует исходники сайта конспектов в notes-src/ — по странице на вопрос.
 *
 * Раньше здесь получался один файл на колоду, и System Design весил
 * 663 КБ одной страницей: читать невозможно, ссылаться некуда. Теперь
 * у каждого вопроса свой адрес вида /notes/js/js2, страницы лёгкие,
 * а поиск VitePress ведёт точно в нужное место.
 *
 * Запуск: node export-notes.js   (после node build.js)
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
// Исходники сайта конспектов. Папка docs/ занята рукописными
// спецификациями проекта, поэтому генерируем рядом.
const DOCS = path.join(ROOT, 'notes-src');

const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
// Скриптов в файле несколько (библиотеки и приложение) — нужен последний
const scripts = html.match(/<script>[\s\S]*?<\/script>/g);
if (!scripts || !scripts.length) throw new Error('в app.html не найден блок <script>');

const body = scripts[scripts.length - 1]
  .replace(/^<script>/, '')
  .replace(/<\/script>$/, '');
const cut = body.indexOf('/* ══ STATE');
if (cut < 0) throw new Error('в app.html не найден маркер секции STATE');

const { DECKS, TASKS, taskCat } = new Function(
  body.slice(0, cut) + '; return { DECKS, TASKS, taskCat };'
)();

/**
 * Конвертация нашего ограниченного HTML в markdown.
 *
 * VitePress разбирает markdown как шаблон Vue, поэтому угловая скобка
 * в обычном тексте («компонент <Suspense> приостанавливает…») трактуется
 * как незакрытый тег и роняет сборку. В прозе скобки экранируются,
 * а внутри кода остаются настоящими: там markdown их не трогает.
 */
function toMarkdown(html) {
  const spans = [];
  const stash = (text) => {
    spans.push(text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
    return '\u0000C' + (spans.length - 1) + '\u0000';
  };

  let out = html
    .replace(/<code>([\s\S]*?)<\/code>/g, (_, inner) => stash(inner))
    .replace(/\s*\n\s*/g, ' ')
    .replace(/<h4>(.*?)<\/h4>/g, '\n\n## $1\n')
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
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n\s*\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return escapeProse(out)
    .replace(/\u0000C(\d+)\u0000/g, (_, i) => fenceInline(spans[i]));
}

/**
 * Обрамляет код в бэктики так, чтобы не сломаться о бэктики внутри.
 * Шаблонные литералы в примерах — обычное дело, и одинарная обёртка
 * вокруг них даёт неверную вложенность.
 */
function fenceInline(code) {
  // Двойные фигурные скобки Vue трактует как подстановку даже внутри
  // обратных кавычек, поэтому такой код отдаём тегом с v-pre
  if (code.includes('{{')) {
    const escaped = code
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<code v-pre>' + escaped + '</code>';
  }
  const longest = (code.match(/`+/g) || []).reduce((max, run) => Math.max(max, run.length), 0);
  const ticks = '`'.repeat(longest + 1);
  const pad = /^`|`$/.test(code) ? ' ' : '';
  return ticks + pad + code + pad + ticks;
}

/** Скобки и усы, которые Vue принял бы за разметку или подстановку */
function escapeProse(text) {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{\{/g, '&#123;&#123;');
}

/** Экранирование для frontmatter: заголовок идёт в кавычках */
const quote = (text) => '"' + String(text).replace(/"/g, '\\"') + '"';

const FREQ_NOTE = {
  3: 'Спрашивают почти всегда',
  2: 'Спрашивают регулярно',
  1: 'Редкий вопрос — оставь на потом',
};

fs.rmSync(DOCS, { recursive: true, force: true });
fs.mkdirSync(DOCS, { recursive: true });

// Меню строится отдельно для каждого раздела: общий список из 440 пунктов
// VitePress вшивал бы в КАЖДУЮ страницу, и сайт распухал до сотен мегабайт
const sidebar = {};
const shortText = (text) => (text.length > 58 ? text.slice(0, 57).trimEnd() + '…' : text);
let pages = 0;

for (const deck of DECKS) {
  const dir = path.join(DOCS, deck.id);
  fs.mkdirSync(dir, { recursive: true });

  const items = [];

  for (const card of deck.cards) {
    const lines = [
      '---',
      'title: ' + quote(card.q),
      '---',
      '',
      '# ' + escapeProse(card.q),
      '',
    ];

    if (card.freq) lines.push('> ' + FREQ_NOTE[card.freq], '');
    if (card.snippet) lines.push('```js', card.snippet.trim(), '```', '');

    lines.push(toMarkdown(card.a), '');

    if (card.code && card.code !== card.snippet) {
      lines.push('```js', card.code.trim(), '```', '');
    }
    if (card.tip) lines.push('::: tip Что добавит очков', escapeProse(card.tip), ':::', '');

    lines.push('---', '',
      '[Открыть в тренажёре](../../#/cards/' + deck.id + '/' + card.id + ') · ' +
      '[Все вопросы раздела](./)');

    fs.writeFileSync(path.join(dir, card.id + '.md'), lines.join('\n'), 'utf8');
    items.push({ text: shortText(card.q), link: '/' + deck.id + '/' + card.id });
    pages++;
  }

  // Оглавление раздела
  const indexLines = [
    '---', 'title: ' + quote(deck.title), '---', '',
    '# ' + escapeProse(deck.title), '', escapeProse(deck.sub), '',
    '_Вопросов: ' + deck.cards.length + '. Отсортированы по частоте: сверху то, что спрашивают почти всегда._', '',
  ];
  let lastFreq = null;
  for (const card of deck.cards) {
    if (card.freq !== lastFreq) {
      lastFreq = card.freq;
      indexLines.push('', '## ' + (FREQ_NOTE[card.freq] || 'Прочее'), '');
    }
    indexLines.push('- [' + escapeProse(card.q) + '](./' + card.id + ')');
  }
  fs.writeFileSync(path.join(dir, 'index.md'), indexLines.join('\n'), 'utf8');

  sidebar['/' + deck.id + '/'] = [{ text: deck.title, items }];
}

/* ── Лайвкодинг: страница на задачу ── */
const codeDir = path.join(DOCS, 'code');
fs.mkdirSync(codeDir, { recursive: true });
const codeItems = [];

for (const task of TASKS) {
  const lines = [
    '---', 'title: ' + quote(task.title), '---', '',
    '# ' + escapeProse(task.title), '',
    '> ' + (task.must ? 'Спрашивают часто' : 'Спрашивают реже') + ' · ' + taskCat(task), '',
    toMarkdown(task.prompt), '',
    '## Подсказки', '',
  ];
  for (const hint of task.hints) lines.push('- ' + escapeProse(hint));
  lines.push('', '## Решение', '', '```js', task.code.trim(), '```', '',
    toMarkdown(task.notes), '', '---', '',
    '[Решить в песочнице](../../#/code/' + task.id + ') · [Все задачи](./)');

  fs.writeFileSync(path.join(codeDir, task.id + '.md'), lines.join('\n'), 'utf8');
  codeItems.push({ text: shortText(task.title), link: '/code/' + task.id });
}

const codeIndex = ['---', 'title: "Лайвкодинг"', '---', '', '# Лайвкодинг', '',
  '_Задач: ' + TASKS.length + '. Сначала решай сам, только потом смотри решение._', ''];
const byCat = new Map();
for (const task of TASKS) {
  const cat = taskCat(task);
  if (!byCat.has(cat)) byCat.set(cat, []);
  byCat.get(cat).push(task);
}
for (const [cat, list] of byCat) {
  codeIndex.push('', '## ' + cat, '');
  for (const task of list) codeIndex.push('- [' + escapeProse(task.title) + '](./' + task.id + ')');
}
fs.writeFileSync(path.join(codeDir, 'index.md'), codeIndex.join('\n'), 'utf8');
sidebar['/code/'] = [{ text: 'Лайвкодинг', items: codeItems }];

/* ── Статьи ──────────────────────────────────────────────────
   Пишутся руками в articles/ и переносятся как есть: в отличие от
   карточек, они не выводятся из данных приложения. */
/* Тематические группы статей: заголовок и список файлов без расширения.
   Плоский алфавитный список на три десятка статей бесполезен — искать в нём
   нечего. Добавил статью — впиши её сюда, иначе уедет в «Разное». */
const ARTICLE_GROUPS = [
  ['Язык', [
    'types-and-coercion', 'scope-and-closures', 'this-and-context',
    'functions-and-patterns', 'prototypes-and-classes',
    'arrays-objects-immutability', 'promises', 'async-await',
    'memory-and-leaks', 'errors-and-debugging',
  ]],
  ['Браузер и сеть', [
    'browser-rendering-event-loop', 'dom-events', 'url-to-page',
  ]],
  ['Веб-API', [
    'web-workers', 'service-worker', 'storage-and-quotas',
    'streaming-responses', 'media-streaming', 'realtime-transports',
  ]],
  ['Интерфейсы и React', [
    'state-management-patterns', 'composition-patterns',
    'data-fetching-patterns', 'rendering-performance-patterns',
    'forms-and-validation', 'search-and-autocomplete',
    'infinite-list-and-virtualization',
  ]],
  ['Архитектура и проектирование', [
    'modules-and-bundling', 'design-system-as-product',
    'microfrontends-and-migration', 'chat-system-design',
  ]],
  ['Инфраструктура и эксплуатация', [
    'frontend-ci-cd', 'deploy-and-release',
    'frontend-monitoring', 'frontend-resilience',
  ]],
  ['Тестирование', [
    'testing-strategy',
  ]],
];
const missingArticles = [];   // упомянуты в группе, но файла нет
const ungrouped = [];         // файл есть, а группы для него нет

const ARTICLES = path.join(ROOT, 'articles');
const articleItems = [];

if (fs.existsSync(ARTICLES)) {
  const outDir = path.join(DOCS, 'articles');
  fs.mkdirSync(outDir, { recursive: true });

  const files = fs.readdirSync(ARTICLES)
    .filter(f => f.endsWith('.md') && f !== 'index.md')
    .sort();

  const byName = new Map();
  for (const file of files) {
    const source = fs.readFileSync(path.join(ARTICLES, file), 'utf8');
    fs.writeFileSync(path.join(outDir, file), source, 'utf8');
    const name = file.replace(/\.md$/, '');
    const title = (source.match(/^title:\s*"?(.+?)"?\s*$/m) || [])[1] || name;
    byName.set(name, { text: title, link: '/articles/' + name });
  }

  /* Порядок внутри группы — читательский, а не алфавитный: сначала то,
     с чего начинают. Статья, которой нет ни в одной группе, попадает в
     «Разное» и печатается предупреждением — чтобы новую не потеряли. */
  const groups = [];
  for (const [title, names] of ARTICLE_GROUPS) {
    const items = names.map(n => byName.get(n)).filter(Boolean);
    names.filter(n => !byName.has(n)).forEach(n => missingArticles.push(n));
    items.forEach(item => byName.delete(item.link.replace('/articles/', '')));
    if (items.length) groups.push({ text: title, items });
  }
  const rest = [...byName.values()];
  if (rest.length) {
    groups.push({ text: 'Разное', items: rest });
    ungrouped.push(...rest.map(i => i.link.replace('/articles/', '')));
  }
  for (const group of groups) articleItems.push(...group.items);

  const listing = ['---', 'title: "Статьи"', '---', '', '# Статьи', '',
    '_Длинные разборы тем, которые карточками не закрыть: механика, а не факты._', ''];
  for (const group of groups) {
    listing.push('## ' + group.text, '');
    for (const item of group.items) {
      listing.push('- [' + item.text + '](.' + item.link.replace('/articles', '') + ')');
    }
    listing.push('');
  }
  fs.writeFileSync(path.join(outDir, 'index.md'), listing.join('\n'), 'utf8');

  if (groups.length) sidebar['/articles/'] = groups;
}

/* ── Главная ── */
const totalCards = DECKS.reduce((sum, d) => sum + d.cards.length, 0);
fs.writeFileSync(path.join(DOCS, 'index.md'), [
  '---',
  'layout: home',
  'hero:',
  '  name: Конспекты',
  '  text: Подготовка к собеседованию senior frontend',
  '  tagline: ' + totalCards + ' разобранных вопросов и ' + TASKS.length + ' задач. Поиск по всему материалу — сверху.',
  '  actions:',
  '    - theme: brand',
  '      text: Открыть тренажёр',
  '      link: ../',
  '    - theme: alt',
  '      text: Начать с JavaScript',
  '      link: /js/',
  'features:',
  ...DECKS.map(d => [
    '  - title: ' + quote(d.title),
    '    details: ' + quote(d.sub + ' Вопросов: ' + d.cards.length + '.'),
    '    link: /' + d.id + '/',
  ].join('\n')),
  ...(articleItems.length ? ['  - title: "Статьи"',
    '    details: ' + quote('Длинные разборы: как работает браузер, событийный цикл и рендеринг. Всего: ' + articleItems.length + '.'),
    '    link: /articles/'] : []),
  '  - title: "Лайвкодинг"',
  '    details: ' + quote('Задачи с подсказками и разбором решения. Всего: ' + TASKS.length + '.'),
  '    link: /code/',
  '---',
  '',
].join('\n'), 'utf8');

/* ── Оформление схем в статьях ── */
const themeDir = path.join(DOCS, '.vitepress', 'theme');
fs.mkdirSync(themeDir, { recursive: true });
fs.writeFileSync(path.join(themeDir, 'index.js'), `import DefaultTheme from 'vitepress/theme';
import './custom.css';
export default DefaultTheme;
`, 'utf8');
fs.writeFileSync(path.join(themeDir, 'custom.css'), `/* Схемы в статьях: рисуются инлайновым SVG и берут цвета темы,
   поэтому одинаково читаются в светлом и тёмном оформлении. */
.diagram {
  margin: 28px 0;
  padding: 20px 16px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
}
.diagram svg { display: block; width: 100%; height: auto; }
.diagram figcaption {
  margin-top: 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
  text-align: center;
}
`, 'utf8');

/* ── Конфиг VitePress ── */
const vpDir = path.join(DOCS, '.vitepress');
fs.mkdirSync(vpDir, { recursive: true });
fs.writeFileSync(path.join(vpDir, 'config.mjs'), `// Сгенерировано export-notes.js — правки вносить туда, а не сюда
import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Конспекты',
  description: 'Подготовка к собеседованию senior frontend',
  lang: 'ru-RU',
  base: '/front-prep/notes/',
  outDir: '../dist/notes',
  cleanUrls: true,
  // Ссылки вида ../../#/cards/js/js2 ведут в тренажёр, который живёт
  // на уровень выше сайта конспектов. Во время работы они корректны,
  // но проверяльщик ссылок VitePress не знает, что там лежит.
  ignoreDeadLinks: [/\\.\\.\\/\\.\\.\\//],
  lastUpdated: false,
  themeConfig: {
    // Разделы — выпадающим списком: десять пунктов с русскими названиями
    // в строку не влезают и ломают шапку на узких экранах
    nav: ${JSON.stringify([
      { text: 'Тренажёр', link: '../' },
      ...(articleItems.length ? [{ text: 'Статьи', link: '/articles/' }] : []),
      {
        text: 'Разделы',
        items: [
          ...DECKS.map(d => ({ text: d.title, link: '/' + d.id + '/' })),
          { text: 'Лайвкодинг', link: '/code/' },
        ],
      },
    ])},
    sidebar: ${JSON.stringify(sidebar, null, 2).replace(/\n/g, '\n    ')},
    search: { provider: 'local' },
    outline: { level: [2, 3], label: 'На странице' },
    docFooter: { prev: 'Предыдущий', next: 'Следующий' },
    darkModeSwitchLabel: 'Тема',
    returnToTopLabel: 'Наверх',
    sidebarMenuLabel: 'Разделы',
  },
});
`, 'utf8');

console.log('✓ notes-src/ обновлён: ' + pages + ' страниц вопросов, ' +
  TASKS.length + ' задач, ' + DECKS.length + ' разделов, ' +
  articleItems.length + ' статей');

// Группировка статей задаётся руками, поэтому о расхождениях говорим вслух
if (ungrouped.length) {
  console.log('  ! статьи без группы, ушли в «Разное»: ' + ungrouped.join(', '));
}
if (missingArticles.length) {
  console.log('  ! в группе указаны, но файлов нет: ' + missingArticles.join(', '));
}
