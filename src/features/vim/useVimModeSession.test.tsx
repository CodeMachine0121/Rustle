import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import { useVimEnabled, useVimMode } from "./useVimModeSession";
import { VimModeSession } from "./VimModeSession";

async function vimModes() {
  const settings = new SettingsSession({
    readSettings: () => Promise.resolve<ChannelResult<Settings>>({ ok: true, payload: { ...DEFAULT_SETTINGS, vimMode: true } }),
    writeSettings: vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null })),
  });
  await settings.load();
  return new VimModeSession(settings);
}

describe("useVimEnabled", () => {
  it("does not re-render the editor's side on a mode change", async () => {
    const session = await vimModes();
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useVimEnabled(session);
    });
    const rendersBefore = renders;

    act(() => session.report("insert"));
    act(() => session.report("visual"));

    expect(renders).toBe(rendersBefore);
  });

  it("re-renders when Vim mode is turned off", async () => {
    const session = await vimModes();
    const { result } = renderHook(() => useVimEnabled(session));

    act(() => session.setEnabled(false));

    expect(result.current).toBe(false);
  });
});

describe("useVimMode", () => {
  it("follows every mode change", async () => {
    const session = await vimModes();
    const { result } = renderHook(() => useVimMode(session));

    act(() => session.report("insert"));

    expect(result.current).toBe("insert");
  });
});
