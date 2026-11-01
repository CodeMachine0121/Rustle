import hljs from "highlight.js/lib/common";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

import { SOURCE_LINE_ATTRIBUTE } from "./PreviewHtmlPolicy";

const TASK_MARKER = /^\[([ xX])\] /;

const markdown = new MarkdownIt({ html: true, linkify: false, typographer: false, breaks: false });

markdown.core.ruler.push("task_checkboxes", (state) => {
  state.tokens.forEach((token, index) => {
    const isListItemParagraph =
      token.type === "inline" &&
      state.tokens[index - 1]?.type === "paragraph_open" &&
      state.tokens[index - 2]?.type === "list_item_open";
    if (isListItemParagraph) {
      replaceTaskMarker(token, state.Token);
    }
  });
});

markdown.core.ruler.push("source_lines", (state) => {
  for (const token of state.tokens) {
    if (token.block && token.map !== null && token.nesting !== -1) {
      token.attrSet(SOURCE_LINE_ATTRIBUTE, String(token.map[0]));
    }
  }
});

markdown.renderer.rules.fence = (tokens, index, _options, _environment, renderer) => {
  const token = tokens[index];
  if (token === undefined) {
    return "";
  }
  const language = token.info.trim().split(/\s+/)[0] ?? "";
  const highlighted = language !== "" && hljs.getLanguage(language) !== undefined;
  const code = highlighted
    ? hljs.highlight(token.content, { language, ignoreIllegals: true }).value
    : markdown.utils.escapeHtml(token.content);
  const classes = [highlighted ? "hljs" : "", language === "" ? "" : `language-${language}`]
    .filter((name) => name !== "")
    .join(" ");
  const classAttribute = classes === "" ? "" : ` class="${markdown.utils.escapeHtml(classes)}"`;
  return `<pre${renderer.renderAttrs(token)}><code${classAttribute}>${code}</code></pre>\n`;
};

function replaceTaskMarker(inline: Token, TokenType: typeof Token): void {
  const marker = TASK_MARKER.exec(inline.content);
  const firstText = inline.children?.[0];
  if (marker === null || firstText?.type !== "text" || !TASK_MARKER.test(firstText.content)) {
    return;
  }
  const isChecked = marker[1] !== " ";
  firstText.content = firstText.content.slice(marker[0].length);
  const checkbox = new TokenType("html_inline", "", 0);
  checkbox.content = `<span class="task-checkbox" role="checkbox" aria-checked="${isChecked}" aria-disabled="true"></span>`;
  inline.children?.unshift(checkbox);
}

/** CommonMark plus tables, task lists, strikethrough and highlighted fenced code. Not sanitized. */
export function renderMarkdown(body: string): string {
  return markdown.render(body);
}
