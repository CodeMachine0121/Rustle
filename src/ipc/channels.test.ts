import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { channels, type ChannelName } from "./channels";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  Channel: class {
    onmessage: (message: null) => void = () => undefined;
  },
}));

type ArgumentlessChannelName = Exclude<
  ChannelName,
  "readBody" | "saveBody" | "watchCloseRequests" | "answerCloseRequest"
>;

const COMMAND_NAMES: Record<ArgumentlessChannelName, string> = {
  listWorkspaces: "list_workspaces",
  listArticles: "list_articles",
  createArticle: "create_article",
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

  it("saves a body with the modification time it expects and the overwrite choice", async () => {
    const savedBody = {
      outcome: "saved",
      updatedAt: "2026-08-20T08:04:11.123Z",
      lastKnownModifiedAt: "2026-08-20T08:04:11.456Z",
    };
    vi.mocked(invoke).mockResolvedValue(savedBody);
    const request = {
      workspace: "Blog",
      fileName: "zen-of-writing.md",
      body: "新的正文",
      lastKnownModifiedAt: "2026-08-20T08:00:00.000Z",
      overwrite: false,
    };

    const result = await channels.saveBody(request);

    expect(invoke).toHaveBeenLastCalledWith("save_body", request);
    expect(result).toEqual({ ok: true, payload: savedBody });
  });

  it("hands every close request the backend reports to the watcher", async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    const onCloseRequest = vi.fn();

    await channels.watchCloseRequests(onCloseRequest);

    const [commandName, args] = vi.mocked(invoke).mock.lastCall ?? [];
    expect(commandName).toBe("watch_close_requests");
    const closeRequests = (args as { onCloseRequest: { onmessage: (message: null) => void } })
      .onCloseRequest;
    closeRequests.onmessage(null);
    closeRequests.onmessage(null);
    expect(onCloseRequest).toHaveBeenCalledTimes(2);
  });

  it.each([true, false])("answers a close request with close = %s", async (close) => {
    vi.mocked(invoke).mockResolvedValue(null);

    await channels.answerCloseRequest(close);

    expect(invoke).toHaveBeenLastCalledWith("answer_close_request", { close });
  });

  it("offers exactly the channels listed in this test", () => {
    expect(Object.keys(channels).sort()).toEqual(
      [
        ...Object.keys(COMMAND_NAMES),
        "readBody",
        "saveBody",
        "watchCloseRequests",
        "answerCloseRequest",
      ].sort(),
    );
  });
});
