import { Plus } from "lucide-react";
import { useRef, useState } from "react";

import type { WorkspaceNameRejection } from "../../ipc/createWorkspaceOutcome";
import { IconButton } from "../../shared/icons/IconButton";
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
      <IconButton
        ref={buttonRef}
        label={messages.newWorkspace}
        icon={Plus}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      />
      {isOpen && (
        <NewWorkspaceDialog rejection={rejection} failure={failure} onCreate={onCreate} onClose={close} />
      )}
    </>
  );
}
