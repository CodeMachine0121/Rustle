import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { InterfaceLanguageProvider } from "../interfaceLanguage/InterfaceLanguageContext";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import { VimModeLabel } from "./VimModeLabel";
import { VimModeSession } from "./VimModeSession";

async function renderLabel(vimMode: boolean) {
  const settings = new SettingsSession({
    readSettings: () => Promise.resolve<ChannelResult<Settings>>({ ok: true, payload: { ...DEFAULT_SETTINGS, vimMode } }),
    writeSettings: vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null })),
  });
  await settings.load();
  const session = new VimModeSession(settings);
  const { container } = render(
    <InterfaceLanguageProvider language="zh">
      <VimModeLabel session={session} />
    </InterfaceLanguageProvider>,
  );
  return { container, session };
}

describe("VimModeLabel", () => {
  it("draws nothing at all while Vim mode is off", async () => {
    const { container } = await renderLabel(false);

    expect(container).toBeEmptyDOMElement();
  });

  it("reads NORMAL, untranslated, in a Chinese interface", async () => {
    const { container } = await renderLabel(true);

    expect(container).toHaveTextContent(/^NORMAL$/u);
  });

  it.each([
    ["insert", "INSERT"],
    ["visual", "VISUAL"],
    ["normal", "NORMAL"],
  ] as const)("reads %s as %s", async (mode, label) => {
    const { container, session } = await renderLabel(true);

    act(() => session.report(mode === "normal" ? "insert" : "normal"));
    act(() => session.report(mode));

    expect(container).toHaveTextContent(new RegExp(`^${label}$`, "u"));
  });

  it("disappears the moment Vim mode is turned off", async () => {
    const { container, session } = await renderLabel(true);

    act(() => session.setEnabled(false));

    expect(container).toBeEmptyDOMElement();
  });
});
