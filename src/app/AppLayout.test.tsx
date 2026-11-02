import { EditorView } from "@codemirror/view";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PreviewWidth } from "../features/preview/PreviewWidth";
import type { ViewMode, WritingLayoutSnapshot } from "../features/writingLayout/WritingLayout";
import { MarkdownEditor } from "../features/editor/MarkdownEditor";
import { CompositionProvider } from "../shared/composition/CompositionContext";
import { CompositionState } from "../shared/composition/CompositionState";
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
  return { viewMode, isZen };
}

function renderLayout(layout = writing("sideBySide"), preview = previewSlot(), isFolded = false) {
  render(
    <CompositionProvider>
      <AppLayout
        sidebar={<button type="button">側欄按鈕</button>}
        articles={<button type="button">文章按鈕</button>}
        editor={<p>編輯內容</p>}
        preview={preview}
        writing={layout}
        toolbar={<div className="toolbar-stub">工具列</div>}
        statusLine={<footer>狀態列</footer>}
        sidebarFold={{ isFolded, button: <button type="button">fold</button> }}
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

  it.each<ViewMode>(["sideBySide", "editorOnly", "previewOnly"])(
    "puts the toolbar on top of the writing sheet and the status line at its foot in %s",
    (viewMode) => {
      renderLayout(writing(viewMode));

      const sheet = document.querySelector(".writing-sheet");
      expect(sheet?.firstElementChild).toHaveTextContent("工具列");
      expect(sheet?.lastElementChild).toHaveTextContent("狀態列");
      expect(region("編輯區").contains(screen.getByText("工具列"))).toBe(false);
    },
  );

  it("keeps the toolbar on the sheet in Zen Mode", () => {
    renderLayout(writing("sideBySide", true));

    expect(screen.getByText("工具列")).toBeVisible();
    expect(screen.getByText("狀態列")).toBeVisible();
  });

  it("titles no column on screen, while every column keeps its name for screen readers", () => {
    renderLayout();

    expect(screen.queryAllByRole("heading")).toEqual([]);
    expect(region("編輯區").querySelector(".region-header")).toBeNull();
    expect(region("預覽區").querySelector(".region-header")).toBeNull();
    expect(region("文章")).toBeInTheDocument();
    expect(region("編輯區")).toBeInTheDocument();
    expect(region("預覽區")).toBeInTheDocument();
  });

  it("gives the preview its share of the writing area beside a divider side by side", () => {
    renderLayout(writing("sideBySide"), previewSlot(0.35));

    expect(region("預覽區").style.flexBasis).toBe("35%");
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "35");
  });

  it("leaves only the editor in editor only", () => {
    renderLayout(writing("editorOnly"));

    expect(document.querySelector('section[aria-label="預覽區"]')).toBeNull();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(region("編輯區")).toBeVisible();
  });

  it("hides the editor without removing it in preview only", () => {
    renderLayout(writing("previewOnly"));

    expect(region("編輯區")).not.toBeVisible();
    expect(region("編輯區")).toHaveTextContent("編輯內容");
    expect(region("預覽區")).toBeVisible();
    expect(region("預覽區").style.flexBasis).toBe("100%");
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("has no preview handle and no close button on the preview", () => {
    renderLayout(writing("editorOnly"));

    expect(screen.queryByRole("button", { name: /預覽/ })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/◀|✕/u);
  });

  it("hides only the sidebar, keeping it mounted, while it is folded", () => {
    renderLayout(writing("sideBySide"), previewSlot(), true);

    expect(document.querySelector("nav")).not.toBeVisible();
    expect(document.querySelector("nav")).toHaveTextContent("側欄按鈕");
    expect(region("文章")).toBeVisible();
    expect(region("編輯區")).toBeVisible();
  });

  it("puts the fold button first in the articles' header, where it stays while the sidebar is folded", () => {
    renderLayout(writing("sideBySide"), previewSlot(), true);

    expect(headerOf("文章")).toEqual(["fold"]);
    expect(within(region("文章")).getByRole("button", { name: "fold" })).toBeVisible();
  });

  it.each([false, true])("hides the sidebar, the articles and the fold button in Zen Mode (folded: %s)", (isFolded) => {
    renderLayout(writing("sideBySide", true), previewSlot(), isFolded);

    expect(document.querySelector("nav")).not.toBeVisible();
    expect(region("文章")).not.toBeVisible();
    expect(screen.queryByRole("button", { name: "fold" })).not.toBeInTheDocument();
  });

  it("hides the sidebar and the articles, keeping them mounted, in Zen Mode", () => {
    renderLayout(writing("sideBySide", true));

    expect(document.querySelector("nav")).not.toBeVisible();
    expect(region("文章")).not.toBeVisible();
    expect(region("文章")).toHaveTextContent("文章按鈕");
    expect(screen.queryByRole("button", { name: "側欄按鈕" })).not.toBeInTheDocument();
    expect(region("編輯區")).toBeVisible();
  });

  it("leaves a composition running in the editor alone through every view mode and Zen Mode", () => {
    const composition = new CompositionState();
    const layoutIn = (layout: WritingLayoutSnapshot) => (
      <CompositionProvider state={composition}>
        <AppLayout
          sidebar="s"
          articles="a"
          editor={<MarkdownEditor documentKey="Blog/zen.md" body="正文" />}
          preview={previewSlot()}
          writing={layout}
          toolbar={null}
        />
      </CompositionProvider>
    );
    const view = render(layoutIn(writing("sideBySide")));
    const content = document.querySelector<HTMLElement>(".cm-content");
    if (content === null) {
      throw new Error("the editor did not render its content area");
    }
    const editor = EditorView.findFromDOM(content);
    content.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    expect(composition.isComposing).toBe(true);

    for (const layout of [writing("editorOnly"), writing("previewOnly"), writing("previewOnly", true), writing("sideBySide")]) {
      view.rerender(layoutIn(layout));
    }

    expect(composition.isComposing).toBe(true);
    expect(EditorView.findFromDOM(content)).toBe(editor);
    expect(content.isConnected).toBe(true);
  });
  it("marks the editor and the preview, and nothing else, as surfaces a zoom acts on", () => {
    renderLayout();

    expect(region("編輯區").getAttribute("data-font-size-surface")).toBe("editor");
    expect(region("預覽區").getAttribute("data-font-size-surface")).toBe("preview");
    expect(document.querySelectorAll("[data-font-size-surface]")).toHaveLength(2);
  });
});
