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

/** Asked in order before Tab indents and when Esc is pressed; the first claim that has work in progress takes the key. */
export const indentationKeyClaims = Facet.define<IndentationKeyClaim>();

/** True from anything in the editor that keeps an unclaimed Esc in the editor, so Tab always indents (Vim does). */
export const escapeRouteClosed = Facet.define<boolean, boolean>({
  combine: (values) => values.some((closed) => closed),
});

/**
 * Owns the Tab key of one editor: Tab indents and Shift+Tab outdents. Esc goes
 * to the claims first; an Esc none of them took opens the way out, unless
 * `escapeRouteClosed`: the very next key, if it is Tab or Shift+Tab within two
 * seconds, moves the focus instead of indenting. A mouse press in the editor
 * or the editor losing focus closes the way out again.
 */
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

  #claims(): readonly IndentationKeyClaim[] {
    return this.#view.state.facet(indentationKeyClaims);
  }

  readonly #handleKeyDown = (event: KeyboardEvent): void => {
    if (MODIFIER_KEYS.has(event.key)) {
      return;
    }
    const escapeArmed =
      this.#escapeArmedAt !== null && Date.now() - this.#escapeArmedAt <= ESCAPE_ROUTE_MILLISECONDS;
    this.#escapeArmedAt = null;
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    const composing = this.#composition.ownsKey(event);
    if (event.key === "Escape") {
      if (composing || event.shiftKey) {
        return;
      }
      if (this.#claims().some((claim) => claim.claimEscape(this.#view))) {
        event.preventDefault();
      } else if (!this.#view.state.facet(escapeRouteClosed)) {
        this.#escapeArmedAt = Date.now();
      }
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    event.stopPropagation();
    if (escapeArmed && !composing) {
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
