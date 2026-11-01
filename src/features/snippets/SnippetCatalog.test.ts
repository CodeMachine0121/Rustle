import { describe, expect, it } from "vitest";

import { SnippetCatalog } from "./SnippetCatalog";
import template from "./snippetTemplate.json";

const SHIPPED_ORDER = ["H1", "H2", "H3", "H4", "H5", "H6", "Link", "Image", "Table"];

function namesOf(catalog: SnippetCatalog, query?: string): string[] {
  return (query === undefined ? catalog.snippets : catalog.matching(query)).map((snippet) => snippet.name);
}

const heading = { name: "H1", template: "# {{標題文字}}" };
const link = { name: "Link", template: "[{{要填的文字}}]({{要填的網址}})" };
const quote = { name: "Quote", template: "> {{引言}}" };

describe("SnippetCatalog", () => {
  it("ships nine snippets in menu order", () => {
    expect(namesOf(SnippetCatalog.shipped())).toEqual(SHIPPED_ORDER);
  });

  it.each([
    ["H1", "# "],
    ["H2", "## "],
    ["H3", "### "],
    ["H4", "#### "],
    ["H5", "##### "],
    ["H6", "###### "],
    ["Link", "[]()"],
    ["Image", "![]()"],
    ["Table", "|  |  |\n| --- | --- |\n|  |  |"],
  ])("ships %s landing as %j", (name, text) => {
    expect(SnippetCatalog.shipped().snippets.find((snippet) => snippet.name === name)?.expansion.text).toBe(text);
  });

  it.each([
    ["", SHIPPED_ORDER],
    ["h", ["H1", "H2", "H3", "H4", "H5", "H6"]],
    ["h2", ["H2"]],
    ["H2", ["H2"]],
    ["t", ["Table"]],
    ["zzz", []],
  ])("filters the shipped snippets by %j", (query, names) => {
    expect(namesOf(SnippetCatalog.shipped(), query)).toEqual(names);
  });

  it("orders the snippets by file name, however the files arrive", () => {
    const catalog = new SnippetCatalog({ "./snippets/07-link.json": link, "./snippets/01-h1.json": heading });

    expect(namesOf(catalog)).toEqual(["H1", "Link"]);
  });

  it("leaves out a snippet that cannot be read and keeps the others", () => {
    const catalog = new SnippetCatalog({
      "./snippets/01-h1.json": heading,
      "./snippets/02-broken.json": { name: "Broken", template: "# {{標題" },
      "./snippets/07-link.json": link,
    });

    expect(namesOf(catalog)).toEqual(["H1", "Link"]);
  });

  it("offers nothing when no snippet can be read", () => {
    expect(namesOf(new SnippetCatalog({ "./snippets/01-h1.json": {} }), "")).toEqual([]);
  });

  it("adds a tenth file as one more snippet after the others, leaving them as they were", () => {
    const shippedFiles = import.meta.glob("./snippets/*.json", { eager: true, import: "default" });
    const before = new SnippetCatalog(shippedFiles);
    const after = new SnippetCatalog({ ...shippedFiles, "./snippets/10-quote.json": quote });

    expect(namesOf(after)).toEqual([...SHIPPED_ORDER, "Quote"]);
    expect(after.snippets.slice(0, 9).map((snippet) => snippet.expansion)).toEqual(
      before.snippets.map((snippet) => snippet.expansion),
    );
  });

  it("keeps the first of two snippets with the same name in any case", () => {
    const catalog = new SnippetCatalog({
      "./snippets/01-h1.json": heading,
      "./snippets/02-again.json": { name: "h1", template: "#{{另一個}}" },
    });

    expect(catalog.snippets.map((snippet) => snippet.expansion.text)).toEqual(["# "]);
  });

  it("offers a template whose two keys are the whole shape of a snippet file", () => {
    expect(Object.keys(template)).toEqual(["name", "template"]);
  });
});
