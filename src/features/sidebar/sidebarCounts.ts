import type { ArticleSummary } from "../../ipc/articleSummary";
import { STATUS_CHOICES, statusChoiceOf, type StatusChoice } from "./statusChoice";

export type StatusCount = { choice: StatusChoice; label: string; count: number };

export type TagCount = { tag: string; count: number };

export type SidebarCounts = { statuses: StatusCount[]; tags: TagCount[] };

/**
 * How many of the given articles have each status (all five, even at zero)
 * and each tag (most used first, then by name). Counted over the whole
 * scope, so a selection never changes them.
 */
export function sidebarCounts(articles: readonly ArticleSummary[]): SidebarCounts {
  const statusCounts = new Map<StatusChoice, number>();
  const tagCounts = new Map<string, number>();
  for (const article of articles) {
    const choice = statusChoiceOf(article.status);
    statusCounts.set(choice, (statusCounts.get(choice) ?? 0) + 1);
    for (const tag of article.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  return {
    statuses: STATUS_CHOICES.map(({ choice, label }) => ({
      choice,
      label,
      count: statusCounts.get(choice) ?? 0,
    })),
    tags: [...tagCounts]
      .map(([tag, count]) => ({ tag, count }))
      .sort((first, second) => second.count - first.count || compareNames(first.tag, second.tag)),
  };
}

function compareNames(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}
