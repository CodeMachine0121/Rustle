import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { describeOperationFailure, type FailureReason, type Operation } from "../vault/operationFailure";
import type { ArticleDraft } from "../vault/VaultSession";
import type { ArticleVocabulary } from "./articleVocabulary";
import { ChipInput } from "./ChipInput";
import { withChip } from "./chipValues";

/** `null` when the article was written; otherwise why it was not. */
export type ArticleMetadataSubmission = Promise<FailureReason | null>;

type ArticleMetadataFormProps = {
  heading: string;
  initial: ArticleDraft;
  vocabulary: ArticleVocabulary;
  operation: Operation;
  submitLabel: string;
  blankTitleHint: string;
  note: ReactNode;
  onSubmit: (draft: ArticleDraft) => ArticleMetadataSubmission;
  onClose: () => void;
};

/**
 * An article's title, categories and tags in a dialog with no form
 * element, so nothing is ever submitted implicitly: Enter in the title
 * submits, Enter in a chip field adds a chip, Esc closes, and a key the
 * input method owns does none of these. It closes itself once submitted.
 */
export function ArticleMetadataForm({
  heading,
  initial,
  vocabulary,
  operation,
  submitLabel,
  blankTitleHint,
  note,
  onSubmit,
  onClose,
}: ArticleMetadataFormProps) {
  const composition = useCompositionState();
  const messages = useMessages();
  const headingId = useId();
  const titleId = useId();
  const requirementId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState(initial.category);
  const [typedCategory, setTypedCategory] = useState("");
  const [tags, setTags] = useState(initial.tags);
  const [typedTag, setTypedTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<FailureReason | null>(null);
  const isTitleBlank = title.trim() === "";

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const submit = async () => {
    if (isTitleBlank || isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setFailure(null);
    const refusal = await onSubmit({
      title: title.trim(),
      category: withChip(category, typedCategory),
      tags: withChip(tags, typedTag),
    });
    if (refusal === null) {
      onClose();
      return;
    }
    setFailure(refusal);
    isSubmittingRef.current = false;
    setIsSubmitting(false);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !composition.ownsKey(event.nativeEvent)) {
      event.preventDefault();
      if (!isSubmittingRef.current) {
        onClose();
      }
    }
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !composition.ownsKey(event.nativeEvent)) {
      event.preventDefault();
      void submit();
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
        <h2 id={headingId}>{heading}</h2>
        <div className="dialog-field">
          <label htmlFor={titleId}>{messages.titleField}</label>
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
          label={messages.categoryField}
          values={category}
          typed={typedCategory}
          vocabulary={vocabulary.category}
          onValuesChange={setCategory}
          onTypedChange={setTypedCategory}
        />
        <ChipInput
          label={messages.tagsField}
          values={tags}
          typed={typedTag}
          vocabulary={vocabulary.tags}
          onValuesChange={setTags}
          onTypedChange={setTypedTag}
        />
        <p className="dialog-note">{note}</p>
        {isTitleBlank && (
          <p id={requirementId} className="dialog-note">
            {blankTitleHint}
          </p>
        )}
        {failure !== null && (
          <p className="column-message" role="alert">
            {describeOperationFailure({ operation, reason: failure }, messages)}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" disabled={isSubmitting} onClick={onClose}>
            {messages.cancel}
          </button>
          <button type="button" disabled={isTitleBlank || isSubmitting} onClick={() => void submit()}>
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
