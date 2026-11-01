import { useCallback, useEffect, useMemo } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import type { SettingsSession } from "../settings/SettingsSession";
import { useSettings } from "../settings/useSettings";
import { KeyboardShortcut } from "./KeyboardShortcut";

export type PreviewPanelControls = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

/** Whether the preview panel is open, remembered in the settings and toggled by the configured shortcut. */
export function usePreviewPanel(settings: SettingsSession): PreviewPanelControls {
  const composition = useCompositionState();
  const { previewPanel } = useSettings(settings);
  const shortcut = useMemo(
    () => KeyboardShortcut.fromSetting(previewPanel.toggleShortcut),
    [previewPanel.toggleShortcut],
  );

  const changeOpen = useCallback(
    (isOpen: (wasOpen: boolean) => boolean) =>
      settings.change((current) => ({
        ...current,
        previewPanel: { ...current.previewPanel, isOpen: isOpen(current.previewPanel.isOpen) },
      })),
    [settings],
  );

  useEffect(() => {
    const toggleOnShortcut = (event: KeyboardEvent) => {
      if (composition.ownsKey(event) || !shortcut.matches(event)) {
        return;
      }
      event.preventDefault();
      changeOpen((wasOpen) => !wasOpen);
    };
    window.addEventListener("keydown", toggleOnShortcut, { capture: true });
    return () => window.removeEventListener("keydown", toggleOnShortcut, { capture: true });
  }, [composition, shortcut, changeOpen]);

  return {
    isOpen: previewPanel.isOpen,
    open: () => changeOpen(() => true),
    close: () => changeOpen(() => false),
  };
}
