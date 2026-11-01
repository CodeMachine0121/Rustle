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
  return sidebarCounts(articles).statuses.map(({ label, count }) => [label, count]);
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
      ["Active", 3],
      ["On Hold", 1],
      ["Completed", 0],
      ["Dropped", 0],
      ["No Status", 2],
    ]);
  });

  it("keeps all five rows at zero when there are no articles", () => {
    expect(statusCounts([])).toEqual([
      ["Active", 0],
      ["On Hold", 0],
      ["Completed", 0],
      ["Dropped", 0],
      ["No Status", 0],
    ]);
    expect(sidebarCounts([]).tags).toEqual([]);
  });

  it("counts across every workspace it is given", () => {
    const articles = [article("active", [], "Blog"), article("active", [], "Blog"), article("active", [], "Work")];

    expect(sidebarCounts(articles).statuses[0]).toEqual({ choice: "active", label: "Active", count: 3 });
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
});
