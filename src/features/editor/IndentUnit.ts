export type IndentationSettings = {
  style: "spaces" | "tab";
  width: number;
};

const DEFAULT_SETTINGS: IndentationSettings = { style: "spaces", width: 2 };
const MINIMUM_WIDTH = 1;
const MAXIMUM_WIDTH = 8;

/** One level of indentation, normalised from whatever settings the caller passed. */
export class IndentUnit {
  readonly style: IndentationSettings["style"];
  readonly width: number;

  private constructor({ style, width }: IndentationSettings) {
    this.style = style;
    this.width = width;
  }

  static from(settings: IndentationSettings = DEFAULT_SETTINGS): IndentUnit {
    const style = settings.style === "tab" ? "tab" : "spaces";
    const widthIsSensible =
      Number.isInteger(settings.width) &&
      settings.width >= MINIMUM_WIDTH &&
      settings.width <= MAXIMUM_WIDTH;
    return new IndentUnit({ style, width: widthIsSensible ? settings.width : DEFAULT_SETTINGS.width });
  }

  get text(): string {
    return this.#render(this.width);
  }

  indent(leadingWhitespace: string): string {
    return leadingWhitespace + this.text;
  }

  /** The leading whitespace one level out, or `null` when the line is already at the outermost level. */
  outdent(leadingWhitespace: string): string | null {
    const columns = this.#columnsOf(leadingWhitespace);
    if (columns === 0) {
      return null;
    }
    const levelBelow = Math.floor((columns - 1) / this.width);
    return this.#render(levelBelow * this.width);
  }

  #columnsOf(leadingWhitespace: string): number {
    let columns = 0;
    for (const character of leadingWhitespace) {
      columns = character === "\t" ? (Math.floor(columns / this.width) + 1) * this.width : columns + 1;
    }
    return columns;
  }

  #render(columns: number): string {
    return this.style === "tab" ? "\t".repeat(columns / this.width) : " ".repeat(columns);
  }
}
