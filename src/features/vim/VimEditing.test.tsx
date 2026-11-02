import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { InterfaceLanguageProvider } from "../interfaceLanguage/InterfaceLanguageContext";
import type { VimMode } from "./VimModeSession";
import type { VimNormalCommand } from "./VimNormalCommand";

const isMac = /Mac/.test(navigator.platform);
const MOD = isMac ? { metaKey: true } : { ctrlKey: true };

function openEditor(
  body: string,
  {
    vimEnabled = true,
    documentKey = "Blog/a.md",
    normalCommands = [] as readonly VimNormalCommand[],
  } = {},
) {
  const composition = new CompositionState();
  const modes: VimMode[] = [];
  const element = (enabled: boolean, key: string, text: string) => (
    <InterfaceLanguageProvider language="en">
      <CompositionProvider state={composition}>
        <MarkdownEditor
          documentKey={key}
          body={text}
          vimEnabled={enabled}
          vimNormalCommands={normalCommands}
          onVimModeChange={(mode) => modes.push(mode)}
        />
      </CompositionProvider>
    </InterfaceLanguageProvider>
  );
  const rendered = render(element(vimEnabled, documentKey, body));
  const content = rendered.container.querySelector(".cm-content");
  const editor = content instanceof HTMLElement ? EditorView.findFromDOM(content) : null;
  if (!(content instanceof HTMLElement) || editor === null) {
    throw new Error("the editor did not render");
  }
  const press = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
    act(() => {
      content.dispatchEvent(event);
    });
    return event;
  };
  return {
    editor,
    content,
    composition,
    press,
    mode: () => modes.at(-1),
    text: () => editor.state.doc.toString(),
    select: (anchor: number, head?: number, userEvent = "select.pointer") =>
      act(() => editor.dispatch({ selection: EditorSelection.single(anchor, head), userEvent })),
    switchVim: (enabled: boolean) => rendered.rerender(element(enabled, documentKey, body)),
    show: (key: string, text: string) => rendered.rerender(element(true, key, text)),
  };
}

describe("turning Vim on and off", () => {
  it("starts in Normal mode, where a letter is a command, not text", () => {
    const { press, mode, text } = openEditor("字");

    press("x");

    expect(mode()).toBe("normal");
    expect(text()).toBe("");
  });

  it("turns on in place and starts in Normal mode", () => {
    const { switchVim, press, mode, text, select } = openEditor("abc", { vimEnabled: false });
    select(1);

    switchVim(true);
    press("x");

    expect(mode()).toBe("normal");
    expect(text()).toBe("ac");
  });

  it("turns off in place: the editor is back to typing", () => {
    const { switchVim, editor, text } = openEditor("abc");

    switchVim(false);
    act(() => editor.dispatch({ changes: { from: 0, insert: "z" }, selection: { anchor: 1 }, userEvent: "input.type" }));
    const event = new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true });
    act(() => {
      editor.contentDOM.dispatchEvent(event);
    });

    expect(text()).toBe("abc");
  });

  it("keeps the undo history when turned on", () => {
    const { switchVim, editor, press, text } = openEditor("abc", { vimEnabled: false });
    act(() => editor.dispatch({ changes: { from: 3, insert: "d" }, userEvent: "input.type" }));

    switchVim(true);
    press("z", MOD);

    expect(text()).toBe("abc");
  });

  it("starts the next article in Normal mode", () => {
    const { press, mode, show } = openEditor("abc");
    press("i");
    expect(mode()).toBe("insert");

    show("Blog/b.md", "def");

    expect(mode()).toBe("normal");
  });
});

