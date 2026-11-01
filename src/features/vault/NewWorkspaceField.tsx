import { useState, type KeyboardEvent } from "react";

import type { WorkspaceNameRejection } from "../../ipc/createWorkspaceOutcome";
import { useCompositionState } from "../../shared/composition/CompositionContext";
import { WORKSPACE_NAME_REJECTION_EXPLANATIONS } from "./workspaceNameRejection";

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
    if (event.key !== "Enter" || composition.ownsKey(event.nativeEvent)) {
      return;
    }
    event.preventDefault();
    void submit();
  };

  const problem = rejection === null ? failure : WORKSPACE_NAME_REJECTION_EXPLANATIONS[rejection];

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
