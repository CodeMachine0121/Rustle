import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { SettingsSession } from "../settings/SettingsSession";
import { FOLLOW_SYSTEM, ThemeCatalog } from "./ThemeCatalog";
import { ThemeSession, paintCachedTheme, type ThemeEnvironment } from "./ThemeSession";

const STORED_SETTINGS: Settings = {
  indentation: { style: "spaces", width: 2 },
  previewPanel: { isOpen: true, widthRatio: 0.5 },
  lastOpened: { workspace: "Blog", article: "zen.md" },
  sidebar: { collapsedSections: [] },
};

const LIGHT_TEXT = "#1f1f1f";
const DARK_TEXT = "#e8e8e6";
const FOREST_TEXT = "#d3c6aa";

const UNREADABLE: ChannelResult<Settings> = { ok: false, reason: "unexpected", message: "denied" };

function settingsSession(
  stored: Partial<Settings>,
  write: ChannelResult<null> = { ok: true, payload: null },
  read: ChannelResult<Settings> = { ok: true, payload: { ...STORED_SETTINGS, ...stored } },
) {
  const channels = {
    readSettings: vi.fn(() => Promise.resolve(read)),
    writeSettings: vi.fn(() => Promise.resolve(write)),
  };
  return { settings: new SettingsSession(channels), channels };
}

function environment({ cached = null as string | null, systemIsDark = false } = {}) {
  let isDark = systemIsDark;
  const systemListeners = new Set<() => void>();
  const cache = { read: vi.fn(() => cached), write: vi.fn() };
  const value: ThemeEnvironment = {
    catalog: ThemeCatalog.shipped(),
    cache,
    system: {
      isDark: () => isDark,
      watch: (listener) => {
        systemListeners.add(listener);
        return () => systemListeners.delete(listener);
      },
    },
    root: document.createElement("div"),
  };
  return {
    value,
    cache,
    systemListeners,
    switchSystem: (dark: boolean) => {
      isDark = dark;
      systemListeners.forEach((listener) => listener());
    },
    text: () => value.root.style.getPropertyValue("--color-text"),
  };
}

