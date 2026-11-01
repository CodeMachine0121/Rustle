import { Channel } from "@tauri-apps/api/core";

import type { ArticleBody } from "./articleBody";
import type { ArticleSummary } from "./articleSummary";
import type { BodySearchRequest, BodySearchResult } from "./bodySearch";
import { callChannel } from "./callChannel";
import type { ClipboardText } from "./clipboardText";
import type { CreateArticleRequest } from "./createArticleRequest";
import type { CreateWorkspaceOutcome } from "./createWorkspaceOutcome";
import type { MetadataUpdateOutcome, MetadataUpdateRequest } from "./metadataUpdate";
import type { PreferredLocales } from "./preferredLocales";
import type { RenameWorkspaceOutcome } from "./renameWorkspaceOutcome";
import type { SaveBodyRequest, SavedBody } from "./savedBody";
import type { SavedClipboardImages } from "./savedClipboardImages";
import type { Settings } from "./settings";
import type { WorkspaceContents } from "./workspaceContents";
import type { WorkspaceSummary } from "./workspaceSummary";

// The webview's only way to reach the backend. Each slice replaces the
// placeholder signature of its own channel with the real request/payload.
export const channels = {
  listWorkspaces: () => callChannel<WorkspaceSummary[]>("list_workspaces"),

  listArticles: (workspace: string) => callChannel<ArticleSummary[]>("list_articles", { workspace }),

  listAllArticles: () => callChannel<ArticleSummary[]>("list_all_articles"),

  createWorkspace: (name: string) => callChannel<CreateWorkspaceOutcome>("create_workspace", { name }),

  createArticle: (request: CreateArticleRequest) =>
    callChannel<ArticleSummary>("create_article", request),

  readBody: (workspace: string, fileName: string) =>
    callChannel<ArticleBody>("read_body", { workspace, fileName }),

  searchBodies: (request: BodySearchRequest) =>
    callChannel<BodySearchResult>("search_bodies", request),

  saveBody: (request: SaveBodyRequest) => callChannel<SavedBody>("save_body", request),

  updateMetadata: (request: MetadataUpdateRequest) =>
    callChannel<MetadataUpdateOutcome>("update_metadata", request),

  deleteArticle: (workspace: string, fileName: string) =>
    callChannel<null>("delete_article", { workspace, fileName }),

  renameWorkspace: (workspace: string, newName: string) =>
    callChannel<RenameWorkspaceOutcome>("rename_workspace", { workspace, newName }),

  countWorkspaceContents: (workspace: string) =>
    callChannel<WorkspaceContents>("count_workspace_contents", { workspace }),

  deleteWorkspace: (workspace: string) =>
    callChannel<WorkspaceContents>("delete_workspace", { workspace }),

  saveClipboardImage: (workspace: string) =>
    callChannel<SavedClipboardImages>("save_clipboard_image", { workspace }),

  readClipboardText: () => callChannel<ClipboardText>("read_clipboard_text"),

  writeClipboardText: (text: string) => callChannel<null>("write_clipboard_text", { text }),

  readSettings: () => callChannel<Settings>("read_settings"),

  writeSettings: (settings: Settings) => callChannel<null>("write_settings", { settings }),

  readPreferredLocales: () => callChannel<PreferredLocales>("read_preferred_locales"),

  watchCloseRequests: (onCloseRequest: () => void) => {
    const closeRequests = new Channel<null>();
    closeRequests.onmessage = () => onCloseRequest();
    return callChannel<null>("watch_close_requests", { onCloseRequest: closeRequests });
  },

  answerCloseRequest: (close: boolean) => callChannel<null>("answer_close_request", { close }),
};

export type Channels = typeof channels;

export type ChannelName = keyof Channels;