describe("a selection always means Visual", () => {
  it("enters Insert with i and goes back to Normal on Esc", () => {
    const { press, mode } = openEditor("abc");

    press("i");
    expect(mode()).toBe("insert");
    const escape = press("Escape");

    expect(mode()).toBe("normal");
    expect(escape.defaultPrevented).toBe(true);
  });

  it("enters Visual when a selection appears in Normal mode", () => {
    const { select, mode } = openEditor("hello world");

    select(0, 5);

    expect(mode()).toBe("visual");
  });

  it("enters Visual when a selection appears in Insert mode, keeping the selection", () => {
    const { press, select, mode, editor } = openEditor("hello world");
    press("i");

    select(0, 5);

    expect(mode()).toBe("visual");
    expect(editor.state.sliceDoc(editor.state.selection.main.from, editor.state.selection.main.to)).toContain("hell");
  });

  it("stays in Insert while an input method marks the candidate being chosen", () => {
    const { press, select, mode, content } = openEditor("hello world");
    press("i");
    act(() => {
      content.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    });

    select(0, 5, "select");

    expect(mode()).toBe("insert");
  });

  it("keeps the chosen candidate and both its neighbours once the input method commits it", () => {
    const { press, select, mode, content, editor, text } = openEditor("前後");
    select(1);
    press("i");
    act(() => {
      content.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      editor.dispatch({ changes: { from: 1, insert: "ㄗˋ" }, userEvent: "input.type.compose" });
    });
    select(1, 3, "select");

    act(() => {
      editor.dispatch({ changes: { from: 1, to: 3, insert: "字" }, userEvent: "input.type.compose" });
      content.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "字" }));
    });
    select(2, 2, "select");

    expect(mode()).toBe("insert");
    expect(text()).toBe("前字後");
  });

  it("goes back to Normal when the selection disappears", () => {
    const { select, mode } = openEditor("hello world");
    select(0, 5);

    select(8);

    expect(mode()).toBe("normal");
  });

  it("goes back to Normal and drops the selection on Esc in Visual", () => {
    const { select, press, mode, editor } = openEditor("hello world");
    select(0, 5);

    press("Escape");

    expect(mode()).toBe("normal");
    expect(editor.state.selection.main.empty).toBe(true);
  });

  it("moves one end of the selection with an arrow key and stays in Visual", () => {
    const { select, press, mode, editor } = openEditor("hello world");
    select(0, 5);
    const before = editor.state.selection.main.head;

    press("ArrowRight");

    expect(mode()).toBe("visual");
    expect(editor.state.selection.main.head).toBeGreaterThan(before);
  });
});

describe("three modes, whatever Vim calls them", () => {
  it("shows a line selection as Visual", () => {
    const { press, mode } = openEditor("abc");

    press("V", { shiftKey: true });

    expect(mode()).toBe("visual");
  });

  it("shows replacing as Insert", () => {
    const { press, mode } = openEditor("abc");

    press("R", { shiftKey: true });

    expect(mode()).toBe("insert");
  });
});

describe("the app's own keys come before Vim", () => {
  it("selects the word on Mod+W in Normal mode and enters Visual", () => {
    const { select, press, mode, editor } = openEditor("hello world", {});
    select(1);

    press("w", MOD);

    expect(editor.state.sliceDoc(editor.state.selection.main.from, editor.state.selection.main.to)).toBe("hello");
    expect(mode()).toBe("visual");
  });

  it("selects the word on Mod+W in Insert mode and enters Visual", () => {
    const { select, press, mode, editor } = openEditor("hello world");
    select(1);
    press("i");

    press("w", MOD);

    expect(editor.state.sliceDoc(editor.state.selection.main.from, editor.state.selection.main.to)).toBe("hello");
    expect(mode()).toBe("visual");
  });

  it("grows the selection one layer on Mod+W in Visual mode", () => {
    const { select, press, mode, editor } = openEditor("看 [連結](https://example.com) 這裡");
    select(3, 5);

    press("w", MOD);

    const { from, to } = editor.state.selection.main;
    expect(editor.state.sliceDoc(from, to)).toBe("[連結](https://example.com)");
    expect(mode()).toBe("visual");
  });

  it("indents on Tab in Normal mode", () => {
    const { press, text } = openEditor("正文");

    press("Tab");

    expect(text()).toBe("  正文");
  });

  it("adds a table row on Enter in Normal mode when the cursor is on a table row", () => {
    const { select, press, text } = openEditor("| a | b |\n| --- | --- |\n| 1 | 2 |");
    select(text().length);

    press("Enter");

    expect(text()).toBe("| a | b |\n| --- | --- |\n| 1 | 2 |\n|  |  |");
  });

  it("moves to the start of the next line on Enter in Normal mode off a table, changing nothing", () => {
    const { select, press, text, editor } = openEditor("第一行\n第二行");
    select(1);

    press("Enter");

    expect(text()).toBe("第一行\n第二行");
    expect(editor.state.selection.main.head).toBe(4);
  });

  it("makes the word bold with Mod+B in Normal mode", () => {
    const { select, press, text } = openEditor("hello world");
    select(1);

    press("b", MOD);

    expect(text()).toBe("**hello** world");
  });

  it("undoes with Mod+Z in Normal mode", () => {
    const { press, text } = openEditor("abc");
    press("x");

    press("z", MOD);

    expect(text()).toBe("abc");
  });
});

