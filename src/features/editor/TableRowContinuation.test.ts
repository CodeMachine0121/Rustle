import { defaultKeymap, history, undo } from "@codemirror/commands";
import { EditorSelection, EditorState, Prec, type SelectionRange } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";

import { CompositionState } from "../../shared/composition/CompositionState";
import { TableRowContinuation } from "./TableRowContinuation";

const CURSOR = "‸";

type EditorOptions = {
  continuesTables?: boolean;
  defaultEnter?: boolean;
  readOnly?: boolean;
  menuOwnsEnter?: boolean;
  selection?: SelectionRange[];
};

const openViews: EditorView[] = [];

afterEach(() => {
  openViews.splice(0).forEach((view) => view.destroy());
});

/** Opens an editor on `marked`, where `‸` is the cursor. */
function openEditor(
  marked: string,
  { continuesTables = true, defaultEnter = true, readOnly = false, menuOwnsEnter = false, selection }: EditorOptions = {},
) {
  const composition = new CompositionState();
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc: marked.replace(CURSOR, ""),
      selection: EditorSelection.create(selection ?? [EditorSelection.cursor(Math.max(marked.indexOf(CURSOR), 0))]),
      extensions: [
        EditorState.allowMultipleSelections.of(true),
        history(),
        continuesTables ? new TableRowContinuation(composition).extension() : [],
        defaultEnter ? keymap.of(defaultKeymap) : [],
        EditorState.readOnly.of(readOnly),
        menuOwnsEnter ? Prec.highest(keymap.of([{ key: "Enter", run: insertText("## ") }])) : [],
      ],
    }),
  });
  openViews.push(view);
  return { view, composition };
}

function insertText(text: string) {
  return (view: EditorView) => {
    view.dispatch(view.state.replaceSelection(text));
    return true;
  };
}

function pressEnter(view: EditorView, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init });
  view.contentDOM.dispatchEvent(event);
  return event;
}

/** The document with `‸` where the cursor is. */
function shown(view: EditorView): string {
  const doc = view.state.doc.toString();
  const head = view.state.selection.main.head;
  return doc.slice(0, head) + CURSOR + doc.slice(head);
}

/** What Enter did before tables were continued. */
function enterWithoutContinuation(marked: string, options: EditorOptions = {}): string {
  const { view } = openEditor(marked, { ...options, continuesTables: false });
  pressEnter(view);
  return shown(view);
}

