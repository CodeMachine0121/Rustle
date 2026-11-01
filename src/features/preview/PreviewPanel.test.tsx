// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "../autosave/AutosaveSession";
import { PreviewedBody } from "./PreviewedBody";
import { PreviewPanel } from "./PreviewPanel";

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
});
