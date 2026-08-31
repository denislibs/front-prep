import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { bracketMatching, indentUnit, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
export { EditorView, EditorState, keymap, lineNumbers, highlightActiveLine, defaultKeymap,
  indentWithTab, history, historyKeymap, javascript, bracketMatching, indentUnit,
  syntaxHighlighting, HighlightStyle, closeBrackets, closeBracketsKeymap, tags };
