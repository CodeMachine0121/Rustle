import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { SettingsEntry } from "./SettingsEntry";

function renderEntry() {
  const onChoose = vi.fn();
  render(
    <CompositionProvider>
      <SettingsEntry language="zh" onChoose={onChoose} />
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
});
