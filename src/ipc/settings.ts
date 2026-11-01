import type { IndentationSettings } from "../features/editor/IndentUnit";

export type Settings = {
  indentation: IndentationSettings;
  previewPanel: { isOpen: boolean; widthRatio: number };
  lastOpened: { workspace: string | null; article: string | null };
};
