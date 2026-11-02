import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WritingToolbar } from "./WritingToolbar";

describe("WritingToolbar", () => {
  it("puts where the writer is on the left, then the view modes, then Zen", () => {
    const { container } = render(
      <WritingToolbar
        breadcrumb={<span>Blog / 寫作是修行</span>}
        viewModeButtons={<span>modes</span>}
        zenButton={<span>zen</span>}
      />,
    );

    const toolbar = container.querySelector(".writing-toolbar");
    expect(Array.from(toolbar?.children ?? []).map((part) => part.textContent)).toEqual([
      "Blog / 寫作是修行",
      "modes",
      "zen",
    ]);
  });

  it("keeps an empty place for where the writer is, so the controls stay put", () => {
    const { container } = render(<WritingToolbar viewModeButtons={<span>modes</span>} zenButton={<span>zen</span>} />);

    expect(container.querySelector(".writing-toolbar")?.firstElementChild).toHaveClass("writing-toolbar__breadcrumb");
  });
});
