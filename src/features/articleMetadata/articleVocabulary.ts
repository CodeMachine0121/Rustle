import type { ArticleSummary } from "../../ipc/articleSummary";

/** Every category and tag the articles of one workspace already use, each once. */
export type ArticleVocabulary = { category: string[]; tags: string[] };

export function vocabularyOf(articles: readonly ArticleSummary[]): ArticleVocabulary {
  return {
    category: [...new Set(articles.flatMap((article) => article.category))],
    tags: [...new Set(articles.flatMap((article) => article.tags))],
  };
}
