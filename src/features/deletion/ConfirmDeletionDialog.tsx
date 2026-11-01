import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";

type ConfirmDeletionDialogProps = {
  heading: string;
  confirmLabel: string;
  children: ReactNode;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

/**
 * The second step before anything goes to the trash. The keyboard starts on
 * 取消 and Enter is never bound to confirming, so one stray Enter (the
 * input method's own key) cannot delete anything; Esc cancels.
 */
export function ConfirmDeletionDialog({
  heading,
  confirmLabel,
  children,
  onConfirm,
  onCancel,
}: ConfirmDeletionDialogProps) {
  const composition = useCompositionState();
  const messages = useMessages();
  const headingId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const confirm = async () => {
    setIsDeleting(true);
    await onConfirm();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !composition.ownsKey(event.nativeEvent)) {
      event.preventDefault();
      if (!isDeleting) {
        onCancel();
      }
    }
  };

  return (
    <div className="dialog-backdrop">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={messageId}
        className="create-article-dialog"
        onKeyDown={handleKeyDown}
      >
        <h2 id={headingId}>{heading}</h2>
        <div id={messageId}>{children}</div>
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" disabled={isDeleting} onClick={onCancel}>
            {messages.cancel}
          </button>
          <button
            type="button"
            className="destructive-action"
            disabled={isDeleting}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
