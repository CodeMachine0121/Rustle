import type { IndentationSettings } from "../features/editor/IndentUnit";

export type Settings = {
  indentation: IndentationSettings;
  previewPanel: { isOpen: boolean; widthRatio: number; toggleShortcut?: string };
  lastOpened: { workspace: string | null; article: string | null };
  sidebar: { collapsedSections: SidebarSection[] };
};

export type SidebarSection = "workspaces" | "status" | "tags";
