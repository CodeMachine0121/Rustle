import { isolateHistory } from "@codemirror/commands";
import { Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

import type { CompositionState } from "../../shared/composition/CompositionState";
import { InlineEmphasis } from "./InlineEmphasis";

/**
 * Owns Mod-B (bold) and Mod-I (italic). While an input method is composing
 * the keys stay the input method's; in a read-only editor, or where the
 * emphasis has nothing to do, they are taken without changing anything.
 */
export class EmphasisShortcuts {
  readonly #composition: CompositionState;

  constructor(composition: CompositionState) {
    this.#composition = composition;
  }

  toggle(view: EditorView, emphasis: InlineEmphasis): boolean {
    if (this.#composition.isComposing || view.composing) {
      return false;
    }
    const edit = view.state.readOnly ? null : emphasis.toggle(view.state);
    if (edit !== null) {
      view.dispatch({
        ...edit,
        annotations: isolateHistory.of("full"),
        userEvent: "input.emphasis",
        scrollIntoView: true,
      });
    }
    return true;
  }

  extension(): Extension {
    return Prec.high(
      keymap.of([
        { key: "Mod-b", run: (view) => this.toggle(view, InlineEmphasis.bold) },
        { key: "Mod-i", run: (view) => this.toggle(view, InlineEmphasis.italic) },
      ]),
    );
  }
}
