export type InterfaceLanguage = "zh" | "en";

/** Each option is written in its own language, so a reader can always find theirs. */
export const LANGUAGE_OPTIONS: ReadonlyArray<{ language: InterfaceLanguage; name: string }> = [
  { language: "zh", name: "中文" },
  { language: "en", name: "English" },
];

const DOCUMENT_LANGUAGES: Record<InterfaceLanguage, string> = { zh: "zh-Hant", en: "en" };

/** Chinese when the most preferred locale is any Chinese; English for everything else. */
export function interfaceLanguageOf(preferredLocales: readonly string[]): InterfaceLanguage {
  const primarySubtag = preferredLocales[0]?.split(/[-_]/)[0]?.toLowerCase();
  return primarySubtag === "zh" ? "zh" : "en";
}

/** The `lang` a screen reader picks its voice by. */
export function documentLanguageOf(language: InterfaceLanguage): string {
  return DOCUMENT_LANGUAGES[language];
}
