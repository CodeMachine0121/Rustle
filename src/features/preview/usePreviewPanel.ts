import { useCallback, useEffect, useMemo, useState } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import type { SettingsSession } from "../settings/SettingsSession";
import { useSettings } from "../settings/useSettings";
import { KeyboardShortcut } from "./KeyboardShortcut";
import { PreviewWidth } from "./PreviewWidth";

export type PreviewPanelControls = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  width: PreviewWidth;
  /** Shows a width without remembering it, while the divider is being dragged. */
  resize: (width: PreviewWidth) => void;
  /** Shows a width and remembers it in the settings. */
  commitWidth: (width: PreviewWidth) => void;
};

/**
 * Whether the preview panel is open and how wide it is, remembered in the
 * settings; the configured shortcut toggles it.
 */
export function usePreviewPanel(settings: SettingsSession): PreviewPanelControls {
  const composition = useCompositionState();
  const { previewPanel } = useSettings(settings);
  const [draggedWidth, setDraggedWidth] = useState<PreviewWidth | null>(null);
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
    width: draggedWidth ?? PreviewWidth.of(previewPanel.widthRatio),
    resize: setDraggedWidth,
    commitWidth: (width) => {
      setDraggedWidth(null);
      settings.change((current) => ({
        ...current,
        previewPanel: { ...current.previewPanel, widthRatio: width.ratio },
      }));
    },
  };
}
