import type { ArticleSummary } from "../../ipc/articleSummary";

/** Every tag the articles in scope already use, each once. */
export type ArticleVocabulary = { tags: string[] };

export function vocabularyOf(articles: readonly ArticleSummary[]): ArticleVocabulary {
  return { tags: [...new Set(articles.flatMap((article) => article.tags))] };
}
