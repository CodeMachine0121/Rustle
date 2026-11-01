import { useId } from "react";

import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { useVimEnabled } from "./useVimModeSession";
import type { VimModeSession } from "./VimModeSession";

type VimModeSettingProps = {
  session: VimModeSession;
};

/** The Vim mode row of the settings: one switch, applied at once. */
export function VimModeSetting({ session }: VimModeSettingProps) {
  const messages = useMessages();
  const isEnabled = useVimEnabled(session);
  const labelId = useId();

  return (
    <section className="settings-item">
      <h3 id={labelId}>{messages.vimMode}</h3>
      <button
        type="button"
        role="switch"
        className="settings-switch"
        aria-labelledby={labelId}
        aria-checked={isEnabled}
        onClick={() => session.setEnabled(!isEnabled)}
      />
    </section>
  );
}
