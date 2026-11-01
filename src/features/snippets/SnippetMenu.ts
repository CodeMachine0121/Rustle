import { isolateHistory } from "@codemirror/commands";
import { EditorState, Prec, StateEffect, StateField, type Extension, type Transaction } from "@codemirror/state";
import { EditorView, keymap, showTooltip, type Tooltip, type TooltipView } from "@codemirror/view";

import type { CompositionState } from "../../shared/composition/CompositionState";
import type { Snippet } from "./Snippet";
import type { SnippetCatalog } from "./SnippetCatalog";
import type { SnippetFields } from "./SnippetFields";
import { slashOpeningSnippetMenu } from "./slashTrigger";

const SLASH = "/";

let menusCreated = 0;

type OpenMenu = {
  readonly slashAt: number;
  readonly query: string;
  readonly matches: readonly Snippet[];
  readonly highlighted: number;
};

const openMenu = StateEffect.define<number>();
const closeMenu = StateEffect.define<null>();
const highlightRow = StateEffect.define<number>();

/**
 * The slash menu: a half-width slash typed where a command may start opens it
 * under the cursor; the text typed after the slash filters it by name prefix.
 * It never opens while an input method composes, and a composition closes it.
 * Arrows move the highlighted row, Enter or a click lands the snippet in place
 * of the slash and the filter text, as one undo step. Tab is never the menu's.
 * The editor keeps the keyboard and points assistive technology at the
 * highlighted row.
 */
export class SnippetMenu {
  readonly #composition: CompositionState;
  readonly #catalog: SnippetCatalog;
  readonly #fields: SnippetFields;
  readonly #label: () => string;
  readonly #menu: StateField<OpenMenu | null>;
  readonly #listId = `snippet-menu-${(menusCreated += 1)}`;

  constructor(composition: CompositionState, catalog: SnippetCatalog, fields: SnippetFields, label: () => string) {
    this.#composition = composition;
    this.#catalog = catalog;
    this.#fields = fields;
    this.#label = label;
    this.#menu = this.#defineMenu();
  }

  close(view: EditorView): boolean {
    if (this.#currentMenu(view) === null) {
      return false;
    }
    view.dispatch({ effects: closeMenu.of(null) });
    return true;
  }

