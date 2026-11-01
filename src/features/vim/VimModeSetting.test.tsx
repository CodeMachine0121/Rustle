import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import type { InterfaceLanguage } from "../interfaceLanguage/interfaceLanguage";
import { InterfaceLanguageProvider } from "../interfaceLanguage/InterfaceLanguageContext";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import { VimModeSession } from "./VimModeSession";
import { VimModeSetting } from "./VimModeSetting";

async function renderSetting(language: InterfaceLanguage, vimMode?: boolean) {
  const writeSettings = vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null }));
  const settings = new SettingsSession({
    readSettings: () => Promise.resolve<ChannelResult<Settings>>({ ok: true, payload: { ...DEFAULT_SETTINGS, vimMode } }),
    writeSettings,
  });
  await settings.load();
  render(
    <InterfaceLanguageProvider language={language}>
      <VimModeSetting session={new VimModeSession(settings)} />
    </InterfaceLanguageProvider>,
  );
  return { writeSettings };
}

describe("VimModeSetting", () => {
  it("is a switch named Vim 模式 in Chinese, off when the settings never mention it", async () => {
    await renderSetting("zh");

    expect(screen.getByRole("switch", { name: "Vim 模式" })).toHaveAttribute("aria-checked", "false");
  });

  it("is named Vim Mode in English", async () => {
    await renderSetting("en", true);

    expect(screen.getByRole("switch", { name: "Vim Mode" })).toHaveAttribute("aria-checked", "true");
  });

  it("turns Vim mode on at once and writes it into the settings", async () => {
    const { writeSettings } = await renderSetting("zh");

    fireEvent.click(screen.getByRole("switch", { name: "Vim 模式" }));

    expect(screen.getByRole("switch", { name: "Vim 模式" })).toHaveAttribute("aria-checked", "true");
    expect(writeSettings).toHaveBeenLastCalledWith(expect.objectContaining({ vimMode: true }));
  });

  it("turns Vim mode off at once and writes it into the settings", async () => {
    const { writeSettings } = await renderSetting("zh", true);

    fireEvent.click(screen.getByRole("switch", { name: "Vim 模式" }));

    expect(screen.getByRole("switch", { name: "Vim 模式" })).toHaveAttribute("aria-checked", "false");
    expect(writeSettings).toHaveBeenLastCalledWith(expect.objectContaining({ vimMode: false }));
  });
});
