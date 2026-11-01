import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { KeyboardShortcut } from "../preview/KeyboardShortcut";
import { FOLLOW_SYSTEM } from "../theme/ThemeCatalog";
import { SettingsSession } from "../settings/SettingsSession";
import { VimModeSession } from "../vim/VimModeSession";
import { SettingsEntry } from "./SettingsEntry";

function renderEntry(composition = new CompositionState(), { gearHidden = false } = {}) {
  const onChoose = vi.fn();
  render(
    <CompositionProvider state={composition}>
      <nav hidden={gearHidden}>
        <SettingsEntry
          language="zh"
          onChoose={onChoose}
          theme={{ choice: FOLLOW_SYSTEM, themes: [], choose: vi.fn() }}
          vimModes={new VimModeSession(new SettingsSession({ readSettings: vi.fn(), writeSettings: vi.fn() }))}
          previewToggle={KeyboardShortcut.DEFAULT}
        />
      </nav>
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

  describe("the settings key", () => {
    function pressComma(init: KeyboardEventInit = { metaKey: true }): KeyboardEvent {
      const event = new KeyboardEvent("keydown", { key: ",", code: "Comma", bubbles: true, cancelable: true, ...init });
      act(() => {
        document.body.dispatchEvent(event);
      });
      return event;
    }

    it.each([
      ["Cmd+,", { metaKey: true }],
      ["Ctrl+,", { ctrlKey: true }],
    ])("opens the settings on %s and takes the key", (_, init: KeyboardEventInit) => {
      renderEntry();

      const event = pressComma(init);

      expect(screen.getByRole("dialog", { name: "設定" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "設定" })).toHaveAttribute("aria-expanded", "true");
      expect(event.defaultPrevented).toBe(true);
    });

    it("closes the settings when pressed again, as the gear does", () => {
      renderEntry();
      pressComma();

      pressComma();

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("closes the settings it opened from the gear", () => {
      renderEntry();
      fireEvent.click(screen.getByRole("button", { name: "設定" }));

      pressComma();

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "設定" })).toHaveFocus();
    });

    it("gives the keyboard back to where it was when the key opened the settings", () => {
      renderEntry();
      const writing = document.createElement("textarea");
      document.body.append(writing);
      writing.focus();
      pressComma();

      fireEvent.keyDown(screen.getByRole("radio", { name: "中文" }), { key: "Escape" });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(writing).toHaveFocus();
      writing.remove();
    });

    it("shows the settings while the gear is hidden", () => {
      renderEntry(new CompositionState(), { gearHidden: true });

      pressComma();

      expect(screen.getByRole("dialog", { name: "設定" })).toBeVisible();
    });

    it("does nothing while an input method composes", () => {
      const composition = new CompositionState();
      renderEntry(composition);
      act(() => composition.start());

      const event = pressComma();

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(event.defaultPrevented).toBe(false);
    });

    it.each([
      ["without Cmd or Ctrl", {}],
      ["with Shift", { metaKey: true, shiftKey: true }],
      ["with Option", { metaKey: true, altKey: true }],
    ])("ignores the comma %s", (_, init: KeyboardEventInit) => {
      renderEntry();

      pressComma(init);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
