import { defaultKeymap, history, historyKeymap, undoDepth } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState, type SelectionRange } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";

import { CompositionState } from "../../shared/composition/CompositionState";
import { ExtendSelection } from "./ExtendSelection";

const CURSOR = "‸";
const SELECTION_START = "⟨";
const SELECTION_END = "⟩";
const IS_MAC = /Mac/.test(navigator.platform);

const openViews: EditorView[] = [];

afterEach(() => {
  openViews.splice(0).forEach((view) => view.destroy());
});

type EditorOptions = { readOnly?: boolean; ranges?: SelectionRange[]; mainIndex?: number };

/** Opens an editor on `marked`: `‸` is a cursor, `⟨…⟩` a selection. */
function openEditor(marked: string, { readOnly = false, ranges, mainIndex = 0 }: EditorOptions = {}) {
  const composition = new CompositionState();
  const { doc, selection } = unmark(marked);
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: ranges === undefined ? selection : EditorSelection.create(ranges, mainIndex),
      extensions: [
        EditorState.allowMultipleSelections.of(true),
        EditorState.readOnly.of(readOnly),
        history(),
        new ExtendSelection(composition).extension(),
        keymap.of([...defaultKeymap.filter((binding) => binding.key !== "Mod-i"), ...historyKeymap]),
        markdown(),
      ],
    }),
  });
  openViews.push(view);
  return { view, composition };
}

function unmark(marked: string) {
  const cursor = marked.indexOf(CURSOR);
  if (cursor >= 0) {
    return { doc: marked.replace(CURSOR, ""), selection: EditorSelection.single(cursor) };
  }
  const start = marked.indexOf(SELECTION_START);
  const end = marked.indexOf(SELECTION_END) - 1;
  return {
    doc: marked.replace(SELECTION_START, "").replace(SELECTION_END, ""),
    selection: EditorSelection.single(start, end),
  };
}

/** The document with the main selection marked the way `openEditor` reads it. */
function shown(view: EditorView): string {
  const doc = view.state.doc.toString();
  const { from, to, empty } = view.state.selection.main;
  if (empty) {
    return doc.slice(0, from) + CURSOR + doc.slice(from);
  }
  return doc.slice(0, from) + SELECTION_START + doc.slice(from, to) + SELECTION_END + doc.slice(to);
}

function selectedTexts(view: EditorView): string[] {
  return view.state.selection.ranges.map((range) => view.state.sliceDoc(range.from, range.to));
}

function press(view: EditorView, target: EventTarget = view.contentDOM): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "w",
    metaKey: IS_MAC,
    ctrlKey: !IS_MAC,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

function cursorAt(doc: string, text: string, offset: number): SelectionRange {
  return EditorSelection.cursor(doc.indexOf(text) + offset);
}

describe("ExtendSelection, the first press without a selection", () => {
  it.each([
    ["a Latin word", "this is impor‸tant today", "this is ⟨important⟩ today"],
    ["the whole run of Chinese", "這是重‸點的地方", "⟨這是重點的地方⟩"],
    ["Chinese up to the punctuation", "這是重‸點，那不是", "⟨這是重點⟩，那不是"],
    ["a word inside a code block", "```js\ncon‸st total = 1\n```", "```js\n⟨const⟩ total = 1\n```"],
  ])("selects %s under the cursor", (_case, marked, expected) => {
    const { view } = openEditor(marked);

    press(view);

    expect(shown(view)).toBe(expected);
  });

  it.each([
    ["an empty line", "第一段\n‸\n第二段"],
    ["a line of only spaces", "第一段\n  ‸  \n第二段"],
    ["an empty body", "‸"],
  ])("leaves the cursor where it is on %s and changes no text", (_case, marked) => {
    const { view } = openEditor(marked);

    const event = press(view);

    expect(shown(view)).toBe(marked);
    expect(event.defaultPrevented).toBe(true);
  });

  it("selects the whole paragraph when the cursor only touches punctuation", () => {
    const { view } = openEditor("today.‸");

    press(view);

    expect(shown(view)).toBe("⟨today.⟩");
  });
});

