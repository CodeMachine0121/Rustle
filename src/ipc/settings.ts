import type { IndentationSettings } from "../features/editor/IndentUnit";
import type { InterfaceLanguage } from "../features/interfaceLanguage/interfaceLanguage";

export type Settings = {
  indentation: IndentationSettings;
  previewPanel: { isOpen: boolean; widthRatio: number; toggleShortcut?: string };
  lastOpened: { workspace: string | null; article: string | null };
  /** Absent until the user chooses one. */
  interfaceLanguage?: InterfaceLanguage;
};
