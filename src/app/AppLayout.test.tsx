import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PreviewWidth } from "../features/preview/PreviewWidth";
import { CompositionProvider } from "../shared/composition/CompositionContext";
import { AppLayout, type PreviewSlot } from "./AppLayout";

function previewSlot(isOpen: boolean, ratio = 0.5): PreviewSlot {
  return {
    isOpen,
    content: <p>預覽內容</p>,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    width: PreviewWidth.of(ratio),
    onResize: vi.fn(),
    onResizeEnd: vi.fn(),
  };
}

function renderLayout(preview?: PreviewSlot) {
  render(
    <CompositionProvider>
      <AppLayout workspaces="w" articles="a" editor="e" preview={preview} />
    </CompositionProvider>,
  );
}

describe("AppLayout", () => {
  it("has a titled region for workspaces, articles and the editor", () => {
    renderLayout();

    const titles = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(titles).toEqual(["WORKSPACES", "ARTICLES", "EDITOR"]);
  });

  it("puts an open preview in the rightmost region with a button that closes it", () => {
    const preview = previewSlot(true);
    renderLayout(preview);

    const regions = screen.getAllByRole("region");
    expect(regions).toHaveLength(4);
    expect(regions.at(-1)).toHaveAccessibleName("PREVIEW");
    expect(regions.at(-1)).toHaveTextContent("預覽內容");

    fireEvent.click(screen.getByRole("button", { name: "關閉預覽" }));
    expect(preview.onClose).toHaveBeenCalled();
  });

  it("folds a closed preview into a handle that opens it", () => {
    const preview = previewSlot(false);
    renderLayout(preview);

    expect(screen.queryByRole("region", { name: "PREVIEW" })).not.toBeInTheDocument();
    expect(screen.queryByText("預覽內容")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "開啟預覽" }));
    expect(preview.onOpen).toHaveBeenCalled();
  });

  it("leaves the preview region out when there is no preview", () => {
    renderLayout();

    expect(screen.queryByRole("region", { name: "PREVIEW" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("region").at(-1)).toHaveAccessibleName("EDITOR");
  });

  it("gives an open preview its share of the writing area beside a divider", () => {
    renderLayout(previewSlot(true, 0.35));

    expect(screen.getByRole("region", { name: "PREVIEW" }).style.flexBasis).toBe("35%");
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "35");
  });

  it("has no divider while the preview is folded", () => {
    renderLayout(previewSlot(false));

    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });
});
