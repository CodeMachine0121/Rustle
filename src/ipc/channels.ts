import type { ArticleBody } from "./articleBody";
import { callChannel } from "./callChannel";

// The webview's only way to reach the backend. Each slice replaces the
// placeholder signature of its own channel with the real request/payload.
export const channels = {
  listWorkspaces: () => callChannel<null>("list_workspaces"),

  listArticles: () => callChannel<null>("list_articles"),

  createArticle: () => callChannel<null>("create_article"),

  readBody: (workspace: string, fileName: string) =>
    callChannel<ArticleBody>("read_body", { workspace, fileName }),

  saveBody: () => callChannel<null>("save_body"),

  updateMetadata: () => callChannel<null>("update_metadata"),

  saveClipboardImage: () => callChannel<null>("save_clipboard_image"),

  readSettings: () => callChannel<null>("read_settings"),

  writeSettings: () => callChannel<null>("write_settings"),
};

export type ChannelName = keyof typeof channels;