describe("ThemeSession", () => {
  it("starts from the last window's theme before the settings are read", () => {
    const { settings } = settingsSession({});
    const env = environment({ cached: "forest" });

    const session = new ThemeSession(settings, env.value);

    expect(session.menu.choice).toBe("forest");
    expect(env.text()).toBe(FOREST_TEXT);
  });

  it("paints the cached theme for the first frame on its own", () => {
    const env = environment({ cached: "forest" });

    expect(paintCachedTheme(env.value)).toBe("forest");
    expect(env.text()).toBe(FOREST_TEXT);
  });

  it("follows the system with nothing cached", () => {
    const { settings } = settingsSession({});
    const env = environment({ systemIsDark: true });

    const session = new ThemeSession(settings, env.value);

    expect(session.menu.choice).toBe(FOLLOW_SYSTEM);
    expect(env.text()).toBe(DARK_TEXT);
  });

  it("follows the remembered theme once the settings are read, and caches it", async () => {
    const { settings } = settingsSession({ theme: "forest" });
    const env = environment();
    const session = new ThemeSession(settings, env.value);

    await settings.load();

    expect(session.menu.choice).toBe("forest");
    expect(env.text()).toBe(FOREST_TEXT);
    expect(env.cache.write).toHaveBeenCalledWith("forest");
  });

  it.each([
    ["never chose", undefined],
    ["remembered a theme it does not know", "solarized"],
  ])("follows the system when the vault %s, whatever was cached", async (_, theme) => {
    const { settings } = settingsSession({ theme });
    const env = environment({ cached: "forest" });
    const session = new ThemeSession(settings, env.value);

    await settings.load();

    expect(session.menu.choice).toBe(FOLLOW_SYSTEM);
    expect(env.text()).toBe(LIGHT_TEXT);
  });

  it("repaints at once when a theme is chosen, then writes it into the settings", async () => {
    const { settings, channels } = settingsSession({});
    const env = environment();
    const session = new ThemeSession(settings, env.value);
    await settings.load();
    const listener = vi.fn();
    session.subscribe(listener);

    session.menu.choose("forest");

    expect(env.text()).toBe(FOREST_TEXT);
    expect(session.menu.choice).toBe("forest");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(channels.writeSettings).toHaveBeenCalledWith({ ...STORED_SETTINGS, theme: "forest" });
  });

  it("repaints even when the settings cannot be written, and says nothing", async () => {
    const { settings } = settingsSession({}, { ok: false, reason: "unexpected", message: "disk full" });
    const env = environment();
    const session = new ThemeSession(settings, env.value);
    await settings.load();

    session.menu.choose("forest");

    expect(env.text()).toBe(FOREST_TEXT);
  });

  it("changes nothing when the theme in use is chosen again", async () => {
    const { settings, channels } = settingsSession({ theme: "forest" });
    const env = environment();
    const session = new ThemeSession(settings, env.value);
    await settings.load();
    channels.writeSettings.mockClear();
    const listener = vi.fn();
    session.subscribe(listener);

    session.menu.choose("forest");

    expect(channels.writeSettings).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(env.text()).toBe(FOREST_TEXT);
  });

  it("keeps the theme when another setting changes", async () => {
    const { settings } = settingsSession({ theme: "forest" });
    const env = environment();
    const session = new ThemeSession(settings, env.value);
    await settings.load();

    settings.change((current) => ({ ...current, interfaceLanguage: "en" }));

    expect(session.menu.choice).toBe("forest");
    expect(env.text()).toBe(FOREST_TEXT);
  });

  it("keeps the cached theme while the settings are still being read, whatever else changes", () => {
    const { settings } = settingsSession({ theme: "forest" });
    const env = environment({ cached: "forest" });
    const session = new ThemeSession(settings, env.value);

    settings.change((current) => ({ ...current, sidebar: { collapsedSections: ["tags"] } }));

    expect(session.menu.choice).toBe("forest");
    expect(env.text()).toBe(FOREST_TEXT);
    expect(env.cache.write).not.toHaveBeenCalled();
  });

  it("keeps the cached theme when the settings cannot be read", async () => {
    const { settings } = settingsSession({}, undefined, UNREADABLE);
    const env = environment({ cached: "forest" });
    const session = new ThemeSession(settings, env.value);

    await settings.load();
    settings.change((current) => ({ ...current, sidebar: { collapsedSections: ["tags"] } }));

    expect(session.menu.choice).toBe("forest");
    expect(env.text()).toBe(FOREST_TEXT);
    expect(env.cache.write).not.toHaveBeenCalled();
  });

  it("repaints a theme chosen while the settings cannot be read, without remembering it", async () => {
    const { settings, channels } = settingsSession({}, undefined, UNREADABLE);
    const env = environment();
    const session = new ThemeSession(settings, env.value);
    await settings.load();
    const listener = vi.fn();
    session.subscribe(listener);

    session.menu.choose("forest");

    expect(session.menu.choice).toBe("forest");
    expect(env.text()).toBe(FOREST_TEXT);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(env.cache.write).not.toHaveBeenCalled();
    expect(channels.writeSettings).not.toHaveBeenCalled();
  });

  it("goes dark with the system while following it", () => {
    const { settings } = settingsSession({});
    const env = environment();
    new ThemeSession(settings, env.value);

    env.switchSystem(true);

    expect(env.text()).toBe(DARK_TEXT);
  });

  it("ignores the system once a theme is chosen", async () => {
    const { settings } = settingsSession({ theme: "forest" });
    const env = environment();
    new ThemeSession(settings, env.value);
    await settings.load();

    env.switchSystem(true);

    expect(env.text()).toBe(FOREST_TEXT);
  });

  it("stops listening to the settings and the system when disposed", async () => {
    const { settings } = settingsSession({ theme: "forest" });
    const env = environment();
    const session = new ThemeSession(settings, env.value);

    session.dispose();
    await settings.load();
    env.switchSystem(true);

    expect(env.systemListeners.size).toBe(0);
    expect(env.text()).toBe(LIGHT_TEXT);
  });

  it("offers every shipped theme", () => {
    const { settings } = settingsSession({});

    const session = new ThemeSession(settings, environment().value);

    expect(session.menu.themes.map((theme) => theme.id)).toEqual(["light", "dark", "forest"]);
  });
});
