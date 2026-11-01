import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import { ViewModeButtons, ZenButton } from "./WritingControls";
import { WritingLayout } from "./WritingLayout";

async function layout() {
  const channels = {
    readSettings: vi.fn(() => Promise.resolve<ChannelResult<Settings>>({ ok: true, payload: DEFAULT_SETTINGS })),
    writeSettings: vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null })),
  };
  const settings = new SettingsSession(channels);
  await settings.load();
  return new WritingLayout(settings);
}

function viewModeNames(): string[] {
  return viewModeButtons().map((button) => button.getAttribute("aria-label") ?? "");
}

function viewModeButtons(): HTMLElement[] {
  return Array.from(screen.getByRole("group", { name: "檢視模式" }).querySelectorAll("button"));
}

describe("ZenButton", () => {
  it("is an icon that turns Zen Mode on and off, its arrows pointing in while it is on", async () => {
    const writingLayout = await layout();
    const { rerender } = render(<ZenButton layout={writingLayout} isZen={false} />);
    const button = screen.getByRole("button", { name: "Zen Mode" });
    const outwardArrows = button.innerHTML;
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("");

    fireEvent.click(button);
    expect(writingLayout.snapshot.isZen).toBe(true);
    rerender(<ZenButton layout={writingLayout} isZen />);

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.innerHTML).not.toBe(outwardArrows);
  });
});

describe("ViewModeButtons", () => {
  it("offers editor only, side by side and preview only as icons, the current one pressed", async () => {
    render(<ViewModeButtons layout={await layout()} viewMode="sideBySide" />);

    expect(viewModeNames()).toEqual(["只有編輯", "編輯與預覽並排", "只有預覽"]);
    expect(viewModeButtons().map((button) => button.getAttribute("aria-pressed"))).toEqual(["false", "true", "false"]);
    expect(viewModeButtons().every((button) => button.textContent === "" && button.querySelector("svg") !== null)).toBe(true);
  });

  it("chooses the view mode that is pressed", async () => {
    const writingLayout = await layout();
    render(<ViewModeButtons layout={writingLayout} viewMode="sideBySide" />);

    fireEvent.click(screen.getByRole("button", { name: "只有編輯" }));

    expect(writingLayout.snapshot.viewMode).toBe("editorOnly");
  });

  it("puts the keyboard on the current button when a choice moved the buttons here", async () => {
    const writingLayout = await layout();
    act(() => writingLayout.choose("previewOnly"));

    render(<ViewModeButtons layout={writingLayout} viewMode="previewOnly" />);

    expect(screen.getByRole("button", { name: "只有預覽" })).toHaveFocus();
  });

  it("leaves the keyboard where it is when it appears for another reason", async () => {
    render(<ViewModeButtons layout={await layout()} viewMode="sideBySide" />);

    expect(document.body).toHaveFocus();
  });
});
