import type { ArticleVocabulary } from "../articleMetadata/articleVocabulary";
import { ArticleMetadataForm } from "../articleMetadata/ArticleMetadataForm";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { ArticleCreation, ArticleDraft } from "../vault/VaultSession";

const NO_METADATA: ArticleDraft = { title: "", category: [], tags: [] };

type CreateArticleDialogProps = {
  workspace: string;
  openedAt: Date;
  vocabulary: ArticleVocabulary;
  onCreate: (draft: ArticleDraft) => Promise<ArticleCreation>;
  onClose: () => void;
};

/** The only place a new article's title, categories and tags are typed. */
export function CreateArticleDialog({ workspace, openedAt, vocabulary, onCreate, onClose }: CreateArticleDialogProps) {
  const messages = useMessages();
  return (
    <ArticleMetadataForm
      heading={messages.newArticleHeading(workspace)}
      initial={NO_METADATA}
      vocabulary={vocabulary}
      operation="createArticle"
      submitLabel={messages.create}
      blankTitleHint={messages.blankTitleOnCreate}
      note={
        <>
          {messages.createdAt(formatMinute(openedAt))}
          <br />
          {messages.timesKeptOnCreate}
        </>
      }
      onSubmit={async (draft) => {
        const creation = await onCreate(draft);
        return creation.outcome === "created" ? null : creation.reason;
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
