import { selectParentSyntax } from "@codemirror/commands";
import { EditorSelection, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

import type { CompositionState } from "../../shared/composition/CompositionState";

/**
 * Owns Mod-W: grows the selection one Markdown structure at a time. With an
 * empty main cursor next to a word the word comes first (the same `wordAt`
 * bold and italic use); otherwise the editor's own syntax walk grows every
 * range, and past the outermost block the whole body is selected. Only the
 * selection moves, so read-only bodies grow too. While an input method is
 * composing the key stays the input method's.
 */
export class ExtendSelection {
  static readonly key = "Mod-w";

  readonly #composition: CompositionState;

  constructor(composition: CompositionState) {
    this.#composition = composition;
  }

  extend(view: EditorView): boolean {
    if (this.#composition.isComposing || view.composing) {
      return false;
    }
    const { state } = view;
    const { main } = state.selection;
    if (main.empty && state.wordAt(main.head) !== null) {
      view.dispatch({
        selection: EditorSelection.create(
          state.selection.ranges.map((range) => (range.empty ? (state.wordAt(range.head) ?? range) : range)),
          state.selection.mainIndex,
        ),
        userEvent: "select.extend",
        scrollIntoView: true,
      });
      return true;
    }
    if (selectParentSyntax(view)) {
      return true;
    }
    const body = state.doc.length;
    if (!main.empty && (main.from !== 0 || main.to !== body)) {
      view.dispatch({ selection: EditorSelection.single(0, body), userEvent: "select.extend" });
    }
    return true;
  }

  extension(): Extension {
    return Prec.high(keymap.of([{ key: ExtendSelection.key, run: (view) => this.extend(view) }]));
  }
}
