import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Vim } from "@replit/codemirror-vim";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { ClipboardText } from "../../ipc/clipboardText";
import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { InterfaceLanguageProvider } from "../interfaceLanguage/InterfaceLanguageContext";
import { SystemClipboardRegister } from "./SystemClipboardRegister";

const UNREADABLE: ChannelResult<ClipboardText> = { ok: false, reason: "unexpected", message: "locked" };

/** A system clipboard that another app can copy into, behind the editor's back. */
function systemClipboard(initial: string | null = null) {
  let text = initial;
  let failsToRead = false;
  const backend = {
    readClipboardText: vi.fn(
      async (): Promise<ChannelResult<ClipboardText>> =>
        failsToRead ? UNREADABLE : { ok: true, payload: { text } },
    ),
    writeClipboardText: vi.fn(async (written: string): Promise<ChannelResult<null>> => {
      text = written;
      return { ok: true, payload: null };
    }),
  };
  return {
    backend,
    text: () => text,
    copyElsewhere: (copied: string | null) => {
      text = copied;
    },
    failToRead: () => {
      failsToRead = true;
    },
  };
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve));
  });
}

async function openEditor(body: string, clipboard = systemClipboard(), { vimEnabled = true } = {}) {
  const register = new SystemClipboardRegister(clipboard.backend);
  const composition = new CompositionState();
  const element = (enabled: boolean) => (
    <InterfaceLanguageProvider language="en">
      <CompositionProvider state={composition}>
        <MarkdownEditor documentKey="Blog/a.md" body={body} vimEnabled={enabled} vimRegister={register} />
      </CompositionProvider>
    </InterfaceLanguageProvider>
  );
  const rendered = render(element(vimEnabled));
  const content = rendered.container.querySelector(".cm-content");
  const editor = content instanceof HTMLElement ? EditorView.findFromDOM(content) : null;
  if (!(content instanceof HTMLElement) || editor === null) {
    throw new Error("the editor did not render");
  }
  await settle();
  const type = (keys: string) => {
    for (const key of keys) {
      act(() => {
        content.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      });
    }
  };
  return {
    editor,
    register,
    type,
    press: (key: string, init: KeyboardEventInit = {}) =>
      act(() => {
        content.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
      }),
    text: () => editor.state.doc.toString(),
    cursorAt: (position: number) =>
      act(() => editor.dispatch({ selection: EditorSelection.cursor(position) })),
    select: (anchor: number, head: number) =>
      act(() => editor.dispatch({ selection: EditorSelection.single(anchor, head), userEvent: "select.pointer" })),
    typeText: (text: string) => act(() => editor.dispatch(editor.state.replaceSelection(text), { userEvent: "input.type" })),
    switchVim: async (enabled: boolean) => {
      rendered.rerender(element(enabled));
      await settle();
    },
    comeBackToTheWindow: async () => {
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });
      await settle();
    },
  };
}

