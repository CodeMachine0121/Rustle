import { useRef, useState } from "react";

import type { ThemeMenu } from "../theme/ThemeSession";
import type { InterfaceLanguage } from "./interfaceLanguage";
import { SettingsButton } from "./SettingsButton";
import { SettingsDialog } from "./SettingsDialog";

type SettingsEntryProps = {
  language: InterfaceLanguage;
  onChoose: (language: InterfaceLanguage) => void;
  theme: ThemeMenu;
};

/** The gear and the settings it opens; the keyboard goes back to the gear when they close. */
export function SettingsEntry({ language, onChoose, theme }: SettingsEntryProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const close = () => {
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <SettingsButton buttonRef={buttonRef} isOpen={isOpen} onToggle={() => (isOpen ? close() : setIsOpen(true))} />
      {isOpen && <SettingsDialog language={language} onChoose={onChoose} theme={theme} onClose={close} />}
    </>
  );
}
