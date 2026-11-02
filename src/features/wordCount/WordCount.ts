const CHARACTER_SCRIPTS = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}";
const OTHER_LETTER = `(?:(?![${CHARACTER_SCRIPTS}])[\\p{L}\\p{N}]\\p{M}*)`;
const CHARACTER_OR_RUN_OF_LETTERS = new RegExp(
  `[${CHARACTER_SCRIPTS}]|${OTHER_LETTER}+(?:['’-]${OTHER_LETTER}+)*`,
  "gu",
);
const LINK_TARGET = /\]\([^)]*\)/g;
const LIST_MARK = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/gm;

/**
 * How many words a body holds, the way a writer of Chinese counts them: each
 * Chinese, Japanese or Korean character is one, each run of other letters or
 * digits is one, and punctuation, spaces and Markdown marks (list numbers,
 * task boxes and the targets of links and images included) are none.
 */
export class WordCount {
  readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static of(body: string): WordCount {
    const readable = body.replace(LINK_TARGET, "]").replace(LIST_MARK, "");
    return new WordCount(readable.match(CHARACTER_OR_RUN_OF_LETTERS)?.length ?? 0);
  }
}
