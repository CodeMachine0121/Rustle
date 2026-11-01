import { useState } from "react";

import type { WorkspaceSummary } from "../../ipc/workspaceSummary";
import { NewWorkspaceField } from "./NewWorkspaceField";
import { RenameWorkspaceField } from "./RenameWorkspaceField";
import type { VaultSnapshot } from "./VaultSession";

type WorkspaceColumnProps = {
  snapshot: VaultSnapshot;
  onSelect: (workspace: string) => void;
  onCreate: (typedName: string) => Promise<boolean>;
  onRename: (workspace: string, typedName: string) => Promise<boolean>;
  onDelete: (workspace: string) => void;
};

export function WorkspaceColumn({
  snapshot,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: WorkspaceColumnProps) {
  const { workspaces, selectedWorkspace, workspaceListFailure, renameRejection } = snapshot;
  const [renaming, setRenaming] = useState<string | null>(null);
  return (
    <>
      <NewWorkspaceField
        rejection={snapshot.creationRejection}
        failure={snapshot.creationFailure}
        onCreate={onCreate}
      />
      {workspaceListFailure !== null && (
        <p className="column-message" role="alert">
          讀不到 workspace：{workspaceListFailure}
        </p>
      )}
      {workspaceListFailure === null && workspaces.length === 0 && (
        <p className="empty-state">建立你的第一個 workspace</p>
      )}
      <ul className="column-list">
        {workspaces.map((workspace) => (
          <li key={workspace.name} className="column-item">
            {renaming === workspace.name ? (
              <RenameWorkspaceField
                workspace={workspace.name}
                rejection={renameRejection?.workspace === workspace.name ? renameRejection.reason : null}
                onRename={(typedName) => onRename(workspace.name, typedName)}
                onCancel={() => setRenaming(null)}
              />
            ) : (
              <>
                <WorkspaceRow
                  workspace={workspace}
                  isSelected={workspace.name === selectedWorkspace}
                  onSelect={onSelect}
                />
                <div className="row-actions">
                  <button
                    type="button"
                    aria-label={`重新命名 ${workspace.name}`}
                    onClick={() => setRenaming(workspace.name)}
                  >
                    重新命名
                  </button>
                  <button
                    type="button"
                    aria-label={`刪除 ${workspace.name}`}
                    onClick={() => onDelete(workspace.name)}
                  >
                    刪除
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

type WorkspaceRowProps = {
  workspace: WorkspaceSummary;
  isSelected: boolean;
  onSelect: (workspace: string) => void;
};

function WorkspaceRow({ workspace, isSelected, onSelect }: WorkspaceRowProps) {
  return (
    <button
      type="button"
      className="column-row"
      aria-pressed={isSelected}
      onClick={() => onSelect(workspace.name)}
    >
      <span className="row-title">{workspace.name}</span>
      {workspace.articleCount === null ? (
        <span className="row-count" aria-label="讀不到篇數">
          ?
        </span>
      ) : (
        <span className="row-count" aria-label={`${workspace.articleCount} 篇文章`}>
          {workspace.articleCount}
        </span>
      )}
    </button>
  );
}
