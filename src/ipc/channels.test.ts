import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { channels, type ChannelName } from "./channels";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const COMMAND_NAMES: Record<ChannelName, string> = {
  listWorkspaces: "list_workspaces",
  listArticles: "list_articles",
  createArticle: "create_article",
  readBody: "read_body",
  saveBody: "save_body",
  updateMetadata: "update_metadata",
  saveClipboardImage: "save_clipboard_image",
  readSettings: "read_settings",
  writeSettings: "write_settings",
};

describe("channels", () => {
  it.each(Object.entries(COMMAND_NAMES))("%s calls the %s command", async (channel, commandName) => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await channels[channel as ChannelName]();

    expect(invoke).toHaveBeenLastCalledWith(commandName, undefined);
  });

  it("offers exactly the channels listed in this test", () => {
    expect(Object.keys(channels).sort()).toEqual(Object.keys(COMMAND_NAMES).sort());
  });
});
