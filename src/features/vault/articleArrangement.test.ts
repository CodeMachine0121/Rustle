import { describe, expect, it } from "vitest";

import type { ArticleLocation, ArticleSummary } from "../../ipc/articleSummary";
import { SidebarFilter } from "../sidebar/SidebarFilter";
import { arrangeArticles } from "./articleArrangement";

function article(fields: Partial<ArticleSummary> & { fileName: string }): ArticleSummary {
  return {
    workspace: "Blog",
    title: fields.fileName,
    createdAt: "",
    updatedAt: "",
    status: null,
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
    status: "active",
    tags: ["tauri", "electron", "技術"],
  }),
  article({ fileName: "zen.md", title: "Zen of Writing", status: "active", tags: ["隨筆"] }),
  article({ fileName: "tauri-note.md", title: "日常" }),
];

function ordered(articles: ArticleSummary[]): string[] {
  return arrangeArticles(articles, {
    filterText: "",
    sidebarFilter: SidebarFilter.NONE,
    openArticle: null,
  }).map(({ article: { fileName } }) => fileName);
}

function filtered(text: string, sidebarFilter = SidebarFilter.NONE): string[] {
  return arrangeArticles(THREE, { filterText: text, sidebarFilter, openArticle: null }).map(
    ({ article: { title } }) => title,
  );
}

function blog(fileName: string): ArticleLocation {
  return { workspace: "Blog", fileName };
}

describe("arrangeArticles ordering", () => {
  it("puts the newest created article first, whatever was updated last", () => {
    expect(ordered(FOUR)).toEqual(["b.md", "c.md", "a.md", "d.md"]);
  });

  it("puts an article with the same time after the one whose title comes first, every time", () => {
    const same = "2026-08-20T00:30:00+08:00";
    const pair = [
      article({ fileName: "beta.md", title: "Beta", createdAt: same }),
      article({ fileName: "alpha.md", title: "Alpha", createdAt: same }),
    ];

    expect(ordered(pair)).toEqual(["alpha.md", "beta.md"]);
    expect(ordered([...pair].reverse())).toEqual(["alpha.md", "beta.md"]);
  });

  it("orders articles with the same time and title by file name", () => {
    const pair = [
      article({ fileName: "b.md", title: "Same" }),
      article({ fileName: "a.md", title: "Same" }),
    ];

    expect(ordered(pair)).toEqual(["a.md", "b.md"]);
  });

  it("compares times written in different zones as instants", () => {
    const pair = [
      article({ fileName: "taipei.md", createdAt: "2026-08-20T00:30:00+08:00" }),
      article({ fileName: "utc.md", createdAt: "2026-08-19T20:00:00Z" }),
    ];

    expect(ordered(pair)).toEqual(["utc.md", "taipei.md"]);
  });

  it.each(["不知道", "", "2026-13-45T99:99:99Z", "Aug 20 2026"])(
    "treats %j as no time and puts it last",
    (createdAt) => {
      const pair = [
        article({ fileName: "unknown.md", title: "A", createdAt }),
        article({ fileName: "known.md", title: "B", createdAt: "2026-08-01" }),
      ];

      expect(ordered(pair)).toEqual(["known.md", "unknown.md"]);
    },
  );

  it("leaves the given list in its order", () => {
    const given = [...FOUR];

    ordered(given);

    expect(given).toEqual(FOUR);
  });
});

