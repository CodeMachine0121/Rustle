import { AutosavedEditor } from "../autosave/AutosavedEditor";
import type { AutosaveSession } from "../autosave/AutosaveSession";
import type { ScrollSynchronizer } from "../preview/ScrollSynchronizer";
import { NoArticleState } from "./NoArticleState";
import type { VaultSnapshot } from "./VaultSession";

type EditorColumnProps = {
  snapshot: VaultSnapshot;
  autosave: AutosaveSession;
  scrollSynchronizer?: ScrollSynchronizer;
};

export function EditorColumn({ snapshot, autosave, scrollSynchronizer }: EditorColumnProps) {
  const { openedDocument, indentation, bodyFailure } = snapshot;
  if (bodyFailure !== null) {
    return (
      <p className="column-message" role="alert">
        讀不到這篇文章：{bodyFailure}
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
    />
  );
}
