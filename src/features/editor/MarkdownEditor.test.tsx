import { undo } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import type { IndentationSettings } from "./IndentUnit";
import { ScrollSynchronizer, type ScrollPane } from "../preview/ScrollSynchronizer";
import { MarkdownEditor } from "./MarkdownEditor";

function renderEditor(
  state = new CompositionState(),
  body = "# Zen of writing",
  indentation?: IndentationSettings,
) {
  const view = render(
    <CompositionProvider state={state}>
      <MarkdownEditor documentKey={body} body={body} indentation={indentation} />
    </CompositionProvider>,
  );
  const content = view.container.querySelector(".cm-content");
  if (!(content instanceof HTMLElement)) {
    throw new Error("the editor did not render its content area");
  }
  return { content, state, view };
}

describe("MarkdownEditor", () => {
  it("reports the whole body every time it is edited", () => {
    const onBodyChange = vi.fn();
    const view = render(
      <CompositionProvider state={new CompositionState()}>
        <MarkdownEditor documentKey="Blog/zen.md" body="# 標題" onBodyChange={onBodyChange} />
      </CompositionProvider>,
    );
    const content = view.container.querySelector(".cm-content");
    if (!(content instanceof HTMLElement)) {
      throw new Error("the editor did not render its content area");
    }

    fireEvent.keyDown(content, { key: "Tab" });

    expect(onBodyChange).toHaveBeenCalledWith("  # 標題");
  });

  it("does not report the body it was given as an edit", () => {
    const onBodyChange = vi.fn();
    render(
      <CompositionProvider state={new CompositionState()}>
        <MarkdownEditor documentKey="Blog/zen.md" body="# 標題" onBodyChange={onBodyChange} />
      </CompositionProvider>,
    );

    expect(onBodyChange).not.toHaveBeenCalled();
  });

  it("shows the body it was given and lets it be edited", () => {
    const { content } = renderEditor(new CompositionState(), "# 寫作的禪\n\n慢慢寫。");

    expect(content).toHaveTextContent("寫作的禪");
    expect(content).toHaveTextContent("慢慢寫。");
    expect(content).toHaveAttribute("contenteditable", "true");
  });

  it("marks the shared state as composing when a composition starts", () => {
    const { content, state } = renderEditor();

    fireEvent.compositionStart(content);

    expect(state.isComposing).toBe(true);
  });

  it("marks the shared state as no longer composing when the composition ends", () => {
    const { content, state } = renderEditor();

    fireEvent.compositionStart(content);
    fireEvent.compositionEnd(content);

    expect(state.isComposing).toBe(false);
  });

  it("reports a whole composition to the shared state as a start then an end", () => {
    const state = new CompositionState();
    const notifications: boolean[] = [];
    state.subscribe((isComposing) => notifications.push(isComposing));
    const { content } = renderEditor(state);

    fireEvent.compositionStart(content);
    fireEvent.compositionEnd(content);

    expect(notifications).toEqual([true, false]);
  });

  it("ends a composition still in progress when the editor is removed", () => {
    const { content, state, view } = renderEditor();

    fireEvent.compositionStart(content);
    view.unmount();

    expect(state.isComposing).toBe(false);
  });

  it("keeps the same editable element while articles are opened one after another", () => {
    const state = new CompositionState();
    const { content, view } = renderEditor(state, "# First article");

    for (const body of ["# Second article", "# Third article", "# First article"]) {
      view.rerender(
        <CompositionProvider state={state}>
          <MarkdownEditor documentKey={body} body={body} />
        </CompositionProvider>,
      );

      expect(view.container.querySelector(".cm-content")).toBe(content);
      expect(content.textContent).toBe(body);
    }
  });

  it("does not replace the document when the same document is given again", () => {
    const state = new CompositionState();
    const { content, view } = renderEditor(state, "字");
    fireEvent.keyDown(content, { key: "Tab" });

    view.rerender(
      <CompositionProvider state={state}>
        <MarkdownEditor documentKey="字" body="字" indentation={{ style: "spaces", width: 2 }} />
      </CompositionProvider>,
    );

    expect(content.textContent).toBe("  字");
  });

  it("shows another article even when its body is the same text", () => {
    const state = new CompositionState();
    const view = render(
      <CompositionProvider state={state}>
        <MarkdownEditor documentKey="Blog/a.md" body="" />
      </CompositionProvider>,
    );
    const content = view.container.querySelector(".cm-content");
    if (!(content instanceof HTMLElement)) {
      throw new Error("the editor did not render its content area");
    }
    fireEvent.keyDown(content, { key: "Tab" });
    expect(content.textContent).toBe("  ");

    view.rerender(
      <CompositionProvider state={state}>
        <MarkdownEditor documentKey="Blog/b.md" body="" />
      </CompositionProvider>,
    );

    expect(content.textContent).toBe("");
  });

  it("shows the next article with its own indentation", () => {
    const state = new CompositionState();
    const { content, view } = renderEditor(state, "第一篇", { style: "spaces", width: 2 });

    view.rerender(
      <CompositionProvider state={state}>
        <MarkdownEditor documentKey="第二篇" body="第二篇" indentation={{ style: "tab", width: 4 }} />
      </CompositionProvider>,
    );
    fireEvent.keyDown(content, { key: "Tab" });

    expect(content.textContent).toBe("\t第二篇");
  });

  it("waits for a composition to end before showing another article", () => {
    const state = new CompositionState();
    const { content, view } = renderEditor(state, "第一篇");

    fireEvent.compositionStart(content);
    view.rerender(
      <CompositionProvider state={state}>
        <MarkdownEditor documentKey="第二篇" body="第二篇" />
      </CompositionProvider>,
    );

    expect(content.textContent).toBe("第一篇");
    fireEvent.compositionEnd(content);
    expect(content.textContent).toBe("第二篇");
  });

  it("shows the last article asked for once a composition ends", () => {
    const state = new CompositionState();
    const { content, view } = renderEditor(state, "第一篇");

    fireEvent.compositionStart(content);
    for (const body of ["第二篇", "第三篇"]) {
      view.rerender(
        <CompositionProvider state={state}>
          <MarkdownEditor documentKey={body} body={body} />
        </CompositionProvider>,
      );
    }
    fireEvent.compositionEnd(content);

    expect(content.textContent).toBe("第三篇");
  });

  it("ends a composition whose end never arrived when the editor loses focus", () => {
    const { content, state } = renderEditor(new CompositionState(), "字");

    fireEvent.compositionStart(content);
    fireEvent.blur(content);
    fireEvent.keyDown(content, { key: "Tab" });

    expect(state.isComposing).toBe(false);
    expect(content.textContent).toBe("  字");
  });

  it("refuses to mount without a shared composition state", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<MarkdownEditor documentKey="# Zen" body="# Zen" />)).toThrow(/CompositionProvider/);
  });

  it("indents the cursor line by two spaces when no indentation settings are given", () => {
    const { content } = renderEditor(new CompositionState(), "字");

    fireEvent.keyDown(content, { key: "Tab" });

    expect(content.textContent).toBe("  字");
  });

  it("indents by the indentation settings it was given", () => {
    const { content } = renderEditor(new CompositionState(), "字", { style: "spaces", width: 4 });

    fireEvent.keyDown(content, { key: "Tab" });

    expect(content.textContent).toBe("    字");
  });

  it("does not indent while the shared state says a composition is in progress", () => {
    const { content } = renderEditor(new CompositionState(), "字");

    fireEvent.compositionStart(content);
    fireEvent.keyDown(content, { key: "Tab" });

    expect(content.textContent).toBe("字");
  });

  describe("handing the keyboard to a new document", () => {
    function renderSwitchingEditor(firstKey: string, firstBody: string) {
      const state = new CompositionState();
      const view = render(
        <>
          <button type="button">elsewhere</button>
          <CompositionProvider state={state}>
            <MarkdownEditor documentKey={firstKey} body={firstBody} />
          </CompositionProvider>
        </>,
      );
      const content = view.container.querySelector(".cm-content");
      if (!(content instanceof HTMLElement)) {
        throw new Error("the editor did not render its content area");
      }
      const elsewhere = view.getByRole("button", { name: "elsewhere" });
      const show = (documentKey: string, body: string, focusOnShow: boolean) =>
        view.rerender(
          <>
            <button type="button">elsewhere</button>
            <CompositionProvider state={state}>
              <MarkdownEditor documentKey={documentKey} body={body} focusOnShow={focusOnShow} />
            </CompositionProvider>
          </>,
        );
      return { content, elsewhere, show };
    }

    function cursorPosition(content: HTMLElement): number | undefined {
      return EditorView.findFromDOM(content)?.state.selection.main.head;
    }

    it("takes the keyboard with the cursor at the start when asked to", () => {
      const { content, elsewhere, show } = renderSwitchingEditor("Blog/old.md", "舊文章");
      elsewhere.focus();

      show("Blog/new.md", "第一行\n第二行", true);

      expect(content).toHaveFocus();
      expect(cursorPosition(content)).toBe(0);
    });

    it("takes the keyboard for a new empty article after another empty one", () => {
      const { content, elsewhere, show } = renderSwitchingEditor("Blog/empty.md", "");
      elsewhere.focus();

      show("Blog/new.md", "", true);

      expect(content).toHaveFocus();
    });

    it("leaves the keyboard where it is when not asked to", () => {
      const { elsewhere, show } = renderSwitchingEditor("Blog/old.md", "舊文章");
      elsewhere.focus();

      show("Blog/next.md", "下一篇", false);

      expect(elsewhere).toHaveFocus();
    });

    it("does not take the keyboard again when the same document is shown again", () => {
      const { elsewhere, show } = renderSwitchingEditor("Blog/old.md", "舊文章");
      show("Blog/new.md", "", true);
      elsewhere.focus();

      show("Blog/new.md", "", true);

      expect(elsewhere).toHaveFocus();
    });

    it("does not undo into the previous article", () => {
      const { content, show } = renderSwitchingEditor("Blog/first.md", "同樣的字");
      fireEvent.keyDown(content, { key: "Tab" });
      show("Blog/second.md", "  同樣的字", false);
      const editor = EditorView.findFromDOM(content);
      if (editor === null) {
        throw new Error("no editor behind the content area");
      }

      undo(editor);

      expect(content.textContent).toBe("  同樣的字");
    });
  });

  describe("scroll sync", () => {
    function previewPane(): ScrollPane & { scroll: () => void } {
      let listener: () => void = () => undefined;
      return {
        scroll: () => listener(),
        listen: (onScroll) => {
          listener = onScroll;
          return () => undefined;
        },
        position: () => 0,
        maximumPosition: () => 500,
        lineAtTop: () => 0,
        positionForLine: (line) => line * 20,
        scrollTo: vi.fn(),
      };
    }

    function renderSynchronizedEditor(synchronizer: ScrollSynchronizer) {
      const view = render(
        <CompositionProvider>
          <MarkdownEditor documentKey="a" body={"第一行\n第二行"} scrollSynchronizer={synchronizer} />
        </CompositionProvider>,
      );
      const scroller = view.container.querySelector(".cm-scroller");
      if (!(scroller instanceof HTMLElement)) {
        throw new Error("the editor did not render its scroller");
      }
      return { scroller, unmount: view.unmount };
    }

    it("leads the preview while mounted", () => {
      const synchronizer = new ScrollSynchronizer();
      const pane = previewPane();
      synchronizer.attach("preview", pane);
      const { scroller } = renderSynchronizedEditor(synchronizer);

      Object.defineProperty(scroller, "scrollTop", { value: 40, configurable: true });
      fireEvent.scroll(scroller);

      expect(pane.scrollTo).toHaveBeenCalledWith(500);
    });

    it("stops leading once unmounted", () => {
      const synchronizer = new ScrollSynchronizer();
      const pane = previewPane();
      synchronizer.attach("preview", pane);
      const { scroller, unmount } = renderSynchronizedEditor(synchronizer);

      unmount();
      Object.defineProperty(scroller, "scrollTop", { value: 40, configurable: true });
      fireEvent.scroll(scroller);
      pane.scroll();

      expect(pane.scrollTo).not.toHaveBeenCalled();
    });
  });
});
