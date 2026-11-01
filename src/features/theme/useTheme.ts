import { useSyncExternalStore } from "react";

import type { ThemeMenu, ThemeSession } from "./ThemeSession";

export function useTheme(session: ThemeSession): ThemeMenu {
  return useSyncExternalStore(session.subscribe, () => session.menu);
}
