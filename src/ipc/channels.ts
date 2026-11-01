import { Channel } from "@tauri-apps/api/core";

import type { ArticleBody } from "./articleBody";
import type { ArticleSummary } from "./articleSummary";
import { callChannel } from "./callChannel";
import type { CreateArticleRequest } from "./createArticleRequest";
import type { CreateWorkspaceOutcome } from "./createWorkspaceOutcome";
import type { SaveBodyRequest, SavedBody } from "./savedBody";
import type { Settings } from "./settings";
import type { WorkspaceSummary } from "./workspaceSummary";

// The webview's only way to reach the backend. Each slice replaces the
// placeholder signature of its own channel with the real request/payload.
export const channels = {
  listWorkspaces: () => callChannel<WorkspaceSummary[]>("list_workspaces"),

  listArticles: (workspace: string) => callChannel<ArticleSummary[]>("list_articles", { workspace }),

  createWorkspace: (name: string) => callChannel<CreateWorkspaceOutcome>("create_workspace", { name }),

  createArticle: (request: CreateArticleRequest) =>
    callChannel<ArticleSummary>("create_article", request),

  readBody: (workspace: string, fileName: string) =>
    callChannel<ArticleBody>("read_body", { workspace, fileName }),

  saveBody: (request: SaveBodyRequest) => callChannel<SavedBody>("save_body", request),

  updateMetadata: () => callChannel<null>("update_metadata"),

  saveClipboardImage: () => callChannel<null>("save_clipboard_image"),

  readSettings: () => callChannel<Settings>("read_settings"),

  writeSettings: (settings: Settings) => callChannel<null>("write_settings", { settings }),

  watchCloseRequests: (onCloseRequest: () => void) => {
    const closeRequests = new Channel<null>();
    closeRequests.onmessage = () => onCloseRequest();
    return callChannel<null>("watch_close_requests", { onCloseRequest: closeRequests });
  },

  answerCloseRequest: (close: boolean) => callChannel<null>("answer_close_request", { close }),
};

export type Channels = typeof channels;

export type ChannelName = keyof Channels;
