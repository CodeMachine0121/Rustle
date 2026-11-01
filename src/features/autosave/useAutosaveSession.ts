import { useSyncExternalStore } from "react";

import type { AutosaveSession, AutosaveStatus, EditorDocument } from "./AutosaveSession";

export function useAutosaveStatus(session: AutosaveSession): AutosaveStatus {
  return useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.status,
  );
}

export function useEditorDocument(session: AutosaveSession): EditorDocument {
  return useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.document,
  );
}
