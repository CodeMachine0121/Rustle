import { useState, type KeyboardEvent } from "react";

import type { WorkspaceNameRejection } from "../../ipc/createWorkspaceOutcome";
import { useCompositionState } from "../../shared/composition/CompositionContext";

const INPUT_METHOD_KEY_CODE = 229;

const REJECTION_EXPLANATIONS: Record<WorkspaceNameRejection, string> = {
  empty: "名稱不可為空",
  containsPathSeparator: "名稱不能含有 / 或 \\",
  reserved: "這是保留名稱（images 或以 . 開頭的名稱）",
  alreadyUsed: "這個名稱已經被使用了",
};

type NewWorkspaceFieldProps = {
  rejection: WorkspaceNameRejection | null;
  failure: string | null;
  onCreate: (typedName: string) => Promise<boolean>;
};

export function NewWorkspaceField({ rejection, failure, onCreate }: NewWorkspaceFieldProps) {
  const composition = useCompositionState();
  const [typedName, setTypedName] = useState("");

  const submit = async () => {
    if (await onCreate(typedName)) {
      setTypedName("");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const composing =
      composition.isComposing || event.nativeEvent.isComposing || event.keyCode === INPUT_METHOD_KEY_CODE;
    if (event.key !== "Enter" || composing) {
      return;
    }
    event.preventDefault();
    void submit();
  };

  const problem = rejection === null ? failure : REJECTION_EXPLANATIONS[rejection];

  return (
    <div className="new-workspace-field">
      <input
        type="text"
        aria-label="新 workspace 名稱"
        placeholder="＋ 新增 workspace"
        value={typedName}
        onChange={(event) => setTypedName(event.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => composition.start()}
        onCompositionEnd={() => composition.end()}
        onBlur={() => composition.end()}
      />
      {problem !== null && (
        <p className="column-message" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
