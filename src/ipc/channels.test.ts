import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { channels, type ChannelName } from "./channels";
import type { Settings } from "./settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

type ArgumentlessChannelName = Extract<
  ChannelName,
  "createArticle" | "saveBody" | "updateMetadata" | "saveClipboardImage" | "listWorkspaces" | "readSettings"
>;

const COMMAND_NAMES: Record<ArgumentlessChannelName, string> = {
  listWorkspaces: "list_workspaces",
  createArticle: "create_article",
  saveBody: "save_body",
  updateMetadata: "update_metadata",
  saveClipboardImage: "save_clipboard_image",
  readSettings: "read_settings",
};

const CHANNELS_WITH_ARGUMENTS = ["listArticles", "createWorkspace", "readBody", "writeSettings"];

describe("channels", () => {
  it.each(Object.entries(COMMAND_NAMES))("%s calls the %s command", async (channel, commandName) => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await channels[channel as ArgumentlessChannelName]();

    expect(invoke).toHaveBeenLastCalledWith(commandName, undefined);
  });

  it("asks for one article's body by workspace and file name", async () => {
    const articleBody = {
      workspace: "Blog",
      fileName: "zen-of-writing.md",
      body: "\n正文的第一行。\n",
      lastKnownModifiedAt: "2026-08-20T08:04:11.123Z",
    };
    vi.mocked(invoke).mockResolvedValue(articleBody);

    const result = await channels.readBody("Blog", "zen-of-writing.md");

    expect(invoke).toHaveBeenLastCalledWith("read_body", {
      workspace: "Blog",
      fileName: "zen-of-writing.md",
    });
    expect(result).toEqual({ ok: true, payload: articleBody });
  });

  it("asks for the articles of one workspace", async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    await channels.listArticles("Blog");

    expect(invoke).toHaveBeenLastCalledWith("list_articles", { workspace: "Blog" });
  });

  it("asks to create a workspace with the name as typed", async () => {
    vi.mocked(invoke).mockResolvedValue({ outcome: "rejected", reason: "alreadyUsed" });

    const result = await channels.createWorkspace("Blog");

    expect(invoke).toHaveBeenLastCalledWith("create_workspace", { name: "Blog" });
    expect(result).toEqual({ ok: true, payload: { outcome: "rejected", reason: "alreadyUsed" } });
  });

  it("writes the whole settings object", async () => {
    const settings: Settings = {
      indentation: { style: "spaces", width: 2 },
      previewPanel: { isOpen: true, widthRatio: 0.5 },
      lastOpened: { workspace: "Blog", article: null },
    };
    vi.mocked(invoke).mockResolvedValue(null);

    await channels.writeSettings(settings);

    expect(invoke).toHaveBeenLastCalledWith("write_settings", { settings });
  });

  it("offers exactly the channels listed in this test", () => {
    expect(Object.keys(channels).sort()).toEqual(
      [...Object.keys(COMMAND_NAMES), ...CHANNELS_WITH_ARGUMENTS].sort(),
    );
  });
});
