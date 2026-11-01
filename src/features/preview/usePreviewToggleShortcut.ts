import { useMemo } from "react";

import type { SettingsSession } from "../settings/SettingsSession";
import { useSettings } from "../settings/useSettings";
import { KeyboardShortcut } from "./KeyboardShortcut";

/** The key that toggles the preview: the written one, or the default when there is none or it cannot be read. */
export function usePreviewToggleShortcut(settings: SettingsSession): KeyboardShortcut {
  const { toggleShortcut } = useSettings(settings).previewPanel;
  return useMemo(() => KeyboardShortcut.fromSetting(toggleShortcut), [toggleShortcut]);
}
