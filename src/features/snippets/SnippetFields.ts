import { EditorSelection, StateEffect, StateField, type ChangeSet, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";

import type { CompositionState } from "../../shared/composition/CompositionState";
import type { SnippetExpansionText } from "./Snippet";

type DocumentRange = { readonly from: number; readonly to: number };

/** The one group of fields a snippet left to fill, in document positions. */
class WaitingFields {
  readonly fields: readonly DocumentRange[];
  readonly active: number;
  readonly span: DocumentRange;

  constructor(fields: readonly DocumentRange[], active: number, span: DocumentRange) {
    this.fields = fields;
    this.active = active;
    this.span = span;
  }

  /**
   * Text typed into a field grows that field. The span keeps every character
   * of the snippet and reaches past its last character only as far as a
   * field grew there, so text typed after the snippet stays outside it.
   */
  map(changes: ChangeSet): WaitingFields {
    const fields = this.fields.map((field) => ({ from: changes.mapPos(field.from, -1), to: changes.mapPos(field.to, 1) }));
    const end = Math.max(changes.mapPos(this.span.to, -1), ...fields.map((field) => field.to));
    return new WaitingFields(fields, this.active, { from: changes.mapPos(this.span.from, -1), to: end });
  }

  /** A field never grows across a line break: one typed or pasted into the snippet ends the group. */
  isBrokenBy(changes: ChangeSet): boolean {
    let isBroken = false;
    changes.iterChanges((from, to, _insertedFrom, _insertedTo, inserted) => {
      if (inserted.lines > 1 && from <= this.span.to && to >= this.span.from) {
        isBroken = true;
      }
    });
    return isBroken;
  }

  activate(index: number): WaitingFields {
    return new WaitingFields(this.fields, index, this.span);
  }

  contains(position: number): boolean {
    return position >= this.span.from && position <= this.span.to;
  }
}

const startFields = StateEffect.define<WaitingFields>();
const activateField = StateEffect.define<number>();
const endFields = StateEffect.define<null>();

const waitingFields = StateField.define<WaitingFields | null>({
  create: () => null,
  update(value, transaction) {
    let next = value === null || value.isBrokenBy(transaction.changes) ? null : value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(startFields)) {
        next = effect.value;
      } else if (effect.is(endFields)) {
        next = null;
      } else if (effect.is(activateField)) {
        next = next?.activate(effect.value) ?? null;
      }
    }
    if (transaction.isUserEvent("undo") || transaction.isUserEvent("redo")) {
      return null;
    }
    return next !== null && next.contains(transaction.newSelection.main.head) ? next : null;
  },
});

class FieldMarker extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = "snippet-field-marker";
    marker.setAttribute("aria-hidden", "true");
    return marker;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

const FIELD_MARKER = Decoration.widget({ widget: new FieldMarker(), side: 1 });

function markersOf(state: EditorState): DecorationSet {
  const fields = state.field(waitingFields, false)?.fields ?? [];
  return Decoration.set(fields.filter((field) => field.from === field.to).map((field) => FIELD_MARKER.range(field.from)));
}

/**
 * The fields a snippet leaves behind: at most one group waits at a time. A
 * group ends when the cursor leaves the snippet, when a line break is typed
 * into it, on undo or redo, when another snippet lands, or when asked. Every empty field shows a thin marker; while
 * an input method composes, the markers are only carried along with the text,
 * never redrawn next to the cursor.
 */
export class SnippetFields {
  readonly #composition: CompositionState;

  constructor(composition: CompositionState) {
    this.#composition = composition;
  }

  /** The effect that makes these fields (offsets from `at`) the waiting group, cursor on the first. */
  start(at: number, expansion: SnippetExpansionText): StateEffect<WaitingFields> {
    const fields = expansion.fields.map((field) => ({ from: at + field.from, to: at + field.to }));
    return startFields.of(new WaitingFields(fields, 0, { from: at, to: at + expansion.text.length }));
  }

  /**
   * Selects the next (or previous) field. Past the last field the group ends
   * with the cursor at the end of the snippet; before the first, nothing moves.
   */
  move(view: EditorView, backward: boolean): boolean {
    const group = view.state.field(waitingFields, false);
    if (group == null) {
      return false;
    }
    const index = group.active + (backward ? -1 : 1);
    const field = group.fields[index];
    if (index >= group.fields.length || field === undefined) {
      if (!backward) {
        view.dispatch({ selection: { anchor: group.span.to }, effects: endFields.of(null), scrollIntoView: true });
      }
      return true;
    }
    view.dispatch({
      selection: EditorSelection.single(field.from, field.to),
      effects: activateField.of(index),
      scrollIntoView: true,
    });
    return true;
  }

  end(view: EditorView): boolean {
    if (view.state.field(waitingFields, false) == null) {
      return false;
    }
    view.dispatch({ effects: endFields.of(null) });
    return true;
  }

  extension(): Extension {
    const composition = this.#composition;
    return [
      waitingFields,
      ViewPlugin.fromClass(
        class {
          markers: DecorationSet;
          #isDestroyed = false;
          readonly #unsubscribe: () => void;

          constructor(view: EditorView) {
            this.markers = markersOf(view.state);
            this.#unsubscribe = composition.subscribe((isComposing) => {
              if (!isComposing) {
                setTimeout(() => this.#redrawAfterComposition(view));
              }
            });
          }

          #redrawAfterComposition(view: EditorView): void {
            if (!this.#isDestroyed && !view.composing && view.state.field(waitingFields, false) != null) {
              view.dispatch({});
            }
          }

          update(update: ViewUpdate): void {
            const isComposing = update.view.composing || composition.isComposing;
            this.markers = isComposing ? this.markers.map(update.changes) : markersOf(update.state);
          }

          destroy(): void {
            this.#isDestroyed = true;
            this.#unsubscribe();
          }
        },
        { decorations: (plugin) => plugin.markers },
      ),
    ];
  }
}
