import { useState } from "react";

import type { WorkspaceSummary } from "../../ipc/workspaceSummary";
import { RenameWorkspaceField } from "./RenameWorkspaceField";
import type { VaultSnapshot } from "./VaultSession";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";

type WorkspaceColumnProps = {
  snapshot: VaultSnapshot;
  onSelect: (workspace: string) => void;
  onRename: (workspace: string, typedName: string) => Promise<boolean>;
  onDelete: (workspace: string) => void;
};

export function WorkspaceColumn({
  snapshot,
  onSelect,
  onRename,
  onDelete,
}: WorkspaceColumnProps) {
  const { workspaces, selectedWorkspace, workspaceListFailure, renameRejection } = snapshot;
  const [renaming, setRenaming] = useState<string | null>(null);
  const messages = useMessages();
  return (
    <>
      {workspaceListFailure !== null && (
        <p className="column-message" role="alert">
          {messages.vaultUnreadable(workspaceListFailure)}
        </p>
      )}
      {workspaceListFailure === null && workspaces.length === 0 && (
        <p className="empty-state">{messages.firstWorkspace}</p>
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
                    aria-label={messages.renameWorkspace(workspace.name)}
                    onClick={() => setRenaming(workspace.name)}
                  >
                    {messages.rename}
                  </button>
                  <button
                    type="button"
                    aria-label={messages.deleteWorkspace(workspace.name)}
                    onClick={() => onDelete(workspace.name)}
                  >
                    {messages.delete}
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
  const messages = useMessages();
  return (
    <button
      type="button"
      className="column-row"
      aria-pressed={isSelected}
      onClick={() => onSelect(workspace.name)}
    >
      <span className="row-title">{workspace.name}</span>
      {workspace.articleCount === null ? (
        <span className="row-count" aria-label={messages.unknownArticleCount}>
          ?
        </span>
      ) : (
        <span className="row-count" aria-label={messages.articleCount(workspace.articleCount)}>
          {workspace.articleCount}
        </span>
      )}
    </button>
  );
}
