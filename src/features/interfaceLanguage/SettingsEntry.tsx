import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import type { KeyboardShortcut } from "../preview/KeyboardShortcut";
import type { ThemeMenu } from "../theme/ThemeSession";
import type { VimModeSession } from "../vim/VimModeSession";
import type { InterfaceLanguage } from "./interfaceLanguage";
import { SettingsButton } from "./SettingsButton";
import { SettingsDialog } from "./SettingsDialog";

type SettingsEntryProps = {
  language: InterfaceLanguage;
  onChoose: (language: InterfaceLanguage) => void;
  theme: ThemeMenu;
  vimModes: VimModeSession;
  previewToggle: KeyboardShortcut;
};

/**
 * The gear and the settings it opens. Cmd+, (Ctrl+, too) opens and closes
 * them like the gear does, from anywhere and even while the gear itself is
 * hidden, except while an input method composes; the key is fixed, as on
 * every Mac. The keyboard goes back to the gear, or to wherever it was when
 * the key opened them.
 */
export function SettingsEntry({ language, onChoose, theme, vimModes, previewToggle }: SettingsEntryProps) {
  const composition = useCompositionState();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const close = () => {
    setIsOpen(false);
    returnFocusRef.current?.focus();
  };

  const toggle = (returnFocusTo: HTMLElement | null) => {
    if (isOpen) {
      close();
      return;
    }
    returnFocusRef.current = returnFocusTo;
    setIsOpen(true);
  };

  const toggleFromKey = useEffectEvent(() =>
    toggle(document.activeElement instanceof HTMLElement ? document.activeElement : null),
  );

  useEffect(() => {
    const toggleOnSettingsKey = (event: KeyboardEvent) => {
      const isSettingsKey =
        (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.code === "Comma";
      if (!isSettingsKey || event.repeat || composition.ownsKey(event)) {
        return;
      }
      event.preventDefault();
      toggleFromKey();
    };
    window.addEventListener("keydown", toggleOnSettingsKey, { capture: true });
    return () => window.removeEventListener("keydown", toggleOnSettingsKey, { capture: true });
  }, [composition]);

  return (
    <>
      <SettingsButton buttonRef={buttonRef} isOpen={isOpen} onToggle={() => toggle(buttonRef.current)} />
      {isOpen &&
        createPortal(
          <SettingsDialog
            language={language}
            onChoose={onChoose}
            theme={theme}
            vimModes={vimModes}
            previewToggle={previewToggle}
            onClose={close}
          />,
          document.body,
        )}
    </>
  );
}
