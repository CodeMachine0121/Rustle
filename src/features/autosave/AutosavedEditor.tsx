import type { IndentationSettings } from "../editor/IndentUnit";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import type { ScrollSynchronizer } from "../preview/ScrollSynchronizer";
import type { AutosaveSession } from "./AutosaveSession";
import { SaveStatusBar } from "./SaveStatusBar";
import { useEditorDocument } from "./useAutosaveSession";

type AutosavedEditorProps = {
  session: AutosaveSession;
  indentation?: IndentationSettings;
  scrollSynchronizer?: ScrollSynchronizer;
};

/** The title bar and the editor, with every edit going to the session. */
export function AutosavedEditor({ session, indentation, scrollSynchronizer }: AutosavedEditorProps) {
  const editorDocument = useEditorDocument(session);

  return (
    <>
      <SaveStatusBar session={session} />
      <MarkdownEditor
        documentKey={String(editorDocument.version)}
        body={editorDocument.body ?? ""}
        indentation={indentation}
        focusOnShow={editorDocument.takesFocus}
        onBodyChange={(body) => session.changeBody(body)}
        scrollSynchronizer={scrollSynchronizer}
      />
    </>
  );
}
