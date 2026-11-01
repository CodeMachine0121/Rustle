import { ensureSyntaxTree, language, syntaxTree } from "@codemirror/language";
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
const EMPHASIS_NODES = new Set(["Emphasis", "StrongEmphasis"]);
const ONLY_MARKS_OR_SPACE = /^[\s*_]*$/;
const NAME_CHARACTER = /^[_A-Za-z0-9]$/;

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
   * The two mark runs of the emphasis around exactly `from`–`to`, as
   * deletions. Underscores between letters are no emphasis to the parser,
   * yet a writer who typed `這是__重點__的地方` meant bold, so the line is read
   * once more with its underscores as asterisks, which the parser pairs
   * between letters too and so still keeps each run with its own partner.
   * Next to a Latin letter or digit an underscore stays part of a name such
   * as `my_var_name`.
   */
  #marksAround(state: EditorState, tree: SyntaxTree, from: number, to: number): ChangeSpec[] | null {
    const marks = this.#emphasisMarks(tree, from, to);
    if (marks !== null) {
      return marks;
    }
    const underscores = "_".repeat(this.#marker.length);
    const before = state.sliceDoc(from - underscores.length - 1, from);
    const after = state.sliceDoc(to, to + underscores.length + 1);
    const isOpened = before.endsWith(underscores) && !NAME_CHARACTER.test(before.slice(0, -underscores.length));
    const isClosed = after.startsWith(underscores) && !NAME_CHARACTER.test(after.slice(underscores.length));
    const parser = state.facet(language)?.parser;
    if (!isOpened || !isClosed || parser === undefined) {
      return null;
    }
    const line = state.doc.lineAt(from);
    const asAsterisks = parser.parse(line.text.replace(/_/g, "*"));
    return (
      this.#emphasisMarks(asAsterisks, from - line.from, to - line.from)?.map((mark) => ({
        from: mark.from + line.from,
        to: mark.to + line.from,
      })) ?? null
    );
  }

  /**
   * The two mark runs of the emphasis whose content, or whole extent, is
   * exactly `from`–`to`. Content wrapped in one more emphasis counts too:
   * `***重點***` is italic around bold. The parser decides which marks open
   * and close.
   */
  #emphasisMarks(tree: SyntaxTree, from: number, to: number): { from: number; to: number }[] | null {
    for (let node: SyntaxNode | null = tree.resolveInner(from, 1); node !== null; node = node.parent) {
      const opening = node.firstChild;
      const closing = node.lastChild;
      if (node.name !== this.#nodeName || opening === null || closing === null) {
        continue;
      }
      const inner = opening.nextSibling;
      const isContent = opening.to === from && closing.from === to;
      const isWhole = node.from === from && node.to === to;
      const isAroundOneEmphasis =
        inner !== null &&
        EMPHASIS_NODES.has(inner.name) &&
        inner.from === opening.to &&
        inner.to === closing.from &&
        inner.firstChild?.to === from &&
        inner.lastChild?.from === to;
      if (isContent || isWhole || isAroundOneEmphasis) {
        return [
          { from: opening.from, to: opening.to },
          { from: closing.from, to: closing.to },
        ];
      }
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
