import type { AutosaveSwitchOutcome } from "../autosave/AutosaveSession";

export type Operation =
  | "createArticle"
  | "updateMetadata"
  | "deleteArticle"
  | "renameWorkspace"
  | "deleteWorkspace";

/** An operation that did not happen, and the reason in the words of whoever refused it. */
export type OperationFailure = { operation: Operation; message: string };

const FAILED_OPERATION_SENTENCES: Record<Operation, string> = {
  createArticle: "建立文章失敗",
  updateMetadata: "更新 metadata 失敗",
  deleteArticle: "刪除文章失敗",
  renameWorkspace: "重新命名 workspace 失敗",
  deleteWorkspace: "刪除 workspace 失敗",
};

export const LEAVING_REFUSAL_MESSAGES: Record<Exclude<AutosaveSwitchOutcome, "switched">, string> = {
  blockedByUnansweredWarning: "請先回答標題列的外部改動提示，再試一次。",
  blockedByFailedSave: "上一次儲存失敗。再按一次就會放掉未儲存的變更並繼續。",
};

export const MODIFIED_ELSEWHERE_MESSAGE = "這篇文章剛剛被別的程式改過，什麼都沒有寫入。請再試一次。";

export function describeOperationFailure({ operation, message }: OperationFailure): string {
  return `${FAILED_OPERATION_SENTENCES[operation]}：${message}`;
}
