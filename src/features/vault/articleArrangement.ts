import type { ArticleLocation, ArticleSummary } from "../../ipc/articleSummary";
import type { SidebarFilter } from "../sidebar/SidebarFilter";
import { isSameArticle } from "./articleLocation";

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

/** A case-insensitive piece of text looked for in an article's title and tags. */
class ArticleFilter {
  readonly #needle: string;

  constructor(text: string) {
    this.#needle = text.trim().toLowerCase();
  }

  matches(article: ArticleSummary): boolean {
    return [article.title, ...article.tags].some((text) =>
      text.toLowerCase().includes(this.#needle),
    );
  }
}

export type ArticleArrangement = {
  filterText: string;
  sidebarFilter: SidebarFilter;
  order: ArticleOrder;
  /** Shown even when the filters leave it out: the article open in the editor. */
  openArticle: ArticleLocation | null;
};

export type ArrangedArticle = {
  article: ArticleSummary;
  /** Listed only because it is the open article. */
  isOutsideFilter: boolean;
};

/**
 * The rows the article column draws, in order: the sidebar filter and the
 * text filter both narrow the list, the open article always stays. The
 * given list is left as it was.
 */
export function arrangeArticles(
  articles: readonly ArticleSummary[],
  { filterText, sidebarFilter, order, openArticle }: ArticleArrangement,
): ArrangedArticle[] {
  const filter = new ArticleFilter(filterText);
  const shown = articles
    .map((article) => ({
      article,
      isOutsideFilter: !sidebarFilter.matches(article) || !filter.matches(article),
    }))
    .filter(({ article, isOutsideFilter }) => !isOutsideFilter || isSameArticle(openArticle, article));
  const instantToOrderBy = ORDER_INSTANTS[order];
  const keyed = shown.map((row) => ({ row, instant: instantToOrderBy(row.article) }));
  keyed.sort(
    (first, second) =>
      compareNewestFirst(first.instant, second.instant) ||
      first.row.article.title.localeCompare(second.row.article.title) ||
      first.row.article.workspace.localeCompare(second.row.article.workspace) ||
      first.row.article.fileName.localeCompare(second.row.article.fileName),
  );
  return keyed.map(({ row }) => row);
}

/** The time each order puts newest first. Ordering by title has none, so the title decides. */
const ORDER_INSTANTS: Record<ArticleOrder, (article: ArticleSummary) => number | null> = {
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
