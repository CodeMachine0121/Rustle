import { ConfirmDeletionDialog } from "./ConfirmDeletionDialog";

type ArticleDeletionDialogProps = {
  title: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

export function ArticleDeletionDialog({ title, onConfirm, onCancel }: ArticleDeletionDialogProps) {
  return (
    <ConfirmDeletionDialog heading={`刪除「${title}」？`} confirmLabel="刪除文章" onConfirm={onConfirm} onCancel={onCancel}>
      <p>這篇文章會移到系統垃圾桶，之後還可以從垃圾桶還原。</p>
      <p>它用到的圖片一張都不會被刪除——images/ 是整個 workspace 共用的，同一張圖可能還被別篇引用。</p>
    </ConfirmDeletionDialog>
  );
}
