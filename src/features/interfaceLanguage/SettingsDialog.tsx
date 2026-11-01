import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import { KeymapOverview } from "../keymap/KeymapOverview";
import type { KeyboardShortcut } from "../preview/KeyboardShortcut";
import type { ThemeMenu } from "../theme/ThemeSession";
import { ThemeSetting } from "../theme/ThemeSetting";
import type { VimModeSession } from "../vim/VimModeSession";
import { VimModeSetting } from "../vim/VimModeSetting";
import { LANGUAGE_OPTIONS, documentLanguageOf, type InterfaceLanguage } from "./interfaceLanguage";
import { useMessages } from "./InterfaceLanguageContext";

type SettingsDialogProps = {
  language: InterfaceLanguage;
  onChoose: (language: InterfaceLanguage) => void;
  theme: ThemeMenu;
  vimModes: VimModeSession;
  previewToggle: KeyboardShortcut;
  onClose: () => void;
};

/**
 * The settings, over a dimmed screen like every other dialog. Choosing a
 * language closes it; a theme or Vim mode applies at once and leaves it
 * open; Esc or a click on the dimmed backdrop only closes it. The keyboard
 * shortcuts take the dialog's place until Back; Esc closes the whole
 * dialog from either page, and it always opens on the settings.
 */
export function SettingsDialog({ language, onChoose, theme, vimModes, previewToggle, onClose }: SettingsDialogProps) {
  const messages = useMessages();
  const composition = useCompositionState();
  const headingId = useId();
  const languageLabelId = useId();
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const keymapButtonRef = useRef<HTMLButtonElement>(null);
  const hasShownKeymapRef = useRef(false);
  const [page, setPage] = useState<"settings" | "keymap">("settings");

  useEffect(() => {
    if (page === "settings") {
      (hasShownKeymapRef.current ? keymapButtonRef : firstOptionRef).current?.focus();
    }
  }, [page]);

  const showKeymap = () => {
    hasShownKeymapRef.current = true;
    setPage("keymap");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !composition.ownsKey(event.nativeEvent)) {
      event.preventDefault();
      onClose();
    }
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="dialog-backdrop" data-testid="settings-backdrop" onClick={handleBackdropClick}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="create-article-dialog settings-dialog"
        onKeyDown={handleKeyDown}
      >
        {page === "keymap" ? (
          <KeymapOverview headingId={headingId} previewToggle={previewToggle} onBack={() => setPage("settings")} />
        ) : (
          <>
            <h2 id={headingId}>{messages.settings}</h2>
            <section className="settings-item">
              <h3 id={languageLabelId}>{messages.language}</h3>
              <div role="radiogroup" aria-labelledby={languageLabelId} className="settings-options">
                {LANGUAGE_OPTIONS.map((option, index) => (
                  <button
                    key={option.language}
                    ref={index === 0 ? firstOptionRef : undefined}
                    type="button"
                    role="radio"
                    aria-checked={option.language === language}
                    lang={documentLanguageOf(option.language)}
                    onClick={() => {
                      onChoose(option.language);
                      onClose();
                    }}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </section>
            <ThemeSetting menu={theme} language={language} />
            <VimModeSetting session={vimModes} />
            <button ref={keymapButtonRef} type="button" className="settings-keymap-button" onClick={showKeymap}>
              {messages.keyboardShortcuts}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
