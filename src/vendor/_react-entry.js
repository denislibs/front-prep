// Точка входа для сборки React в браузерный бандл песочницы.
// Собирается development-сборкой намеренно: только в ней работает act(),
// на котором держатся тесты React-задач, и понятные предупреждения о хуках.
import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import * as ReactDOM from 'react-dom';
window.React = React;
window.ReactDOM = ReactDOMClient;      // createRoot
window.ReactDOMFull = ReactDOM;        // createPortal, flushSync
