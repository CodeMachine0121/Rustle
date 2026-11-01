import { undo } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import type { CursorPlacement } from "../autosave/AutosaveSession";
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

  describe("table rows", () => {
    function renderTable(body: string) {
      const onBodyChange = vi.fn();
      const view = render(
        <CompositionProvider state={new CompositionState()}>
          <MarkdownEditor documentKey="Blog/table.md" body={body} onBodyChange={onBodyChange} />
        </CompositionProvider>,
      );
      const content = view.container.querySelector(".cm-content");
      const editor = content instanceof HTMLElement ? EditorView.findFromDOM(content) : null;
      if (!(content instanceof HTMLElement) || editor === null) {
        throw new Error("the editor did not render its content area");
      }
      editor.dispatch({ selection: { anchor: editor.state.doc.length } });
      const type = (text: string) => {
        editor.dispatch({ ...editor.state.replaceSelection(text), userEvent: "input.type" });
      };
      const moveToNextCell = () => {
        editor.dispatch({ selection: { anchor: editor.state.selection.main.head + " | ".length } });
      };
      const moveToLineEnd = () => {
        editor.dispatch({ selection: { anchor: editor.state.doc.lineAt(editor.state.selection.main.head).to } });
      };
      return { content, onBodyChange, type, moveToNextCell, moveToLineEnd };
    }

    it("adds the next row of a table on Enter and saves it as plain markdown", () => {
      const { content, onBodyChange } = renderTable("| 甲 | 乙 |\n| --- | --- |");

      fireEvent.keyDown(content, { key: "Enter" });

      expect(onBodyChange).toHaveBeenLastCalledWith("| 甲 | 乙 |\n| --- | --- |\n|  |  |");
    });

    it("keeps the quote marker on the next row of a table inside a quote", () => {
      const { content, onBodyChange } = renderTable("> | 甲 | 乙 |");

      fireEvent.keyDown(content, { key: "Enter" });

      expect(onBodyChange).toHaveBeenLastCalledWith("> | 甲 | 乙 |\n> |  |  |");
    });

    it("lets two rows be added and filled, then leaves the table on an empty row", () => {
      const { content, onBodyChange, type, moveToNextCell, moveToLineEnd } = renderTable("| 甲 | 乙 |\n| --- | --- |");

      fireEvent.keyDown(content, { key: "Enter" });
      type("丙");
      moveToNextCell();
      type("丁");
      moveToLineEnd();
      fireEvent.keyDown(content, { key: "Enter" });
      type("戊");
      moveToNextCell();
      type("己");
      moveToLineEnd();
      fireEvent.keyDown(content, { key: "Enter" });
      fireEvent.keyDown(content, { key: "Enter" });

      expect(onBodyChange).toHaveBeenLastCalledWith("| 甲 | 乙 |\n| --- | --- |\n| 丙 | 丁 |\n| 戊 | 己 |\n");
    });

    it("keeps Enter at the end of plain text a new line", () => {
      const { content, onBodyChange } = renderTable("最近在選桌面框架");

      fireEvent.keyDown(content, { key: "Enter" });

      expect(onBodyChange).toHaveBeenLastCalledWith("最近在選桌面框架\n");
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

  describe("putting the cursor on a line", () => {
    const BODY = ["第一行", "第二行", "第三行", "第四行", "第五行", "第六行", "今天加班", "第八行"].join("\n");

    function renderPlacingEditor(state = new CompositionState()) {
      const view = render(
        <>
          <button type="button">elsewhere</button>
          <CompositionProvider state={state}>
            <MarkdownEditor documentKey="Blog/old.md" body="舊文章" />
          </CompositionProvider>
        </>,
      );
      const content = view.container.querySelector(".cm-content");
      if (!(content instanceof HTMLElement)) {
        throw new Error("the editor did not render its content area");
      }
      const elsewhere = view.getByRole("button", { name: "elsewhere" });
      const show = (documentKey: string, body: string, cursorPlacement: CursorPlacement | null) =>
        view.rerender(
          <>
            <button type="button">elsewhere</button>
            <CompositionProvider state={state}>
              <MarkdownEditor documentKey={documentKey} body={body} cursorPlacement={cursorPlacement} />
            </CompositionProvider>
          </>,
        );
      return { content, elsewhere, show };
    }

    function cursorLine(content: HTMLElement): number | undefined {
      const editor = EditorView.findFromDOM(content);
      return editor?.state.doc.lineAt(editor.state.selection.main.head).number;
    }

    it("opens a document with the cursor on the asked line and the keyboard in the editor", () => {
      const { content, elsewhere, show } = renderPlacingEditor();
      elsewhere.focus();

      show("Blog/tired.md", BODY, { line: 7, sequence: 1 });

      expect(cursorLine(content)).toBe(7);
      expect(EditorView.findFromDOM(content)?.state.selection.main.head).toBe(BODY.indexOf("今天加班"));
      expect(content).toHaveFocus();
    });

    it("moves the cursor in the shown document when asked again", () => {
      const { content, elsewhere, show } = renderPlacingEditor();
      show("Blog/tired.md", BODY, { line: 3, sequence: 1 });
      elsewhere.focus();

      show("Blog/tired.md", BODY, { line: 7, sequence: 2 });

      expect(cursorLine(content)).toBe(7);
    });

    it("puts the cursor on the last line when the line is past the end", () => {
      const { content, show } = renderPlacingEditor();

      show("Blog/tired.md", BODY, { line: 40, sequence: 1 });

      expect(cursorLine(content)).toBe(8);
    });

    it("does not move the cursor again for a request it already followed", () => {
      const { content, elsewhere, show } = renderPlacingEditor();
      show("Blog/tired.md", BODY, { line: 7, sequence: 1 });
      elsewhere.focus();
      EditorView.findFromDOM(content)?.dispatch({ selection: { anchor: 0 } });

      show("Blog/tired.md", BODY, { line: 7, sequence: 1 });

      expect(cursorLine(content)).toBe(1);
    });

    it("puts the cursor on the line once a composition holding the document ends", () => {
      const state = new CompositionState();
      const { content, show } = renderPlacingEditor(state);
      fireEvent.compositionStart(content);

      show("Blog/tired.md", BODY, { line: 7, sequence: 1 });
      fireEvent.compositionEnd(content);

      expect(cursorLine(content)).toBe(7);
    });
  });
});

describe("MarkdownEditor marks and emphasis", () => {
  const isMac = /Mac/.test(navigator.platform);

  function editorOn(body: string, selection: EditorSelection) {
    const { content } = renderEditor(new CompositionState(), body);
    const editor = EditorView.findFromDOM(content);
    if (editor === null) {
      throw new Error("the editor did not render");
    }
    editor.dispatch({ selection });
    return { content, editor };
  }

  function pressShortcut(content: HTMLElement, key: string) {
    fireEvent.keyDown(content, { key, metaKey: isMac, ctrlKey: !isMac });
  }

  it("makes the selected words bold with the bold shortcut", () => {
    const { content, editor } = editorOn("這是重點的地方", EditorSelection.single(2, 4));

    pressShortcut(content, "b");

    expect(editor.state.doc.toString()).toBe("這是**重點**的地方");
  });

  it("makes the word in a link italic instead of selecting the link", () => {
    const { content, editor } = editorOn("看[連結](https://example.com)這裡", EditorSelection.single(3));

    pressShortcut(content, "i");

    expect(editor.state.doc.toString()).toBe("看[*連結*](https://example.com)這裡");
    expect(editor.state.selection.main.empty).toBe(true);
  });

  it("draws the cursor-line background only while nothing is selected", () => {
    const { content, editor } = editorOn("第一行\n第二行", EditorSelection.single(5));

    expect(content.querySelectorAll(".cm-cursorLine")).toHaveLength(1);

    editor.dispatch({ selection: EditorSelection.single(4, 6) });

    expect(content.querySelectorAll(".cm-cursorLine")).toHaveLength(0);
  });

  it("still indents with Tab", () => {
    const { content, editor } = editorOn("正文", EditorSelection.single(0));

    fireEvent.keyDown(content, { key: "Tab" });

    expect(editor.state.doc.toString()).toBe("  正文");
  });

  it("grows the selection from the word to the link with the extend selection key", () => {
    const { content, editor } = editorOn("看[今天的天氣](https://example.com)這裡", EditorSelection.single(4));

    pressShortcut(content, "w");
    const word = editor.state.sliceDoc(editor.state.selection.main.from, editor.state.selection.main.to);
    pressShortcut(content, "w");
    const link = editor.state.sliceDoc(editor.state.selection.main.from, editor.state.selection.main.to);

    expect([word, link]).toEqual(["今天的天氣", "[今天的天氣](https://example.com)"]);
    expect(editor.state.doc.toString()).toBe("看[今天的天氣](https://example.com)這裡");
  });

  it("selects nothing with the italic shortcut while composing", () => {
    const { content, editor } = editorOn("看[連結](https://example.com)這裡", EditorSelection.single(3));
    fireEvent.compositionStart(content);

    pressShortcut(content, "i");

    expect(editor.state.doc.toString()).toBe("看[連結](https://example.com)這裡");
    expect(editor.state.selection.main.empty).toBe(true);
  });
});
