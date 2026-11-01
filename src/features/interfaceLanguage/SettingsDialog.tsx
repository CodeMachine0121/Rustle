import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
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
  onClose: () => void;
};

/**
 * The settings, over a dimmed screen like every other dialog. Choosing a
 * language closes it; a theme or Vim mode applies at once and leaves it
 * open; Esc or a click on the dimmed backdrop only closes it.
 */
export function SettingsDialog({ language, onChoose, theme, vimModes, onClose }: SettingsDialogProps) {
  const messages = useMessages();
  const composition = useCompositionState();
  const headingId = useId();
  const languageLabelId = useId();
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstOptionRef.current?.focus();
  }, []);

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
      </div>
    </div>
  );
}
