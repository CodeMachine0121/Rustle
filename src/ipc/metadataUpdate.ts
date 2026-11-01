import type { ArticleStatus } from "./articleStatus";
import type { ArticleSummary } from "./articleSummary";

export type MetadataUpdateRequest = {
  workspace: string;
  fileName: string;
  title: string;
  status: ArticleStatus | null;
  tags: string[];
};

/** `modifiedElsewhere`: another program changed the file first, so nothing was written. */
export type MetadataUpdateOutcome =
  | { outcome: "updated"; article: ArticleSummary }
  | { outcome: "modifiedElsewhere" };
