import { describe, expect, it } from "vitest";

import { Snippet } from "./Snippet";

describe("Snippet", () => {
  it("lands a heading with its field emptied and the cursor after the marks", () => {
    const snippet = Snippet.parse({ name: "H2", template: "## {{標題文字}}" });

    expect(snippet?.name).toBe("H2");
    expect(snippet?.expansion).toEqual({ text: "## ", fields: [{ from: 3, to: 3 }] });
  });

  it("keeps two fields with the same name apart, in document order", () => {
    const snippet = Snippet.parse({
      name: "Table",
      template: "| {{欄位一}} | {{欄位二}} |\n| --- | --- |\n| {{內容}} | {{內容}} |",
    });

    expect(snippet?.expansion.text).toBe("|  |  |\n| --- | --- |\n|  |  |");
    expect(snippet?.expansion.fields).toEqual([
      { from: 2, to: 2 },
      { from: 5, to: 5 },
      { from: 24, to: 24 },
      { from: 27, to: 27 },
    ]);
  });

  it("never lets a field name reach the body", () => {
    expect(Snippet.parse({ name: "Link", template: "[{{要填的文字}}]({{要填的網址}})" })?.expansion).toEqual({
      text: "[]()",
      fields: [
        { from: 1, to: 1 },
        { from: 3, to: 3 },
      ],
    });
  });

  it("accepts a snippet without fields", () => {
    expect(Snippet.parse({ name: "Rule", template: "---" })?.expansion).toEqual({ text: "---", fields: [] });
  });

  it.each([
    ["no name", { template: "# {{標題}}" }],
    ["a blank name", { name: "  ", template: "# {{標題}}" }],
    ["a name that is not text", { name: 1, template: "# {{標題}}" }],
    ["no template", { name: "H1" }],
    ["a template that is not text", { name: "H1", template: ["# "] }],
    ["a field without a name", { name: "H1", template: "# {{}}" }],
    ["a field name across lines", { name: "H1", template: "# {{標題\n文字}}" }],
    ["an unclosed field", { name: "H1", template: "# {{標題" }],
    ["a stray closing brace pair", { name: "H1", template: "# 標題}}" }],
    ["not an object", "H1"],
    ["nothing", null],
    ["a list", [{ name: "H1", template: "# " }]],
  ])("is not a snippet with %s", (_case, file) => {
    expect(Snippet.parse(file)).toBeNull();
  });

  it.each([
    ["", true],
    ["h", true],
    ["h2", true],
    ["H2", true],
    ["h3", false],
    ["2", false],
    ["h2x", false],
  ])("matches the filter %j as %s by name prefix in any case", (query, matches) => {
    expect(Snippet.parse({ name: "H2", template: "## {{標題文字}}" })?.matches(query)).toBe(matches);
  });

  it.each([
    ["a heading", "## {{標題文字}}", true],
    ["a table", "| {{欄位一}} | {{欄位二}} |\n| --- | --- |\n| {{內容}} | {{內容}} |", true],
    ["a link", "[{{要填的文字}}]({{要填的網址}})", false],
    ["an image", "![{{要填的文字}}]({{要填的網址}})", false],
  ])("knows whether %s only works at the start of a line", (_kind, template, startsLine) => {
    expect(Snippet.parse({ name: "片段", template })?.startsLine).toBe(startsLine);
  });
});
