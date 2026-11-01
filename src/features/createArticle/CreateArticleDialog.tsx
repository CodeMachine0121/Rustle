import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import type { ArticleVocabulary } from "../articleMetadata/articleVocabulary";
import { ChipInput } from "../articleMetadata/ChipInput";
import { withChip } from "../articleMetadata/chipValues";
import { describeOperationFailure } from "../vault/operationFailure";
import type { ArticleCreation, ArticleDraft } from "../vault/VaultSession";

type CreateArticleDialogProps = {
  openedAt: Date;
  vocabulary: ArticleVocabulary;
  onCreate: (draft: ArticleDraft) => Promise<ArticleCreation>;
  onClose: () => void;
};

/**
 * The only place a new article's title, categories and tags are typed. It
 * has no form element, so nothing is ever submitted implicitly: Enter in
 * the title creates, Enter in a chip field adds a chip, and a key the input
 * method owns does neither.
 */
export function CreateArticleDialog({ openedAt, vocabulary, onCreate, onClose }: CreateArticleDialogProps) {
  const composition = useCompositionState();
  const headingId = useId();
  const titleId = useId();
  const requirementId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const isCreatingRef = useRef(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string[]>([]);
  const [typedCategory, setTypedCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [typedTag, setTypedTag] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const isTitleBlank = title.trim() === "";

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const create = async () => {
    if (isTitleBlank || isCreatingRef.current) {
      return;
    }
    isCreatingRef.current = true;
    setIsCreating(true);
    setFailure(null);
    const creation = await onCreate({
      title: title.trim(),
      category: withChip(category, typedCategory),
      tags: withChip(tags, typedTag),
    });
    if (creation.outcome === "created") {
      onClose();
      return;
    }
    setFailure(creation.message);
    isCreatingRef.current = false;
    setIsCreating(false);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !composition.ownsKey(event.nativeEvent)) {
      event.preventDefault();
      if (!isCreatingRef.current) {
        onClose();
      }
    }
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !composition.ownsKey(event.nativeEvent)) {
      event.preventDefault();
      void create();
    }
  };

  return (
    <div className="dialog-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="create-article-dialog"
        onKeyDown={handleDialogKeyDown}
      >
        <h2 id={headingId}>新文章</h2>
        <div className="dialog-field">
          <label htmlFor={titleId}>Title</label>
          <input
            ref={titleRef}
            id={titleId}
            type="text"
            value={title}
            aria-describedby={isTitleBlank ? requirementId : undefined}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={handleTitleKeyDown}
            onCompositionStart={() => composition.start()}
            onCompositionEnd={() => composition.end()}
            onBlur={() => composition.end()}
          />
        </div>
        <ChipInput
          label="Category"
          values={category}
          typed={typedCategory}
          vocabulary={vocabulary.category}
          onValuesChange={setCategory}
          onTypedChange={setTypedCategory}
        />
        <ChipInput
          label="Tags"
          values={tags}
          typed={typedTag}
          vocabulary={vocabulary.tags}
          onValuesChange={setTags}
          onTypedChange={setTypedTag}
        />
        <p className="dialog-note">
          建立於 {formatMinute(openedAt)}
          <br />
          建立與更新時間由 Rustle 自動維護
        </p>
        {isTitleBlank && (
          <p id={requirementId} className="dialog-note">
            標題是必填的
          </p>
        )}
        {failure !== null && (
          <p className="column-message" role="alert">
            {describeOperationFailure({ operation: "createArticle", message: failure })}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" disabled={isCreating} onClick={onClose}>
            取消
          </button>
          <button type="button" disabled={isTitleBlank || isCreating} onClick={() => void create()}>
            建立
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMinute(time: Date): string {
  const twoDigits = (value: number) => String(value).padStart(2, "0");
  const date = `${time.getFullYear()}-${twoDigits(time.getMonth() + 1)}-${twoDigits(time.getDate())}`;
  return `${date} ${twoDigits(time.getHours())}:${twoDigits(time.getMinutes())}`;
}
