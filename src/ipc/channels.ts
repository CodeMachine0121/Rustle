import { Channel } from "@tauri-apps/api/core";

import type { ArticleBody } from "./articleBody";
import { callChannel } from "./callChannel";
import type { SaveBodyRequest, SavedBody } from "./savedBody";

// The webview's only way to reach the backend. Each slice replaces the
// placeholder signature of its own channel with the real request/payload.
export const channels = {
  listWorkspaces: () => callChannel<null>("list_workspaces"),

  listArticles: () => callChannel<null>("list_articles"),

  createArticle: () => callChannel<null>("create_article"),

  readBody: (workspace: string, fileName: string) =>
    callChannel<ArticleBody>("read_body", { workspace, fileName }),

  saveBody: (request: SaveBodyRequest) => callChannel<SavedBody>("save_body", request),

  updateMetadata: () => callChannel<null>("update_metadata"),

  saveClipboardImage: () => callChannel<null>("save_clipboard_image"),

  readSettings: () => callChannel<null>("read_settings"),

  writeSettings: () => callChannel<null>("write_settings"),

  watchCloseRequests: (onCloseRequest: () => void) => {
    const closeRequests = new Channel<null>();
    closeRequests.onmessage = () => onCloseRequest();
    return callChannel<null>("watch_close_requests", { onCloseRequest: closeRequests });
  },

  answerCloseRequest: (close: boolean) => callChannel<null>("answer_close_request", { close }),
};

export type ChannelName = keyof typeof channels;
