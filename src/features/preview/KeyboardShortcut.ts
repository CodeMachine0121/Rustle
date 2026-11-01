export type ShortcutKeyEvent = Pick<
  KeyboardEvent,
  "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "code"
>;

const MODIFIERS = ["mod", "shift", "alt"];
const LETTER_OR_DIGIT = /^[a-z0-9]$/i;

/**
 * A key combination such as `Mod+Shift+P`: `Mod` (required, Cmd or Ctrl;
 * also written `Cmd`), optionally `Shift` and `Alt`, and one letter or digit.
 */
export class KeyboardShortcut {
  static readonly DEFAULT = new KeyboardShortcut(true, false, "P");

  readonly #withShift: boolean;
  readonly #withAlt: boolean;
  readonly #key: string;
  readonly #code: string;

  private constructor(withShift: boolean, withAlt: boolean, key: string) {
    this.#withShift = withShift;
    this.#withAlt = withAlt;
    this.#key = key.toUpperCase();
    this.#code = /\d/.test(key) ? `Digit${key}` : `Key${this.#key}`;
  }

  static parse(text: string): KeyboardShortcut | null {
    const parts = text.split("+").map((part) => part.trim());
    const key = parts.pop() ?? "";
    const modifiers = new Set(parts.map((part) => part.toLowerCase().replace(/^cmd$/, "mod")));
    const isUsable =
      LETTER_OR_DIGIT.test(key) &&
      modifiers.size === parts.length &&
      modifiers.has("mod") &&
      [...modifiers].every((modifier) => MODIFIERS.includes(modifier));
    return isUsable ? new KeyboardShortcut(modifiers.has("shift"), modifiers.has("alt"), key) : null;
  }

  /** The written shortcut, or the default when there is none or it cannot be understood. */
  static fromSetting(text: string | undefined): KeyboardShortcut {
    return (text === undefined ? null : KeyboardShortcut.parse(text)) ?? KeyboardShortcut.DEFAULT;
  }

  /** The shortcut as a Mac menu writes it, in key-cap words: Option, then Shift, then Cmd. */
  get label(): string {
    const option = this.#withAlt ? "Option+" : "";
    const shift = this.#withShift ? "Shift+" : "";
    return `${option}${shift}Cmd+${this.#key}`;
  }

  // The physical key, because with Alt on macOS `key` turns into a symbol.
  matches(event: ShortcutKeyEvent): boolean {
    return (
      (event.metaKey || event.ctrlKey) &&
      event.shiftKey === this.#withShift &&
      event.altKey === this.#withAlt &&
      event.code === this.#code
    );
  }
}
