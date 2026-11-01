import type { IndentationSettings } from "../editor/IndentUnit";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import type { ImagePaste } from "../imagePaste/ImagePaste";
import { ImagePasteStatusLine } from "../imagePaste/ImagePasteStatusLine";
import type { ScrollSynchronizer } from "../preview/ScrollSynchronizer";
import type { AutosaveSession } from "./AutosaveSession";
import { SaveStatusLine } from "./SaveStatusLine";
import { useEditorDocument } from "./useAutosaveSession";

type AutosavedEditorProps = {
  session: AutosaveSession;
  indentation?: IndentationSettings;
  scrollSynchronizer?: ScrollSynchronizer;
  imagePaste?: ImagePaste;
};

/** The image paste line, the editor and the save status line under it, with every edit going to the session. */
export function AutosavedEditor({
  session,
  indentation,
  scrollSynchronizer,
  imagePaste,
}: AutosavedEditorProps) {
  const editorDocument = useEditorDocument(session);

  return (
    <>
      {imagePaste !== undefined && <ImagePasteStatusLine imagePaste={imagePaste} />}
      <MarkdownEditor
        documentKey={String(editorDocument.version)}
        body={editorDocument.body ?? ""}
        indentation={indentation}
        focusOnShow={editorDocument.takesFocus}
        imagePaste={imagePaste}
        onBodyChange={(body) => session.changeBody(body)}
        scrollSynchronizer={scrollSynchronizer}
      />
      <SaveStatusLine session={session} />
    </>
  );
}
