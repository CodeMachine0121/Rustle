import { describe, expect, it } from "vitest";

import { TableRow } from "./TableRow";

/** The line after Enter at `‸`, with `‸` where the cursor ends up; `null` when the row leaves Enter alone. */
function afterEnter(marked: string): string | null {
  const column = marked.indexOf("‸");
  const line = marked.replace("‸", "");
  const edit = TableRow.parse(line)?.enterAt(column) ?? null;
  if (edit === null) {
    return null;
  }
  const edited = line.slice(0, edit.from) + edit.insert + line.slice(edit.to);
  return `${edited.slice(0, edit.cursor)}‸${edited.slice(edit.cursor)}`;
}

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
    ["| 甲 | 乙 |‸", "| 甲 | 乙 |\n| ‸ |  |"],
    ["  > | 甲 |‸", "  > | 甲 |\n  > | ‸ |"],
    ["| 甲 | 乙‸", "| 甲 | 乙\n| ‸ |  |"],
    ["| a \\| b |‸", "| a \\| b |\n| ‸ |"],
    ["| 甲 |  |‸", "| 甲 |  |\n| ‸ |  |"],
    ["| --- | --- |‸", "| --- | --- |\n| ‸ |  |"],
    ["|‸", "|\n| ‸ |"],
  ])("follows %j with the next empty row", (before, after) => {
    expect(afterEnter(before)).toBe(after);
  });

  it.each([
    ["|  |  |‸", "‸"],
    ["| ‸ |  |", "‸"],
    ["|  |‸", "‸"],
    ["|||‸", "‸"],
    ["> |  |  |  ‸", "> ‸"],
  ])("clears the finished, empty row %j", (before, after) => {
    expect(afterEnter(before)).toBe(after);
  });

  it.each(["| 甲‸ | 乙 |", "‸| 甲 | 乙 |", "‸|  |  |", "> ‸|  |", "| 甲 | 乙 ‸|"])(
    "leaves Enter at %j to the editor",
    (marked) => {
      expect(afterEnter(marked)).toBeNull();
    },
  );
});
