import { describe, expect, it } from "vitest";

import { WordCount } from "./WordCount";

describe("WordCount", () => {
  it.each([
    ["counts each Chinese character and each run of letters once", "今天寫了 Rust 程式", 7],
    ["counts English words and numbers, not their punctuation", "Hello world, 2026!", 3],
    ["counts nothing in an empty body", "", 0],
    ["counts a single word", "Hi", 1],
    ["counts no Markdown marks", "## 標題\n- [ ] **重點**", 4],
    ["counts kana and hangul character by character", "ひらがなカナ한글", 8],
    ["keeps an apostrophe or hyphen inside one word", "don't over-think", 2],
    ["splits letters that touch a Chinese character", "用Rust寫", 3],
    ["counts no task box", "- [x] 重點\n1. [ ] 次要", 4],
    ["counts the text of a link but not where it goes", "看 [Rust](https://www.rust-lang.org/learn) 吧", 3],
    ["counts an image's description but not its path", "![圖](images/photo-01.png)", 1],
    ["keeps a word with combining marks whole", "नमस्ते", 1],
  ])("%s", (_, body, expected) => {
    expect(WordCount.of(body).value).toBe(expected);
  });

  it("counts 1284 characters as 1284", () => {
    expect(WordCount.of("字".repeat(1284)).value).toBe(1284);
  });
});
