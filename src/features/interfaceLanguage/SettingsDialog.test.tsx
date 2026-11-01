import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import type { InterfaceLanguage } from "./interfaceLanguage";
import { InterfaceLanguageProvider } from "./InterfaceLanguageContext";
import { SettingsDialog } from "./SettingsDialog";

function renderDialog(language: InterfaceLanguage, composition = new CompositionState()) {
  const onChoose = vi.fn();
  const onClose = vi.fn();
  render(
    <CompositionProvider state={composition}>
      <InterfaceLanguageProvider language={language}>
        <SettingsDialog language={language} onChoose={onChoose} onClose={onClose} />
      </InterfaceLanguageProvider>
    </CompositionProvider>,
  );
  return { onChoose, onClose };
}

function options() {
  return within(screen.getByRole("radiogroup")).getAllByRole("radio");
}

describe("SettingsDialog", () => {
  it("is a dialog headed 設定 with one item, the language, and its two options side by side", () => {
    renderDialog("zh");

    const dialog = screen.getByRole("dialog", { name: "設定" });
    expect(within(dialog).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "語言",
    ]);
    expect(screen.getByRole("radiogroup", { name: "語言" })).toBeInTheDocument();
    expect(options()).toHaveLength(2);
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
    const { onChoose, onClose } = renderDialog("zh");

    fireEvent.keyDown(screen.getByRole("radio", { name: "中文" }), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("leaves Esc to the input method while it is composing", () => {
    const composition = new CompositionState();
    const { onClose } = renderDialog("zh", composition);
    composition.start();

    fireEvent.keyDown(screen.getByRole("radio", { name: "中文" }), { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a click on the dimmed backdrop without choosing", () => {
    const { onChoose, onClose } = renderDialog("zh");

    fireEvent.click(screen.getByTestId("settings-backdrop"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("stays open on a click inside the dialog", () => {
    const { onClose } = renderDialog("zh");

    fireEvent.click(screen.getByRole("heading", { name: "語言" }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
