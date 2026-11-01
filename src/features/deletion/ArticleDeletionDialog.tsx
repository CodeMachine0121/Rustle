import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { ConfirmDeletionDialog } from "./ConfirmDeletionDialog";

type ArticleDeletionDialogProps = {
  title: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

export function ArticleDeletionDialog({ title, onConfirm, onCancel }: ArticleDeletionDialogProps) {
  const messages = useMessages();
  return (
    <ConfirmDeletionDialog
      heading={messages.deleteArticleHeading(title)}
      confirmLabel={messages.deleteArticleConfirm}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>{messages.deleteArticleDestination}</p>
      <p>{messages.deleteArticleKeepsImages}</p>
    </ConfirmDeletionDialog>
  );
}
