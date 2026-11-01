import { history, undo } from "@codemirror/commands";
import { EditorSelection, EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArticleBody } from "../../ipc/articleBody";
import type { ChannelResult } from "../../ipc/channelResult";
import type { SavedClipboardImages } from "../../ipc/savedClipboardImages";
import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "../autosave/AutosaveSession";
import { ImagePaste } from "./ImagePaste";

type Answer = ChannelResult<SavedClipboardImages>;

function articleBody(workspace: string): ArticleBody {
  return { workspace, fileName: "a.md", body: "", lastKnownModifiedAt: "2026-08-20T08:00:00.000Z" };
}

function saved(...relativePaths: string[]): Answer {
  return { ok: true, payload: { images: relativePaths.map((relativePath) => ({ relativePath })) } };
}

const DISK_FULL: Answer = {
  ok: false,
  reason: "unexpected",
  message: "could not write 'Blog/images/x.png': No space left on device",
};

describe("ImagePaste", () => {
  let composition: CompositionState;
  let editor: AutosaveSession;
  let answers: ((answer: Answer) => void)[];
  let saveClipboardImage: ReturnType<typeof vi.fn<(workspace: string) => Promise<Answer>>>;
  let imagePaste: ImagePaste;
  let view: EditorView;

  function editorWith(doc: string): EditorView {
    return new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc,
        selection: EditorSelection.cursor(doc.length),
        extensions: [history(), imagePaste.extension()],
      }),
    });
  }

  function paste(types: string[], text = ""): void {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        items: types.map((type) => ({ kind: type.startsWith("text/") ? "string" : "file", type })),
        files: [],
        getData: (format: string) => (format === "text/plain" ? text : ""),
      },
    });
    view.contentDOM.dispatchEvent(event);
  }

  function type(text: string): void {
    const { head } = view.state.selection.main;
    view.dispatch({
      changes: { from: head, insert: text },
      selection: { anchor: head + text.length },
      annotations: Transaction.userEvent.of("input.type"),
    });
  }

  async function answer(result: Answer): Promise<void> {
    answers.shift()?.(result);
    await vi.waitFor(() => expect(answers).toHaveLength(0));
    await Promise.resolve();
    await Promise.resolve();
  }

  function cursor(): number {
    return view.state.selection.main.head;
  }

  beforeEach(async () => {
    composition = new CompositionState();
    editor = new AutosaveSession(composition, {
      saveBody: () => Promise.reject(new Error("not saving in this test")),
      readBody: () => Promise.reject(new Error("not reading in this test")),
    });
    answers = [];
    saveClipboardImage = vi.fn(
      () =>
        new Promise<Answer>((resolve) => {
          answers.push(resolve);
        }),
    );
    imagePaste = new ImagePaste(composition, { saveClipboardImage }, editor);
    await editor.openArticle({ article: articleBody("Blog"), title: "A" });
    view = editorWith("");
  });

  afterEach(() => {
    view.destroy();
    imagePaste.dispose();
    editor.dispose();
  });

  describe("a paste with an image", () => {
    it("stores it in the open article's workspace and inserts relative image syntax", async () => {
      paste(["image/png"]);
      await answer(saved("images/8f3c1e42.png"));

      expect(saveClipboardImage).toHaveBeenCalledWith("Blog");
      expect(view.state.doc.toString()).toBe("![](images/8f3c1e42.png)");
    });

    it("leaves the cursor inside the empty alt text so typing describes the image", async () => {
      paste(["image/png"]);
      await answer(saved("images/8f3c.png"));
      type("封面");

      expect(view.state.doc.toString()).toBe("![封面](images/8f3c.png)");
    });

    it("inserts the syntax where the cursor was", async () => {
      view.destroy();
      view = editorWith("在這裡：");

      paste(["image/png"]);
      await answer(saved("images/8f3c.png"));

      expect(view.state.doc.toString()).toBe("在這裡：![](images/8f3c.png)");
    });

    it("replaces the selected text, like any paste", async () => {
      view.destroy();
      view = editorWith("留下選取的字");
      view.dispatch({ selection: { anchor: 2, head: 6 } });

      paste(["image/png"]);
      await answer(saved("images/a.png"));

      expect(view.state.doc.toString()).toBe("留下![](images/a.png)");
    });

    it("inserts one line per image in clipboard order, cursor in the last one", async () => {
      paste(["image/png", "image/gif"]);
      await answer(saved("images/a.png", "images/b.gif"));

      expect(view.state.doc.toString()).toBe("![](images/a.png)\n![](images/b.gif)");
      expect(cursor()).toBe("![](images/a.png)\n![".length);
    });

    it("takes the image over the text that came with it", async () => {
      paste(["text/plain", "image/png"], "網頁上的一段字");
      await answer(saved("images/8f3c.png"));

      expect(view.state.doc.toString()).toBe("![](images/8f3c.png)");
    });

    it.each([
      "image/jpeg",
      "image/gif",
      "image/bmp",
      "image/tiff",
      "image/webp",
      "image/svg+xml",
    ])("takes a %s file", (imageType) => {
      paste([imageType]);

      expect(saveClipboardImage).toHaveBeenCalledOnce();
    });

    it("recognises an image offered only as a file", () => {
      const event = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", {
        value: { items: [], files: [{ type: "image/png" }], getData: () => "" },
      });
      view.contentDOM.dispatchEvent(event);

      expect(saveClipboardImage).toHaveBeenCalledOnce();
    });

    it("inserts the paste-time text when the clipboard turned out to hold no image", async () => {
      paste(["text/plain", "image/png"], "換掉之後的字");
      await answer(saved());

      expect(view.state.doc.toString()).toBe("換掉之後的字");
      expect(cursor()).toBe("換掉之後的字".length);
    });

    it("inserts nothing when the clipboard turned out to hold neither image nor text", async () => {
      paste(["image/png"]);
      await answer(saved());

      expect(view.state.doc.toString()).toBe("");
    });
  });

  describe("undo", () => {
    it("removes the whole insertion in one step", async () => {
      paste(["image/png", "image/png"]);
      await answer(saved("images/a.png", "images/b.png"));

      undo(view);

      expect(view.state.doc.toString()).toBe("");
    });

    it("does not take the typing just before the paste with it", async () => {
      type("先寫一句");
      paste(["image/png"]);
      await answer(saved("images/a.png"));

      undo(view);

      expect(view.state.doc.toString()).toBe("先寫一句");
    });

    it("keeps typing right after the paste as its own step", async () => {
      paste(["image/png"]);
      await answer(saved("images/a.png"));
      type("封面");

      undo(view);

      expect(view.state.doc.toString()).toBe("![](images/a.png)");
    });

    it("asks the backend for nothing, so no file is deleted", async () => {
      paste(["image/png"]);
      await answer(saved("images/a.png"));

      undo(view);

      expect(saveClipboardImage).toHaveBeenCalledOnce();
    });
  });

  describe("pastes that are not image pastes", () => {
    it("leaves a text-only paste to the editor", () => {
      paste(["text/plain"], "一般的字");

      expect(saveClipboardImage).not.toHaveBeenCalled();
      expect(view.state.doc.toString()).toBe("一般的字");
    });

    it("leaves a file type it does not recognise to the editor", () => {
      paste(["image/heic"], "IMG_0001.heic");

      expect(saveClipboardImage).not.toHaveBeenCalled();
      expect(view.state.doc.toString()).toBe("IMG_0001.heic");
    });

    it("does nothing with an image while composing", () => {
      composition.start();

      paste(["image/png"]);

      expect(saveClipboardImage).not.toHaveBeenCalled();
      expect(view.state.doc.toString()).toBe("");
    });

    it("does nothing with an image while no article is open", async () => {
      await editor.closeArticle();

      paste(["image/png"]);

      expect(saveClipboardImage).not.toHaveBeenCalled();
    });

    it("does nothing with an event that carries no clipboard", () => {
      view.contentDOM.dispatchEvent(new Event("paste", { bubbles: true, cancelable: true }));

      expect(saveClipboardImage).not.toHaveBeenCalled();
    });
  });

  describe("while saving", () => {
    it("says it is saving until the answer comes", async () => {
      expect(imagePaste.status).toEqual({ kind: "idle" });

      paste(["image/png"]);
      expect(imagePaste.status).toEqual({ kind: "saving" });

      await answer(saved("images/a.png"));
      expect(imagePaste.status).toEqual({ kind: "idle" });
    });

    it("keeps saying so while a second paste is still saving", async () => {
      paste(["image/png"]);
      paste(["image/png"]);

      answers.shift()?.(saved("images/a.png"));
      await Promise.resolve();
      await Promise.resolve();

      expect(imagePaste.status).toEqual({ kind: "saving" });
      await answer(saved("images/b.png"));
      expect(imagePaste.status).toEqual({ kind: "idle" });
    });

    it("lets typing through and still inserts where the paste happened", async () => {
      view.destroy();
      view = editorWith("前");

      paste(["image/png"]);
      type("後");
      await answer(saved("images/a.png"));

      expect(view.state.doc.toString()).toBe("前![](images/a.png)後");
    });

    it("follows the paste position when text is added before it meanwhile", async () => {
      view.destroy();
      view = editorWith("前");

      paste(["image/png"]);
      view.dispatch({ changes: { from: 0, insert: "最" } });
      await answer(saved("images/a.png"));

      expect(view.state.doc.toString()).toBe("最前![](images/a.png)");
    });

    it("waits for a composition to end before inserting", async () => {
      paste(["image/png"]);
      composition.start();
      await answer(saved("images/a.png"));

      expect(view.state.doc.toString()).toBe("");

      composition.end();
      expect(view.state.doc.toString()).toBe("![](images/a.png)");
    });

    it("drops the answer when another article replaced the document meanwhile", async () => {
      paste(["image/png"]);
      view.setState(EditorState.create({ doc: "另一篇", extensions: [imagePaste.extension()] }));
      await answer(saved("images/a.png"));

      expect(view.state.doc.toString()).toBe("另一篇");
    });

    it("notifies listeners only when the status changes", async () => {
      const listener = vi.fn();
      imagePaste.subscribe(listener);

      paste(["image/png"]);
      paste(["image/png"]);
      expect(listener).toHaveBeenCalledOnce();

      answers.forEach((resolve) => resolve(saved("images/a.png")));
      await vi.waitFor(() => expect(imagePaste.status).toEqual({ kind: "idle" }));
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe("a failed save", () => {
    it("inserts nothing, not even the text, and says why", async () => {
      paste(["text/plain", "image/png"], "網頁上的一段字");
      await answer(DISK_FULL);

      expect(view.state.doc.toString()).toBe("");
      expect(imagePaste.status).toEqual({ kind: "failed", message: DISK_FULL.message });
    });

    it("keeps the editor usable", async () => {
      paste(["image/png"]);
      await answer(DISK_FULL);

      type("繼續寫");

      expect(view.state.doc.toString()).toBe("繼續寫");
    });

    it("is forgotten after the next paste succeeds", async () => {
      paste(["image/png"]);
      await answer(DISK_FULL);

      paste(["image/png"]);
      await answer(saved("images/a.png"));

      expect(imagePaste.status).toEqual({ kind: "idle" });
    });

    it("is forgotten when another workspace's article is opened", async () => {
      paste(["image/png"]);
      await answer(DISK_FULL);

      await editor.openArticle({ article: articleBody("Work"), title: "B" });

      expect(imagePaste.status).toEqual({ kind: "idle" });
    });

    it("is kept when another article of the same workspace is opened", async () => {
      paste(["image/png"]);
      await answer(DISK_FULL);

      await editor.openArticle({ article: { ...articleBody("Blog"), fileName: "b.md" }, title: "B" });

      expect(imagePaste.status.kind).toBe("failed");
    });
  });
});
