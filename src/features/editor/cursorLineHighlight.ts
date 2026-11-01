import { RangeSetBuilder, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

const cursorLine = Decoration.line({ class: "cm-cursorLine" });

/**
 * The background that says "the cursor is on this line". It answers where
 * the cursor is, so it steps aside while any text is selected: the selection
 * answers that already, and the background would hide it.
 */
export function cursorLineHighlight(): Extension {
  return EditorView.decorations.compute(["doc", "selection"], cursorLineDecorations);
}

function cursorLineDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { ranges } = state.selection;
  if (ranges.some((range) => !range.empty)) {
    return builder.finish();
  }
  const lineStarts = new Set(ranges.map((range) => state.doc.lineAt(range.head).from));
  lineStarts.forEach((from) => builder.add(from, from, cursorLine));
  return builder.finish();
}
