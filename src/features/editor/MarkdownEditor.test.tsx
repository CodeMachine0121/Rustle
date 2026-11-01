import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import type { IndentationSettings } from "./IndentUnit";
import { MarkdownEditor } from "./MarkdownEditor";

function renderEditor(
  state = new CompositionState(),
  body = "# Zen of writing",
  indentation?: IndentationSettings,
) {
  const view = render(
    <CompositionProvider state={state}>
      <MarkdownEditor body={body} indentation={indentation} />
    </CompositionProvider>,
  );
  const content = view.container.querySelector(".cm-content");
  if (!(content instanceof HTMLElement)) {
    throw new Error("the editor did not render its content area");
  }
  return { content, state, view };
}

describe("MarkdownEditor", () => {
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
          <MarkdownEditor body={body} />
        </CompositionProvider>,
      );

      expect(view.container.querySelector(".cm-content")).toBe(content);
      expect(content.textContent).toBe(body);
    }
  });

  it("does not replace the document when the same body is given again", () => {
    const state = new CompositionState();
    const { content, view } = renderEditor(state, "字");
    fireEvent.keyDown(content, { key: "Tab" });

    view.rerender(
      <CompositionProvider state={state}>
        <MarkdownEditor body="字" indentation={{ style: "spaces", width: 2 }} />
      </CompositionProvider>,
    );

    expect(content.textContent).toBe("  字");
  });

  it("shows the next article with its own indentation", () => {
    const state = new CompositionState();
    const { content, view } = renderEditor(state, "第一篇", { style: "spaces", width: 2 });

    view.rerender(
      <CompositionProvider state={state}>
        <MarkdownEditor body="第二篇" indentation={{ style: "tab", width: 4 }} />
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
        <MarkdownEditor body="第二篇" />
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
          <MarkdownEditor body={body} />
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

    expect(() => render(<MarkdownEditor body="# Zen" />)).toThrow(/CompositionProvider/);
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
});
