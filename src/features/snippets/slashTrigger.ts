import { syntaxTree } from "@codemirror/language";
import type { EditorState, Transaction } from "@codemirror/state";

import { TableRow } from "../editor/TableRow";

const SLASH = "/";
const CODE_NODES = new Set(["FencedCode", "CodeBlock"]);
const ONLY_BLANKS = /^[ \t]*$/;
const ENDS_WITH_BLANK = /\s$/;
const INDENTED_CODE_COLUMNS = 4;
const TAB_STOP = 4;

/**
 * Where the slash is, when `transaction` is a half-width slash typed as a
 * command that opens the snippet menu rather than as content: typed (not
 * pasted), alone, at the line start or after a blank, and not in code
 * (fenced, or indented as deep as Markdown's indented code) or a table row.
 */
export function slashOpeningSnippetMenu(transaction: Transaction): number | null {
  if (!transaction.isUserEvent("input.type")) {
    return null;
  }
  const insertions: number[] = [];
  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    insertions.push(fromA === toA && inserted.toString() === SLASH ? fromA : -1);
  });
  const [position] = insertions;
  if (insertions.length !== 1 || position === undefined || position < 0) {
    return null;
  }
  return isCommandPosition(transaction.startState, position) ? position : null;
}

function isCommandPosition(state: EditorState, position: number): boolean {
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
