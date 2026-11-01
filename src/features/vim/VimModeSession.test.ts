import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import { VimModeSession } from "./VimModeSession";

async function sessionOver(stored: Settings) {
  const channels = {
    readSettings: vi.fn(() => Promise.resolve<ChannelResult<Settings>>({ ok: true, payload: stored })),
    writeSettings: vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null })),
  };
  const settings = new SettingsSession(channels);
  await settings.load();
  return { session: new VimModeSession(settings), channels };
}

describe("VimModeSession", () => {
  it("is off, with no mode to show, when the settings never mention Vim", async () => {
    const { session } = await sessionOver(DEFAULT_SETTINGS);

    expect(session.isEnabled).toBe(false);
    expect(session.mode).toBeNull();
  });

  it("is on and in Normal mode when the settings say so", async () => {
    const { session } = await sessionOver({ ...DEFAULT_SETTINGS, vimMode: true });

    expect(session.isEnabled).toBe(true);
    expect(session.mode).toBe("normal");
  });

  it("writes the choice into the settings when turned on", async () => {
    const { session, channels } = await sessionOver(DEFAULT_SETTINGS);

    session.setEnabled(true);

    expect(channels.writeSettings).toHaveBeenLastCalledWith(expect.objectContaining({ vimMode: true }));
    expect(session.mode).toBe("normal");
  });

  it("writes the choice into the settings when turned off, and has no mode to show", async () => {
    const { session, channels } = await sessionOver({ ...DEFAULT_SETTINGS, vimMode: true });

    session.setEnabled(false);

    expect(channels.writeSettings).toHaveBeenLastCalledWith(expect.objectContaining({ vimMode: false }));
    expect(session.mode).toBeNull();
  });

  it("shows the mode the editor reports and tells its listeners", async () => {
    const { session } = await sessionOver({ ...DEFAULT_SETTINGS, vimMode: true });
    const listener = vi.fn();
    session.subscribe(listener);

    session.report("insert");

    expect(session.mode).toBe("insert");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not tell its listeners about the mode it is already in", async () => {
    const { session } = await sessionOver({ ...DEFAULT_SETTINGS, vimMode: true });
    const listener = vi.fn();
    session.subscribe(listener);

    session.report("normal");

    expect(listener).not.toHaveBeenCalled();
  });

  it("starts again in Normal mode when turned back on", async () => {
    const { session } = await sessionOver({ ...DEFAULT_SETTINGS, vimMode: true });
    session.report("insert");
    session.setEnabled(false);

    session.setEnabled(true);

    expect(session.mode).toBe("normal");
  });

  it("tells its listeners when the settings turn Vim on or off", async () => {
    const { session } = await sessionOver(DEFAULT_SETTINGS);
    const listener = vi.fn();
    session.subscribe(listener);

    session.setEnabled(true);

    expect(listener).toHaveBeenCalled();
  });

  it("stops telling a listener that unsubscribed", async () => {
    const { session } = await sessionOver({ ...DEFAULT_SETTINGS, vimMode: true });
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    unsubscribe();
    session.report("insert");
    session.setEnabled(false);

    expect(listener).not.toHaveBeenCalled();
  });
});
