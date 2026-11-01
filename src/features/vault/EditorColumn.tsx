import { AutosavedEditor } from "../autosave/AutosavedEditor";
import type { AutosaveSession } from "../autosave/AutosaveSession";
import type { VaultSnapshot } from "./VaultSession";

type EditorColumnProps = {
  snapshot: VaultSnapshot;
  autosave: AutosaveSession;
};

export function EditorColumn({ snapshot, autosave }: EditorColumnProps) {
  const { openedDocument, indentation, bodyFailure } = snapshot;
  if (bodyFailure !== null) {
    return (
      <p className="column-message" role="alert">
        讀不到這篇文章：{bodyFailure}
      </p>
    );
  }
  if (openedDocument === null) {
    return <p className="empty-state">選一篇文章開始寫作</p>;
  }
  return <AutosavedEditor session={autosave} indentation={indentation} />;
}
