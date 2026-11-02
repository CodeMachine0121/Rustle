import { describe, expect, it } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import { SidebarFilter } from "./SidebarFilter";

function article(fields: Partial<ArticleSummary>): ArticleSummary {
  return {
    workspace: "Blog",
    fileName: "a.md",
    title: "a",
    createdAt: "",
    updatedAt: "",
    status: null,
    tags: [],
    hasIncompleteMetadata: false,
    excerpt: null,
    ...fields,
  };
}

const ACTIVE = article({ fileName: "active.md", status: "active" });
const COMPLETED = article({ fileName: "completed.md", status: "completed" });
const NO_STATUS = article({ fileName: "none.md" });
const WORK_AND_BUG = article({ fileName: "both.md", tags: ["work", "bug"] });
const WORK_ONLY = article({ fileName: "work.md", tags: ["work"] });

describe("SidebarFilter", () => {
  it("keeps everything when nothing is chosen", () => {
    expect([ACTIVE, NO_STATUS, WORK_ONLY].every((each) => SidebarFilter.NONE.matches(each))).toBe(true);
  });

  it("keeps only the articles with the chosen status", () => {
    const filter = SidebarFilter.NONE.toggleStatus("active");

    expect([ACTIVE, COMPLETED, NO_STATUS].filter((each) => filter.matches(each))).toEqual([ACTIVE]);
  });

  it("keeps only the articles without a status when No Status is chosen", () => {
    const filter = SidebarFilter.NONE.toggleStatus("noStatus");

    expect([ACTIVE, NO_STATUS].filter((each) => filter.matches(each))).toEqual([NO_STATUS]);
  });

  it("lets go of the chosen status when it is chosen again", () => {
    const filter = SidebarFilter.NONE.toggleStatus("active").toggleStatus("active");

    expect(filter.status).toBeNull();
    expect(filter.matches(COMPLETED)).toBe(true);
  });

  it("holds at most one status: choosing another replaces it", () => {
    const filter = SidebarFilter.NONE.toggleStatus("active").toggleStatus("completed");

    expect(filter.status).toBe("completed");
    expect(filter.matches(ACTIVE)).toBe(false);
  });

  it("asks for every chosen tag", () => {
    const filter = SidebarFilter.NONE.toggleTag("work").toggleTag("bug");

    expect([WORK_AND_BUG, WORK_ONLY].filter((each) => filter.matches(each))).toEqual([WORK_AND_BUG]);
  });

  it("drops a tag chosen again and keeps the others", () => {
    const filter = SidebarFilter.NONE.toggleTag("work").toggleTag("bug").toggleTag("bug");

    expect(filter.tags).toEqual(["work"]);
    expect([WORK_AND_BUG, WORK_ONLY].filter((each) => filter.matches(each))).toEqual([WORK_AND_BUG, WORK_ONLY]);
  });

  it("asks for the status and every tag together", () => {
    const filter = SidebarFilter.NONE.toggleStatus("active").toggleTag("work");
    const activeWork = article({ status: "active", tags: ["work"] });
    const activeOnly = article({ status: "active" });

    expect([activeWork, activeOnly].filter((each) => filter.matches(each))).toEqual([activeWork]);
  });

  it("lets go of chosen tags no article carries any more and keeps the rest", () => {
    const filter = SidebarFilter.NONE.toggleStatus("active").toggleTag("work").toggleTag("bug");

    const kept = filter.keepingTagsIn([WORK_ONLY]);

    expect(kept.tags).toEqual(["work"]);
    expect(kept.status).toBe("active");
  });

  it("never changes the filter it was made from", () => {
    const chosen = SidebarFilter.NONE.toggleStatus("active");

    chosen.toggleTag("work");

    expect(chosen.tags).toEqual([]);
    expect(SidebarFilter.NONE.status).toBeNull();
  });
});
