import type { WorkspaceNameRejection } from "./createWorkspaceOutcome";

export type RenameWorkspaceOutcome =
  | { outcome: "renamed"; workspace: string }
  | { outcome: "rejected"; reason: WorkspaceNameRejection };
