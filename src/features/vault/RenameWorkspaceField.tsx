import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import type { WorkspaceNameRejection } from "../../ipc/createWorkspaceOutcome";
import { useCompositionState } from "../../shared/composition/CompositionContext";
import { WORKSPACE_NAME_REJECTION_EXPLANATIONS } from "./workspaceNameRejection";

type RenameWorkspaceFieldProps = {
  workspace: string;
  rejection: WorkspaceNameRejection | null;
  onRename: (typedName: string) => Promise<boolean>;
  onCancel: () => void;
};

/** Renames in place: Enter renames and Esc gives up, unless the input method owns the key. */
export function RenameWorkspaceField({ workspace, rejection, onRename, onCancel }: RenameWorkspaceFieldProps) {
  const composition = useCompositionState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [typedName, setTypedName] = useState(workspace);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const rename = async () => {
    if (await onRename(typedName)) {
      onCancel();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (composition.ownsKey(event.nativeEvent)) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void rename();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="new-workspace-field">
      <input
        ref={inputRef}
        type="text"
        aria-label={`${workspace} 的新名稱`}
        value={typedName}
        onChange={(event) => setTypedName(event.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => composition.start()}
        onCompositionEnd={() => composition.end()}
        onBlur={() => composition.end()}
      />
      <div className="row-actions">
        <button type="button" onClick={onCancel}>
          取消
        </button>
        <button type="button" onClick={() => void rename()}>
          重新命名
        </button>
      </div>
      {rejection !== null && (
        <p className="column-message" role="alert">
          {WORKSPACE_NAME_REJECTION_EXPLANATIONS[rejection]}
        </p>
      )}
    </div>
  );
}
