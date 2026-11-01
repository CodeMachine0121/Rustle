import { describe, expect, it } from "vitest";

import { IndentUnit } from "./IndentUnit";

describe("IndentUnit", () => {
  it("is two spaces when no settings are given", () => {
    expect(IndentUnit.from().text).toBe("  ");
  });

  it("is four spaces when set to spaces of width four", () => {
    expect(IndentUnit.from({ style: "spaces", width: 4 }).text).toBe("    ");
  });

  it("is one tab character when set to tabs", () => {
    expect(IndentUnit.from({ style: "tab", width: 4 }).text).toBe("\t");
  });

  it.each([0, -2, 23, 2.5, 3.5, Number.NaN])("falls back to two spaces for the unreasonable width %s", (width) => {
    expect(IndentUnit.from({ style: "spaces", width }).text).toBe("  ");
  });

  it("accepts the widest sensible width", () => {
    expect(IndentUnit.from({ style: "spaces", width: 8 }).text).toBe(" ".repeat(8));
  });

  it("adds one unit on indent without realigning uneven whitespace", () => {
    expect(IndentUnit.from().indent("   ")).toBe("     ");
  });

  it.each([
    [1, 0],
    [2, 0],
    [3, 2],
    [4, 2],
    [5, 4],
  ])("outdents %i leading spaces to %i", (before, after) => {
    expect(IndentUnit.from().outdent(" ".repeat(before))).toBe(" ".repeat(after));
  });

  it("has nothing to outdent at the outermost level", () => {
    expect(IndentUnit.from().outdent("")).toBeNull();
  });

  it("outdents to a multiple of four when the width is four", () => {
    expect(IndentUnit.from({ style: "spaces", width: 4 }).outdent(" ".repeat(6))).toBe("    ");
  });

  it("writes the outdented whitespace as tabs when the style is tab", () => {
    expect(IndentUnit.from({ style: "tab", width: 4 }).outdent(" ".repeat(6))).toBe("\t");
  });

  it("counts a tab character as reaching the next tab stop", () => {
    const unit = IndentUnit.from({ style: "spaces", width: 4 });

    expect(unit.outdent(" \t")).toBe("");
    expect(unit.outdent("\t\t")).toBe("    ");
  });
});
