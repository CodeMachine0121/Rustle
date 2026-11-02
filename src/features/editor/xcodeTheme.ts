import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const MONOSPACED_FONT = '"SF Mono", SFMono-Regular, Menlo, Monaco, "PingFang TC", monospace';

/**
 * Xcode's default Markdown colours. The values are the theme's
 * `--color-editor-*` tokens, so they change with the theme; text with no
 * syntax keeps the plain editor text colour.
 */
export const xcodeHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--color-editor-heading)", fontWeight: "bold" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--color-editor-link)" },
  { tag: tags.quote, color: "var(--color-editor-quote)" },
  { tag: tags.monospace, color: "var(--color-editor-code)" },
  {
    tag: [tags.processingInstruction, tags.contentSeparator, tags.labelName, tags.meta],
    color: "var(--color-editor-mark)",
  },
]);

const xcodeEditorTheme = EditorView.theme({
  "&": {
    color: "var(--color-editor-text)",
    backgroundColor: "var(--color-editor-background)",
  },
  ".cm-content": {
    fontFamily: MONOSPACED_FONT,
    caretColor: "var(--color-editor-text)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--color-editor-text)",
  },
  ".cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--color-selected)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--color-selected)",
  },
});

/** The writing area's monospaced Xcode look; nothing outside the editor changes. */
export function xcodeTheme() {
  return [xcodeEditorTheme, syntaxHighlighting(xcodeHighlightStyle)];
}
