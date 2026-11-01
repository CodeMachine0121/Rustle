import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

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
});
