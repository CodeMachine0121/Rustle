import type { Extension } from "@codemirror/state";

import type { CompositionState } from "../../shared/composition/CompositionState";
import { indentationKeyClaims } from "../editor/TabIndentation";
import type { SnippetCatalog } from "./SnippetCatalog";
import { SnippetFields } from "./SnippetFields";
import { SnippetMenu } from "./SnippetMenu";

/**
 * Snippets in one editor: the slash menu and the fields a snippet leaves.
 * Tab moves between waiting fields and is indentation otherwise. Esc closes
 * the menu first, then ends the waiting fields; when neither is there the
 * key is left to whatever comes next.
 */
export class SnippetExpansion {
  readonly #fields: SnippetFields;
  readonly #menu: SnippetMenu;

  /** `menuLabel` names the menu each time it opens, so it follows the interface language. */
  constructor(composition: CompositionState, catalog: SnippetCatalog, menuLabel: () => string) {
    this.#fields = new SnippetFields(composition);
    this.#menu = new SnippetMenu(composition, catalog, this.#fields, menuLabel);
  }

  extension(): Extension {
    return [
      this.#menu.extension(),
      this.#fields.extension(),
      indentationKeyClaims.of({
        claimTab: (view, backward) => this.#fields.move(view, backward),
        claimEscape: (view) => this.#menu.close(view) || this.#fields.end(view),
      }),
    ];
  }
}
