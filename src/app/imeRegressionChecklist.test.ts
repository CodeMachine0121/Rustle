import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const checklist = readFileSync(join(process.cwd(), "docs", "ime-regression-checklist.md"), "utf8");

const items = checklist
  .slice(0, checklist.indexOf("## 發佈檢查清單"))
  .split("\n### ")
  .slice(1);

describe("input method regression checklist", () => {
  it("has thirteen items", () => {
    expect(items).toHaveLength(13);
  });

  it.each(items.map((item, index) => [index + 1, item]))(
    "gives item %i steps, an expected result and a failure criterion",
    (_itemNumber, item) => {
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
    expect(releaseChecklist).toContain("重跑全部 13 項");
    expect(releaseChecklist).toContain("依賴版本鎖定");
  });
});
