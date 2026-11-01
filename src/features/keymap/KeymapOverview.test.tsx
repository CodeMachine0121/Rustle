import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { InterfaceLanguage } from "../interfaceLanguage/interfaceLanguage";
import { CHINESE_MESSAGES } from "../interfaceLanguage/messages";
import { InterfaceLanguageProvider } from "../interfaceLanguage/InterfaceLanguageContext";
import { KeyboardShortcut } from "../preview/KeyboardShortcut";
import { KeymapOverview } from "./KeymapOverview";

function renderOverview(language: InterfaceLanguage, previewToggle = KeyboardShortcut.DEFAULT) {
  const onBack = vi.fn();
  render(
    <InterfaceLanguageProvider language={language}>
      <KeymapOverview headingId="keymap-heading" previewToggle={previewToggle} onBack={onBack} />
    </InterfaceLanguageProvider>,
  );
  return onBack;
}

function keyFor(description: string): string | null | undefined {
  return screen.getByText(description, { selector: "dt" }).parentElement?.querySelector("kbd")?.textContent;
}

describe("KeymapOverview", () => {
  it("is headed 快捷鍵 and shows the groups top to bottom", () => {
    renderOverview("zh");

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("快捷鍵");
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "寫作",
      "畫面",
      "視窗",
      "尋找",
    ]);
  });

  it("describes a row in Chinese and writes its key as printed on the keyboard", () => {
    renderOverview("zh");

    expect(keyFor("粗體")).toBe("Cmd+B");
    expect(keyFor("縮排")).toBe("Tab");
    expect(keyFor("擴大選取")).toBe("Cmd+W");
    expect(keyFor("關閉視窗")).toBe("Shift+Cmd+W");
  });

  it("describes the same row in English and keeps its key", () => {
    renderOverview("en");

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Keyboard Shortcuts");
    expect(keyFor("Bold")).toBe("Cmd+B");
    expect(screen.queryByText("粗體")).not.toBeInTheDocument();
  });

  it("writes the preview row with the key the app answers to", () => {
    renderOverview("zh", KeyboardShortcut.fromSetting("Cmd+Alt+K"));

    expect(keyFor("開關預覽")).toBe("Option+Cmd+K");
  });

  it("says nothing of its own outside the interface copy, apart from the key names", () => {
    renderOverview("zh");
    const sentences = new Set<unknown>(Object.values(CHINESE_MESSAGES));
    const words = Array.from(document.querySelectorAll("h2, h3, dt")).map((element) => element.textContent);
    const keyNames = Array.from(document.querySelectorAll("kbd")).map((element) => element.textContent);

    expect(words.filter((word) => !sentences.has(word))).toEqual([]);
    expect(keyNames.every((keyName) => /^(?:[A-Z][a-z]*\+)*(?:[A-Z][a-z]*|[A-Z0-9/])$/.test(keyName ?? ""))).toBe(true);
  });

  it("has no rows for undo or redo", () => {
    renderOverview("zh");

    expect(screen.queryByText("還原")).not.toBeInTheDocument();
    expect(screen.queryByText("重做")).not.toBeInTheDocument();
  });

  it("goes back from a named arrow button that has the keyboard", () => {
    const onBack = renderOverview("zh");
    const back = screen.getByRole("button", { name: "返回設定" });

    expect(back).toHaveFocus();
    expect(within(back).queryByText(/./)).not.toBeInTheDocument();
    fireEvent.click(back);

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
