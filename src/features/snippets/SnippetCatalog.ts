import { Snippet } from "./Snippet";

/**
 * The snippets the slash menu offers, in the order of their file names. A
 * file that is not a usable snippet is left out, as is a second snippet whose
 * name is taken (in any case).
 */
export class SnippetCatalog {
  readonly snippets: readonly Snippet[];

  constructor(files: Readonly<Record<string, unknown>>) {
    const snippets: Snippet[] = [];
    Object.keys(files)
      .sort()
      .forEach((fileName) => {
        const snippet = Snippet.parse(files[fileName]);
        if (snippet !== null && !snippets.some((taken) => taken.name.toLowerCase() === snippet.name.toLowerCase())) {
          snippets.push(snippet);
        }
      });
    this.snippets = snippets;
  }

  /** Every snippet file shipped in `snippets/`; a new snippet is one more file there. */
  static shipped(): SnippetCatalog {
    return new SnippetCatalog(import.meta.glob("./snippets/*.json", { eager: true, import: "default" }));
  }

  matching(query: string): readonly Snippet[] {
    return this.snippets.filter((snippet) => snippet.matches(query));
  }
}
