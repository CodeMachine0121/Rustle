import type { WorkspaceNameRejection } from "../../ipc/createWorkspaceOutcome";

export const WORKSPACE_NAME_REJECTION_EXPLANATIONS: Record<WorkspaceNameRejection, string> = {
  empty: "請先輸入 workspace 名稱。",
  containsPathSeparator: "名稱不能包含 / 或 \\，一個 workspace 就是一層資料夾。",
  reserved: "這是保留名稱（images，或以 . 開頭的名稱），請換一個。",
  alreadyUsed: "這個名稱已經有人用了，請換一個。",
};