describe("arrangeArticles filtering", () => {
  it.each([
    ["the title", "Zen", ["Zen of Writing"]],
    ["a tag in another script", "技術", ["Tauri 與 Electron"]],
    ["a tag", "electron", ["Tauri 與 Electron"]],
    ["any letter case", "ELECTRON", ["Tauri 與 Electron"]],
    ["the trimmed text", " Zen ", ["Zen of Writing"]],
    ["nothing outside title and tags", "tauri", ["Tauri 與 Electron"]],
    ["nothing at all", "xyz", []],
  ])("matches %s", (_case, text, expected) => {
    expect(filtered(text)).toEqual(expected);
  });

  it.each(["", "   "])("keeps every article for %j", (text) => {
    expect(filtered(text)).toHaveLength(3);
  });

  it("keeps the open article even when it does not match, and says so", () => {
    const rows = arrangeArticles(THREE, {
      filterText: "技術",
      sidebarFilter: SidebarFilter.NONE,
      openArticle: blog("zen.md"),
    });

    expect(rows.map(({ article: { title }, isOutsideFilter }) => [title, isOutsideFilter])).toEqual([
      ["Tauri 與 Electron", false],
      ["Zen of Writing", true],
    ]);
  });

  it("orders what is left", () => {
    expect(filtered("e")).toEqual(["Tauri 與 Electron", "Zen of Writing"]);

    const rows = arrangeArticles(FOUR, {
      filterText: "a",
      sidebarFilter: SidebarFilter.NONE,
      openArticle: null,
    });

    expect(rows.map(({ article: { title } }) => title)).toEqual(["Tauri 與 Electron", "Alpha", "Beta"]);
  });

  it("orders and filters five hundred articles from five workspaces without a visible pause", () => {
    const many = Array.from({ length: 500 }, (_, index) =>
      article({
        workspace: `Workspace ${index % 5}`,
        fileName: `article-${index}.md`,
        title: `第 ${index} 篇 writing notes`,
        createdAt: `2026-0${(index % 9) + 1}-1${index % 10}T0${index % 10}:00:00+08:00`,
        status: index % 2 === 0 ? "active" : "dropped",
        tags: [index % 4 === 0 ? "技術筆記" : "隨筆", `tag-${index}`],
      }),
    );

    const started = performance.now();
    const rows = arrangeArticles(many, {
      filterText: "writing",
      sidebarFilter: SidebarFilter.NONE.toggleStatus("active").toggleTag("技術筆記"),
      openArticle: null,
    });
    const elapsedMilliseconds = performance.now() - started;

    expect(rows).toHaveLength(125);
    expect(elapsedMilliseconds).toBeLessThan(50);
  });
});

describe("arrangeArticles with the sidebar filter", () => {
  const MIXED = [
    article({ fileName: "a.md", title: "A 桌面", status: "active", tags: ["work"] }),
    article({ fileName: "b.md", title: "B 桌面", status: "active" }),
    article({ fileName: "c.md", title: "C 筆記", status: "active", tags: ["work"] }),
    article({ fileName: "d.md", title: "D 桌面", status: "completed", tags: ["work"] }),
  ];

  function shown(text: string, sidebarFilter: SidebarFilter, openArticle: ArticleLocation | null = null) {
    return arrangeArticles(MIXED, { filterText: text, sidebarFilter, openArticle }).map(
      ({ article: { fileName }, isOutsideFilter }) => (isOutsideFilter ? `${fileName} (open)` : fileName),
    );
  }

  it("keeps only the articles with both the chosen status and every chosen tag", () => {
    expect(shown("", SidebarFilter.NONE.toggleStatus("active").toggleTag("work"))).toEqual(["a.md", "c.md"]);
  });

  it("adds the text filter on top of the sidebar filter", () => {
    expect(shown("桌面", SidebarFilter.NONE.toggleStatus("active"))).toEqual(["a.md", "b.md"]);
  });

  it("keeps the open article that the sidebar filter leaves out, and says so", () => {
    expect(shown("", SidebarFilter.NONE.toggleStatus("active"), blog("d.md"))).toEqual([
      "a.md",
      "b.md",
      "c.md",
      "d.md (open)",
    ]);
  });

  it("keeps only the open article of the right workspace when two share a file name", () => {
    const twins = [
      article({ workspace: "Blog", fileName: "zen.md", status: "completed" }),
      article({ workspace: "Work", fileName: "zen.md", status: "completed" }),
    ];

    const rows = arrangeArticles(twins, {
      filterText: "",
      sidebarFilter: SidebarFilter.NONE.toggleStatus("active"),
      openArticle: { workspace: "Work", fileName: "zen.md" },
    });

    expect(rows.map(({ article: { workspace } }) => workspace)).toEqual(["Work"]);
  });

  it("puts a tie across workspaces in workspace name order, then file name order", () => {
    const same = "2026-08-20T00:30:00+08:00";
    const ties = [
      article({ workspace: "Work", fileName: "b.md", title: "Zen", createdAt: same }),
      article({ workspace: "Blog", fileName: "z.md", title: "Zen", createdAt: same }),
      article({ workspace: "Work", fileName: "a.md", title: "Zen", createdAt: same }),
    ];

    const rows = arrangeArticles(ties, {
      filterText: "",
      sidebarFilter: SidebarFilter.NONE,
      openArticle: null,
    });

    expect(rows.map(({ article: { workspace, fileName } }) => `${workspace}/${fileName}`)).toEqual([
      "Blog/z.md",
      "Work/a.md",
      "Work/b.md",
    ]);
  });
});
