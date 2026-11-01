import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import { usePreviewToggleShortcut } from "./usePreviewToggleShortcut";

async function sessionWith(toggleShortcut?: string) {
  const stored: Settings = { ...DEFAULT_SETTINGS, previewPanel: { ...DEFAULT_SETTINGS.previewPanel, toggleShortcut } };
  const settings = new SettingsSession({
    readSettings: vi.fn(() => Promise.resolve<ChannelResult<Settings>>({ ok: true, payload: stored })),
    writeSettings: vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null })),
  });
  await settings.load();
  return settings;
}

describe("usePreviewToggleShortcut", () => {
  it.each([
    [undefined, "Shift+Cmd+P"],
    ["Mod+Alt+K", "Option+Cmd+K"],
    ["not a key", "Shift+Cmd+P"],
  ])("answers the key the settings give for %j", async (written, label) => {
    const settings = await sessionWith(written);

    const { result } = renderHook(() => usePreviewToggleShortcut(settings));

    expect(result.current.label).toBe(label);
  });

  it("follows a change of the setting", async () => {
    const settings = await sessionWith();
    const { result } = renderHook(() => usePreviewToggleShortcut(settings));

    act(() =>
      settings.change((current) => ({
        ...current,
        previewPanel: { ...current.previewPanel, toggleShortcut: "Mod+Shift+O" },
      })),
    );

    expect(result.current.label).toBe("Shift+Cmd+O");
  });
});
