import { useEffect, useSyncExternalStore } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import { usePreviewToggleShortcut } from "../preview/usePreviewToggleShortcut";
import type { SettingsSession } from "../settings/SettingsSession";
import type { WritingLayout, WritingLayoutSnapshot } from "./WritingLayout";

/**
 * The layout's arrangement, with the configured preview shortcut listening
 * for the whole window. Esc leaves Zen Mode, but only as the last rung: an
 * Esc that anything else already took (a menu, a field, a dialog, Vim) or
 * that belongs to the input method leaves Zen Mode alone.
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

  useEffect(() => {
    const leaveZenOnEscape = (event: KeyboardEvent) => {
      const isPlainEscape =
        event.key === "Escape" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
      if (isPlainEscape && !event.defaultPrevented && !composition.ownsKey(event)) {
        layout.leaveZen();
      }
    };
    window.addEventListener("keydown", leaveZenOnEscape);
    return () => window.removeEventListener("keydown", leaveZenOnEscape);
  }, [composition, layout]);

  return useSyncExternalStore(layout.subscribe, () => layout.snapshot);
}
