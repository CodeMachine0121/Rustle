import { createContext, useContext, useEffect, type ReactNode } from "react";

import { documentLanguageOf, type InterfaceLanguage } from "./interfaceLanguage";
import { messagesFor, type Messages } from "./messages";

const MessagesContext = createContext<Messages>(messagesFor("zh"));

type InterfaceLanguageProviderProps = {
  language: InterfaceLanguage;
  children: ReactNode;
};

/** Speaks `language` everywhere below it and tells assistive technology which language that is. */
export function InterfaceLanguageProvider({ language, children }: InterfaceLanguageProviderProps) {
  useEffect(() => {
    document.documentElement.lang = documentLanguageOf(language);
  }, [language]);

  return <MessagesContext.Provider value={messagesFor(language)}>{children}</MessagesContext.Provider>;
}

export function useMessages(): Messages {
  return useContext(MessagesContext);
}
