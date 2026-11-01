import type { IndentationSettings } from "../features/editor/IndentUnit";
import type { InterfaceLanguage } from "../features/interfaceLanguage/interfaceLanguage";

export type Settings = {
  indentation: IndentationSettings;
  previewPanel: { isOpen: boolean; widthRatio: number; toggleShortcut?: string };
  lastOpened: { workspace: string | null; article: string | null };
  /** Absent until the user chooses one. */
  interfaceLanguage?: InterfaceLanguage;
  sidebar: { collapsedSections: SidebarSection[] };
  /** Pixels as last written; absent or out of range means the webview's own rule decides. */
  fontSize?: { editor?: number; preview?: number };
  /** The chosen theme's id, or `followSystem`; absent until chosen. Only the webview knows which ids exist. */
  theme?: string;
  /** Absent (or anything but `true` in the file) means off. */
  vimMode?: boolean;
};

export type SidebarSection = "workspaces" | "status" | "tags";
