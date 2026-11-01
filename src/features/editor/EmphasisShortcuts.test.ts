import { defaultKeymap, history, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState, type SelectionRange } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";

import { CompositionState } from "../../shared/composition/CompositionState";
import { EmphasisShortcuts } from "./EmphasisShortcuts";

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
        new EmphasisShortcuts(composition).extension(),
        keymap.of(defaultKeymap.filter((binding) => binding.key !== "Mod-i")),
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

function press(view: EditorView, key: "b" | "i"): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    metaKey: IS_MAC,
    ctrlKey: !IS_MAC,
    bubbles: true,
    cancelable: true,
  });
  view.contentDOM.dispatchEvent(event);
  return event;
}

function type(view: EditorView, text: string) {
  view.dispatch({ ...view.state.replaceSelection(text), userEvent: "input.type" });
}

describe("the bold shortcut", () => {
  it.each([
    ["wraps the selected words", "這是⟨重點⟩的地方", "這是**⟨重點⟩**的地方"],
    ["unwraps selected bold words", "這是**⟨重點⟩**的地方", "這是⟨重點⟩的地方"],
    ["unwraps bold written with underscores", "這是__⟨重點⟩__的地方", "這是⟨重點⟩的地方"],
    ["unwraps underscore bold at the start of the document", "__⟨重點⟩__", "⟨重點⟩"],
    ["does not take an underscore run longer on one side for bold", "甲___⟨重點⟩__乙", "甲___**⟨重點⟩**__乙"],
    ["does not take a longer underscore run between letters for bold", "甲___⟨重點⟩___乙", "甲___**⟨重點⟩**___乙"],
    ["unwraps underscore bold standing between spaces", "a __⟨init⟩__ b", "a ⟨init⟩ b"],
    ["keeps the underscores of a name", "my__⟨var⟩__name", "my__**⟨var⟩**__name"],
    [
      "does not take the underscores of the neighbouring bold for this one",
      "__甲__⟨乙⟩__丙__",
      "__甲__**⟨乙⟩**__丙__",
    ],
    ["unwraps a selection covering the bold and its marks", "這是⟨**重點**⟩的地方", "這是⟨重點⟩的地方"],
    ["keeps surrounding whitespace outside the marks", "這是⟨重點 ⟩的地方", "這是**⟨重點⟩** 的地方"],
    ["wraps the whole selection when only part of it is bold", "這是⟨**重**點⟩的地方", "這是**⟨**重**點⟩**的地方"],
    ["wraps the word under the cursor", "the impor‸tant part", "the **impor‸tant** part"],
    ["keeps the cursor inside the word it ends", "the important‸ part", "the **important‸** part"],
    ["wraps a run of Chinese up to the punctuation", "這是重‸點的地方，對吧", "**這是重‸點的地方**，對吧"],
    ["unwraps the bold word under the cursor", "這是**重‸點**的地方", "這是重‸點的地方"],
    ["drops an empty pair on an empty line", "‸", "**‸**"],
    ["drops an empty pair next to a space", "甲 ‸ 乙", "甲 **‸** 乙"],
    [
      "does not take the marks of the neighbouring bold for this one",
      "**甲**⟨乙⟩**丙**",
      "**甲****⟨乙⟩****丙**",
    ],
  ])("%s", (_name, before, after) => {
    const { view } = openEditor(before);

    press(view, "b");

    expect(shown(view)).toBe(after);
  });

  it("returns italic words to italic when pressed twice", () => {
    const { view } = openEditor("這是*⟨重點⟩*的地方");

    press(view, "b");
    press(view, "b");

    expect(shown(view)).toBe("這是*⟨重點⟩*的地方");
  });

  it("lets the writer type bold text into the empty pair", () => {
    const { view } = openEditor("‸");

    press(view, "b");
    type(view, "重點");

    expect(shown(view)).toBe("**重點‸**");
  });

  it.each([
    ["a selection across two lines", "第一⟨行\n第二⟩行"],
    ["a selection of only marks", "這是⟨**⟩重點**的地方"],
    ["a selection of a thematic break", "⟨***⟩"],
    ["a selection of only spaces", "甲⟨  ⟩乙"],
    ["the cursor in inline code", "看 `co‸de` 這裡"],
    ["a selection in a fenced code block", "```\nconst ⟨a⟩ = 1;\n```"],
    ["the cursor in an indented code block", "段落\n\n    co‸de"],
  ])("changes nothing for %s and still takes the key", (_name, marked) => {
    const { view } = openEditor(marked);

    const event = press(view, "b");

    expect(shown(view)).toBe(marked);
    expect(event.defaultPrevented).toBe(true);
  });

  it("changes nothing in a read-only editor and still takes the key", () => {
    const { view } = openEditor("這是⟨重點⟩的地方", { readOnly: true });

    const event = press(view, "b");

    expect(shown(view)).toBe("這是⟨重點⟩的地方");
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves the key to the input method while composing", () => {
    const { view, composition } = openEditor("這是⟨重點⟩的地方");
    composition.start();

    const event = press(view, "b");

    expect(shown(view)).toBe("這是⟨重點⟩的地方");
    expect(event.defaultPrevented).toBe(false);
  });

  it("is undone in one step, apart from the typing before it", () => {
    const { view } = openEditor("這是‸的地方");
    type(view, "重點");
    view.dispatch({ selection: EditorSelection.single(2, 4) });

    press(view, "b");
    undo(view);

    expect(view.state.doc.toString()).toBe("這是重點的地方");
  });

  it("keeps the empty pair when the words typed into it are undone", () => {
    const { view } = openEditor("‸");
    press(view, "b");
    type(view, "重點");

    undo(view);

    expect(shown(view)).toBe("**‸**");
  });

  it("rewrites only the main range and moves the other cursors with the change", () => {
    const { view } = openEditor("甲乙 丙丁", {
      ranges: [EditorSelection.range(0, 2), EditorSelection.cursor(4)],
      mainIndex: 0,
    });

    press(view, "b");

    expect(view.state.doc.toString()).toBe("**甲乙** 丙丁");
    expect(view.state.selection.ranges.map((range) => [range.from, range.to])).toEqual([
      [2, 4],
      [8, 8],
    ]);
  });
});

