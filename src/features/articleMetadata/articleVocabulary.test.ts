import { describe, expect, it } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import { vocabularyOf } from "./articleVocabulary";

function article(category: string[], tags: string[]): ArticleSummary {
  return { fileName: "a.md", title: "a", createdAt: "", updatedAt: "", category, tags, hasIncompleteMetadata: false };
}

describe("vocabularyOf", () => {
  it("collects every category and tag the articles use, each once", () => {
    const vocabulary = vocabularyOf([
      article(["技術筆記"], []),
      article(["技術筆記", "桌面開發"], ["tauri"]),
      article([], ["electron", "tauri"]),
    ]);

    expect(vocabulary).toEqual({ category: ["技術筆記", "桌面開發"], tags: ["tauri", "electron"] });
  });

  it("is empty for articles without categories or tags", () => {
    expect(vocabularyOf([article([], [])])).toEqual({ category: [], tags: [] });
  });
});
