import type { ArticleStatus } from "../../ipc/articleStatus";

/** One of the four statuses, or the absence of one. */
export type StatusChoice = ArticleStatus | "noStatus";

export const STATUS_CHOICES: readonly StatusChoice[] = ["active", "onHold", "completed", "dropped", "noStatus"];

export function statusChoiceOf(status: ArticleStatus | null): StatusChoice {
  return status ?? "noStatus";
}

export function statusOf(choice: StatusChoice): ArticleStatus | null {
  return choice === "noStatus" ? null : choice;
}

export function statusChoiceNamed(name: string): StatusChoice {
  return STATUS_CHOICES.find((choice) => choice === name) ?? "noStatus";
}

