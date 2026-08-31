# Библиотеки

Собранные бандлы, встраиваемые в `app.html`. Пересобирать нужно только при обновлении версий.

| Файл | Что это | Как собран |
|---|---|---|
| `codemirror.js` | редактор кода на странице | из `_codemirror-entry.js` |
| `react-bundle.js` | React для песочницы React-задач | из `_react-entry.js` |
| `sucrase.js` | транспайлер JSX | `export { transform } from 'sucrase'` |

Команда сборки (нужны `esbuild` и соответствующие пакеты):

```bash
esbuild src/vendor/_react-entry.js --bundle --format=iife --platform=browser \
  --define:process.env.NODE_ENV='"development"' --outfile=src/vendor/react-bundle.js
```

React намеренно собирается **development-сборкой**: только в ней работает `act()`, на котором держатся тесты React-задач, и только она даёт понятные предупреждения о нарушении правил хуков. Это стоит примерно мегабайта веса и того стоит.
