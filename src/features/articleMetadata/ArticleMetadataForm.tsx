import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import { STATUS_CHOICES, statusChoiceNamed, statusChoiceOf, statusOf } from "../sidebar/statusChoice";
import { describeOperationFailure, type Operation } from "../vault/operationFailure";
import type { ArticleDraft } from "../vault/VaultSession";
import type { ArticleVocabulary } from "./articleVocabulary";
import { ChipInput } from "./ChipInput";
import { withChip } from "./chipValues";

/** `null` when the article was written; otherwise why it was not. */
export type ArticleMetadataSubmission = Promise<string | null>;

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
 * An article's title, status and tags in a dialog with no form
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
  const headingId = useId();
  const titleId = useId();
  const statusId = useId();
  const requirementId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const [title, setTitle] = useState(initial.title);
  const [status, setStatus] = useState(statusChoiceOf(initial.status));
  const [tags, setTags] = useState(initial.tags);
  const [typedTag, setTypedTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
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
      status: statusOf(status),
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
        <div className="dialog-field">
          <label htmlFor={statusId}>Status</label>
          <select
            id={statusId}
            value={status}
            onChange={(event) => setStatus(statusChoiceNamed(event.target.value))}
          >
            {STATUS_CHOICES.map(({ choice, label }) => (
              <option key={choice} value={choice}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <ChipInput
          label="Tags"
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
            {describeOperationFailure({ operation, message: failure })}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" disabled={isSubmitting} onClick={onClose}>
            取消
          </button>
          <button type="button" disabled={isTitleBlank || isSubmitting} onClick={() => void submit()}>
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
