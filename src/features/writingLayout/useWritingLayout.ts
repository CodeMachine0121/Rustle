import { useEffect, useMemo, useSyncExternalStore } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import { KeyboardShortcut } from "../preview/KeyboardShortcut";
import type { SettingsSession } from "../settings/SettingsSession";
import { useSettings } from "../settings/useSettings";
import type { WritingLayout, WritingLayoutSnapshot } from "./WritingLayout";

/** The layout's arrangement, with the configured preview shortcut listening for the whole window. */
export function useWritingLayout(layout: WritingLayout, settings: SettingsSession): WritingLayoutSnapshot {
  const composition = useCompositionState();
  const { previewPanel } = useSettings(settings);
  const shortcut = useMemo(
    () => KeyboardShortcut.fromSetting(previewPanel.toggleShortcut),
    [previewPanel.toggleShortcut],
  );

  useEffect(() => {
    const toggleOnShortcut = (event: KeyboardEvent) => {
      if (composition.ownsKey(event) || !shortcut.matches(event)) {
        return;
      }
      event.preventDefault();
      layout.togglePreviewFromShortcut();
    };
    window.addEventListener("keydown", toggleOnShortcut, { capture: true });
    return () => window.removeEventListener("keydown", toggleOnShortcut, { capture: true });
  }, [composition, shortcut, layout]);

  return useSyncExternalStore(layout.subscribe, () => layout.snapshot);
}
