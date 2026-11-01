import type { WorkspaceContents } from "../../ipc/workspaceContents";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { ConfirmDeletionDialog } from "./ConfirmDeletionDialog";

type WorkspaceDeletionDialogProps = {
  workspace: string;
  contents: WorkspaceContents;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

/** `contents` must be counted right before this opens: its numbers are what the user decides on. */
export function WorkspaceDeletionDialog({ workspace, contents, onConfirm, onCancel }: WorkspaceDeletionDialogProps) {
  const messages = useMessages();
  return (
    <ConfirmDeletionDialog
      heading={messages.deleteWorkspaceHeading(workspace)}
      confirmLabel={messages.deleteWorkspaceConfirm}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>{messages.deleteWorkspaceContents(contents.articleCount, contents.imageCount)}</p>
      <p>{messages.deleteWorkspaceDestination(workspace)}</p>
    </ConfirmDeletionDialog>
  );
}