describe("the editor's typing keys step aside outside Insert mode", () => {
  it.each([
    ["delete line", "k", { shiftKey: true, ...MOD }],
    ["move line up", "ArrowUp", { altKey: true }],
    ["move line down", "ArrowDown", { altKey: true }],
    ["toggle comment", "/", MOD],
    ["insert blank line", "Enter", MOD],
    ["indent more", "]", MOD],
    ["delete word backward", "Backspace", isMac ? { altKey: true } : { ctrlKey: true }],
    ["select all, which Vim does not have", "a", MOD],
  ])("leaves the text untouched on %s in Normal mode", (_name, key, init) => {
    const { select, press, text } = openEditor("第一行\n第二行");
    select(5);

    const event = press(key, init);

    expect(text()).toBe("第一行\n第二行");
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves the text untouched on delete line in Visual mode", () => {
    const { select, press, text } = openEditor("第一行\n第二行");
    select(4, 6);

    press("k", { shiftKey: true, ...MOD });

    expect(text()).toBe("第一行\n第二行");
  });

  it("deletes the line on delete line in Insert mode, as without Vim", () => {
    const { select, press, text } = openEditor("第一行\n第二行");
    select(5);
    press("i");

    press("k", { shiftKey: true, ...MOD });

    expect(text()).toBe("第一行");
  });

  it("only moves the cursor left on Backspace in Normal mode", () => {
    const { select, press, text, editor } = openEditor("abcd");
    select(2);

    press("Backspace");

    expect(text()).toBe("abcd");
    expect(editor.state.selection.main.head).toBe(1);
  });

  it("deletes the character under the cursor on Delete in Normal mode", () => {
    const { select, press, text } = openEditor("abcd");
    select(2);

    press("Delete");

    expect(text()).toBe("abd");
  });

  it("deletes the character before the cursor on Backspace in Insert mode", () => {
    const { select, press, text } = openEditor("abcd");
    select(2);
    press("i");

    press("Backspace");

    expect(text()).toBe("acd");
  });
});

describe("Esc, one rung at a time", () => {
  it("closes the snippet menu first and stays in Insert mode", () => {
    const { press, mode, editor } = openEditor("");
    press("i");
    act(() => editor.dispatch({ changes: { from: 0, insert: "/" }, selection: { anchor: 1 }, userEvent: "input.type" }));
    expect(editor.dom.querySelector(".snippet-menu")).not.toBeNull();

    press("Escape");

    expect(editor.dom.querySelector(".snippet-menu")).toBeNull();
    expect(mode()).toBe("insert");
  });

  it("ends the waiting snippet fields first and stays in Insert mode", () => {
    const { press, mode, editor } = openEditor("");
    press("i");
    [..."/link"].forEach((character, index) =>
      act(() =>
        editor.dispatch({ changes: { from: index, insert: character }, selection: { anchor: index + 1 }, userEvent: "input.type" }),
      ),
    );
    press("Enter");
    expect(editor.dom.querySelectorAll(".snippet-field-marker").length).toBeGreaterThan(0);

    press("Escape");

    expect(editor.dom.querySelectorAll(".snippet-field-marker")).toHaveLength(0);
    expect(mode()).toBe("insert");
  });

  it("leaves an Esc in Normal mode to the rest of the app", () => {
    const { press, mode } = openEditor("abc");

    const escape = press("Escape");

    expect(escape.defaultPrevented).toBe(false);
    expect(mode()).toBe("normal");
  });

  it("leaves an Esc while the input method composes to the input method", () => {
    const { press, mode, content } = openEditor("abc");
    press("i");
    fireEvent.compositionStart(content);

    press("Escape", { isComposing: true, keyCode: 229 });

    expect(mode()).toBe("insert");
  });
});

