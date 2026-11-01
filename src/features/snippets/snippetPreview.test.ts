// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { renderPreviewHtml } from "../preview/renderPreviewHtml";
import { SnippetCatalog } from "./SnippetCatalog";

function filledIn(name: string, values: readonly string[]): string {
  const snippet = SnippetCatalog.shipped().snippets.find((candidate) => candidate.name === name);
  if (snippet === undefined) {
    throw new Error(`no ${name} snippet`);
  }
  const { text, fields } = snippet.expansion;
  return fields.reduceRight(
    (filled, field, index) => filled.slice(0, field.from) + (values[index] ?? "") + filled.slice(field.to),
    text,
  );
}

describe("what a snippet lands in the preview", () => {
  it("renders a filled table snippet as a table", () => {
    const preview = document.createElement("div");
    preview.innerHTML = renderPreviewHtml(filledIn("Table", ["欄位一", "欄位二", "甲", "乙"]));

    expect([...preview.querySelectorAll("th")].map((cell) => cell.textContent)).toEqual(["欄位一", "欄位二"]);
    expect([...preview.querySelectorAll("td")].map((cell) => cell.textContent)).toEqual(["甲", "乙"]);
  });

  it("renders a filled heading snippet as a heading of its level", () => {
    const preview = document.createElement("div");
    preview.innerHTML = renderPreviewHtml(filledIn("H3", ["安裝步驟"]));

    expect(preview.querySelector("h3")?.textContent).toBe("安裝步驟");
  });
});
