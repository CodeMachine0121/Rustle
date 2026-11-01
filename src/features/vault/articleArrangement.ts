import type { ArticleSummary } from "../../ipc/articleSummary";

export type ArticleOrder = "createdNewestFirst" | "title" | "updatedNewestFirst";

export const DEFAULT_ARTICLE_ORDER: ArticleOrder = "createdNewestFirst";

export const ARTICLE_ORDERS: ReadonlyArray<{ order: ArticleOrder; label: string }> = [
  { order: "createdNewestFirst", label: "建立時間（新到舊）" },
  { order: "title", label: "標題" },
  { order: "updatedNewestFirst", label: "更新時間（新到舊）" },
];

export function articleOrderNamed(name: string): ArticleOrder {
  return ARTICLE_ORDERS.find(({ order }) => order === name)?.order ?? DEFAULT_ARTICLE_ORDER;
}

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** A case-insensitive piece of text looked for in an article's title, categories and tags. */
class ArticleFilter {
  readonly #needle: string;

  constructor(text: string) {
    this.#needle = text.trim().toLowerCase();
  }

  matches(article: ArticleSummary): boolean {
    return [article.title, ...article.category, ...article.tags].some((text) =>
      text.toLowerCase().includes(this.#needle),
    );
  }
}

export type ArticleArrangement = {
  filterText: string;
  order: ArticleOrder;
  /** Shown even when the filter leaves it out: the article open in the editor. */
  openArticle: string | null;
};

export type ArrangedArticle = {
  article: ArticleSummary;
  /** Listed only because it is the open article. */
  isOutsideFilter: boolean;
};

/** The rows the article column draws, in order. The given list is left as it was. */
export function arrangeArticles(
  articles: readonly ArticleSummary[],
  { filterText, order, openArticle }: ArticleArrangement,
): ArrangedArticle[] {
  const filter = new ArticleFilter(filterText);
  const shown = articles
    .map((article) => ({ article, isOutsideFilter: !filter.matches(article) }))
    .filter(({ article, isOutsideFilter }) => !isOutsideFilter || article.fileName === openArticle);
  const compareKeys = ORDER_KEYS[order];
  const keyed = shown.map((row) => ({ row, key: compareKeys(row.article) }));
  keyed.sort(
    (first, second) =>
      compareNewestFirst(first.key, second.key) ||
      first.row.article.title.localeCompare(second.row.article.title) ||
      first.row.article.fileName.localeCompare(second.row.article.fileName),
  );
  return keyed.map(({ row }) => row);
}

const ORDER_KEYS: Record<ArticleOrder, (article: ArticleSummary) => number | null> = {
  createdNewestFirst: (article) => instantOf(article.createdAt),
  updatedNewestFirst: (article) => instantOf(article.updatedAt),
  title: () => null,
};

function instantOf(text: string): number | null {
  if (!ISO_DATE_TIME.test(text)) {
    return null;
  }
  const instant = Date.parse(text);
  return Number.isNaN(instant) ? null : instant;
}

function compareNewestFirst(first: number | null, second: number | null): number {
  if (first === second) {
    return 0;
  }
  if (first === null) {
    return 1;
  }
  if (second === null) {
    return -1;
  }
  return second - first;
}
