import { Plus } from "lucide-react";
import { useRef, useState } from "react";

import type { WorkspaceNameRejection } from "../../ipc/createWorkspaceOutcome";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { NewWorkspaceDialog } from "./NewWorkspaceDialog";

type NewWorkspaceEntryProps = {
  rejection: WorkspaceNameRejection | null;
  failure: string | null;
  onCreate: (typedName: string) => Promise<boolean>;
};

/** The plus icon and the dialog it opens; the keyboard goes back to the icon when it closes. */
export function NewWorkspaceEntry({ rejection, failure, onCreate }: NewWorkspaceEntryProps) {
  const messages = useMessages();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const close = () => {
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="icon-button"
        aria-label={messages.newWorkspace}
        title={messages.newWorkspace}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="icon" aria-hidden="true" />
      </button>
      {isOpen && (
        <NewWorkspaceDialog rejection={rejection} failure={failure} onCreate={onCreate} onClose={close} />
      )}
    </>
  );
}
