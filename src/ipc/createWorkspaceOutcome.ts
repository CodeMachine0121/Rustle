import type { WorkspaceSummary } from "./workspaceSummary";

export type WorkspaceNameRejection = "empty" | "containsPathSeparator" | "reserved" | "alreadyUsed";

export type CreateWorkspaceOutcome =
  | { outcome: "created"; workspace: WorkspaceSummary }
  | { outcome: "rejected"; reason: WorkspaceNameRejection };
