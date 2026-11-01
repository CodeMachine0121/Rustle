import type { IndentationSettings } from "../editor/IndentUnit";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import type { ImagePaste } from "../imagePaste/ImagePaste";
import { ImagePasteStatusLine } from "../imagePaste/ImagePasteStatusLine";
import type { ScrollSynchronizer } from "../preview/ScrollSynchronizer";
import { useVimEnabled } from "../vim/useVimModeSession";
import { VimModeLabel } from "../vim/VimModeLabel";
import type { VimModeSession } from "../vim/VimModeSession";
import type { AutosaveSession } from "./AutosaveSession";
import { SaveStatusLine } from "./SaveStatusLine";
import { useEditorDocument } from "./useAutosaveSession";

type AutosavedEditorProps = {
  session: AutosaveSession;
  indentation?: IndentationSettings;
  scrollSynchronizer?: ScrollSynchronizer;
  imagePaste?: ImagePaste;
  fontSizePixels?: number;
  vimModes: VimModeSession;
};

/**
 * The image paste line, the editor and the save status line under it, with
 * every edit going to the session. The editor follows Vim mode being turned
 * on or off; the mode itself goes straight to the status line, so a mode
 * change never re-renders the editor.
 */
export function AutosavedEditor({
  session,
  indentation,
  scrollSynchronizer,
  imagePaste,
  fontSizePixels,
  vimModes,
}: AutosavedEditorProps) {
  const editorDocument = useEditorDocument(session);
  const vimEnabled = useVimEnabled(vimModes);

  return (
    <>
      {imagePaste !== undefined && <ImagePasteStatusLine imagePaste={imagePaste} />}
      <MarkdownEditor
        documentKey={String(editorDocument.version)}
        body={editorDocument.body ?? ""}
        indentation={indentation}
        focusOnShow={editorDocument.takesFocus}
        cursorPlacement={editorDocument.cursorPlacement}
        imagePaste={imagePaste}
        onBodyChange={(body) => session.changeBody(body)}
        scrollSynchronizer={scrollSynchronizer}
        fontSizePixels={fontSizePixels}
        vimEnabled={vimEnabled}
        onVimModeChange={vimModes.report}
      />
      <SaveStatusLine session={session} modeLabel={<VimModeLabel session={vimModes} />} />
    </>
  );
}
