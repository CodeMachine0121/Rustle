import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { callChannel } from "./callChannel";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

describe("callChannel", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("wraps a payload in a successful result", async () => {
    invokeMock.mockResolvedValue({ title: "Zen of writing" });

    await expect(callChannel("read_body")).resolves.toEqual({
      ok: true,
      payload: { title: "Zen of writing" },
    });
  });

  it("treats an empty list as a successful payload", async () => {
    invokeMock.mockResolvedValue([]);

    await expect(callChannel("list_workspaces")).resolves.toEqual({ ok: true, payload: [] });
  });

  it.each([
    ["notImplemented", "the readBody channel is not implemented yet"],
    ["outsideVault", "'..' is outside the vault"],
    ["unknownChannel", "no channel answers 'format_disk'"],
  ] as const)("passes a %s failure through with its message", async (reason, message) => {
    invokeMock.mockRejectedValue({ reason, message });

    await expect(callChannel("read_body")).resolves.toEqual({ ok: false, reason, message });
  });

  it("reports any other error as unexpected with its original message", async () => {
    invokeMock.mockRejectedValue(new Error("disk on fire"));

    await expect(callChannel("read_body")).resolves.toEqual({
      ok: false,
      reason: "unexpected",
      message: "disk on fire",
    });
  });

  it("reports a plain text rejection as unexpected with that text", async () => {
    invokeMock.mockRejectedValue("command read_body not found");

    await expect(callChannel("read_body")).resolves.toEqual({
      ok: false,
      reason: "unexpected",
      message: "command read_body not found",
    });
  });

  it.each([undefined, null, {}, "", { reason: "meltdown", message: "?" }])(
    "explains that the backend gave no reason when it throws %j",
    async (thrown) => {
      invokeMock.mockRejectedValue(thrown);

      await expect(callChannel("read_body")).resolves.toEqual({
        ok: false,
        reason: "unexpected",
        message: "the backend failed without giving a reason",
      });
    },
  );

  it("forwards the arguments to the named command", async () => {
    invokeMock.mockResolvedValue(undefined);

    await callChannel("read_body", { workspace: "Blog", fileName: "zen-of-writing.md" });

    expect(invokeMock).toHaveBeenCalledWith("read_body", {
      workspace: "Blog",
      fileName: "zen-of-writing.md",
    });
  });
});
