import type { ArticleStatus } from "./articleStatus";

export type ArticleSummary = {
  workspace: string;
  fileName: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: ArticleStatus | null;
  tags: string[];
  hasIncompleteMetadata: boolean;
  /** The opening words of the body; `null` when it has none to read. */
  excerpt: string | null;
};

/** Which article, wherever it is listed: the same file name may live in two workspaces. */
export type ArticleLocation = Pick<ArticleSummary, "workspace" | "fileName">;
