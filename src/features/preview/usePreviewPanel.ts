import { useState } from "react";

import type { SettingsSession } from "../settings/SettingsSession";
import { useSettings } from "../settings/useSettings";
import { PreviewWidth } from "./PreviewWidth";

export type PreviewPanelControls = {
  width: PreviewWidth;
  /** Shows a width without remembering it, while the divider is being dragged. */
  resize: (width: PreviewWidth) => void;
  /** Shows a width and remembers it in the settings. */
  commitWidth: (width: PreviewWidth) => void;
};

/** How wide the preview is beside the editor, remembered in the settings whatever the view mode. */
export function usePreviewPanel(settings: SettingsSession): PreviewPanelControls {
  const { previewPanel } = useSettings(settings);
  const [draggedWidth, setDraggedWidth] = useState<PreviewWidth | null>(null);

  return {
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
