import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("opens with the sample body in the markdown editor", () => {
    const { container } = render(<App />);

    expect(container.querySelector(".cm-content")).toHaveTextContent("寫作的禪");
  });
});
