/**
 * What the writer typed into a finder: one contiguous piece of text, any
 * case. Blank text means nothing was typed.
 */
export class FindingText {
  readonly #lowercase: string;

  constructor(typed: string) {
    this.#lowercase = typed.trim().toLowerCase();
  }

  get isBlank(): boolean {
    return this.#lowercase === "";
  }

  /** The text the backend searches with, surrounding blanks removed. */
  get searched(): string {
    return this.#lowercase;
  }

  matches(text: string): boolean {
    return text.toLowerCase().includes(this.#lowercase);
  }
}
