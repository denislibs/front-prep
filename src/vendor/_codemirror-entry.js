// Точка входа для сборки CodeMirror. Помимо редактора экспортируется парсер
// и highlightTree — ими подсвечиваются статические блоки кода на карточках,
// без создания редактора на каждый фрагмент.
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { javascript, jsxLanguage } from '@codemirror/lang-javascript';
import { bracketMatching, indentUnit, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags, highlightTree, classHighlighter } from '@lezer/highlight';
export { EditorView, EditorState, keymap, lineNumbers, highlightActiveLine, defaultKeymap,
  indentWithTab, history, historyKeymap, javascript, jsxLanguage, bracketMatching, indentUnit,
  syntaxHighlighting, HighlightStyle, closeBrackets, closeBracketsKeymap,
  tags, highlightTree, classHighlighter };
