import { describe, expect, it } from "vitest";

import { FindingText } from "./FindingText";

describe("FindingText", () => {
  it.each([
    ["input", true],
    ["INPUT", true],
    ["input method", true],
    ["  input  ", true],
    ["inpmet", false],
    ["method input", false],
  ])("finds %j in 〈Input Method 筆記〉: %s", (typed, expected) => {
    expect(new FindingText(typed).matches("Input Method 筆記")).toBe(expected);
  });

  it("finds a piece of a Chinese title", () => {
    expect(new FindingText("累").matches("今天很累")).toBe(true);
    expect(new FindingText("累").matches("昨天下雨")).toBe(false);
  });

  it.each(["", "   ", "\t"])("takes %j as nothing typed", (typed) => {
    expect(new FindingText(typed).isBlank).toBe(true);
  });

  it("searches with the text the writer typed, without the blanks around it", () => {
    expect(new FindingText("  加班 ").searched).toBe("加班");
    expect(new FindingText(" a b ").isBlank).toBe(false);
  });
});
