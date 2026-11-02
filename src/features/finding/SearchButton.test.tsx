import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InterfaceLanguageProvider } from "../interfaceLanguage/InterfaceLanguageContext";
import { FinderRequests } from "./FinderRequests";
import { SearchButton } from "./SearchButton";

function renderButton(language: "zh" | "en", isAvailable = true) {
  const requests = new FinderRequests();
  const requested = vi.fn();
  requests.subscribe(requested);
  render(
    <InterfaceLanguageProvider language={language}>
      <SearchButton requests={requests} isAvailable={isAvailable} />
    </InterfaceLanguageProvider>,
  );
  return requested;
}

describe("SearchButton", () => {
  it("names itself and shows the key that does the same", () => {
    renderButton("zh");

    const button = screen.getByRole("button", { name: /搜尋/ });
    expect(button).toHaveTextContent("⌘T");
    expect(button).toHaveAttribute("aria-keyshortcuts", "Meta+T");
  });

  it("speaks the interface language", () => {
    renderButton("en");

    expect(screen.getByRole("button", { name: /Search/ })).toBeInTheDocument();
  });

  it("cannot be pressed while there is nothing to search in", () => {
    const requested = renderButton("zh", false);

    const button = screen.getByRole("button", { name: /搜尋/ });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(requested).not.toHaveBeenCalled();
  });

  it("asks for the title finder when pressed", () => {
    const requested = renderButton("zh");

    fireEvent.click(screen.getByRole("button", { name: /搜尋/ }));

    expect(requested).toHaveBeenCalledWith("title");
  });
});
