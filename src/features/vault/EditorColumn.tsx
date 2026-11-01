import { AutosavedEditor } from "../autosave/AutosavedEditor";
import type { AutosaveSession } from "../autosave/AutosaveSession";
import type { ScrollSynchronizer } from "../preview/ScrollSynchronizer";
import type { ImagePaste } from "../imagePaste/ImagePaste";
import type { SystemClipboardRegister } from "../vim/SystemClipboardRegister";
import type { VimModeSession } from "../vim/VimModeSession";
import { NoArticleState } from "./NoArticleState";
import type { VaultSnapshot } from "./VaultSession";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";

type EditorColumnProps = {
  snapshot: VaultSnapshot;
  autosave: AutosaveSession;
  scrollSynchronizer?: ScrollSynchronizer;
  imagePaste?: ImagePaste;
  fontSizePixels?: number;
  vimModes: VimModeSession;
  vimRegister?: SystemClipboardRegister;
};

export function EditorColumn({
  snapshot,
  autosave,
  scrollSynchronizer,
  imagePaste,
  fontSizePixels,
  vimModes,
  vimRegister,
}: EditorColumnProps) {
  const { openedDocument, indentation, bodyFailure } = snapshot;
  const messages = useMessages();
  if (bodyFailure !== null) {
    return (
      <p className="column-message" role="alert">
        {messages.articleUnreadable(bodyFailure)}
      </p>
    );
  }
  if (openedDocument === null) {
    return <NoArticleState />;
  }
  return (
    <AutosavedEditor
      session={autosave}
      indentation={indentation}
      scrollSynchronizer={scrollSynchronizer}
      imagePaste={imagePaste}
      fontSizePixels={fontSizePixels}
      vimModes={vimModes}
      vimRegister={vimRegister}
    />
  );
}
