import type { AutosaveSwitchOutcome } from "../autosave/AutosaveSession";
import type { Messages } from "../interfaceLanguage/messages";

export type Operation =
  | "createArticle"
  | "updateMetadata"
  | "deleteArticle"
  | "renameWorkspace"
  | "deleteWorkspace";

export type LeavingRefusal = Exclude<AutosaveSwitchOutcome, "switched">;

/** Why something did not happen. Put into words only when shown, so the words follow the interface language. */
export type FailureReason =
  | { kind: "reported"; message: string }
  | { kind: "leavingRefused"; refusal: LeavingRefusal }
  | { kind: "modifiedElsewhere" }
  | { kind: "noWorkspaceSelected" };

export type OperationFailure = { operation: Operation; reason: FailureReason };

export function reportedFailure(message: string): FailureReason {
  return { kind: "reported", message };
}

export function describeFailureReason(reason: FailureReason, messages: Messages): string {
  switch (reason.kind) {
    case "reported":
      return reason.message;
    case "leavingRefused":
      return messages.leavingRefusals[reason.refusal];
    case "modifiedElsewhere":
      return messages.modifiedElsewhere;
    case "noWorkspaceSelected":
      return messages.noWorkspaceSelected;
  }
}

export function describeOperationFailure({ operation, reason }: OperationFailure, messages: Messages): string {
  return messages.failureWithReason(messages.failedOperations[operation], describeFailureReason(reason, messages));
}
