import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { MarkdownEditor } from "./MarkdownEditor";

function renderEditor(state = new CompositionState(), body = "# Zen of writing") {
  const view = render(
    <CompositionProvider state={state}>
      <MarkdownEditor initialBody={body} />
    </CompositionProvider>,
  );
  const content = view.container.querySelector(".cm-content");
  if (!(content instanceof HTMLElement)) {
    throw new Error("the editor did not render its content area");
  }
  return { content, state };
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

  it("refuses to mount without a shared composition state", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<MarkdownEditor initialBody="# Zen" />)).toThrow(/CompositionProvider/);
  });
});