describe("the italic shortcut", () => {
  it.each([
    ["wraps the selected words", "這是⟨重點⟩的地方", "這是*⟨重點⟩*的地方"],
    ["unwraps selected italic words", "這是*⟨重點⟩*的地方", "這是⟨重點⟩的地方"],
    ["unwraps italic written with underscores", "the _⟨point⟩_ here", "the ⟨point⟩ here"],
    ["unwraps italic written with underscores between Chinese", "這是_⟨重點⟩_的地方", "這是⟨重點⟩的地方"],
    ["keeps the underscores of a snake case name", "my_⟨var⟩_name here", "my_*⟨var⟩*_name here"],
    [
      "does not take the underscores of the neighbouring italic for this one",
      "_甲_⟨乙⟩_丙_",
      "_甲_*⟨乙⟩*_丙_",
    ],
    ["unwraps the italic around bold words", "這是***⟨重點⟩***的地方", "這是**⟨重點⟩**的地方"],
    ["unwraps the italic around a bold word between spaces", "the ***⟨word⟩*** x", "the **⟨word⟩** x"],
    ["drops an empty pair on an empty line", "‸", "*‸*"],
    [
      "wraps the word in a link instead of selecting the link",
      "看[連‸結](https://example.com)這裡",
      "看[*連‸結*](https://example.com)這裡",
    ],
  ])("%s", (_name, before, after) => {
    const { view } = openEditor(before);

    press(view, "i");

    expect(shown(view)).toBe(after);
  });

  it("leaves the key to the input method while composing", () => {
    const { view, composition } = openEditor("這是⟨重點⟩的地方");
    composition.start();

    const event = press(view, "i");

    expect(shown(view)).toBe("這是⟨重點⟩的地方");
    expect(event.defaultPrevented).toBe(false);
  });

  it("returns bold words to bold when pressed twice", () => {
    const { view } = openEditor("這是**⟨重點⟩**的地方");

    press(view, "i");
    press(view, "i");

    expect(shown(view)).toBe("這是**⟨重點⟩**的地方");
  });

  it("does not unwrap bold", () => {
    const { view } = openEditor("這是**⟨重點⟩**的地方");

    press(view, "i");

    expect(shown(view)).toBe("這是***⟨重點⟩***的地方");
  });
});
