import { useEffect, useSyncExternalStore } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import { usePreviewToggleShortcut } from "../preview/usePreviewToggleShortcut";
import type { SettingsSession } from "../settings/SettingsSession";
import type { WritingLayout, WritingLayoutSnapshot } from "./WritingLayout";

/**
 * The layout's arrangement, with the configured preview shortcut listening
 * for the whole window. Esc has nothing to do with Zen Mode.
 */
export function useWritingLayout(layout: WritingLayout, settings: SettingsSession): WritingLayoutSnapshot {
  const composition = useCompositionState();
  const shortcut = usePreviewToggleShortcut(settings);

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
