import { markdownLanguage } from "@codemirror/lang-markdown";

const FIELD = /\{\{([^{}\n]*)\}\}/g;
const FIELD_BRACES = /\{\{|\}\}/;

/** A place to fill, in offsets from the start of the expanded text. */
export type SnippetField = { readonly from: number; readonly to: number };

/** What lands in the body: the template with every field emptied, and where those fields are. */
export type SnippetExpansionText = { readonly text: string; readonly fields: readonly SnippetField[] };

type Fields = Record<string, unknown>;

function fieldsOf(value: unknown): Fields | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Fields) : null;
}

/**
 * One shipped snippet: a name and a template whose `{{name}}` parts are the
 * fields. The names inside the braces are for whoever reads the file; they
 * never reach the body, so every field lands empty and each occurrence is a
 * field of its own.
 */
export class Snippet {
  readonly name: string;
  readonly expansion: SnippetExpansionText;
  /** Whether the text is a block, such as a heading or a table, that only means what it says at the start of a line. */
  readonly startsLine: boolean;

  private constructor(name: string, expansion: SnippetExpansionText) {
    this.name = name;
    this.expansion = expansion;
    this.startsLine = markdownLanguage.parser.parse(expansion.text).topNode.firstChild?.name !== "Paragraph";
  }

  /** `null` unless the file has a name and a template whose every `{{…}}` names a field on one line. */
  static parse(file: unknown): Snippet | null {
    const fields = fieldsOf(file);
    const name = fields?.name;
    const template = fields?.template;
    if (typeof name !== "string" || name.trim() === "" || typeof template !== "string") {
      return null;
    }
    let text = "";
    let copiedUpTo = 0;
    const snippetFields: SnippetField[] = [];
    for (const match of template.matchAll(FIELD)) {
      if ((match[1] ?? "").trim() === "") {
        return null;
      }
      text += template.slice(copiedUpTo, match.index);
      snippetFields.push({ from: text.length, to: text.length });
      copiedUpTo = match.index + match[0].length;
    }
    text += template.slice(copiedUpTo);
    if (FIELD_BRACES.test(text)) {
      return null;
    }
    return new Snippet(name.trim(), { text, fields: snippetFields });
  }

  /** Whether typing `query` after the slash keeps this snippet in the menu: a name prefix, any case. */
  matches(query: string): boolean {
    return this.name.toLowerCase().startsWith(query.toLowerCase());
  }
}
