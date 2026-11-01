import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { KeyboardShortcut } from "../preview/KeyboardShortcut";
import { FOLLOW_SYSTEM } from "../theme/ThemeCatalog";
import { SettingsSession } from "../settings/SettingsSession";
import { VimModeSession } from "../vim/VimModeSession";
import { SettingsEntry } from "./SettingsEntry";

function renderEntry() {
  const onChoose = vi.fn();
  render(
    <CompositionProvider>
      <SettingsEntry language="zh" onChoose={onChoose} theme={{ choice: FOLLOW_SYSTEM, themes: [], choose: vi.fn() }}
        vimModes={new VimModeSession(new SettingsSession({ readSettings: vi.fn(), writeSettings: vi.fn() }))}
        previewToggle={KeyboardShortcut.DEFAULT}
      />
    </CompositionProvider>,
  );
  return onChoose;
}

describe("SettingsEntry", () => {
  it("opens the settings from the gear", () => {
    renderEntry();

    fireEvent.click(screen.getByRole("button", { name: "設定" }));

    expect(screen.getByRole("dialog", { name: "設定" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "設定" })).toHaveAttribute("aria-expanded", "true");
  });

  it("closes after a choice and gives the keyboard back to the gear", () => {
    const onChoose = renderEntry();
    fireEvent.click(screen.getByRole("button", { name: "設定" }));

    fireEvent.click(screen.getByRole("radio", { name: "English" }));

    expect(onChoose).toHaveBeenCalledWith("en");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "設定" })).toHaveFocus();
  });

  it("closes on Esc and gives the keyboard back to the gear", () => {
    const onChoose = renderEntry();
    fireEvent.click(screen.getByRole("button", { name: "設定" }));

    fireEvent.keyDown(screen.getByRole("radio", { name: "中文" }), { key: "Escape" });

    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "設定" })).toHaveFocus();
  });

  it("opens on the settings again after it was closed on the keyboard shortcuts", () => {
    renderEntry();
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    fireEvent.click(screen.getByRole("button", { name: "快捷鍵" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "返回設定" }), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "設定" }));

    expect(screen.getByRole("dialog", { name: "設定" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "返回設定" })).not.toBeInTheDocument();
  });
});
