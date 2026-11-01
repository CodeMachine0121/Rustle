import { isolateHistory } from "@codemirror/commands";
import { Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

import type { CompositionState } from "../../shared/composition/CompositionState";
import { TableRow } from "./TableRow";

/**
 * Owns Enter at the end of a Markdown table row: it adds the next empty row.
 * On a row whose cells are all empty, Enter anywhere past its first pipe
 * clears the row to leave the table (an added row puts the cursor in its
 * first cell, so two presses leave).
 * Every other Enter stays the editor's own. It sits above the default Enter
 * and below anything that claims Enter at the highest precedence (a menu).
 */
export class TableRowContinuation {
  readonly #composition: CompositionState;

  constructor(composition: CompositionState) {
    this.#composition = composition;
  }

  continueRow(view: EditorView): boolean {
    const { state } = view;
    const cursor = state.selection.main;
    if (this.#composition.isComposing || state.readOnly || state.selection.ranges.length > 1 || !cursor.empty) {
      return false;
    }
    const line = state.doc.lineAt(cursor.head);
    const edit = TableRow.parse(line.text)?.enterAt(cursor.head - line.from) ?? null;
    if (edit === null) {
      return false;
    }
    view.dispatch({
      changes: { from: line.from + edit.from, to: line.from + edit.to, insert: edit.insert },
      selection: { anchor: line.from + edit.cursor },
      annotations: isolateHistory.of("full"),
      userEvent: "input",
      scrollIntoView: true,
    });
    return true;
  }

  extension(): Extension {
    return Prec.high(
      keymap.of([
        {
          any: (view, event) => {
            const isPlainEnter =
              event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
            return isPlainEnter && !this.#composition.ownsKey(event) && this.continueRow(view);
          },
        },
      ]),
    );
  }
}
