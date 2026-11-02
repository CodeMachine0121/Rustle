import { Columns2, Maximize2, Minimize2, PanelLeftClose, PanelRightClose, type LucideIcon } from "lucide-react";

import { IconButton } from "../../shared/icons/IconButton";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { VIEW_MODES, type ViewMode, type WritingLayout } from "./WritingLayout";

type ZenButtonProps = {
  layout: WritingLayout;
  isZen: boolean;
};

/** Arrows pointing out while the columns are shown, pointing in while Zen Mode hides them. */
export function ZenButton({ layout, isZen }: ZenButtonProps) {
  const messages = useMessages();
  return (
    <IconButton
      className="zen-button"
      label={messages.zenMode}
      icon={isZen ? Minimize2 : Maximize2}
      aria-pressed={isZen}
      onClick={() => layout.toggleZen()}
    />
  );
}

const VIEW_MODE_MARKS = {
  editorOnly: PanelRightClose,
  sideBySide: Columns2,
  previewOnly: PanelLeftClose,
} satisfies Record<ViewMode, LucideIcon>;

type ViewModeButtonsProps = {
  layout: WritingLayout;
  viewMode: ViewMode;
};

/** The three view modes side by side, each with its mark and its short name, the current one pressed. */
export function ViewModeButtons({ layout, viewMode }: ViewModeButtonsProps) {
  const messages = useMessages();
  return (
    <div className="view-mode-buttons" role="group" aria-label={messages.viewModesGroup}>
      {VIEW_MODES.map((mode) => {
        const Mark = VIEW_MODE_MARKS[mode];
        return (
          <button
            key={mode}
            type="button"
            className="view-mode-button"
            aria-label={messages.viewModes[mode]}
            title={messages.viewModes[mode]}
            aria-pressed={mode === viewMode}
            onClick={() => layout.choose(mode)}
          >
            <Mark className="icon" aria-hidden="true" />
            <span aria-hidden="true">{messages.viewModeNames[mode]}</span>
          </button>
        );
      })}
    </div>
  );
}
