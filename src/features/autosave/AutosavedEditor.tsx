import { MarkdownEditor } from "../editor/MarkdownEditor";
import type { AutosaveSession } from "./AutosaveSession";
import { SaveStatusBar } from "./SaveStatusBar";
import { useEditorDocument } from "./useAutosaveSession";

type AutosavedEditorProps = {
  session: AutosaveSession;
  placeholderBody: string;
};

/** The title bar and the editor, with every edit going to the session. */
export function AutosavedEditor({ session, placeholderBody }: AutosavedEditorProps) {
  const editorDocument = useEditorDocument(session);

  return (
    <>
      <SaveStatusBar session={session} />
      <MarkdownEditor
        key={editorDocument.version}
        initialBody={editorDocument.body ?? placeholderBody}
        onBodyChange={(body) => session.changeBody(body)}
      />
    </>
  );
}
