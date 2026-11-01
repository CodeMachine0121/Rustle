import { describe, expect, it } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import {
  arrangeArticles,
  articleOrderNamed,
  type ArticleOrder,
} from "./articleArrangement";

function article(fields: Partial<ArticleSummary> & { fileName: string }): ArticleSummary {
  return {
    title: fields.fileName,
    createdAt: "",
    updatedAt: "",
    category: [],
    tags: [],
    hasIncompleteMetadata: false,
    ...fields,
  };
}

const FOUR = [
  article({
    fileName: "a.md",
    title: "Zen of Writing",
    createdAt: "2026-08-18T09:00:00+08:00",
    updatedAt: "2026-08-20T18:00:00+08:00",
  }),
  article({
    fileName: "b.md",
    title: "Tauri 與 Electron",
    createdAt: "2026-08-20T00:30:00+08:00",
    updatedAt: "2026-08-20T01:00:00+08:00",
  }),
  article({
    fileName: "c.md",
    title: "Alpha",
    createdAt: "2026-08-19T22:00:00+08:00",
    updatedAt: "2026-08-19T22:00:00+08:00",
  }),
  article({ fileName: "d.md", title: "Beta" }),
];

const THREE = [
  article({
    fileName: "tauri.md",
    title: "Tauri 與 Electron",
    category: ["技術筆記"],
    tags: ["tauri", "electron"],
  }),
  article({ fileName: "zen.md", title: "Zen of Writing", category: ["隨筆"] }),
  article({ fileName: "tauri-note.md", title: "日常" }),
];

function ordered(articles: ArticleSummary[], order: ArticleOrder): string[] {
  return arrangeArticles(articles, { filterText: "", order, openArticle: null }).map(
    ({ article: { fileName } }) => fileName,
  );
}

function filtered(text: string, openArticle: string | null = null): string[] {
  return arrangeArticles(THREE, { filterText: text, order: "title", openArticle }).map(
    ({ article: { title } }) => title,
  );
}

describe("arrangeArticles ordering", () => {
  it.each<[ArticleOrder, string[]]>([
    ["createdNewestFirst", ["b.md", "c.md", "a.md", "d.md"]],
    ["title", ["c.md", "d.md", "b.md", "a.md"]],
    ["updatedNewestFirst", ["a.md", "b.md", "c.md", "d.md"]],
  ])("orders by %s", (order, expected) => {
    expect(ordered(FOUR, order)).toEqual(expected);
  });

  it("puts an article with the same time after the one whose title comes first, every time", () => {
    const same = "2026-08-20T00:30:00+08:00";
    const pair = [
      article({ fileName: "beta.md", title: "Beta", createdAt: same }),
      article({ fileName: "alpha.md", title: "Alpha", createdAt: same }),
    ];

    expect(ordered(pair, "createdNewestFirst")).toEqual(["alpha.md", "beta.md"]);
    expect(ordered([...pair].reverse(), "createdNewestFirst")).toEqual(["alpha.md", "beta.md"]);
  });

  it("orders articles with the same time and title by file name", () => {
    const pair = [
      article({ fileName: "b.md", title: "Same" }),
      article({ fileName: "a.md", title: "Same" }),
    ];

    expect(ordered(pair, "createdNewestFirst")).toEqual(["a.md", "b.md"]);
  });

  it("compares times written in different zones as instants", () => {
    const pair = [
      article({ fileName: "taipei.md", createdAt: "2026-08-20T00:30:00+08:00" }),
      article({ fileName: "utc.md", createdAt: "2026-08-19T20:00:00Z" }),
    ];

    expect(ordered(pair, "createdNewestFirst")).toEqual(["utc.md", "taipei.md"]);
  });

  it.each(["不知道", "", "2026-13-45T99:99:99Z", "Aug 20 2026"])(
    "treats %j as no time and puts it last",
    (createdAt) => {
      const pair = [
        article({ fileName: "unknown.md", title: "A", createdAt }),
        article({ fileName: "known.md", title: "B", createdAt: "2026-08-01" }),
      ];

      expect(ordered(pair, "createdNewestFirst")).toEqual(["known.md", "unknown.md"]);
    },
  );

  it("leaves the given list in its order", () => {
    const given = [...FOUR];

    ordered(given, "title");

    expect(given).toEqual(FOUR);
  });

  it("falls back to the default order for an unknown name", () => {
    expect(articleOrderNamed("title")).toBe("title");
    expect(articleOrderNamed("byColour")).toBe("createdNewestFirst");
  });
});

describe("arrangeArticles filtering", () => {
  it.each([
    ["the title", "Zen", ["Zen of Writing"]],
    ["a category", "技術", ["Tauri 與 Electron"]],
    ["a tag", "electron", ["Tauri 與 Electron"]],
    ["any letter case", "ELECTRON", ["Tauri 與 Electron"]],
    ["the trimmed text", " Zen ", ["Zen of Writing"]],
    ["nothing outside title, categories and tags", "tauri", ["Tauri 與 Electron"]],
    ["nothing at all", "xyz", []],
  ])("matches %s", (_case, text, expected) => {
    expect(filtered(text)).toEqual(expected);
  });

  it.each(["", "   "])("keeps every article for %j", (text) => {
    expect(filtered(text)).toHaveLength(3);
  });

  it("keeps the open article even when it does not match, and says so", () => {
    const rows = arrangeArticles(THREE, { filterText: "技術", order: "title", openArticle: "zen.md" });

    expect(rows.map(({ article: { title }, isOutsideFilter }) => [title, isOutsideFilter])).toEqual([
      ["Tauri 與 Electron", false],
      ["Zen of Writing", true],
    ]);
  });

  it("orders what is left", () => {
    const rows = arrangeArticles(FOUR, { filterText: "a", order: "title", openArticle: null });

    expect(rows.map(({ article: { title } }) => title)).toEqual(["Alpha", "Beta", "Tauri 與 Electron"]);
  });

  it("orders and filters five hundred articles without a visible pause", () => {
    const many = Array.from({ length: 500 }, (_, index) =>
      article({
        fileName: `article-${index}.md`,
        title: `第 ${index} 篇 writing notes`,
        createdAt: `2026-0${(index % 9) + 1}-1${index % 10}T0${index % 10}:00:00+08:00`,
        category: [index % 2 === 0 ? "技術筆記" : "隨筆"],
        tags: ["tauri", `tag-${index}`],
      }),
    );

    const started = performance.now();
    const rows = arrangeArticles(many, {
      filterText: "技術",
      order: "createdNewestFirst",
      openArticle: null,
    });
    const elapsedMilliseconds = performance.now() - started;

    expect(rows).toHaveLength(250);
    expect(elapsedMilliseconds).toBeLessThan(50);
  });
});
