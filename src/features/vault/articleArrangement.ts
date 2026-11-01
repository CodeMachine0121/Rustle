import type { ArticleLocation, ArticleSummary } from "../../ipc/articleSummary";
import { SidebarFilter } from "../sidebar/SidebarFilter";
import { isSameArticle } from "./articleLocation";

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
  /** Shown even when the filters leave it out: the article open in the editor. */
  openArticle: ArticleLocation | null;
};

export type ArrangedArticle = {
  article: ArticleSummary;
  /** Listed only because it is the open article. */
  isOutsideFilter: boolean;
};

/**
 * The rows the article column draws, newest created first: the sidebar
 * filter and the text filter both narrow the list, the open article always
 * stays. Articles without a creation time come last; ties go by title, then
 * workspace, then file name. The given list is left as it was.
 */
export function arrangeArticles(
  articles: readonly ArticleSummary[],
  { filterText, sidebarFilter, openArticle }: ArticleArrangement,
): ArrangedArticle[] {
  const filter = new ArticleFilter(filterText);
  const shown = articles
    .map((article) => ({
      article,
      isOutsideFilter: !sidebarFilter.matches(article) || !filter.matches(article),
    }))
    .filter(({ article, isOutsideFilter }) => !isOutsideFilter || isSameArticle(openArticle, article));
  const keyed = shown.map((row) => ({ row, instant: instantOf(row.article.createdAt) }));
  keyed.sort(
    (first, second) =>
      compareNewestFirst(first.instant, second.instant) ||
      first.row.article.title.localeCompare(second.row.article.title) ||
      first.row.article.workspace.localeCompare(second.row.article.workspace) ||
      first.row.article.fileName.localeCompare(second.row.article.fileName),
  );
  return keyed.map(({ row }) => row);
}

/** Every article in the list's order, with no filter. */
export function orderArticles(articles: readonly ArticleSummary[]): ArticleSummary[] {
  return arrangeArticles(articles, {
    filterText: "",
    sidebarFilter: SidebarFilter.NONE,
    openArticle: null,
  }).map(({ article }) => article);
}

/** The article the list shows first with no filter: what "the newest one" means everywhere. */
export function firstArticleIn(articles: readonly ArticleSummary[]): ArticleSummary | null {
  return orderArticles(articles)[0] ?? null;
}

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
