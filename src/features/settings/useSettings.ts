import { useSyncExternalStore } from "react";

import type { Settings } from "../../ipc/settings";
import type { SettingsSession } from "./SettingsSession";

export function useSettings(session: SettingsSession): Settings {
  return useSyncExternalStore(session.subscribe, () => session.settings);
}
