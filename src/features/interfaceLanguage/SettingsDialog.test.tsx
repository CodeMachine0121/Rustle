import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { KeyboardShortcut } from "../preview/KeyboardShortcut";
import { FOLLOW_SYSTEM, ThemeCatalog, type ThemeChoice } from "../theme/ThemeCatalog";
import { SettingsSession } from "../settings/SettingsSession";
import { VimModeSession } from "../vim/VimModeSession";
import type { InterfaceLanguage } from "./interfaceLanguage";
import { InterfaceLanguageProvider } from "./InterfaceLanguageContext";
import { SettingsDialog } from "./SettingsDialog";

function renderDialog(
  language: InterfaceLanguage,
  composition = new CompositionState(),
  themeChoice: ThemeChoice = FOLLOW_SYSTEM,
) {
  const onChoose = vi.fn();
  const onClose = vi.fn();
  const chooseTheme = vi.fn();
  const theme = { choice: themeChoice, themes: ThemeCatalog.shipped().themes, choose: chooseTheme };
  const vimModes = new VimModeSession(new SettingsSession({ readSettings: vi.fn(), writeSettings: vi.fn() }));
  render(
    <CompositionProvider state={composition}>
      <InterfaceLanguageProvider language={language}>
        <SettingsDialog
          language={language}
          onChoose={onChoose}
          theme={theme}
          vimModes={vimModes}
          previewToggle={KeyboardShortcut.DEFAULT}
          onClose={onClose}
        />
      </InterfaceLanguageProvider>
    </CompositionProvider>,
  );
  return { onChoose, onClose, chooseTheme, vimModes };
}

function themeSelect(name = "主題"): HTMLSelectElement {
  return screen.getByRole("combobox", { name }) as HTMLSelectElement;
}

function options() {
  return within(screen.getByRole("radiogroup")).getAllByRole("radio");
}

