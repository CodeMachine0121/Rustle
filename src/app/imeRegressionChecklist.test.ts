import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const checklist = readFileSync(join(process.cwd(), "docs", "ime-regression-checklist.md"), "utf8");

function section(itemNumber: number): string {
  const start = checklist.indexOf(`### T-${itemNumber} `);
  const end = checklist.indexOf("\n### ", start + 1);
  return start === -1 ? "" : checklist.slice(start, end === -1 ? undefined : end);
}

describe("input method regression checklist", () => {
  it.each(Array.from({ length: 12 }, (_, index) => index + 1))(
    "gives T-%i steps, an expected result and a failure criterion",
    (itemNumber) => {
      const item = section(itemNumber);

      expect(item).toContain("**怎麼做**");
      expect(item).toContain("**期望**");
      expect(item).toContain("**失敗**");
    },
  );

  it("states that the items are manual by decision", () => {
    expect(checklist).toContain("**決定人工執行**");
  });

  it("requires a full rerun before upgrading the GUI framework or the editor component", () => {
    const releaseChecklist = checklist.slice(checklist.indexOf("## 發佈檢查清單"));

    expect(releaseChecklist).toContain("升級所用的 GUI 框架（Tauri）或編輯器元件（CodeMirror）之前");
    expect(releaseChecklist).toContain("重跑全部 12 項");
    expect(releaseChecklist).toContain("依賴版本鎖定");
  });
});
