import type { ArticleSummary } from "../../ipc/articleSummary";
import type { ArticleVocabulary } from "../articleMetadata/articleVocabulary";
import { ArticleMetadataForm } from "../articleMetadata/ArticleMetadataForm";
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
  return (
    <ArticleMetadataForm
      heading={`編輯 metadata · ${article.fileName}`}
      initial={article}
      vocabulary={vocabulary}
      operation="updateMetadata"
      submitLabel="儲存"
      blankTitleHint="請先輸入標題，「儲存」才會啟用。"
      note={
        <>
          建立於 {minuteAsWritten(article.createdAt)}
          <br />
          更新於 {minuteAsWritten(article.updatedAt)}
          <br />
          建立時間與更新時間都由 Rustle 自己維護，不能編輯。檔名也不會因為改標題而改變。
        </>
      }
      onSubmit={async (draft) => {
        const edit = await onSave(draft);
        return edit.outcome === "updated" ? null : edit.message;
      }}
      onClose={onClose}
    />
  );
}

function minuteAsWritten(timestamp: string): string {
  if (timestamp === "") {
    return "（檔案沒有記錄）";
  }
  const minute = MINUTE_AS_WRITTEN.exec(timestamp);
  return minute === null ? timestamp : `${minute[1]} ${minute[2]}`;
}
