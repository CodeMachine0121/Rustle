import type { ArticleLocation } from "../../ipc/articleSummary";

/** The same file in the same workspace: a file name alone is not enough under All Notes. */
export function isSameArticle(first: ArticleLocation | null, second: ArticleLocation): boolean {
  return first?.workspace === second.workspace && first.fileName === second.fileName;
}
