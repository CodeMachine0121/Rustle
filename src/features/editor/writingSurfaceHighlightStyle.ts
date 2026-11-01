import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * Colours of the writing surface's Markdown. Emphasis is carried by weight,
 * not hue, with one exception: heading text has its own colour, so a heading
 * reads as one at a glance. A theme sets `--color-editor-heading`; without it
 * the heading falls back to the surface's purple. Marks (`#`, `*`, `>`) are
 * quiet. Bold and italic are deliberately left the body's colour.
 */
export const writingSurfaceHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--color-editor-heading, var(--color-editor-heading-fallback))" },
  { tag: tags.processingInstruction, color: "var(--color-muted-text)" },
]);
