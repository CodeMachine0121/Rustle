import { describe, expect, it } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import { vocabularyOf } from "./articleVocabulary";

function article(workspace: string, tags: string[]): ArticleSummary {
  return {
    workspace,
    fileName: "a.md",
    title: "a",
    createdAt: "",
    updatedAt: "",
    status: null,
    tags,
    hasIncompleteMetadata: false,
    excerpt: null,
  };
}

describe("vocabularyOf", () => {
  it("collects every tag the articles in scope use, each once, across workspaces", () => {
    const vocabulary = vocabularyOf([
      article("Blog", ["tauri"]),
      article("Work", ["electron", "tauri"]),
    ]);

    expect(vocabulary).toEqual({ tags: ["tauri", "electron"] });
  });

  it("is empty for articles without tags", () => {
    expect(vocabularyOf([article("Blog", [])])).toEqual({ tags: [] });
  });
});