describe("Enter at the end of a table row adds the next row", () => {
  it.each([
    ["two columns", "| 甲 | 乙 |‸", "| 甲 | 乙 |\n| ‸ |  |"],
    ["three columns", "| 甲 | 乙 | 丙 |‸", "| 甲 | 乙 | 丙 |\n| ‸ |  |  |"],
    ["the dashes row", "| 甲 | 乙 |\n| --- | --- |‸", "| 甲 | 乙 |\n| --- | --- |\n| ‸ |  |"],
    ["an indented row, keeping its indentation", "  | 甲 | 乙 |‸", "  | 甲 | 乙 |\n  | ‸ |  |"],
    ["a row inside a quote, keeping the quote marker", "> | 甲 | 乙 |‸", "> | 甲 | 乙 |\n> | ‸ |  |"],
    ["a row with one empty cell", "| 甲 |  |‸", "| 甲 |  |\n| ‸ |  |"],
    ["a lone pipe, as a one-column row", "|‸", "|\n| ‸ |"],
    ["a row without its closing pipe", "| 甲 | 乙‸", "| 甲 | 乙\n| ‸ |  |"],
    ["a row with spaces after its last pipe", "| 甲 | 乙 |  ‸", "| 甲 | 乙 |  \n| ‸ |  |"],
    ["a row whose cell holds an escaped pipe", "| a \\| b | c |‸", "| a \\| b | c |\n| ‸ |  |"],
    ["a row above more text", "| 甲 | 乙 |‸\n\n下一段", "| 甲 | 乙 |\n| ‸ |  |\n\n下一段"],
  ])("for %s", (_situation, before, after) => {
    const { view } = openEditor(before);

    const event = pressEnter(view);

    expect(shown(view)).toBe(after);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("Enter on a row whose every cell is empty leaves the table", () => {
  it.each([
    ["below a table", "| 甲 | 乙 |\n|  |  |‸", "| 甲 | 乙 |\n‸"],
    ["with the cursor in the first cell", "| 甲 | 乙 |\n| ‸ |  |", "| 甲 | 乙 |\n‸"],
    ["with the row's indentation kept", "  | 甲 | 乙 |\n  |  |  |‸", "  | 甲 | 乙 |\n  ‸"],
    ["inside a quote, staying in the quote", "> | 甲 | 乙 |\n> |  |  |‸", "> | 甲 | 乙 |\n> ‸"],
    ["for a row of one empty cell", "|  |‸", "‸"],
  ])("%s", (_situation, before, after) => {
    const { view } = openEditor(before);

    pressEnter(view);

    expect(shown(view)).toBe(after);
  });

  it("takes two presses of Enter after a filled row", () => {
    const { view } = openEditor("| 甲 | 乙 |‸");

    pressEnter(view);
    pressEnter(view);

    expect(shown(view)).toBe("| 甲 | 乙 |\n‸");
  });
});

describe("every other Enter is what it was before", () => {
  it.each([
    ["in the middle of a table row", "| 甲‸ | 乙 |"],
    ["at the end of plain text", "最近在選桌面框架‸"],
    ["before the first pipe of a table row", "‸| 甲 | 乙 |"],
    ["before the first pipe of an empty row", "‸|  |  |"],
    ["before the closing pipe of a table row", "| 甲 | 乙 ‸|"],
  ])("%s", (_situation, before) => {
    const { view } = openEditor(before);

    pressEnter(view);

    expect(shown(view)).toBe(enterWithoutContinuation(before));
    expect(view.state.doc.lines).toBe(2);
  });

  it("replaces a selection instead of adding a row", () => {
    const selection = [EditorSelection.range(2, 9)];
    const { view } = openEditor("| 甲 | 乙 |", { selection });

    pressEnter(view);

    expect(shown(view)).toBe(enterWithoutContinuation("| 甲 | 乙 |", { selection }));
  });

  it("keeps the default Enter when there are several cursors", () => {
    const selection = [EditorSelection.cursor(5), EditorSelection.cursor(11)];
    const { view } = openEditor("| 甲 |\n| 乙 |", { selection });

    pressEnter(view);

    expect(view.state.doc.toString()).toBe("| 甲 |\n\n| 乙 |\n");
  });

  it.each([
    ["Shift", { shiftKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Meta", { metaKey: true }],
  ])("adds no row when %s is held", (_modifier, init) => {
    const { view } = openEditor("| 甲 | 乙 |‸", { defaultEnter: false });

    const event = pressEnter(view, init);

    expect(view.state.doc.toString()).toBe("| 甲 | 乙 |");
    expect(event.defaultPrevented).toBe(false);
  });

  it("changes nothing in a read-only editor", () => {
    const { view } = openEditor("| 甲 | 乙 |‸", { readOnly: true });

    pressEnter(view);

    expect(shown(view)).toBe("| 甲 | 乙 |‸");
  });
});

describe("an input method owns the Enter that confirms a candidate", () => {
  it.each([
    ["the editor reports a composition", true, {}],
    ["the key event is composing", false, { isComposing: true }],
    ["the key is the input method's key", false, { keyCode: 229 }],
  ])("leaves the row and the key alone when %s", (_situation, composing, init) => {
    const { view, composition } = openEditor("| 甲 | 乙 |‸", { defaultEnter: false });
    if (composing) {
      composition.start();
    }

    const event = pressEnter(view, init);

    expect(shown(view)).toBe("| 甲 | 乙 |‸");
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves an empty row alone while composing", () => {
    const { view, composition } = openEditor("| 甲 | 乙 |\n|  |  |‸", { defaultEnter: false });
    composition.start();

    pressEnter(view);

    expect(shown(view)).toBe("| 甲 | 乙 |\n|  |  |‸");
  });

  it("refuses to continue a row while composing even when asked directly", () => {
    const composition = new CompositionState();
    const { view } = openEditor("| 甲 | 乙 |‸");
    composition.start();

    expect(new TableRowContinuation(composition).continueRow(view)).toBe(false);
    expect(view.state.doc.toString()).toBe("| 甲 | 乙 |");
  });
});

describe("an Enter owner above table continuation, like an open menu", () => {
  it("keeps Enter, so no row is added", () => {
    const { view } = openEditor("| 甲 | 乙 |‸", { menuOwnsEnter: true });

    pressEnter(view);

    expect(view.state.doc.toString()).toBe("| 甲 | 乙 |## ");
  });
});

describe("undo", () => {
  it("takes back an added row in one step, keeping what was typed before", () => {
    const { view } = openEditor("| 甲 | ‸");
    view.dispatch({ ...view.state.replaceSelection("乙 |"), userEvent: "input.type" });

    pressEnter(view);
    undo(view);

    expect(shown(view)).toBe("| 甲 | 乙 |‸");
  });

  it("keeps an added row its own step when the writer types in it", () => {
    const { view } = openEditor("| 甲 | 乙 |‸");

    pressEnter(view);
    view.dispatch({ ...view.state.replaceSelection("丙"), userEvent: "input.type" });
    undo(view);

    expect(shown(view)).toBe("| 甲 | 乙 |\n| ‸ |  |");
  });

  it("brings back a removed empty row in one step", () => {
    const { view } = openEditor("| 甲 | 乙 |\n|  |  |‸");

    pressEnter(view);
    undo(view);

    expect(shown(view)).toBe("| 甲 | 乙 |\n|  |  |‸");
  });

  it("keeps leaving the table its own step when the writer types after it", () => {
    const { view } = openEditor("| 甲 | 乙 |\n|  |  |‸");

    pressEnter(view);
    view.dispatch({ ...view.state.replaceSelection("下一段"), userEvent: "input.type" });
    undo(view);

    expect(shown(view)).toBe("| 甲 | 乙 |\n‸");
  });
});
