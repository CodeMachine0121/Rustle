import { describe, expect, it } from "vitest";

import { candidatesFor, withChip } from "./chipValues";

describe("withChip", () => {
  it.each([
    [[], "技術筆記", ["技術筆記"]],
    [["tauri"], "electron", ["tauri", "electron"]],
    [[], "  技術筆記  ", ["技術筆記"]],
    [["技術筆記"], "   ", ["技術筆記"]],
    [["electron"], "electron", ["electron"]],
    [["electron"], " electron ", ["electron"]],
    [["electron"], "Electron", ["electron", "Electron"]],
  ])("adds %j + %j as %j", (chips, typed, expected) => {
    expect(withChip(chips, typed)).toEqual(expected);
  });
});

describe("candidatesFor", () => {
  const vocabulary = ["技術筆記", "桌面開發", "Electron", "tauri"];

  it.each([
    ["技", [], ["技術筆記"]],
    ["發", [], ["桌面開發"]],
    ["elec", [], ["Electron"]],
    ["ELEC", [], ["Electron"]],
    ["TECH", [], []],
    ["技", ["技術筆記"], []],
    ["", [], []],
    ["   ", [], []],
  ])("offers for %j with %j chosen: %j", (typed, chosen, expected) => {
    expect(candidatesFor(vocabulary, typed, chosen)).toEqual(expected);
  });

  it("offers nothing when the workspace has no words yet", () => {
    expect(candidatesFor([], "技", [])).toEqual([]);
  });
});
