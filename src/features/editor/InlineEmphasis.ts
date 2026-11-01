import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import {
  EditorSelection,
  type ChangeSet,
  type ChangeSpec,
  type EditorState,
  type SelectionRange,
  type TransactionSpec,
} from "@codemirror/state";

type SyntaxTree = ReturnType<typeof syntaxTree>;
type SyntaxNode = ReturnType<SyntaxTree["resolveInner"]>;

const PARSE_TIMEOUT_MILLISECONDS = 50;

const CODE_NODES = new Set(["InlineCode", "FencedCode", "CodeBlock"]);
const ONLY_MARKS_OR_SPACE = /^[\s*_]*$/;

/**
 * Bold or italic as a toggle over the main selection: wraps the selected
 * words (or the word under the cursor) in asterisks, or unwraps an emphasis
 * the Markdown parser already sees there, in asterisks or underscores. An
 * empty cursor with no word next to it gets an empty pair to type into.
 */
export class InlineEmphasis {
  static readonly bold = new InlineEmphasis("**", "StrongEmphasis");
  static readonly italic = new InlineEmphasis("*", "Emphasis");

  readonly #marker: string;
  readonly #nodeName: string;

  private constructor(marker: string, nodeName: string) {
    this.#marker = marker;
    this.#nodeName = nodeName;
  }

  /** The edit toggling this emphasis makes, or `null` when the document must stay as it is. */
  toggle(state: EditorState): TransactionSpec | null {
    const range = state.selection.main;
    const tree = ensureSyntaxTree(state, range.to, PARSE_TIMEOUT_MILLISECONDS) ?? syntaxTree(state);
    if (state.doc.lineAt(range.from).number !== state.doc.lineAt(range.to).number || isInCode(tree, range)) {
      return null;
    }
    const target = range.empty ? (state.wordAt(range.head) ?? range) : range;
    if (target.empty) {
      return this.#withMainRange(state, {
        changes: { from: target.from, insert: this.#marker + this.#marker },
        selectionFor: () => EditorSelection.cursor(target.from + this.#marker.length),
      });
    }
    const text = state.sliceDoc(target.from, target.to);
    if (ONLY_MARKS_OR_SPACE.test(text)) {
      return null;
    }
    const from = target.from + (text.length - text.trimStart().length);
    const to = target.to - (text.length - text.trimEnd().length);
    // A cursor stays a cursor on the same letter; a selection keeps the words.
    const keepContent = (changes: ChangeSet) => {
      const contentFrom = changes.mapPos(from, 1);
      const contentTo = changes.mapPos(to, -1);
      if (!range.empty) {
        return EditorSelection.range(contentFrom, contentTo);
      }
      return EditorSelection.cursor(Math.min(Math.max(changes.mapPos(range.head, 1), contentFrom), contentTo));
    };
    const marks = this.#marksAround(state, tree, from, to);
    if (marks !== null) {
      return this.#withMainRange(state, { changes: marks, selectionFor: keepContent });
    }
    return this.#withMainRange(state, {
      changes: [
        { from, insert: this.#marker },
        { from: to, insert: this.#marker },
      ],
      selectionFor: keepContent,
    });
  }

  /**
   * The two mark runs of the emphasis whose content, or whole extent, is
   * exactly `from`–`to`, as deletions. The parser decides which marks open
   * and close. Underscores between letters are no emphasis to the parser,
   * yet a writer who typed `__重點__` meant bold, so an exact underscore run
   * on both sides counts too.
   */
  #marksAround(state: EditorState, tree: SyntaxTree, from: number, to: number): ChangeSpec[] | null {
    for (let node: SyntaxNode | null = tree.resolveInner(from, 1); node !== null; node = node.parent) {
      const opening = node.firstChild;
      const closing = node.lastChild;
      if (node.name !== this.#nodeName || opening === null || closing === null) {
        continue;
      }
      const isContent = opening.to === from && closing.from === to;
      const isWhole = node.from === from && node.to === to;
      if (isContent || isWhole) {
        return [
          { from: opening.from, to: opening.to },
          { from: closing.from, to: closing.to },
        ];
      }
    }
    const underscores = "_".repeat(this.#marker.length);
    const before = state.sliceDoc(from - underscores.length - 1, from);
    const after = state.sliceDoc(to, to + underscores.length + 1);
    const isOpened = before.endsWith(underscores) && !before.endsWith(`_${underscores}`);
    const isClosed = after.startsWith(underscores) && !after.startsWith(`${underscores}_`);
    if (isOpened && isClosed) {
      return [
        { from: from - underscores.length, to: from },
        { from: to, to: to + underscores.length },
      ];
    }
    return null;
  }

  #withMainRange(
    state: EditorState,
    edit: { changes: TransactionSpec["changes"]; selectionFor: (changes: ChangeSet) => SelectionRange },
  ): TransactionSpec {
    const changes = state.changes(edit.changes);
    const { ranges, mainIndex } = state.selection;
    return {
      changes,
      selection: EditorSelection.create(
        ranges.map((range, index) => (index === mainIndex ? edit.selectionFor(changes) : range.map(changes))),
        mainIndex,
      ),
    };
  }
}

function isInCode(tree: SyntaxTree, range: SelectionRange): boolean {
  return [tree.resolveInner(range.from, 1), tree.resolveInner(range.to, -1)].some((start) => {
    for (let node: SyntaxNode | null = start; node !== null; node = node.parent) {
      if (CODE_NODES.has(node.name)) {
        return true;
      }
    }
    return false;
  });
}
