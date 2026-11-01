import { describe, expect, it } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import { sidebarCounts } from "./sidebarCounts";

function article(status: ArticleSummary["status"], tags: string[] = [], workspace = "Blog"): ArticleSummary {
  return {
    workspace,
    fileName: "a.md",
    title: "a",
    createdAt: "",
    updatedAt: "",
    status,
    tags,
    hasIncompleteMetadata: false,
  };
}

function statusCounts(articles: ArticleSummary[]) {
  return sidebarCounts(articles).statuses.map(({ choice, count }) => [choice, count]);
}

describe("sidebarCounts", () => {
  it("counts every status, the absence of one included, in a fixed order of five", () => {
    const articles = [
      article("active"),
      article("active"),
      article("active"),
      article("onHold"),
      article(null),
      article(null),
    ];

    expect(statusCounts(articles)).toEqual([
      ["active", 3],
      ["onHold", 1],
      ["completed", 0],
      ["dropped", 0],
      ["noStatus", 2],
    ]);
  });

  it("keeps all five rows at zero when there are no articles", () => {
    expect(statusCounts([])).toEqual([
      ["active", 0],
      ["onHold", 0],
      ["completed", 0],
      ["dropped", 0],
      ["noStatus", 0],
    ]);
    expect(sidebarCounts([]).tags).toEqual([]);
  });

  it("counts across every workspace it is given", () => {
    const articles = [article("active", [], "Blog"), article("active", [], "Blog"), article("active", [], "Work")];

    expect(sidebarCounts(articles).statuses[0]).toEqual({ choice: "active", count: 3 });
  });

  it("lists the tags most used first, then by name", () => {
    const articles = [
      article(null, ["work", "zen"]),
      article(null, ["work", "zen", "bug"]),
      article(null, ["zen", "work"]),
      article(null, ["work", "zen"]),
    ];

    expect(sidebarCounts(articles).tags).toEqual([
      { tag: "work", count: 4 },
      { tag: "zen", count: 4 },
      { tag: "bug", count: 1 },
    ]);
  });

  it("counts five hundred articles from five workspaces without a visible pause", () => {
    const many = Array.from({ length: 500 }, (_, index) =>
      article(index % 2 === 0 ? "active" : null, [`tag-${index % 40}`, "work"], `Workspace ${index % 5}`),
    );

    const started = performance.now();
    const counts = sidebarCounts(many);
    const elapsedMilliseconds = performance.now() - started;

    expect(counts.statuses[0]?.count).toBe(250);
    expect(counts.tags[0]).toEqual({ tag: "work", count: 500 });
    expect(elapsedMilliseconds).toBeLessThan(50);
  });
});
