import type { ArticleSummary } from "./articleSummary";

export type MetadataUpdateRequest = {
  workspace: string;
  fileName: string;
  title: string;
  category: string[];
  tags: string[];
};

/** `modifiedElsewhere`: another program changed the file first, so nothing was written. */
export type MetadataUpdateOutcome =
  | { outcome: "updated"; article: ArticleSummary }
  | { outcome: "modifiedElsewhere" };
