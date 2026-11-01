import type { ArticleSummary } from "../../ipc/articleSummary";
import type { ArticleVocabulary } from "../articleMetadata/articleVocabulary";
import { ArticleMetadataForm } from "../articleMetadata/ArticleMetadataForm";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { Messages } from "../interfaceLanguage/messages";
import type { ArticleDraft, MetadataEdit } from "../vault/VaultSession";

const MINUTE_AS_WRITTEN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

type EditArticleMetadataDialogProps = {
  article: ArticleSummary;
  vocabulary: ArticleVocabulary;
  onSave: (draft: ArticleDraft) => Promise<MetadataEdit>;
  onClose: () => void;
};

/**
 * The create dialog's form, filled with what the article says now. Both
 * times are shown as the file wrote them, in the file's own time zone, and
 * cannot be edited.
 */
export function EditArticleMetadataDialog({ article, vocabulary, onSave, onClose }: EditArticleMetadataDialogProps) {
  const messages = useMessages();
  return (
    <ArticleMetadataForm
      heading={messages.editMetadataHeading(article.fileName)}
      initial={article}
      vocabulary={vocabulary}
      operation="updateMetadata"
      submitLabel={messages.save}
      blankTitleHint={messages.blankTitleOnEdit}
      note={
        <>
          {messages.createdAt(minuteAsWritten(article.createdAt, messages))}
          <br />
          {messages.updatedAt(minuteAsWritten(article.updatedAt, messages))}
          <br />
          {messages.timesKeptOnEdit}
        </>
      }
      onSubmit={async (draft) => {
        const edit = await onSave(draft);
        return edit.outcome === "updated" ? null : edit.reason;
      }}
      onClose={onClose}
    />
  );
}

function minuteAsWritten(timestamp: string, messages: Messages): string {
  if (timestamp === "") {
    return messages.notRecordedInFile;
  }
  const minute = MINUTE_AS_WRITTEN.exec(timestamp);
  return minute === null ? timestamp : `${minute[1]} ${minute[2]}`;
}
