import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { SavedClipboardImages } from "../../ipc/savedClipboardImages";
import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "../autosave/AutosaveSession";
import { ImagePaste } from "./ImagePaste";
import { ImagePasteStatusLine } from "./ImagePasteStatusLine";

type Answer = ChannelResult<SavedClipboardImages>;

async function pastingWith(answer: Promise<Answer>) {
  const composition = new CompositionState();
  const editor = new AutosaveSession(composition, {
    saveBody: () => Promise.reject(new Error("not saving in this test")),
    readBody: () => Promise.reject(new Error("not reading in this test")),
  });
  await editor.openArticle({
    article: { workspace: "Blog", fileName: "a.md", body: "", lastKnownModifiedAt: "2026-08-20T08:00:00.000Z" },
    title: "A",
  });
  const imagePaste = new ImagePaste(composition, { saveClipboardImage: () => answer }, editor);
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({ extensions: [imagePaste.extension()] }),
  });
  render(<ImagePasteStatusLine imagePaste={imagePaste} />);
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { items: [{ kind: "file", type: "image/png" }], files: [], getData: () => "" },
  });
  act(() => {
    view.contentDOM.dispatchEvent(event);
  });
}

describe("ImagePasteStatusLine", () => {
  it("shows nothing while no image is being saved", () => {
    const imagePaste = new ImagePaste(
      new CompositionState(),
      { saveClipboardImage: () => new Promise(() => undefined) },
      { workspace: null, subscribe: () => () => undefined },
    );
    const { container } = render(<ImagePasteStatusLine imagePaste={imagePaste} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("says an image is being saved, then goes away once it is", async () => {
    let finish: (answer: Answer) => void = () => undefined;
    await pastingWith(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("正在存圖片…");

    await act(async () => {
      finish({ ok: true, payload: { images: [{ relativePath: "images/a.png" }] } });
      await Promise.resolve();
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says why an image could not be saved, without a dialog", async () => {
    await pastingWith(
      Promise.resolve({ ok: false, reason: "unexpected", message: "No space left on device" }),
    );
    await act(() => Promise.resolve());

    expect(screen.getByRole("alert")).toHaveTextContent("圖片沒有存進去：No space left on device");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