describe("ExtendSelection, each further press", () => {
  it.each([
    [
      "link text to the whole link, brackets and parentheses included",
      "去看 [今天的⟨天氣⟩](https://example.com) 吧",
      "去看 ⟨[今天的天氣](https://example.com)⟩ 吧",
    ],
    [
      "a whole link to its paragraph",
      "去看 ⟨[今天的天氣](https://example.com)⟩ 吧",
      "⟨去看 [今天的天氣](https://example.com) 吧⟩",
    ],
    ["one list item to the whole list with its marks", "- 一\n⟨- 二⟩\n- 三", "⟨- 一\n- 二\n- 三⟩"],
    ["emphasised words to the emphasis with both marks", "這是 **⟨重點⟩** 喔", "這是 ⟨**重點**⟩ 喔"],
    ["the last block to the whole body", "第一段\n\n⟨第二段⟩", "⟨第一段\n\n第二段⟩"],
  ])("grows %s", (_case, marked, expected) => {
    const { view } = openEditor(marked);

    press(view);

    expect(shown(view)).toBe(expected);
  });

  it("reaches the whole paragraph within three presses from inside a link", () => {
    const { view } = openEditor("先去看 [今天的天‸氣](https://example.com) 吧\n\n另一段");

    press(view);
    press(view);
    press(view);

    expect(selectedTexts(view)).toEqual(["先去看 [今天的天氣](https://example.com) 吧"]);
  });

  it("grows a dragged selection outward instead of falling back to a word", () => {
    const { view } = openEditor("去看 [⟨今天的天⟩氣](https://example.com) 吧");

    press(view);

    expect(shown(view)).toBe("去看 ⟨[今天的天氣](https://example.com)⟩ 吧");
  });
});

describe("ExtendSelection at the outermost layer", () => {
  it("keeps the whole body selected", () => {
    const { view } = openEditor("⟨第一段\n\n第二段⟩");

    press(view);

    expect(shown(view)).toBe("⟨第一段\n\n第二段⟩");
  });

  it("stops at the only line of a short body and never shrinks", () => {
    const { view } = openEditor("to‸day");
    const sizes: number[] = [];

    for (let pressCount = 0; pressCount < 5; pressCount += 1) {
      press(view);
      sizes.push(view.state.selection.main.to - view.state.selection.main.from);
    }

    expect(shown(view)).toBe("⟨today⟩");
    expect(sizes).toEqual([...sizes].sort((first, second) => first - second));
  });

  it("starts again from the word after the cursor is put somewhere else", () => {
    const doc = "去看 [今天的天氣](https://example.com) 吧\n\nthis is important today";
    const { view } = openEditor(doc, { ranges: [cursorAt(doc, "天氣", 1)] });
    press(view);
    press(view);

    view.dispatch({ selection: cursorAt(doc, "important", 4), userEvent: "select.pointer" });
    press(view);

    expect(selectedTexts(view)).toEqual(["important"]);
  });
});

describe("ExtendSelection never writes", () => {
  it("grows the selection in a read-only body", () => {
    const { view } = openEditor("this is impor‸tant today", { readOnly: true });

    press(view);

    expect(shown(view)).toBe("this is ⟨important⟩ today");
  });

  it("leaves no step in the undo history", () => {
    const { view } = openEditor("去看 [今天的天‸氣](https://example.com) 吧");

    press(view);
    press(view);
    press(view);

    expect(undoDepth(view.state)).toBe(0);
    expect(view.state.doc.toString()).toBe("去看 [今天的天氣](https://example.com) 吧");
  });
});

describe("ExtendSelection with several cursors", () => {
  it("gives every cursor its own word when the writer's cursor is next to one", () => {
    const doc = "milk and bread";
    const { view } = openEditor(doc, { ranges: [cursorAt(doc, "milk", 2), cursorAt(doc, "bread", 2)] });

    press(view);

    expect(selectedTexts(view)).toEqual(["milk", "bread"]);
  });

  it("leaves a cursor without a word where it is while the writer's cursor takes its word", () => {
    const doc = "milk. and bread";
    const { view } = openEditor(doc, { ranges: [cursorAt(doc, "bread", 2), cursorAt(doc, ".", 1)] });

    press(view);

    expect(view.state.selection.ranges.map((range) => [range.from, range.to])).toEqual([
      [doc.indexOf(".") + 1, doc.indexOf(".") + 1],
      [doc.indexOf("bread"), doc.length],
    ]);
  });

  it("keeps a selected range as it is while the writer's cursor takes its word", () => {
    const doc = "milk and bread";
    const bread = doc.indexOf("bread");
    const { view } = openEditor(doc, { ranges: [cursorAt(doc, "milk", 2), EditorSelection.range(bread, bread + 2)] });

    press(view);

    expect(selectedTexts(view)).toEqual(["milk", "br"]);
  });

  it("grows everything together when the writer's cursor has no word", () => {
    const doc = "milk. and bread";
    const { view } = openEditor(doc, {
      ranges: [cursorAt(doc, ".", 1), cursorAt(doc, "bread", 2)],
      mainIndex: 0,
    });

    press(view);

    expect(selectedTexts(view)).toEqual(["milk. and bread"]);
  });
});

describe("ExtendSelection leaves the key alone", () => {
  it("while an input method is composing", () => {
    const { view, composition } = openEditor("this is impor‸tant today");
    composition.start();

    const event = press(view);

    expect(shown(view)).toBe("this is impor‸tant today");
    expect(event.defaultPrevented).toBe(false);
  });

  it("when the key is pressed outside the editor", () => {
    const { view } = openEditor("this is impor‸tant today");

    const event = press(view, document.body);

    expect(shown(view)).toBe("this is impor‸tant today");
    expect(event.defaultPrevented).toBe(false);
  });
});
