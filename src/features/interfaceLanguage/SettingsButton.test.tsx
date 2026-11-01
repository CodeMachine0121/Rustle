import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InterfaceLanguageProvider } from "./InterfaceLanguageContext";
import { SettingsButton } from "./SettingsButton";

describe("SettingsButton", () => {
  it.each([
    ["zh", "設定"],
    ["en", "Settings"],
  ] as const)("is a gear named in the interface language (%s)", (language, name) => {
    const onToggle = vi.fn();
    render(
      <InterfaceLanguageProvider language={language}>
        <SettingsButton isOpen={false} onToggle={onToggle} />
      </InterfaceLanguageProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name })).toHaveAttribute("aria-expanded", "false");
  });

  it("draws a gear: a hub, a ring and eight teeth", () => {
    const { container } = render(<SettingsButton isOpen onToggle={vi.fn()} />);

    expect(container.querySelectorAll("svg circle")).toHaveLength(2);
    expect(container.querySelectorAll("svg rect")).toHaveLength(8);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });
});
