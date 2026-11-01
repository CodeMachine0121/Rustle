import { useSyncExternalStore } from "react";

import type { VimMode, VimModeSession } from "./VimModeSession";

/** The mode to show, `null` while Vim mode is off; re-renders only when that changes. */
export function useVimMode(session: VimModeSession): VimMode | null {
  return useSyncExternalStore(session.subscribe, () => session.mode);
}

/** Whether Vim mode is on; re-renders only when it is turned on or off, never on a mode change. */
export function useVimEnabled(session: VimModeSession): boolean {
  return useSyncExternalStore(session.subscribe, () => session.isEnabled);
}
