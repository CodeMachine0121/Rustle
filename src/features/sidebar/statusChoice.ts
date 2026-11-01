import type { ArticleStatus } from "../../ipc/articleStatus";
import type { ArticleSummary } from "../../ipc/articleSummary";

/** One of the four statuses, or the absence of one. */
export type StatusChoice = ArticleStatus | "noStatus";

export const STATUS_CHOICES: ReadonlyArray<{ choice: StatusChoice; label: string }> = [
  { choice: "active", label: "Active" },
  { choice: "onHold", label: "On Hold" },
  { choice: "completed", label: "Completed" },
  { choice: "dropped", label: "Dropped" },
  { choice: "noStatus", label: "No Status" },
];

export function statusChoiceOf(status: ArticleStatus | null): StatusChoice {
  return status ?? "noStatus";
}

export function statusOf(choice: StatusChoice): ArticleStatus | null {
  return choice === "noStatus" ? null : choice;
}

export function statusChoiceNamed(name: string): StatusChoice {
  return STATUS_CHOICES.find(({ choice }) => choice === name)?.choice ?? "noStatus";
}

export function statusLabelOf(article: Pick<ArticleSummary, "status">): string | null {
  return article.status === null
    ? null
    : (STATUS_CHOICES.find(({ choice }) => choice === article.status)?.label ?? null);
}
