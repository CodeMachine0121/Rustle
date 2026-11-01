import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { DEFAULT_SETTINGS, SettingsSession } from "./SettingsSession";

const STORED_SETTINGS: Settings = {
  indentation: { style: "spaces", width: 4 },
  previewPanel: { isOpen: true, widthRatio: 0.4, toggleShortcut: "Mod+Alt+K" },
  lastOpened: { workspace: "Blog", article: "zen-of-writing.md" },
  sidebar: { collapsedSections: ["tags"] },
};

function settingsChannels(read: ChannelResult<Settings>) {
  return {
    readSettings: vi.fn(() => Promise.resolve(read)),
    writeSettings: vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null })),
  };
}

const closePreview = (settings: Settings): Settings => ({
  ...settings,
  previewPanel: { ...settings.previewPanel, isOpen: false },
});

describe("SettingsSession", () => {
  it("shows the defaults until the settings are read", () => {
    const session = new SettingsSession(settingsChannels({ ok: true, payload: STORED_SETTINGS }));

    expect(session.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("shows the stored settings once read", async () => {
    const session = new SettingsSession(settingsChannels({ ok: true, payload: STORED_SETTINGS }));

    await session.load();

    expect(session.settings).toEqual(STORED_SETTINGS);
  });

  it("writes a change back with every other setting as it was", async () => {
    const channels = settingsChannels({ ok: true, payload: STORED_SETTINGS });
    const session = new SettingsSession(channels);
    await session.load();

    session.change(closePreview);

    expect(channels.writeSettings).toHaveBeenCalledWith({
      ...STORED_SETTINGS,
      previewPanel: { isOpen: false, widthRatio: 0.4, toggleShortcut: "Mod+Alt+K" },
    });
  });

  it.each([
    ["before the read", null, false],
    ["after a failed read", { ok: false, reason: "unexpected", message: "denied" } as const, false],
    ["after a successful read", { ok: true, payload: STORED_SETTINGS } as const, true],
  ])("says whether the file was read %s", async (_, read, wasRead) => {
    const session = new SettingsSession(settingsChannels(read ?? { ok: true, payload: STORED_SETTINGS }));
    if (read !== null) {
      await session.load();
    }

    expect(session.wasRead).toBe(wasRead);
  });

  it("changes unread settings on screen without writing them", async () => {
    const channels = settingsChannels({ ok: false, reason: "unexpected", message: "denied" });
    const session = new SettingsSession(channels);
    await session.load();

    session.change(closePreview);

    expect(session.settings.previewPanel.isOpen).toBe(false);
    expect(channels.writeSettings).not.toHaveBeenCalled();
  });

  it("tells its listeners about every change", async () => {
    const session = new SettingsSession(settingsChannels({ ok: true, payload: STORED_SETTINGS }));
    const listener = vi.fn();
    session.subscribe(listener);

    await session.load();
    session.change(closePreview);

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("keeps building on the latest change", async () => {
    const channels = settingsChannels({ ok: true, payload: STORED_SETTINGS });
    const session = new SettingsSession(channels);
    await session.load();

    session.change(closePreview);
    session.change((settings) => ({ ...settings, lastOpened: { workspace: "Work", article: null } }));

    expect(channels.writeSettings).toHaveBeenLastCalledWith({
      ...STORED_SETTINGS,
      previewPanel: { ...STORED_SETTINGS.previewPanel, isOpen: false },
      lastOpened: { workspace: "Work", article: null },
    });
  });
});