describe("SettingsDialog", () => {
  it("is a dialog headed 設定 with the language, the theme, then Vim mode, and the language's two options side by side", () => {
    renderDialog("zh");

    const dialog = screen.getByRole("dialog", { name: "設定" });
    expect(within(dialog).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "語言",
      "主題",
      "Vim 模式",
    ]);
    expect(screen.getByRole("radiogroup", { name: "語言" })).toBeInTheDocument();
    expect(options()).toHaveLength(2);
  });

  it("keeps the dialog open when Vim mode is switched on", () => {
    const { onClose } = renderDialog("zh");

    fireEvent.click(screen.getByRole("switch", { name: "Vim 模式" }));

    expect(screen.getByRole("switch", { name: "Vim 模式" })).toHaveAttribute("aria-checked", "true");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("is headed Settings in English", () => {
    renderDialog("en");

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Language" })).toBeInTheDocument();
  });

  it.each(["zh", "en"] as const)("writes each option in its own language whatever the interface speaks (%s)", (language) => {
    renderDialog(language);

    expect(options().map((option) => [option.textContent, option.getAttribute("lang")])).toEqual([
      ["中文", "zh-Hant"],
      ["English", "en"],
    ]);
  });

  it("marks the language in use", () => {
    renderDialog("en");

    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "中文" })).toHaveAttribute("aria-checked", "false");
  });

  it("puts the keyboard on the first option when it opens", () => {
    renderDialog("en");

    expect(screen.getByRole("radio", { name: "中文" })).toHaveFocus();
  });

  it.each([
    ["English", "en"],
    ["中文", "zh"],
  ] as const)("chooses %s and closes", (name, language) => {
    const { onChoose, onClose } = renderDialog("zh");

    fireEvent.click(screen.getByRole("radio", { name }));

    expect(onChoose).toHaveBeenCalledWith(language);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Esc without choosing", () => {
    const { onChoose, onClose, chooseTheme } = renderDialog("zh");

    fireEvent.keyDown(screen.getByRole("radio", { name: "中文" }), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
    expect(chooseTheme).not.toHaveBeenCalled();
  });

  it("closes on Esc from the theme menu without choosing a theme", () => {
    const { onClose, chooseTheme } = renderDialog("zh");

    fireEvent.keyDown(themeSelect(), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(chooseTheme).not.toHaveBeenCalled();
  });

  it("lists Follow System, Light, Dark and Forest, and marks the theme in use", () => {
    renderDialog("zh");

    expect(Array.from(themeSelect().options).map((option) => option.textContent)).toEqual([
      "跟隨系統",
      "淡色",
      "暗色",
      "森林",
    ]);
    expect(themeSelect().selectedOptions[0]?.textContent).toBe("跟隨系統");
  });

  it("names the themes in English", () => {
    renderDialog("en", new CompositionState(), "forest");

    expect(Array.from(themeSelect("Theme").options).map((option) => option.textContent)).toEqual([
      "Follow System",
      "Light",
      "Dark",
      "Forest",
    ]);
    expect(themeSelect("Theme").selectedOptions[0]?.textContent).toBe("Forest");
  });

  it("offers the themes in a native menu the keyboard reaches and works, named by its heading", () => {
    renderDialog("zh");
    const select = themeSelect();

    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect(select).toBeEnabled();
    expect(select.tabIndex).toBeGreaterThanOrEqual(0);
    expect(select).toHaveAccessibleName("主題");
    select.focus();
    expect(select).toHaveFocus();
  });

  it("chooses a theme and stays open", () => {
    const { onClose, chooseTheme } = renderDialog("zh");

    fireEvent.change(themeSelect(), { target: { value: "forest" } });

    expect(chooseTheme).toHaveBeenCalledWith("forest");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("leaves Esc to the input method while it is composing", () => {
    const composition = new CompositionState();
    const { onClose } = renderDialog("zh", composition);
    composition.start();

    fireEvent.keyDown(screen.getByRole("radio", { name: "中文" }), { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a click on the dimmed backdrop without choosing", () => {
    const { onChoose, onClose, chooseTheme } = renderDialog("zh");

    fireEvent.click(screen.getByTestId("settings-backdrop"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
    expect(chooseTheme).not.toHaveBeenCalled();
  });

  it("stays open on a click inside the dialog", () => {
    const { onClose } = renderDialog("zh");

    fireEvent.click(screen.getByRole("heading", { name: "語言" }));

    expect(onClose).not.toHaveBeenCalled();
  });

  describe("keyboard shortcuts", () => {
    function rowsShown() {
      return Array.from(screen.getByRole("dialog").querySelectorAll(".keymap-overview__row")).map(
        (row) => row.textContent,
      );
    }

    it("offers a 快捷鍵 button under the language, the theme and Vim mode", () => {
      renderDialog("zh");

      const button = screen.getByRole("button", { name: "快捷鍵" });
      const vimSwitch = screen.getByRole("switch", { name: "Vim 模式" });
      expect(vimSwitch.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("is named Keyboard Shortcuts in English", () => {
      renderDialog("en");

      expect(screen.getByRole("button", { name: "Keyboard Shortcuts" })).toBeInTheDocument();
    });

    it("replaces the settings with the list inside the same dialog", () => {
      renderDialog("zh");

      fireEvent.click(screen.getByRole("button", { name: "快捷鍵" }));

      expect(screen.getByRole("dialog", { name: "快捷鍵" })).toBeInTheDocument();
      expect(screen.queryByRole("radiogroup", { name: "語言" })).not.toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "主題" })).not.toBeInTheDocument();
      expect(screen.queryByRole("switch", { name: "Vim 模式" })).not.toBeInTheDocument();
    });

    it("goes back to the settings unchanged, with the keyboard on the 快捷鍵 button", () => {
      const { onChoose, onClose, chooseTheme, vimModes } = renderDialog("zh", new CompositionState(), "forest");
      act(() => vimModes.setEnabled(true));
      fireEvent.click(screen.getByRole("button", { name: "快捷鍵" }));

      fireEvent.click(screen.getByRole("button", { name: "返回設定" }));

      expect(screen.getByRole("dialog", { name: "設定" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "中文" })).toHaveAttribute("aria-checked", "true");
      expect(themeSelect().selectedOptions[0]?.textContent).toBe("森林");
      expect(screen.getByRole("switch", { name: "Vim 模式" })).toHaveAttribute("aria-checked", "true");
      expect(onChoose).not.toHaveBeenCalled();
      expect(chooseTheme).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(vimModes.isEnabled).toBe(true);
      expect(screen.getByRole("button", { name: "快捷鍵" })).toHaveFocus();
    });

    it("closes the whole dialog on Esc from the list", () => {
      const { onClose } = renderDialog("zh");
      fireEvent.click(screen.getByRole("button", { name: "快捷鍵" }));

      fireEvent.keyDown(screen.getByRole("button", { name: "返回設定" }), { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("shows exactly the same rows whether Vim mode is on or off", () => {
      const { vimModes } = renderDialog("zh");
      fireEvent.click(screen.getByRole("button", { name: "快捷鍵" }));
      const withVimOff = rowsShown();
      fireEvent.click(screen.getByRole("button", { name: "返回設定" }));

      act(() => vimModes.setEnabled(true));
      fireEvent.click(screen.getByRole("button", { name: "快捷鍵" }));

      expect(withVimOff.length).toBeGreaterThan(0);
      expect(rowsShown()).toEqual(withVimOff);
    });
  });
});
