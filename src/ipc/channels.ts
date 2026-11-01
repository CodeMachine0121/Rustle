import type { ArticleBody } from "./articleBody";
import type { ArticleSummary } from "./articleSummary";
import { callChannel } from "./callChannel";
import type { CreateWorkspaceOutcome } from "./createWorkspaceOutcome";
import type { Settings } from "./settings";
import type { WorkspaceSummary } from "./workspaceSummary";

// The webview's only way to reach the backend. Each slice replaces the
// placeholder signature of its own channel with the real request/payload.
export const channels = {
  listWorkspaces: () => callChannel<WorkspaceSummary[]>("list_workspaces"),

  listArticles: (workspace: string) => callChannel<ArticleSummary[]>("list_articles", { workspace }),

  createWorkspace: (name: string) => callChannel<CreateWorkspaceOutcome>("create_workspace", { name }),

  createArticle: () => callChannel<null>("create_article"),

  readBody: (workspace: string, fileName: string) =>
    callChannel<ArticleBody>("read_body", { workspace, fileName }),

  saveBody: () => callChannel<null>("save_body"),

  updateMetadata: () => callChannel<null>("update_metadata"),

  saveClipboardImage: () => callChannel<null>("save_clipboard_image"),

  readSettings: () => callChannel<Settings>("read_settings"),

  writeSettings: (settings: Settings) => callChannel<null>("write_settings", { settings }),
};

export type Channels = typeof channels;

export type ChannelName = keyof Channels;
