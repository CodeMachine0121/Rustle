import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
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
  render(
    <CompositionProvider state={composition}>
      <InterfaceLanguageProvider language={language}>
        <SettingsDialog
          language={language}
          onChoose={onChoose}
          theme={theme}
          vimModes={new VimModeSession(new SettingsSession({ readSettings: vi.fn(), writeSettings: vi.fn() }))}
          onClose={onClose}
        />
      </InterfaceLanguageProvider>
    </CompositionProvider>,
  );
  return { onChoose, onClose, chooseTheme };
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
});
