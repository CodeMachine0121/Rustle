import type { ArticleSummary } from "../../ipc/articleSummary";
import { statusChoiceOf, type StatusChoice } from "./statusChoice";

/**
 * What the sidebar narrows the article list to: at most one status choice
 * and any number of tags, every one of which an article must carry.
 */
export class SidebarFilter {
  static readonly NONE = new SidebarFilter(null, []);

  readonly status: StatusChoice | null;
  readonly tags: readonly string[];

  private constructor(status: StatusChoice | null, tags: readonly string[]) {
    this.status = status;
    this.tags = tags;
  }

  /** Choosing the chosen status again lets it go; another one replaces it. */
  toggleStatus(choice: StatusChoice): SidebarFilter {
    return new SidebarFilter(this.status === choice ? null : choice, this.tags);
  }

  toggleTag(tag: string): SidebarFilter {
    const tags = this.tags.includes(tag)
      ? this.tags.filter((chosen) => chosen !== tag)
      : [...this.tags, tag];
    return new SidebarFilter(this.status, tags);
  }

  matches(article: ArticleSummary): boolean {
    const hasStatus = this.status === null || statusChoiceOf(article.status) === this.status;
    return hasStatus && this.tags.every((tag) => article.tags.includes(tag));
  }
}