describe("text Vim takes goes out to the system clipboard", () => {
  it("a yanked selection is on the clipboard", async () => {
    const clipboard = systemClipboard();
    const { select, type } = await openEditor("買進台積電", clipboard);

    select(2, 5);
    type("y");

    expect(clipboard.text()).toBe("台積電");
  });

  it("a yanked line takes its line break with it", async () => {
    const clipboard = systemClipboard();
    const { type } = await openEditor("今日盤後觀察\n第二行", clipboard);

    type("yy");

    expect(clipboard.text()).toBe("今日盤後觀察\n");
  });

  it("a deleted line is cut onto the clipboard", async () => {
    const clipboard = systemClipboard();
    const { type, text } = await openEditor("今日盤後觀察\n第二行", clipboard);

    type("dd");

    expect(clipboard.text()).toBe("今日盤後觀察\n");
    expect(text()).toBe("第二行");
  });

  it("a deleted character is cut onto the clipboard", async () => {
    const clipboard = systemClipboard();
    const { type, cursorAt } = await openEditor("台積電", clipboard);

    cursorAt(2);
    type("x");

    expect(clipboard.text()).toBe("電");
  });

  it("the text a change replaces is on the clipboard", async () => {
    const clipboard = systemClipboard();
    const { select, type, typeText, text } = await openEditor("買進聯電", clipboard);

    select(2, 4);
    type("c");
    typeText("台積電");

    expect(clipboard.text()).toBe("聯電");
    expect(text()).toBe("買進台積電");
  });

  it("a yank into a named register is on the clipboard too, and in the named register", async () => {
    const clipboard = systemClipboard();
    const { select, type } = await openEditor("買進聯電", clipboard);

    select(2, 4);
    type('"ay');

    expect(clipboard.text()).toBe("聯電");
    expect(Vim.getRegisterController().getRegister("a").toString()).toBe("聯電");
  });

  it("deleting into the black hole register leaves the clipboard as it was", async () => {
    const clipboard = systemClipboard("https://example.com/報告");
    const { type, text } = await openEditor("今日盤後觀察\n第二行", clipboard);

    type('"_dd');

    expect(clipboard.text()).toBe("https://example.com/報告");
    expect(clipboard.backend.writeClipboardText).not.toHaveBeenCalled();
    expect(text()).toBe("第二行");
  });

  it("Vim emptying its own register leaves the clipboard as it was", async () => {
    const clipboard = systemClipboard("昨天複製的東西");
    const { register } = await openEditor("文章", clipboard);

    register.clear();
    register.setText("");

    expect(register.toString()).toBe("");
    expect(register.keyBuffer).toEqual([""]);
    expect(clipboard.text()).toBe("昨天複製的東西");
    expect(clipboard.backend.writeClipboardText).not.toHaveBeenCalled();
  });

  it("keys a macro appends to the register go out too", async () => {
    const clipboard = systemClipboard();
    const { register } = await openEditor("文章", clipboard);

    register.clear();
    register.pushText("l");
    register.pushText("l");

    expect(clipboard.text()).toBe("ll");
  });

  it("an edit still happens when the clipboard refuses the text", async () => {
    const clipboard = systemClipboard();
    clipboard.backend.writeClipboardText.mockResolvedValue({ ok: false, reason: "unexpected", message: "denied" });
    const { type, text, cursorAt } = await openEditor("今日盤後觀察\n第二行", clipboard);

    type("dd");
    cursorAt(0);
    type("p");

    expect(text()).toBe("第二行\n今日盤後觀察");
  });
});

