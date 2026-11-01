import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppLayout, type PreviewSlot } from "./AppLayout";

function previewSlot(isOpen: boolean): PreviewSlot {
  return { isOpen, content: <p>預覽內容</p>, onOpen: vi.fn(), onClose: vi.fn() };
}

describe("AppLayout", () => {
  it("has a titled region for workspaces, articles and the editor", () => {
    render(<AppLayout workspaces="w" articles="a" editor="e" />);

    const titles = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(titles).toEqual(["WORKSPACES", "ARTICLES", "EDITOR"]);
  });

  it("puts an open preview in the rightmost region with a button that closes it", () => {
    const preview = previewSlot(true);
    render(<AppLayout workspaces="w" articles="a" editor="e" preview={preview} />);

    const regions = screen.getAllByRole("region");
    expect(regions).toHaveLength(4);
    expect(regions.at(-1)).toHaveAccessibleName("PREVIEW");
    expect(regions.at(-1)).toHaveTextContent("預覽內容");

    fireEvent.click(screen.getByRole("button", { name: "關閉預覽" }));
    expect(preview.onClose).toHaveBeenCalled();
  });

  it("folds a closed preview into a handle that opens it", () => {
    const preview = previewSlot(false);
    render(<AppLayout workspaces="w" articles="a" editor="e" preview={preview} />);

    expect(screen.queryByRole("region", { name: "PREVIEW" })).not.toBeInTheDocument();
    expect(screen.queryByText("預覽內容")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "開啟預覽" }));
    expect(preview.onOpen).toHaveBeenCalled();
  });

  it("leaves the preview region out when there is no preview", () => {
    render(<AppLayout workspaces="w" articles="a" editor="e" />);

    expect(screen.queryByRole("region", { name: "PREVIEW" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("region").at(-1)).toHaveAccessibleName("EDITOR");
  });
});
