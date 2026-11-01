import { useEffect, useState } from "react";

import type { Channels } from "../../ipc/channels";
import type { SettingsSession } from "../settings/SettingsSession";
import { useSettings } from "../settings/useSettings";
import { interfaceLanguageOf, type InterfaceLanguage } from "./interfaceLanguage";

export type InterfaceLanguageChannels = Pick<Channels, "readPreferredLocales">;

export type InterfaceLanguageChoice = {
  language: InterfaceLanguage;
  choose: (language: InterfaceLanguage) => void;
};

/**
 * The language the user chose in this vault, or the system's until they do.
 * The first frame asks the webview, which may not know the system's choice;
 * the operating system's answer replaces it as soon as it arrives.
 */
export function useInterfaceLanguage(
  settings: SettingsSession,
  channels: InterfaceLanguageChannels,
): InterfaceLanguageChoice {
  const { interfaceLanguage } = useSettings(settings);
  const [systemLanguage, setSystemLanguage] = useState(() => interfaceLanguageOf(navigator.languages));

  useEffect(() => {
    let isCurrent = true;
    void channels.readPreferredLocales().then((result) => {
      if (isCurrent && result.ok && result.payload.locales.length > 0) {
        setSystemLanguage(interfaceLanguageOf(result.payload.locales));
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [channels]);

  return {
    language: interfaceLanguage ?? systemLanguage,
    choose: (language) => {
      if (language !== interfaceLanguage) {
        settings.change((current) => ({ ...current, interfaceLanguage: language }));
      }
    },
  };
}
