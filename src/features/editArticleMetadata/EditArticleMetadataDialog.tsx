import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import type { ArticleSummary } from "../../ipc/articleSummary";
import { useCompositionState } from "../../shared/composition/CompositionContext";
import type { ArticleVocabulary } from "../articleMetadata/articleVocabulary";
import { ChipInput } from "../articleMetadata/ChipInput";
import { withChip } from "../articleMetadata/chipValues";
import { describeOperationFailure } from "../vault/operationFailure";
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
 * cannot be edited. Like the create dialog it has no form element, and a
 * key the input method owns neither saves nor closes it.
 */
export function EditArticleMetadataDialog({
  article,
  vocabulary,
  onSave,
  onClose,
}: EditArticleMetadataDialogProps) {
  const composition = useCompositionState();
  const headingId = useId();
  const titleId = useId();
  const requirementId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);
  const [title, setTitle] = useState(article.title);
  const [category, setCategory] = useState(article.category);
  const [typedCategory, setTypedCategory] = useState("");
  const [tags, setTags] = useState(article.tags);
  const [typedTag, setTypedTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const isTitleBlank = title.trim() === "";

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const save = async () => {
    if (isTitleBlank || isSavingRef.current) {
      return;
    }
    isSavingRef.current = true;
    setIsSaving(true);
    setFailure(null);
    const edit = await onSave({
      title: title.trim(),
      category: withChip(category, typedCategory),
      tags: withChip(tags, typedTag),
    });
    if (edit.outcome === "updated") {
      onClose();
      return;
    }
    setFailure(edit.message);
    isSavingRef.current = false;
    setIsSaving(false);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !composition.ownsKey(event.nativeEvent)) {
      event.preventDefault();
      if (!isSavingRef.current) {
        onClose();
      }
    }
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !composition.ownsKey(event.nativeEvent)) {
      event.preventDefault();
      void save();
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
        <h2 id={headingId}>編輯 metadata · {article.fileName}</h2>
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
          建立於 {minuteAsWritten(article.createdAt)}
          <br />
          更新於 {minuteAsWritten(article.updatedAt)}
          <br />
          建立時間與更新時間都由 Rustle 自己維護，不能編輯。檔名也不會因為改標題而改變。
        </p>
        {isTitleBlank && (
          <p id={requirementId} className="dialog-note">
            請先輸入標題，「儲存」才會啟用。
          </p>
        )}
        {failure !== null && (
          <p className="column-message" role="alert">
            {describeOperationFailure({ operation: "updateMetadata", message: failure })}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" disabled={isSaving} onClick={onClose}>
            取消
          </button>
          <button type="button" disabled={isTitleBlank || isSaving} onClick={() => void save()}>
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}

function minuteAsWritten(timestamp: string): string {
  if (timestamp === "") {
    return "（檔案沒有記錄）";
  }
  const minute = MINUTE_AS_WRITTEN.exec(timestamp);
  return minute === null ? timestamp : `${minute[1]} ${minute[2]}`;
}
