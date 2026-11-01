import type { ArticleVocabulary } from "../articleMetadata/articleVocabulary";
import { ArticleMetadataForm } from "../articleMetadata/ArticleMetadataForm";
import type { ArticleCreation, ArticleDraft } from "../vault/VaultSession";

const NO_METADATA: ArticleDraft = { title: "", status: null, tags: [] };

type CreateArticleDialogProps = {
  openedAt: Date;
  vocabulary: ArticleVocabulary;
  onCreate: (draft: ArticleDraft) => Promise<ArticleCreation>;
  onClose: () => void;
};

/** The only place a new article's title, status and tags are chosen. */
export function CreateArticleDialog({ openedAt, vocabulary, onCreate, onClose }: CreateArticleDialogProps) {
  return (
    <ArticleMetadataForm
      heading="新文章"
      initial={NO_METADATA}
      vocabulary={vocabulary}
      operation="createArticle"
      submitLabel="建立"
      blankTitleHint="標題是必填的"
      note={
        <>
          建立於 {formatMinute(openedAt)}
          <br />
          建立與更新時間由 Rustle 自動維護
        </>
      }
      onSubmit={async (draft) => {
        const creation = await onCreate(draft);
        return creation.outcome === "created" ? null : creation.message;
      }}
      onClose={onClose}
    />
  );
}

function formatMinute(time: Date): string {
  const twoDigits = (value: number) => String(value).padStart(2, "0");
  const date = `${time.getFullYear()}-${twoDigits(time.getMonth() + 1)}-${twoDigits(time.getDate())}`;
  return `${date} ${twoDigits(time.getHours())}:${twoDigits(time.getMinutes())}`;
}
