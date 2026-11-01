import type { ArticleStatus } from "./articleStatus";

export type CreateArticleRequest = {
  workspace: string;
  title: string;
  status: ArticleStatus | null;
  tags: string[];
};
