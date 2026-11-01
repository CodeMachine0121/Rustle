import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { channels, type ChannelName } from "./channels";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

type ArgumentlessChannelName = Exclude<ChannelName, "readBody">;

const COMMAND_NAMES: Record<ArgumentlessChannelName, string> = {
  listWorkspaces: "list_workspaces",
  listArticles: "list_articles",
  createArticle: "create_article",
  saveBody: "save_body",
  updateMetadata: "update_metadata",
  saveClipboardImage: "save_clipboard_image",
  readSettings: "read_settings",
  writeSettings: "write_settings",
};

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

  it("offers exactly the channels listed in this test", () => {
    expect(Object.keys(channels).sort()).toEqual([...Object.keys(COMMAND_NAMES), "readBody"].sort());
  });
});
