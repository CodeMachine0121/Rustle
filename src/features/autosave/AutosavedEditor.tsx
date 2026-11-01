import type { IndentationSettings } from "../editor/IndentUnit";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import type { ImagePaste } from "../imagePaste/ImagePaste";
import { ImagePasteStatusLine } from "../imagePaste/ImagePasteStatusLine";
import type { AutosaveSession } from "./AutosaveSession";
import { SaveStatusBar } from "./SaveStatusBar";
import { useEditorDocument } from "./useAutosaveSession";

type AutosavedEditorProps = {
  session: AutosaveSession;
  indentation?: IndentationSettings;
  imagePaste?: ImagePaste;
};

/** The title bar, the image paste line and the editor, with every edit going to the session. */
export function AutosavedEditor({ session, indentation, imagePaste }: AutosavedEditorProps) {
  const editorDocument = useEditorDocument(session);

  return (
    <>
      <SaveStatusBar session={session} />
      {imagePaste !== undefined && <ImagePasteStatusLine imagePaste={imagePaste} />}
      <MarkdownEditor
        documentKey={String(editorDocument.version)}
        body={editorDocument.body ?? ""}
        indentation={indentation}
        focusOnShow={editorDocument.takesFocus}
        imagePaste={imagePaste}
        onBodyChange={(body) => session.changeBody(body)}
      />
    </>
  );
}