describe("Tab after Esc", () => {
  it("indents after an Esc in Normal mode and keeps the keyboard in the editor", () => {
    const { press, mode, text } = openEditor("正文");

    press("Escape");
    const tab = press("Tab");

    expect(text()).toBe("  正文");
    expect(tab.defaultPrevented).toBe(true);
    expect(mode()).toBe("normal");
  });

  it("indents after an Esc that brought Insert mode back to Normal", () => {
    const { press, mode, text } = openEditor("正文");
    press("i");

    press("Escape");
    const tab = press("Tab");

    expect(mode()).toBe("normal");
    expect(text()).toBe("  正文");
    expect(tab.defaultPrevented).toBe(true);
  });

  it("indents on a Tab with no Esc before it", () => {
    const { press, text } = openEditor("正文");

    const tab = press("Tab");

    expect(text()).toBe("  正文");
    expect(tab.defaultPrevented).toBe(true);
  });

  it("lets the Tab right after an unclaimed Esc move the focus while Vim is off", () => {
    const { press, text } = openEditor("正文", { vimEnabled: false });

    press("Escape");
    const tab = press("Tab");

    expect(text()).toBe("正文");
    expect(tab.defaultPrevented).toBe(false);
  });

  it("indents when another key came between Esc and Tab while Vim is off", () => {
    const { press, text } = openEditor("正文", { vimEnabled: false });

    press("Escape");
    press("a");
    const tab = press("Tab");

    expect(text()).toBe("  正文");
    expect(tab.defaultPrevented).toBe(true);
  });

  it("brings the way out back as soon as Vim is turned off", () => {
    const { press, switchVim, text } = openEditor("正文");

    switchVim(false);
    press("Escape");
    const tab = press("Tab");

    expect(text()).toBe("正文");
    expect(tab.defaultPrevented).toBe(false);
  });

  it("closes the way out as soon as Vim is turned on", () => {
    const { press, switchVim, text } = openEditor("正文", { vimEnabled: false });

    switchVim(true);
    press("Escape");
    const tab = press("Tab");

    expect(text()).toBe("  正文");
    expect(tab.defaultPrevented).toBe(true);
  });
});

describe("an app command on a Normal mode key", () => {
  function openWithCommand(body: string, vimEnabled = true) {
    const run = vi.fn();
    const opened = openEditor(body, { vimEnabled, normalCommands: [{ keys: "zz", run }] });
    return { ...opened, run };
  }

  it("runs on zz in Normal mode and leaves the text and the mode as they were", () => {
    const { press, run, text, mode } = openWithCommand("hello");

    press("z");
    press("z");

    expect(run).toHaveBeenCalledTimes(1);
    expect([text(), mode()]).toEqual(["hello", "normal"]);
  });

  it("runs again on the next zz, so the command can toggle", () => {
    const { press, run } = openWithCommand("hello");

    press("z");
    press("z");
    press("z");
    press("z");

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does nothing on a single z", () => {
    const { press, run, text } = openWithCommand("hello");

    press("z");

    expect(run).not.toHaveBeenCalled();
    expect(text()).toBe("hello");
  });

  it("does not run in Insert mode, where both letters go on to be typed", () => {
    const { press, run, mode } = openWithCommand("hello");
    press("i");

    const presses = [press("z"), press("z")];

    expect(run).not.toHaveBeenCalled();
    expect(mode()).toBe("insert");
    expect(presses.map((event) => event.defaultPrevented)).toEqual([false, false]);
  });

  it("does not run in Visual mode, where the selection stays", () => {
    const { press, run, select, mode, editor } = openWithCommand("hello world");
    select(0, 5);

    press("z");
    press("z");

    expect(run).not.toHaveBeenCalled();
    expect(mode()).toBe("visual");
    expect(editor.state.selection.main.empty).toBe(false);
  });

  it("does not run with Vim off, where both letters go on to be typed", () => {
    const { press, run } = openWithCommand("hello", false);

    const presses = [press("z"), press("z")];

    expect(run).not.toHaveBeenCalled();
    expect(presses.map((event) => event.defaultPrevented)).toEqual([false, false]);
  });

  it("does not run while an input method composes", () => {
    const { press, run, composition } = openWithCommand("hello");
    act(() => composition.start());

    press("z");
    press("z");

    expect(run).not.toHaveBeenCalled();
  });

  it("runs the command of the editor the keys were typed in", () => {
    const first = openWithCommand("one");
    const second = openWithCommand("two");

    second.press("z");
    second.press("z");

    expect([first.run.mock.calls.length, second.run.mock.calls.length]).toEqual([0, 1]);
  });

  it("does nothing in an editor that has no command for those keys", () => {
    openWithCommand("one");
    const { press, text, mode } = openEditor("plain");

    press("z");
    press("z");

    expect([text(), mode()]).toEqual(["plain", "normal"]);
  });
});
