const TABLE_ROW = /^([ \t>]*)(\|.*)$/;
const UNESCAPED_PIPE = /(?<!\\)\|/;
const EMPTY_CELL = "  |";

/** A change to the row's line, in offsets from the line start, and where the cursor ends up. */
export type TableRowEdit = { from: number; to: number; insert: string; cursor: number };

/** One line of a Markdown table: its leading indentation and quote markers, then cells between pipes. */
export class TableRow {
  readonly #prefix: string;
  readonly #cells: readonly string[];
  readonly #hasClosedCell: boolean;
  readonly #length: number;

  private constructor(prefix: string, cells: readonly string[], hasClosedCell: boolean, length: number) {
    this.#prefix = prefix;
    this.#cells = cells;
    this.#hasClosedCell = hasClosedCell;
    this.#length = length;
  }

  /** The row on this line, or `null` when the first character after indentation and `>` is not a pipe. */
  static parse(lineText: string): TableRow | null {
    const match = TABLE_ROW.exec(lineText);
    if (match === null) {
      return null;
    }
    const [, prefix = "", row = ""] = match;
    const segments = row.slice(1).split(UNESCAPED_PIPE);
    const hasClosedCell = segments.length > 1;
    const cells = hasClosedCell && segments.at(-1)?.trim() === "" ? segments.slice(0, -1) : segments;
    return new TableRow(prefix, cells, hasClosedCell, lineText.length);
  }

  /**
   * What Enter does with the cursor at `column`, given the line below the row
   * (`null` at the end of the document): at the end of the row it adds the
   * next empty row (same prefix and columns, cursor in its first cell).
   * On the table's last row, when it is finished — every cell empty; a lone
   * pipe is a row being started — anywhere after the first pipe it clears the
   * row down to its prefix. An empty row with rows below it stays in the table.
   * Anywhere else it is not the table's Enter: `null`.
   */
  enterAt(column: number, lineBelow: string | null): TableRowEdit | null {
    const isBlank = this.#hasClosedCell && this.#cells.every((cell) => cell.trim() === "");
    const isLastRow = lineBelow === null || TableRow.parse(lineBelow) === null;
    if (isBlank && isLastRow && column > this.#prefix.length) {
      return { from: 0, to: this.#length, insert: this.#prefix, cursor: this.#prefix.length };
    }
    if (column !== this.#length) {
      return null;
    }
    const nextRow = `${this.#prefix}|${EMPTY_CELL.repeat(this.#cells.length)}`;
    const firstCell = this.#length + 1 + this.#prefix.length + "| ".length;
    return { from: this.#length, to: this.#length, insert: `\n${nextRow}`, cursor: firstCell };
  }
}
