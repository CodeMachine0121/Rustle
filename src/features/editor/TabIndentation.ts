import { isolateHistory } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import {
  EditorSelection,
  EditorState,
  Facet,
  type ChangeSpec,
  type Extension,
  type Line,
} from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

import type { CompositionState } from "../../shared/composition/CompositionState";
import type { IndentUnit } from "./IndentUnit";

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);
const ESCAPE_ROUTE_MILLISECONDS = 2000;

/** Something in the editor that, while it has work in progress, takes Tab or Esc before indentation does. */
export type IndentationKeyClaim = {
  claimTab(view: EditorView, backward: boolean): boolean;
  claimEscape(view: EditorView): boolean;
};

/** Asked in order before Tab indents and before Esc arms the way out; none claiming leaves both as they were. */
export const indentationKeyClaims = Facet.define<IndentationKeyClaim>();

/** Owns the Tab key of one editor: Tab indents, Shift+Tab outdents, Esc then Tab (within two seconds) lets focus leave. */
export class TabIndentation {
  readonly #composition: CompositionState;
  readonly #unit: IndentUnit;

  constructor(composition: CompositionState, unit: IndentUnit) {
    this.#composition = composition;
    this.#unit = unit;
  }

  indent(view: EditorView): boolean {
    return this.#rewriteCoveredLines(view, (line) => {
      return { from: line.from, insert: this.#unit.text };
    });
  }

  outdent(view: EditorView): boolean {
    return this.#rewriteCoveredLines(view, (line) => {
      const leadingWhitespace = line.text.slice(0, line.text.search(/[^ \t]|$/));
      const outdented = this.#unit.outdent(leadingWhitespace);
      if (outdented === null) {
        return null;
      }
      return { from: line.from, to: line.from + leadingWhitespace.length, insert: outdented };
    });
  }

  extension(): Extension {
    return [
      EditorState.tabSize.of(this.#unit.width),
      indentUnit.of(this.#unit.text),
      ViewPlugin.define((view) => new TabKeyListener(view, this, this.#composition)),
    ];
  }

  #rewriteCoveredLines(view: EditorView, rewrite: (line: Line) => ChangeSpec | null): boolean {
    const { state } = view;
    if (this.#composition.isComposing || state.readOnly) {
      return false;
    }
    const lineChanges = this.#coveredLines(state).flatMap((line) => rewrite(line) ?? []);
    if (lineChanges.length === 0) {
      return false;
    }
    const changes = state.changes(lineChanges);
    const selection = EditorSelection.create(
      state.selection.ranges.map((range) =>
        EditorSelection.range(changes.mapPos(range.anchor, 1), changes.mapPos(range.head, 1)),
      ),
      state.selection.mainIndex,
    );
    view.dispatch({
      changes,
      selection,
      annotations: isolateHistory.of("full"),
      userEvent: "input.indent",
    });
    return true;
  }

  #coveredLines(state: EditorState): Line[] {
    const lineNumbers = new Set<number>();
    for (const range of state.selection.ranges) {
      const first = state.doc.lineAt(range.from).number;
      const endLine = state.doc.lineAt(range.to);
      const last = !range.empty && range.to === endLine.from ? endLine.number - 1 : endLine.number;
      for (let number = first; number <= last; number += 1) {
        lineNumbers.add(number);
      }
    }
    return [...lineNumbers].sort((left, right) => left - right).map((number) => state.doc.line(number));
  }
}

class TabKeyListener {
  readonly #view: EditorView;
  readonly #indentation: TabIndentation;
  readonly #composition: CompositionState;
  #escapeArmedAt: number | null = null;

  constructor(view: EditorView, indentation: TabIndentation, composition: CompositionState) {
    this.#view = view;
    this.#indentation = indentation;
    this.#composition = composition;
    view.dom.addEventListener("keydown", this.#handleKeyDown, { capture: true });
    view.dom.addEventListener("mousedown", this.#disarmEscape, { capture: true });
    view.dom.addEventListener("focusout", this.#disarmEscape, { capture: true });
  }

  destroy(): void {
    this.#view.dom.removeEventListener("keydown", this.#handleKeyDown, { capture: true });
    this.#view.dom.removeEventListener("mousedown", this.#disarmEscape, { capture: true });
    this.#view.dom.removeEventListener("focusout", this.#disarmEscape, { capture: true });
  }

  readonly #disarmEscape = (): void => {
    this.#escapeArmedAt = null;
  };

  #isEscapeArmed(): boolean {
    return this.#escapeArmedAt !== null && Date.now() - this.#escapeArmedAt <= ESCAPE_ROUTE_MILLISECONDS;
  }

  #claims(): readonly IndentationKeyClaim[] {
    return this.#view.state.facet(indentationKeyClaims);
  }

  #escapeClaimed(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return false;
    }
    const claimed = this.#claims().some((claim) => claim.claimEscape(this.#view));
    if (claimed) {
      event.preventDefault();
    }
    return claimed;
  }

  readonly #handleKeyDown = (event: KeyboardEvent): void => {
    const composing = this.#composition.ownsKey(event);
    if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey) {
      if (!MODIFIER_KEYS.has(event.key)) {
        const arms = event.key === "Escape" && !composing && !this.#escapeClaimed(event);
        this.#escapeArmedAt = arms ? Date.now() : null;
      }
      return;
    }
    event.stopPropagation();
    if (this.#isEscapeArmed() && !composing) {
      this.#escapeArmedAt = null;
      return;
    }
    event.preventDefault();
    if (composing || this.#claims().some((claim) => claim.claimTab(this.#view, event.shiftKey))) {
      return;
    }
    if (event.shiftKey) {
      this.#indentation.outdent(this.#view);
    } else {
      this.#indentation.indent(this.#view);
    }
  };
}
