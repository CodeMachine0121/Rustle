import { Columns2, Maximize2, Minimize2, PanelLeftClose, PanelRightClose } from "lucide-react";
import { useEffect, useRef } from "react";

import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { VIEW_MODES, type ViewMode, type WritingLayout } from "./WritingLayout";

type ZenButtonProps = {
  layout: WritingLayout;
  isZen: boolean;
};

/** Arrows pointing out while the columns are shown, pointing in while Zen Mode hides them. */
export function ZenButton({ layout, isZen }: ZenButtonProps) {
  const messages = useMessages();
  const Mark = isZen ? Minimize2 : Maximize2;
  return (
    <button
      type="button"
      className="icon-button zen-button"
      aria-label={messages.zenMode}
      title={messages.zenMode}
      aria-pressed={isZen}
      onClick={() => layout.toggleZen()}
    >
      <Mark className="icon" aria-hidden="true" />
    </button>
  );
}

const VIEW_MODE_MARKS = {
  editorOnly: PanelRightClose,
  sideBySide: Columns2,
  previewOnly: PanelLeftClose,
} satisfies Record<ViewMode, typeof Columns2>;

type ViewModeButtonsProps = {
  layout: WritingLayout;
  viewMode: ViewMode;
};

/** The three view modes, the current one pressed. */
export function ViewModeButtons({ layout, viewMode }: ViewModeButtonsProps) {
  const messages = useMessages();
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (layout.takeControlsFocus()) {
      currentRef.current?.focus();
    }
  }, [layout]);

  return (
    <div className="view-mode-buttons" role="group" aria-label={messages.viewModesGroup}>
      {VIEW_MODES.map((mode) => {
        const Mark = VIEW_MODE_MARKS[mode];
        return (
          <button
            key={mode}
            ref={mode === viewMode ? currentRef : undefined}
            type="button"
            className="icon-button"
            aria-label={messages.viewModes[mode]}
            title={messages.viewModes[mode]}
            aria-pressed={mode === viewMode}
            onClick={() => layout.choose(mode)}
          >
            <Mark className="icon" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
