import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";

import { TableRow } from "../editor/TableRow";

const CODE_NODES = new Set(["FencedCode", "CodeBlock"]);
const ONLY_BLANKS = /^[ \t]*$/;
const ENDS_WITH_BLANK = /\s$/;
const INDENTED_CODE_COLUMNS = 4;
const TAB_STOP = 4;

/**
 * Whether a half-width slash inserted at `position` of `state` (the document
 * before the slash) is a command that opens the snippet menu rather than
 * content: it starts the line or follows a blank, and it is not in code
 * (fenced, or indented as deep as Markdown's indented code) or a table row.
 */
export function slashOpensSnippetMenu(state: EditorState, position: number): boolean {
  const line = state.doc.lineAt(position);
  const textBefore = line.text.slice(0, position - line.from);
  if (textBefore !== "" && !ENDS_WITH_BLANK.test(textBefore)) {
    return false;
  }
  if (ONLY_BLANKS.test(textBefore) && columnsOf(textBefore) >= INDENTED_CODE_COLUMNS) {
    return false;
  }
  return TableRow.parse(line.text) === null && !isInCode(state, position);
}

function columnsOf(blanks: string): number {
  return [...blanks].reduce(
    (columns, character) => (character === "\t" ? columns + TAB_STOP - (columns % TAB_STOP) : columns + 1),
    0,
  );
}

function isInCode(state: EditorState, position: number): boolean {
  const tree = syntaxTree(state);
  return ([-1, 1] as const).some((side) => {
    for (let node = tree.resolveInner(position, side); ; node = node.parent) {
      if (CODE_NODES.has(node.name)) {
        return true;
      }
      if (node.parent === null) {
        return false;
      }
    }
  });
}
