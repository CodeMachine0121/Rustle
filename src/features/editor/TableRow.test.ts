import { describe, expect, it } from "vitest";

import { TableRow } from "./TableRow";

describe("TableRow", () => {
  it.each(["| 甲 | 乙 |", "|", "  | 甲 |", "> | 甲 |", ">> | 甲 |", "\t| 甲 |", "| --- | --- |"])(
    "recognises %j as a table row",
    (line) => {
      expect(TableRow.parse(line)).not.toBeNull();
    },
  );

  it.each(["最近在選桌面框架", "", "- | 甲 |", "甲 | 乙", "`|`", "  "])("does not take %j for a table row", (line) => {
    expect(TableRow.parse(line)).toBeNull();
  });

  it.each([
    ["|  |  |", true],
    ["|  |", true],
    ["|||", true],
    ["> |  |  |  ", true],
    ["| 甲 |  |", false],
    ["| --- | --- |", false],
    ["|", false],
  ])("judges whether %j is a finished, empty row: %s", (line, isBlank) => {
    expect(TableRow.parse(line)?.isBlank).toBe(isBlank);
  });

  it.each([
    ["| 甲 | 乙 |", "|  |  |"],
    ["  > | 甲 |", "  > |  |"],
    ["| 甲 | 乙", "|  |  |"],
    ["| a \\| b |", "|  |"],
  ])("follows %j with %j", (line, nextRow) => {
    expect(TableRow.parse(line)?.nextRow).toBe(nextRow);
  });
});
