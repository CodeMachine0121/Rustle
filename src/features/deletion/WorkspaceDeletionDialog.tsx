import type { WorkspaceContents } from "../../ipc/workspaceContents";
import { ConfirmDeletionDialog } from "./ConfirmDeletionDialog";

type WorkspaceDeletionDialogProps = {
  workspace: string;
  contents: WorkspaceContents;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

/** `contents` must be counted right before this opens: its numbers are what the user decides on. */
export function WorkspaceDeletionDialog({ workspace, contents, onConfirm, onCancel }: WorkspaceDeletionDialogProps) {
  return (
    <ConfirmDeletionDialog
      heading={`刪除 workspace「${workspace}」？`}
      confirmLabel="刪除 workspace"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>
        將刪除 {contents.articleCount} 篇文章與 {contents.imageCount} 張圖片。
      </p>
      <p>整個 {workspace} 資料夾會移到系統垃圾桶，之後還可以從垃圾桶還原。</p>
    </ConfirmDeletionDialog>
  );
}
