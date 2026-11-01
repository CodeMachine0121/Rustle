import type { Ref } from "react";

import { useMessages } from "./InterfaceLanguageContext";

type SettingsButtonProps = {
  isOpen: boolean;
  onToggle: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
};

/** The gear at the bottom of the sidebar. */
export function SettingsButton({ isOpen, onToggle, buttonRef }: SettingsButtonProps) {
  const messages = useMessages();
  return (
    <button
      ref={buttonRef}
      type="button"
      className="settings-button"
      aria-label={messages.settings}
      title={messages.settings}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      onClick={onToggle}
    >
      <GearMark />
    </button>
  );
}

const TEETH = Array.from({ length: 8 }, (_, index) => index * 45);

function GearMark() {
  return (
    <svg className="settings-button__mark" viewBox="0 0 24 24" aria-hidden="true">
      {TEETH.map((angle) => (
        <rect key={angle} x="10.5" y="1.75" width="3" height="4" rx="0.6" transform={`rotate(${angle} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
