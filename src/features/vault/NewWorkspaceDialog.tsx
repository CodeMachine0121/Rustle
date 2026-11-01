import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import type { WorkspaceNameRejection } from "../../ipc/createWorkspaceOutcome";
import { useCompositionState } from "../../shared/composition/CompositionContext";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";

type NewWorkspaceDialogProps = {
  rejection: WorkspaceNameRejection | null;
  failure: string | null;
  /** Resolves to whether the workspace was created. */
  onCreate: (typedName: string) => Promise<boolean>;
  onClose: () => void;
};

/**
 * A name field with 建立 and 取消. It closes itself once the workspace
 * exists; a refused name stays in the field with the reason. Esc, the
 * backdrop and 取消 close it, and a key the input method owns does nothing.
 */
export function NewWorkspaceDialog({ rejection, failure, onCreate, onClose }: NewWorkspaceDialogProps) {
  const composition = useCompositionState();
  const messages = useMessages();
  const headingId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const [typedName, setTypedName] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    fieldRef.current?.focus();
  }, []);

  const submit = async () => {
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    setHasSubmitted(true);
    const isCreated = await onCreate(typedName);
    isSubmittingRef.current = false;
    if (isCreated) {
      onClose();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (composition.ownsKey(event.nativeEvent)) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Enter" && event.target === fieldRef.current) {
      event.preventDefault();
      void submit();
    }
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const reason = rejection === null ? failure : messages.workspaceNameRejections[rejection];
  const problem = hasSubmitted ? reason : null;

  return (
    <div className="dialog-backdrop" data-testid="new-workspace-backdrop" onClick={handleBackdropClick}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="create-article-dialog new-workspace-dialog"
        onKeyDown={handleKeyDown}
      >
        <h2 id={headingId}>{messages.newWorkspace}</h2>
        <input
          ref={fieldRef}
          type="text"
          aria-label={messages.newWorkspaceName}
          value={typedName}
          onChange={(event) => setTypedName(event.target.value)}
          onCompositionStart={() => composition.start()}
          onCompositionEnd={() => composition.end()}
          onBlur={() => composition.end()}
        />
        {problem !== null && (
          <p className="column-message" role="alert">
            {problem}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            {messages.cancel}
          </button>
          <button type="button" onClick={() => void submit()}>
            {messages.create}
          </button>
        </div>
      </div>
    </div>
  );
}