  extension(): Extension {
    return [
      this.#menu,
      EditorState.transactionExtender.of((transaction) => {
        const slashAt = slashOpeningSnippetMenu(transaction);
        return slashAt === null ? null : { effects: openMenu.of(slashAt) };
      }),
      Prec.highest(
        keymap.of([
          {
            any: (view, event) => {
              if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || this.#composition.ownsKey(event)) {
                return false;
              }
              return this.#handleKey(view, event.key);
            },
          },
        ]),
      ),
    ];
  }

  #handleKey(view: EditorView, key: string): boolean {
    const menu = this.#currentMenu(view);
    if (menu === null || view.composing) {
      return false;
    }
    switch (key) {
      case "ArrowDown":
        view.dispatch({ effects: highlightRow.of(menu.highlighted + 1) });
        return true;
      case "ArrowUp":
        view.dispatch({ effects: highlightRow.of(menu.highlighted - 1) });
        return true;
      case "Enter":
        this.#expandRow(view, menu.highlighted);
        return true;
      default:
        return false;
    }
  }

  /**
   * Replaces the slash and the filter text with the snippet on `row`, the
   * cursor on its first field. A block snippet typed after other text on the
   * line starts a line of its own, so it still lands as a heading or a table.
   */
  #expandRow(view: EditorView, row: number): void {
    const menu = this.#currentMenu(view);
    const snippet = menu?.matches[row];
    if (menu === null || snippet === undefined) {
      return;
    }
    const { text, fields } = snippet.expansion;
    const line = view.state.doc.lineAt(menu.slashAt);
    const textBefore = line.text.slice(0, menu.slashAt - line.from);
    const breaksLine = snippet.startsLine && textBefore.trim() !== "";
    const from = breaksLine ? line.from + textBefore.trimEnd().length : menu.slashAt;
    const at = breaksLine ? from + 1 : from;
    const cursor = at + (fields[0]?.from ?? text.length);
    view.dispatch({
      changes: { from, to: view.state.selection.main.head, insert: breaksLine ? `\n${text}` : text },
      selection: { anchor: cursor },
      effects: [closeMenu.of(null), ...(fields.length > 0 ? [this.#fields.start(at, snippet.expansion)] : [])],
      annotations: isolateHistory.of("full"),
      userEvent: "input.snippet",
      scrollIntoView: true,
    });
  }

  #defineMenu(): StateField<OpenMenu | null> {
    const tooltipView = (view: EditorView) => this.#createTooltipView(view);
    return StateField.define<OpenMenu | null>({
      create: () => null,
      update: (menu, transaction) => this.#nextMenu(menu, transaction),
      provide: (field) => [
        showTooltip.from(field, (menu): Tooltip | null =>
          menu === null ? null : { pos: menu.slashAt, above: false, create: tooltipView },
        ),
        EditorView.contentAttributes.from(field, (menu): Record<string, string> =>
          menu === null
            ? {}
            : { "aria-controls": this.#listId, "aria-activedescendant": this.#rowId(menu.highlighted) },
        ),
      ],
    });
  }

  #nextMenu(menu: OpenMenu | null, transaction: Transaction): OpenMenu | null {
    let slashAt = menu === null ? null : transaction.changes.mapPos(menu.slashAt, 1);
    let highlighted = menu?.highlighted ?? 0;
    for (const effect of transaction.effects) {
      if (effect.is(openMenu)) {
        slashAt = transaction.changes.mapPos(effect.value, -1);
      } else if (effect.is(closeMenu)) {
        return null;
      } else if (effect.is(highlightRow)) {
        highlighted = effect.value;
      }
    }
    if (slashAt === null || transaction.isUserEvent("input.type.compose") || this.#composition.isComposing) {
      return null;
    }
    const doc = transaction.newDoc;
    const cursor = transaction.newSelection.main;
    if (!cursor.empty || cursor.head <= slashAt || doc.sliceString(slashAt, slashAt + 1) !== SLASH) {
      return null;
    }
    const query = doc.sliceString(slashAt + 1, cursor.head);
    const matches = this.#catalog.matching(query);
    if (matches.length === 0) {
      return null;
    }
    const keepsHighlight = menu !== null && menu.query === query;
    const lastRow = matches.length - 1;
    return { slashAt, query, matches, highlighted: keepsHighlight ? Math.max(0, Math.min(highlighted, lastRow)) : 0 };
  }

  #createTooltipView(view: EditorView): TooltipView {
    const list = document.createElement("ul");
    list.id = this.#listId;
    list.className = "snippet-menu";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", this.#label());
    list.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const row = event.target instanceof Element ? event.target.closest("[data-snippet-row]") : null;
      this.#expandRow(view, Number(row?.getAttribute("data-snippet-row")));
    });
    const render = (menu: OpenMenu | null) => {
      list.replaceChildren(
        ...(menu?.matches ?? []).map((snippet, index) => {
          const row = document.createElement("li");
          row.id = this.#rowId(index);
          row.className = "snippet-menu-row";
          row.setAttribute("role", "option");
          row.setAttribute("aria-selected", String(index === menu?.highlighted));
          row.setAttribute("data-snippet-row", String(index));
          row.textContent = snippet.name;
          return row;
        }),
      );
    };
    render(this.#currentMenu(view));
    return { dom: list, update: (update) => render(update.state.field(this.#menu, false) ?? null) };
  }

  #rowId(index: number): string {
    return `${this.#listId}-row-${index}`;
  }

  #currentMenu(view: EditorView): OpenMenu | null {
    return view.state.field(this.#menu, false) ?? null;
  }
}
