import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { InterfaceLanguageProvider } from "../interfaceLanguage/InterfaceLanguageContext";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import { SidebarFoldButton } from "./SidebarFoldButton";
import { useCollapsedSections } from "./useCollapsedSections";
import { useSidebarFold } from "./useSidebarFold";

async function settingsSession(
  sidebar: Settings["sidebar"],
  write: () => Promise<ChannelResult<null>> = () => Promise.resolve({ ok: true, payload: null }),
) {
  const channels = {
    readSettings: vi.fn(() => Promise.resolve<ChannelResult<Settings>>({ ok: true, payload: { ...DEFAULT_SETTINGS, sidebar } })),
    writeSettings: vi.fn(write),
  };
  const session = new SettingsSession(channels);
  await session.load();
  return { session, channels };
}

function FoldedProbe({ settings }: { settings: SettingsSession }) {
  const fold = useSidebarFold(settings);
  const sections = useCollapsedSections(settings);
  return (
    <>
      <SidebarFoldButton fold={fold} />
      <button type="button" onClick={() => sections.toggle("tags")}>
        摺標籤
      </button>
      <p>{fold.isFolded ? "收起" : "攤開"}</p>
    </>
  );
}

function renderFold(settings: SettingsSession, language: "zh" | "en" = "zh") {
  render(
    <InterfaceLanguageProvider language={language}>
      <FoldedProbe settings={settings} />
    </InterfaceLanguageProvider>,
  );
}

describe("SidebarFoldButton", () => {
  it("folds the sidebar away and brings it back with the same button, remembering each choice", async () => {
    const { session, channels } = await settingsSession({ collapsedSections: ["status"] });
    renderFold(session);

    act(() => fireEvent.click(screen.getByRole("button", { name: "收起側邊欄" })));

    expect(screen.getByText("收起")).toBeInTheDocument();
    const showButton = screen.getByRole("button", { name: "打開側邊欄" });
    expect(showButton).toHaveAttribute("aria-expanded", "false");
    expect(channels.writeSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ sidebar: { collapsedSections: ["status"], isFolded: true } }),
    );

    act(() => fireEvent.click(showButton));

    expect(screen.getByText("攤開")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起側邊欄" })).toHaveAttribute("aria-expanded", "true");
    expect(channels.writeSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ sidebar: { collapsedSections: ["status"], isFolded: false } }),
    );
  });

  it("is a real button the keyboard reaches", async () => {
    const { session } = await settingsSession({ collapsedSections: [], isFolded: true });
    renderFold(session);
    const button = screen.getByRole("button", { name: "打開側邊欄" });

    button.focus();

    expect(button).toHaveFocus();
    expect(button.tagName).toBe("BUTTON");
  });

  it("starts folded when the settings say the sidebar was folded", async () => {
    const { session } = await settingsSession({ collapsedSections: [], isFolded: true });
    renderFold(session);

    expect(screen.getByText("收起")).toBeInTheDocument();
  });

  it("starts unfolded when the settings could not be read, and still folds on screen", async () => {
    const channels = {
      readSettings: vi.fn(() =>
        Promise.resolve<ChannelResult<Settings>>({ ok: false, reason: "unexpected", message: "broken" }),
      ),
      writeSettings: vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null })),
    };
    const session = new SettingsSession(channels);
    await session.load();
    renderFold(session);

    expect(screen.getByText("攤開")).toBeInTheDocument();

    act(() => fireEvent.click(screen.getByRole("button", { name: "收起側邊欄" })));

    expect(screen.getByText("收起")).toBeInTheDocument();
    expect(channels.writeSettings).not.toHaveBeenCalled();
  });

  it("keeps the sidebar folded on screen when the settings cannot be written", async () => {
    const { session } = await settingsSession({ collapsedSections: [] }, () =>
      Promise.resolve({ ok: false, reason: "unexpected", message: "disk full" }),
    );
    renderFold(session);

    act(() => fireEvent.click(screen.getByRole("button", { name: "收起側邊欄" })));

    expect(screen.getByText("收起")).toBeInTheDocument();
  });

  it("keeps the fold when a section is folded", async () => {
    const { session, channels } = await settingsSession({ collapsedSections: [], isFolded: true });
    renderFold(session);

    act(() => fireEvent.click(screen.getByRole("button", { name: "摺標籤" })));

    expect(channels.writeSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ sidebar: { collapsedSections: ["tags"], isFolded: true } }),
    );
  });

  it("speaks English when English is in use", async () => {
    const { session } = await settingsSession({ collapsedSections: [] });
    renderFold(session, "en");

    expect(screen.getByRole("button", { name: "Hide sidebar" })).toBeInTheDocument();
  });
});
