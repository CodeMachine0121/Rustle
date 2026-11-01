import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  Channel: class {
    onmessage: (message: null) => void = () => undefined;
  },
}));

beforeEach(() => {
  vi.useRealTimers();
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockResolvedValue(null);
});

describe("App", () => {
  it("opens with the sample body in the markdown editor", () => {
    const { container } = render(<App />);

    expect(container.querySelector(".cm-content")).toHaveTextContent("寫作的禪");
  });

  it("indents the cursor line by two spaces when Tab is pressed in the editor", () => {
    const { container } = render(<App />);
    const content = container.querySelector(".cm-content");
    if (!(content instanceof HTMLElement)) {
      throw new Error("the editor did not render its content area");
    }

    const firstLineBefore = content.querySelector(".cm-line")?.textContent;
    fireEvent.keyDown(content, { key: "Tab" });

    expect(content.querySelector(".cm-line")?.textContent).toBe(`  ${firstLineBefore ?? ""}`);
  });

  it("shows no save status while no article is open, even after typing", async () => {
    vi.useFakeTimers();
    const { container, getByRole } = render(<App />);
    const content = container.querySelector(".cm-content");
    if (!(content instanceof HTMLElement)) {
      throw new Error("the editor did not render its content area");
    }

    fireEvent.keyDown(content, { key: "Tab" });
    await vi.advanceTimersByTimeAsync(1000);

    expect(getByRole("banner")).toBeEmptyDOMElement();
    expect(invoke).not.toHaveBeenCalledWith("save_body", expect.anything());
  });

  it("starts watching window close requests", () => {
    render(<App />);

    expect(invoke).toHaveBeenCalledWith("watch_close_requests", expect.anything());
  });
});
