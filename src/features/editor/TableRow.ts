const TABLE_ROW = /^([ \t>]*)(\|.*)$/;
const UNESCAPED_PIPE = /(?<!\\)\|/;
const EMPTY_CELL = "  |";

/** One line of a Markdown table: its leading indentation and quote markers, then cells between pipes. */
export class TableRow {
  readonly prefix: string;
  readonly #cells: readonly string[];
  readonly #hasClosedCell: boolean;

  private constructor(prefix: string, cells: readonly string[], hasClosedCell: boolean) {
    this.prefix = prefix;
    this.#cells = cells;
    this.#hasClosedCell = hasClosedCell;
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
    return new TableRow(prefix, cells, hasClosedCell);
  }

  /** Every cell is empty: the writer has finished the table. A lone pipe is a row being started, not a finished one. */
  get isBlank(): boolean {
    return this.#hasClosedCell && this.#cells.every((cell) => cell.trim() === "");
  }

  /** The empty row that follows this one: same prefix, same number of columns. */
  get nextRow(): string {
    return `${this.prefix}|${EMPTY_CELL.repeat(this.#cells.length)}`;
  }

  /** Where the cursor goes in `nextRow`: inside its first cell. */
  get firstCellOffset(): number {
    return this.prefix.length + 2;
  }
}
