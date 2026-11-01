// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "../autosave/AutosaveSession";
import { PreviewedBody } from "./PreviewedBody";
import { PreviewPanel } from "./PreviewPanel";
import { ScrollSynchronizer, type ScrollPane } from "./ScrollSynchronizer";

function editorSession(): AutosaveSession {
  return new AutosaveSession(new CompositionState(), {
    saveBody: () => Promise.reject(new Error("not saving in this test")),
    readBody: () => Promise.reject(new Error("not reading in this test")),
  });
}

describe("PreviewPanel", () => {
  it("says what the editor says while no article is open, with nothing to type into", () => {
    const { container } = render(
      <PreviewPanel previewedBody={new PreviewedBody(editorSession(), new CompositionState())} />,
    );

    expect(screen.getByText("選一篇文章開始寫作")).toBeInTheDocument();
    expect(container.querySelector("[contenteditable], input, textarea")).toBeNull();
  });

  it("shows the rendered body of the open article", async () => {
    const editor = editorSession();
    render(<PreviewPanel previewedBody={new PreviewedBody(editor, new CompositionState())} />);

    await act(() =>
      editor.openArticle({
        article: {
          workspace: "Blog",
          fileName: "a.md",
          body: "# 只有正文",
          lastKnownModifiedAt: "2026-08-20T08:00:00.000Z",
        },
        title: "A",
      }),
    );

    expect(screen.getByRole("heading", { level: 1, name: "只有正文" })).toBeInTheDocument();
    expect(screen.queryByText("選一篇文章開始寫作")).not.toBeInTheDocument();
  });

  it("shows an image of the article's workspace through the vault scheme", async () => {
    const editor = editorSession();
    const { container } = render(
      <PreviewPanel previewedBody={new PreviewedBody(editor, new CompositionState())} />,
    );

    await act(() =>
      editor.openArticle({
        article: {
          workspace: "隨筆",
          fileName: "a.md",
          body: "![](images/8f3c.png)",
          lastKnownModifiedAt: "2026-08-20T08:00:00.000Z",
        },
        title: "A",
      }),
    );

    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "rustle://vault/%E9%9A%A8%E7%AD%86/images/8f3c.png",
    );
  });

  it("shows an empty article as an empty preview, not as no article", async () => {
    const editor = editorSession();
    render(<PreviewPanel previewedBody={new PreviewedBody(editor, new CompositionState())} />);

    await act(() =>
      editor.openArticle({
        article: { workspace: "Blog", fileName: "a.md", body: "", lastKnownModifiedAt: "2026-08-20T08:00:00.000Z" },
        title: "A",
      }),
    );

    expect(screen.getByRole("article", { name: "預覽內容" })).toBeEmptyDOMElement();
    expect(screen.queryByText("選一篇文章開始寫作")).not.toBeInTheDocument();
  });

  describe("scroll sync", () => {
    function editorPane(): ScrollPane & { scroll: () => void } {
      let listener: () => void = () => undefined;
      return {
        scroll: () => listener(),
        listen: (onScroll) => {
          listener = onScroll;
          return () => undefined;
        },
        position: () => 0,
        maximumPosition: () => 1000,
        lineAtTop: () => 0,
        positionForLine: (line) => line * 20,
        scrollTo: vi.fn(),
      };
    }

    async function showBody(editor: AutosaveSession, body: string) {
      await act(() =>
        editor.openArticle({
          article: { workspace: "Blog", fileName: "a.md", body, lastKnownModifiedAt: "2026-08-20T08:00:00.000Z" },
          title: "A",
        }),
      );
    }

    function scrollPreview(scroller: Element, position: number) {
      Object.defineProperties(scroller, {
        scrollHeight: { value: 2000, configurable: true },
        clientHeight: { value: 300, configurable: true },
      });
      scroller.scrollTop = position;
      fireEvent.scroll(scroller);
    }

    it("leads the editor while it shows a body", async () => {
      const editor = editorSession();
      const synchronizer = new ScrollSynchronizer();
      const pane = editorPane();
      synchronizer.attach("editor", pane);
      const { container } = render(
        <PreviewPanel
          previewedBody={new PreviewedBody(editor, new CompositionState())}
          scrollSynchronizer={synchronizer}
        />,
      );
      await showBody(editor, "# 標題\n\n正文");

      const scroller = container.querySelector(".preview-scroller");
      if (scroller === null) {
        throw new Error("the preview has no scroller");
      }
      scrollPreview(scroller, 1700);

      expect(pane.scrollTo).toHaveBeenCalledWith(1000);
    });

    it("stops leading once it is gone", async () => {
      const editor = editorSession();
      const synchronizer = new ScrollSynchronizer();
      const pane = editorPane();
      synchronizer.attach("editor", pane);
      const { container, unmount } = render(
        <PreviewPanel
          previewedBody={new PreviewedBody(editor, new CompositionState())}
          scrollSynchronizer={synchronizer}
        />,
      );
      await showBody(editor, "正文");
      const scroller = container.querySelector(".preview-scroller");

      unmount();
      if (scroller !== null) {
        scrollPreview(scroller, 1700);
      }
      pane.scroll();

      expect(scroller).not.toBeNull();
      expect(pane.scrollTo).not.toHaveBeenCalled();
    });
  });
});
