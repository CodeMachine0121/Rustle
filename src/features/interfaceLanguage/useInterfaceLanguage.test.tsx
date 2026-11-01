import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { PreferredLocales } from "../../ipc/preferredLocales";
import type { Settings } from "../../ipc/settings";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import { useInterfaceLanguage } from "./useInterfaceLanguage";

function preferredLocales(locales: string[]) {
  return {
    readPreferredLocales: vi.fn(() => Promise.resolve<ChannelResult<PreferredLocales>>({ ok: true, payload: { locales } })),
  };
}

function settingsSession(stored: Settings | null) {
  const writeSettings = vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null }));
  const session = new SettingsSession({
    readSettings: () =>
      Promise.resolve<ChannelResult<Settings>>(
        stored === null ? { ok: false, reason: "unexpected", message: "unreadable" } : { ok: true, payload: stored },
      ),
    writeSettings,
  });
  return { session, writeSettings };
}

function stubWebviewLanguages(languages: string[]) {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useInterfaceLanguage", () => {
  it("follows a Chinese system until anything is chosen", async () => {
    stubWebviewLanguages(["en-US"]);
    const { session } = settingsSession(DEFAULT_SETTINGS);

    const { result } = renderHook(() => useInterfaceLanguage(session, preferredLocales(["zh-Hant-TW", "en-US"])));

    expect(result.current.language).toBe("en");
    await waitFor(() => expect(result.current.language).toBe("zh"));
  });

  it("speaks English on a system in a language it does not support", async () => {
    stubWebviewLanguages(["ja-JP"]);
    const channels = preferredLocales(["ja-JP", "zh-Hant-TW"]);
    const { session } = settingsSession(DEFAULT_SETTINGS);

    const { result } = renderHook(() => useInterfaceLanguage(session, channels));

    await waitFor(() => expect(channels.readPreferredLocales).toHaveBeenCalled());
    expect(result.current.language).toBe("en");
  });

  it("starts in the webview's language when the system does not say", async () => {
    stubWebviewLanguages(["zh-TW"]);
    const channels = preferredLocales([]);
    const { session } = settingsSession(DEFAULT_SETTINGS);

    const { result } = renderHook(() => useInterfaceLanguage(session, channels));

    await waitFor(() => expect(channels.readPreferredLocales).toHaveBeenCalled());
    expect(result.current.language).toBe("zh");
  });

  it("speaks the remembered language once the settings are read, whatever the system says", async () => {
    stubWebviewLanguages(["zh-TW"]);
    const { session } = settingsSession({ ...DEFAULT_SETTINGS, interfaceLanguage: "en" });
    const { result } = renderHook(() => useInterfaceLanguage(session, preferredLocales(["zh-Hant-TW"])));

    await act(() => session.load());

    expect(result.current.language).toBe("en");
  });

  it("follows the system when the settings hold no usable language", async () => {
    stubWebviewLanguages(["en-US"]);
    const { session } = settingsSession(DEFAULT_SETTINGS);
    const { result } = renderHook(() => useInterfaceLanguage(session, preferredLocales(["zh-Hant-TW"])));

    await act(() => session.load());

    await waitFor(() => expect(result.current.language).toBe("zh"));
  });

  it("changes at once and remembers the choice with every other setting", async () => {
    stubWebviewLanguages(["zh-TW"]);
    const stored: Settings = { ...DEFAULT_SETTINGS, indentation: { style: "tab", width: 4 } };
    const { session, writeSettings } = settingsSession(stored);
    const { result } = renderHook(() => useInterfaceLanguage(session, preferredLocales(["zh-Hant-TW"])));
    await act(() => session.load());

    act(() => result.current.choose("en"));

    expect(result.current.language).toBe("en");
    expect(writeSettings).toHaveBeenCalledWith({ ...stored, interfaceLanguage: "en" });
  });
});
