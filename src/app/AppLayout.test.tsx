import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PreviewWidth } from "../features/preview/PreviewWidth";
import type { ViewMode, WritingLayoutSnapshot } from "../features/writingLayout/WritingLayout";
import { CompositionProvider } from "../shared/composition/CompositionContext";
import { AppLayout, type PreviewSlot } from "./AppLayout";

function previewSlot(ratio = 0.5): PreviewSlot {
  return {
    content: <p>預覽內容</p>,
    width: PreviewWidth.of(ratio),
    onResize: vi.fn(),
    onResizeEnd: vi.fn(),
  };
}

function writing(viewMode: ViewMode, isZen = false): WritingLayoutSnapshot {
  return { viewMode, isZen, controlsLiveIn: viewMode === "previewOnly" ? "preview" : "editor" };
}

function renderLayout(layout = writing("sideBySide"), preview = previewSlot()) {
  render(
    <CompositionProvider>
      <AppLayout
        sidebar={<button type="button">側欄按鈕</button>}
        articles={<button type="button">文章按鈕</button>}
        editor={<p>編輯內容</p>}
        preview={preview}
        writing={layout}
        controls={{
          zenButton: <button type="button">zen</button>,
          viewModeButtons: <button type="button">modes</button>,
        }}
      />
    </CompositionProvider>,
  );
}

function region(name: string): HTMLElement {
  const section = document.querySelector<HTMLElement>(`section[aria-label="${name}"]`);
  if (section === null) {
    throw new Error(`no ${name} region`);
  }
  return section;
}

function headerOf(name: string): string[] {
  const header = region(name).querySelector(".region-header");
  return Array.from(header?.children ?? []).map((child) => child.textContent ?? "");
}

describe("AppLayout", () => {
  it("puts the sidebar first, then the articles, the editor and the preview", () => {
    renderLayout();

    expect(screen.getByRole("navigation", { name: "側邊欄" })).toHaveTextContent("側欄按鈕");
    expect(screen.getAllByRole("region").map((shown) => shown.getAttribute("aria-label"))).toEqual([
      "文章",
      "編輯區",
      "預覽區",
    ]);
  });

  it("puts Zen on the left and the view modes on the right of the editor's header side by side", () => {
    renderLayout(writing("sideBySide"));

    expect(headerOf("編輯區")).toEqual(["zen", "編輯", "modes"]);
    expect(headerOf("預覽區")).toEqual(["預覽"]);
  });

  it("gives the preview its share of the writing area beside a divider side by side", () => {
    renderLayout(writing("sideBySide"), previewSlot(0.35));

    expect(region("預覽區").style.flexBasis).toBe("35%");
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "35");
  });

  it("leaves only the editor, with its controls, in editor only", () => {
    renderLayout(writing("editorOnly"));

    expect(document.querySelector('section[aria-label="預覽區"]')).toBeNull();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(headerOf("編輯區")).toEqual(["zen", "編輯", "modes"]);
  });

  it("hides the editor without removing it and moves the controls to the preview in preview only", () => {
    renderLayout(writing("previewOnly"));

    expect(region("編輯區")).not.toBeVisible();
    expect(region("編輯區")).toHaveTextContent("編輯內容");
    expect(region("預覽區")).toBeVisible();
    expect(region("預覽區").style.flexBasis).toBe("100%");
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(headerOf("預覽區")).toEqual(["zen", "預覽", "modes"]);
    expect(headerOf("編輯區")).toEqual(["編輯"]);
  });

  it("has no preview handle and no close button on the preview", () => {
    renderLayout(writing("editorOnly"));

    expect(screen.queryByRole("button", { name: /預覽/ })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/◀|✕/u);
  });

  it("hides the sidebar and the articles, keeping them mounted, in Zen Mode", () => {
    renderLayout(writing("sideBySide", true));

    expect(document.querySelector("nav")).not.toBeVisible();
    expect(region("文章")).not.toBeVisible();
    expect(region("文章")).toHaveTextContent("文章按鈕");
    expect(screen.queryByRole("button", { name: "側欄按鈕" })).not.toBeInTheDocument();
    expect(within(region("編輯區")).getByRole("button", { name: "zen" })).toBeVisible();
  });
});
