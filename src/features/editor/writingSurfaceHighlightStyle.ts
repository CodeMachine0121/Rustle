import { defaultHighlightStyle, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const markColour: unknown = defaultHighlightStyle.specs.find((spec) => spec.tag === tags.meta)?.color;

/**
 * Colours of the writing surface's Markdown, on top of the editor's default
 * style. Emphasis is carried by weight, not hue, with one exception: heading
 * text has its own colour, so a heading reads as one at a glance. A theme
 * sets `--color-editor-heading`; without it the heading falls back to the
 * surface's purple. The `#` of a heading is a mark, not heading text: marks
 * keep the quiet colour the default style gives them, restated after the
 * heading rule so it wins. Bold and italic are deliberately left uncoloured.
 */
export const writingSurfaceHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--color-editor-heading, var(--color-editor-heading-fallback))" },
  { tag: tags.processingInstruction, color: typeof markColour === "string" ? markColour : "inherit" },
]);
