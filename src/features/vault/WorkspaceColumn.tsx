import type { WorkspaceSummary } from "../../ipc/workspaceSummary";
import { NewWorkspaceField } from "./NewWorkspaceField";
import type { VaultSnapshot } from "./VaultSession";

type WorkspaceColumnProps = {
  snapshot: VaultSnapshot;
  onSelect: (workspace: string) => void;
  onCreate: (typedName: string) => Promise<boolean>;
};

export function WorkspaceColumn({ snapshot, onSelect, onCreate }: WorkspaceColumnProps) {
  const { workspaces, selectedWorkspace, workspaceListFailure } = snapshot;
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
          <li key={workspace.name}>
            <WorkspaceRow
              workspace={workspace}
              isSelected={workspace.name === selectedWorkspace}
              onSelect={onSelect}
            />
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
      <span className="row-count" aria-label={`${workspace.articleCount} 篇文章`}>
        {workspace.articleCount}
      </span>
    </button>
  );
}