describe("text copied elsewhere comes in with Vim's paste", () => {
  it("pastes what another app copied", async () => {
    const { type, text } = await openEditor("文章", systemClipboard("營收成長"));

    type("p");

    expect(text()).toBe("文營收成長章");
  });

  it("the last copy wins, even over the writer's own yank", async () => {
    const clipboard = systemClipboard();
    const { select, type, text, cursorAt, comeBackToTheWindow } = await openEditor("台積電", clipboard);
    select(0, 3);
    type("y");

    clipboard.copyElsewhere("營收成長");
    await comeBackToTheWindow();
    cursorAt(2);
    type("p");

    expect(text()).toBe("台積電營收成長");
  });

  it("a copy made outside Vim is pasted by Vim", async () => {
    const clipboard = systemClipboard("舊的");
    const { type, text } = await openEditor("文章", clipboard);

    clipboard.copyElsewhere("營收成長");
    act(() => {
      document.dispatchEvent(new Event("copy"));
    });
    await settle();
    type("p");

    expect(text()).toBe("文營收成長章");
  });

  it("a named register pastes its own text, not the clipboard", async () => {
    const clipboard = systemClipboard();
    const { select, type, text, cursorAt, comeBackToTheWindow } = await openEditor("聯電", clipboard);
    select(0, 2);
    type('"ay');

    clipboard.copyElsewhere("營收成長");
    await comeBackToTheWindow();
    cursorAt(1);
    type('"ap');

    expect(text()).toBe("聯電聯電");
  });

  it("text ending with a line break comes in as a whole line below", async () => {
    const { type, text, cursorAt } = await openEditor("第一行文字\n第二行", systemClipboard("今日盤後觀察\n"));

    cursorAt(2);
    type("p");

    expect(text()).toBe("第一行文字\n今日盤後觀察\n第二行");
  });

  it("text without a line break comes in inside the line", async () => {
    const { type, text, cursorAt } = await openEditor("第一行文字\n第二行", systemClipboard("營收成長"));

    cursorAt(2);
    type("p");

    expect(text()).toBe("第一行營收成長文字\n第二行");
  });

  it.each([
    ["the clipboard is empty", null],
    ["the clipboard holds only a picture", null],
    ["the clipboard holds an empty text", ""],
  ])("pastes nothing when %s", async (_situation, held) => {
    const { type, text } = await openEditor("文章", systemClipboard(held));

    type("p");

    expect(text()).toBe("文章");
  });

  it("pastes nothing once another app replaced the writer's yank with a picture", async () => {
    const clipboard = systemClipboard();
    const { select, type, text, comeBackToTheWindow } = await openEditor("台積電", clipboard);
    select(0, 3);
    type("y");

    clipboard.copyElsewhere(null);
    await comeBackToTheWindow();
    type("p");

    expect(text()).toBe("台積電");
  });

  it("pastes nothing when the clipboard cannot be read", async () => {
    const clipboard = systemClipboard("營收成長");
    clipboard.failToRead();
    const { type, text } = await openEditor("文章", clipboard);

    type("p");

    expect(text()).toBe("文章");
  });

  it("a block cut here comes back as a block, even after the clipboard was looked at again", async () => {
    const { type, press, text, cursorAt, comeBackToTheWindow } = await openEditor("ab\ncd", systemClipboard());

    press("v", { ctrlKey: true });
    type("jd");
    await comeBackToTheWindow();
    cursorAt(1);
    type("p");

    expect(text()).toBe("ba\ndc");
  });

  it("several lines from elsewhere come in as ordinary text, not a block", async () => {
    const { type, text } = await openEditor("ab", systemClipboard("x\ny"));

    type("p");

    expect(text()).toBe("ax\nyb");
  });

  it("text from elsewhere that matches no yank of the writer's is never a block", async () => {
    const clipboard = systemClipboard();
    const { register, comeBackToTheWindow } = await openEditor("ab\ncd", clipboard);
    register.setText("a\nc", false, true);

    clipboard.copyElsewhere("x\ny");
    await comeBackToTheWindow();

    expect(register.blockwise).toBe(false);
    expect(register.linewise).toBe(false);
  });

  it("the writer's own yank pastes back at once, even over a slower look at the clipboard", async () => {
    const clipboard = systemClipboard("舊的");
    const { select, type, text, cursorAt, comeBackToTheWindow, editor } = await openEditor("台積電", clipboard);
    const lateAnswers: Array<() => void> = [];
    clipboard.backend.readClipboardText.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          lateAnswers.push(() => resolve({ ok: true, payload: { text: "舊的" } }));
        }),
    );
    await comeBackToTheWindow();

    select(0, 3);
    type("y");
    lateAnswers.forEach((answer) => answer());
    await settle();
    cursorAt(editor.state.doc.length);
    type("p");

    expect(text()).toBe("台積電台積電");
  });
});

describe("the clipboard is shared only while Vim is on", () => {
  it("deleting a selection with Vim off leaves the clipboard as it was", async () => {
    const clipboard = systemClipboard("昨天複製的東西");
    const { press, select, text } = await openEditor("買進台積電", clipboard, { vimEnabled: false });

    select(2, 5);
    press("Backspace");

    expect(text()).toBe("買進");
    expect(clipboard.text()).toBe("昨天複製的東西");
    expect(clipboard.backend.writeClipboardText).not.toHaveBeenCalled();
  });

  it("with Vim off nothing looks at the clipboard", async () => {
    const clipboard = systemClipboard("營收成長");
    const { comeBackToTheWindow } = await openEditor("文章", clipboard, { vimEnabled: false });

    await comeBackToTheWindow();
    act(() => {
      document.dispatchEvent(new Event("copy"));
    });
    await settle();

    expect(clipboard.backend.readClipboardText).not.toHaveBeenCalled();
  });

  it("turning Vim off on the spot stops sharing on the spot", async () => {
    const clipboard = systemClipboard("昨天複製的東西");
    const { press, select, switchVim, comeBackToTheWindow } = await openEditor("買進台積電", clipboard);
    const readsWhileOn = clipboard.backend.readClipboardText.mock.calls.length;

    await switchVim(false);
    select(2, 5);
    press("Backspace");
    await comeBackToTheWindow();

    expect(clipboard.text()).toBe("昨天複製的東西");
    expect(clipboard.backend.readClipboardText).toHaveBeenCalledTimes(readsWhileOn);
  });

  it("turning Vim on on the spot shares at once", async () => {
    const clipboard = systemClipboard();
    const { select, type, switchVim } = await openEditor("買進台積電", clipboard, { vimEnabled: false });

    await switchVim(true);
    select(2, 5);
    type("y");

    expect(clipboard.text()).toBe("台積電");
  });
});
