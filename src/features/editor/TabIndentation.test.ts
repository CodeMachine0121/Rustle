import { history, undo } from "@codemirror/commands";
import { EditorSelection, EditorState, Prec, type SelectionRange } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompositionState } from "../../shared/composition/CompositionState";
import { IndentUnit, type IndentationSettings } from "./IndentUnit";
import { TabIndentation } from "./TabIndentation";

type EditorOptions = {
  doc: string;
  selection?: SelectionRange[];
  settings?: IndentationSettings;
  readOnly?: boolean;
  competingTabBinding?: boolean;
  wordExpansionOnTab?: boolean;
};

const openViews: EditorView[] = [];

afterEach(() => {
  openViews.splice(0).forEach((view) => view.destroy());
  vi.useRealTimers();
});

function openEditor({
  doc,
  selection,
  settings,
  readOnly = false,
  competingTabBinding = false,
  wordExpansionOnTab = false,
}: EditorOptions) {
  const composition = new CompositionState();
  const indentation = new TabIndentation(composition, IndentUnit.from(settings));
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: EditorSelection.create(selection ?? [EditorSelection.cursor(0)]),
      extensions: [
        EditorState.allowMultipleSelections.of(true),
        history(),
        indentation.extension(),
        EditorState.readOnly.of(readOnly),
        competingTabBinding ? Prec.highest(keymap.of([{ key: "Tab", run: insertText("搶走") }])) : [],
        wordExpansionOnTab ? Prec.highest(keymap.of([{ key: "Tab", run: insertText("sole.log()") }])) : [],
      ],
    }),
  });
  openViews.push(view);
  return { view, composition, indentation };
}

function insertText(text: string) {
  return (view: EditorView) => {
    view.dispatch(view.state.replaceSelection(text));
    return true;
  };
}

function press(view: EditorView, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  view.contentDOM.dispatchEvent(event);
  return event;
}

function pressTab(view: EditorView, init: KeyboardEventInit = {}): KeyboardEvent {
  return press(view, "Tab", init);
}

function pressShiftTab(view: EditorView, init: KeyboardEventInit = {}): KeyboardEvent {
  return press(view, "Tab", { shiftKey: true, ...init });
}

function textOf(view: EditorView): string {
  return view.state.doc.toString();
}

function cursorAt(doc: string, before: string): SelectionRange {
  return EditorSelection.cursor(doc.indexOf(before));
}

function textAround(view: EditorView, position: number): [string, string] {
  const doc = textOf(view);
  return [doc.slice(position - 1, position), doc.slice(position, position + 1)];
}

describe("Tab indents the current line", () => {
  it("indents the whole line and keeps the cursor glued to the text when at the line start", () => {
    const { view } = openEditor({ doc: "寫文章" });

    pressTab(view);

    expect(textOf(view)).toBe("  寫文章");
    expect(textAround(view, view.state.selection.main.head)[1]).toBe("寫");
    expect(view.state.selection.main.head).toBe(2);
  });

  it("indents the whole line and keeps the cursor between the same characters", () => {
    const { view } = openEditor({ doc: "寫文章", selection: [cursorAt("寫文章", "章")] });

    pressTab(view);

    expect(textOf(view)).toBe("  寫文章");
    expect(textAround(view, view.state.selection.main.head)).toEqual(["文", "章"]);
  });

  it("turns a list item into a sub item", () => {
    const { view } = openEditor({ doc: "- 第一項", selection: [EditorSelection.cursor(5)] });

    pressTab(view);

    expect(textOf(view)).toBe("  - 第一項");
  });

  it("indents one more level when the cursor is inside the leading whitespace", () => {
    const { view } = openEditor({ doc: "  - 第一項", selection: [EditorSelection.cursor(2)] });

    pressTab(view);

    expect(textOf(view)).toBe("    - 第一項");
  });

  it("indents an empty line", () => {
    const { view } = openEditor({ doc: "" });

    pressTab(view);

    expect(textOf(view)).toBe("  ");
  });

  it("indents a line inside a fenced code block and leaves the fences alone", () => {
    const doc = "```ts\nconst answer = 1\n```";
    const { view } = openEditor({ doc, selection: [cursorAt(doc, "answer")] });

    pressTab(view);

    expect(textOf(view)).toBe("```ts\n  const answer = 1\n```");
  });

  it("adds one unit to uneven leading whitespace instead of realigning it", () => {
    const { view } = openEditor({ doc: "   字", selection: [EditorSelection.cursor(4)] });

    pressTab(view);

    expect(textOf(view)).toBe("     字");
  });

  it("indents every line of a multi-line selection and keeps the selection on the same text", () => {
    const { view } = openEditor({ doc: "一\n二\n三", selection: [EditorSelection.range(0, 5)] });

    pressTab(view);

    expect(textOf(view)).toBe("  一\n  二\n  三");
    const { from, to } = view.state.selection.main;
    expect(view.state.sliceDoc(from, to)).toBe("一\n  二\n  三");
  });

  it("indents both lines when the selection covers only part of each", () => {
    const doc = "一二\n三四";
    const { view } = openEditor({ doc, selection: [EditorSelection.range(doc.indexOf("二"), doc.indexOf("四"))] });

    pressTab(view);

    expect(textOf(view)).toBe("  一二\n  三四");
  });

  it("indents a line only once when it holds several cursors", () => {
    const { view } = openEditor({
      doc: "一二三",
      selection: [EditorSelection.cursor(1), EditorSelection.cursor(2)],
    });

    pressTab(view);

    expect(textOf(view)).toBe("  一二三");
  });

  it("leaves the next line alone when the selection ends exactly at its start", () => {
    const { view } = openEditor({ doc: "一\n二", selection: [EditorSelection.range(0, 2)] });

    pressTab(view);

    expect(textOf(view)).toBe("  一\n二");
  });
});

describe("Shift+Tab outdents the current line", () => {
  it("outdents one unit back to the outermost level and keeps the cursor between the same characters", () => {
    const doc = "  寫文章";
    const { view } = openEditor({ doc, selection: [cursorAt(doc, "章")] });

    pressShiftTab(view);

    expect(textOf(view)).toBe("寫文章");
    expect(textAround(view, view.state.selection.main.head)).toEqual(["文", "章"]);
  });

  it("moves a nested list item back out", () => {
    const { view } = openEditor({ doc: "  - 子項", selection: [EditorSelection.cursor(6)] });

    pressShiftTab(view);

    expect(textOf(view)).toBe("- 子項");
  });

  it.each([
    [1, 0],
    [2, 0],
    [3, 2],
    [4, 2],
    [5, 4],
  ])("outdents %i leading spaces to the nearest level below, %i", (before, after) => {
    const doc = `${" ".repeat(before)}字`;
    const { view } = openEditor({ doc, selection: [EditorSelection.cursor(doc.length)] });

    pressShiftTab(view);

    expect(textOf(view)).toBe(`${" ".repeat(after)}字`);
  });

  it("does nothing at all at the outermost level", () => {
    const doc = "寫文章";
    const cursor = cursorAt(doc, "章");
    const { view } = openEditor({ doc, selection: [cursor] });

    pressShiftTab(view);

    expect(textOf(view)).toBe("寫文章");
    expect(view.state.selection.main.head).toBe(cursor.head);
  });

  it("outdents every line of a multi-line selection and keeps the selection on the same text", () => {
    const { view } = openEditor({ doc: "  一\n  二", selection: [EditorSelection.range(2, 7)] });

    pressShiftTab(view);

    expect(textOf(view)).toBe("一\n二");
    const { from, to } = view.state.selection.main;
    expect(view.state.sliceDoc(from, to)).toBe("一\n二");
  });

  it("outdents the lines that can move and leaves the outermost line intact", () => {
    const { view } = openEditor({ doc: "  一\n二", selection: [EditorSelection.range(0, 5)] });

    pressShiftTab(view);

    expect(textOf(view)).toBe("一\n二");
  });

  it("outdents a line inside a fenced code block like any other line", () => {
    const doc = "```ts\n  const answer = 1\n```";
    const { view } = openEditor({ doc, selection: [cursorAt(doc, "answer")] });

    pressShiftTab(view);

    expect(textOf(view)).toBe("```ts\nconst answer = 1\n```");
  });
});

describe("one key press is one undo step", () => {
  it("undoes a three-line indent in one step", () => {
    const { view } = openEditor({ doc: "一\n二\n三", selection: [EditorSelection.range(0, 5)] });

    pressTab(view);
    undo(view);

    expect(textOf(view)).toBe("一\n二\n三");
  });

  it("undoes a three-line outdent in one step", () => {
    const { view } = openEditor({ doc: "  一\n  二\n  三", selection: [EditorSelection.range(0, 11)] });

    pressShiftTab(view);
    undo(view);

    expect(textOf(view)).toBe("  一\n  二\n  三");
  });

  it("does not record a step for an outdent that changed nothing", () => {
    const { view } = openEditor({ doc: "" });
    view.dispatch({ changes: { from: 0, insert: "字" }, selection: { anchor: 1 }, userEvent: "input.type" });

    pressShiftTab(view);
    undo(view);

    expect(textOf(view)).toBe("");
  });

  it("keeps typing right after an indent separate from the indent", () => {
    const { view } = openEditor({ doc: "" });

    pressTab(view);
    view.dispatch({ changes: { from: 2, insert: "字" }, selection: { anchor: 3 }, userEvent: "input.type" });
    undo(view);

    expect(textOf(view)).toBe("  ");
  });

  it("keeps an indent separate from the typing right before it", () => {
    const { view } = openEditor({ doc: "" });
    view.dispatch({ changes: { from: 0, insert: "字" }, selection: { anchor: 1 }, userEvent: "input.type" });

    pressTab(view);
    undo(view);

    expect(textOf(view)).toBe("字");
  });
});

describe("Tab does nothing but indent", () => {
  it("keeps the key press in the editor", () => {
    const { view } = openEditor({ doc: "字" });

    const event = pressTab(view);

    expect(textOf(view)).toBe("  字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps the key press in the editor even when Shift+Tab has nothing to do", () => {
    const { view } = openEditor({ doc: "字" });

    const event = pressShiftTab(view);

    expect(textOf(view)).toBe("字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps the key press but leaves a read-only editor unchanged", () => {
    const { view } = openEditor({ doc: "字", readOnly: true });

    const event = pressTab(view);

    expect(textOf(view)).toBe("字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not complete or expand the word before the cursor", () => {
    const { view } = openEditor({
      doc: "con",
      selection: [EditorSelection.cursor(3)],
      wordExpansionOnTab: true,
    });

    pressTab(view);

    expect(textOf(view)).toBe("  con");
  });

  it("wins over another extension that binds Tab", () => {
    const { view } = openEditor({ doc: "字", competingTabBinding: true });

    pressTab(view);

    expect(textOf(view)).toBe("  字");
  });

  it("leaves Tab with a system modifier to the system", () => {
    const { view } = openEditor({ doc: "字" });

    const event = pressTab(view, { ctrlKey: true });

    expect(textOf(view)).toBe("字");
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("keyboard escape route", () => {
  it("still lets the focus leave on a Tab within two seconds of Esc", () => {
    vi.useFakeTimers();
    const { view } = openEditor({ doc: "字" });

    press(view, "Escape");
    vi.advanceTimersByTime(2000);
    const event = pressTab(view);

    expect(textOf(view)).toBe("字");
    expect(event.defaultPrevented).toBe(false);
  });

  it("goes back to indenting when no Tab came within two seconds of Esc", () => {
    vi.useFakeTimers();
    const { view } = openEditor({ doc: "字" });

    press(view, "Escape");
    vi.advanceTimersByTime(2001);
    const event = pressTab(view);

    expect(textOf(view)).toBe("  字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("lets the Tab right after Esc move the focus instead of indenting", () => {
    const { view } = openEditor({ doc: "字" });

    press(view, "Escape");
    const event = pressTab(view);

    expect(textOf(view)).toBe("字");
    expect(event.defaultPrevented).toBe(false);
  });

  it("lets Shift+Tab right after Esc move the focus backwards", () => {
    const { view } = openEditor({ doc: "  字" });

    press(view, "Escape");
    press(view, "Shift", { shiftKey: true });
    const event = pressShiftTab(view);

    expect(textOf(view)).toBe("  字");
    expect(event.defaultPrevented).toBe(false);
  });

  it("goes back to indenting once another key was pressed after Esc", () => {
    const { view } = openEditor({ doc: "字" });

    press(view, "Escape");
    press(view, "a");
    const event = pressTab(view);

    expect(textOf(view)).toBe("  字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("hands the Tab after Esc past every other Tab binding in the editor", () => {
    const { view } = openEditor({ doc: "字", competingTabBinding: true });

    press(view, "Escape");
    const event = pressTab(view);

    expect(textOf(view)).toBe("字");
    expect(event.defaultPrevented).toBe(false);
  });

  it("goes back to indenting once the mouse was pressed in the editor after Esc", () => {
    const { view } = openEditor({ doc: "字" });

    press(view, "Escape");
    fireEvent.mouseDown(view.dom);
    const event = pressTab(view);

    expect(textOf(view)).toBe("  字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("goes back to indenting once the editor lost focus after Esc", () => {
    const { view } = openEditor({ doc: "字" });

    press(view, "Escape");
    fireEvent.focusOut(view.contentDOM);
    const event = pressTab(view);

    expect(textOf(view)).toBe("  字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("is used up by the one Tab that escaped", () => {
    const { view } = openEditor({ doc: "字" });

    press(view, "Escape");
    pressTab(view);
    const event = pressTab(view);

    expect(textOf(view)).toBe("  字");
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("Tab during a composition belongs to the input method", () => {
  it("does not indent but keeps the focus in the editor", () => {
    const { view, composition } = openEditor({ doc: "字" });
    composition.start();

    const event = pressTab(view);

    expect(textOf(view)).toBe("字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not outdent but keeps the focus in the editor", () => {
    const { view, composition } = openEditor({ doc: "  字" });
    composition.start();

    const event = pressShiftTab(view);

    expect(textOf(view)).toBe("  字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("indents again once the composition has ended", () => {
    const { view, composition } = openEditor({ doc: "字" });
    composition.start();
    composition.end();

    pressTab(view);

    expect(textOf(view)).toBe("  字");
  });

  it("keeps the focus in the editor even when the editor core no longer hands the key to any binding", () => {
    const { view, composition } = openEditor({ doc: "字" });
    composition.start();
    fireEvent.compositionStart(view.contentDOM);

    const event = pressTab(view, { isComposing: true, keyCode: 229 });

    expect(textOf(view)).toBe("字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps the focus in the editor when the key event carries the input method key code", () => {
    const { view } = openEditor({ doc: "字" });

    const event = pressTab(view, { keyCode: 229 });

    expect(textOf(view)).toBe("字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps the focus in the editor when only the key event says it is composing", () => {
    const { view } = openEditor({ doc: "字" });

    const event = pressTab(view, { isComposing: true });

    expect(textOf(view)).toBe("字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not let Esc during a composition open the escape route", () => {
    const { view, composition } = openEditor({ doc: "字" });
    composition.start();
    press(view, "Escape");
    composition.end();

    const event = pressTab(view);

    expect(textOf(view)).toBe("  字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("reports that nothing changed when no covered line can be outdented", () => {
    const { view, indentation } = openEditor({ doc: "字" });

    expect(indentation.outdent(view)).toBe(false);
  });

  it("reports the change when a line was indented", () => {
    const { view, indentation } = openEditor({ doc: "字" });

    expect(indentation.indent(view)).toBe(true);
  });

  it.each([
    ["indent", "字"],
    ["outdent", "  字"],
  ] as const)("refuses a direct %s request while composing", (action, doc) => {
    const { view, composition, indentation } = openEditor({ doc });
    composition.start();

    const changed = action === "indent" ? indentation.indent(view) : indentation.outdent(view);

    expect(changed).toBe(false);
    expect(textOf(view)).toBe(doc);
  });
});

describe("indent unit", () => {
  it("inserts two spaces by default", () => {
    const { view } = openEditor({ doc: "字" });

    pressTab(view);

    expect(textOf(view)).toBe("  字");
  });

  it("inserts four spaces when set to spaces of width four", () => {
    const { view } = openEditor({ doc: "字", settings: { style: "spaces", width: 4 } });

    pressTab(view);

    expect(textOf(view)).toBe("    字");
  });

  it("inserts one tab character when set to tabs", () => {
    const { view } = openEditor({ doc: "字", settings: { style: "tab", width: 4 } });

    pressTab(view);

    expect(textOf(view)).toBe("\t字");
  });

  it("outdents to a multiple of four when the width is four", () => {
    const { view } = openEditor({ doc: "      字", settings: { style: "spaces", width: 4 } });

    pressShiftTab(view);

    expect(textOf(view)).toBe("    字");
  });

  it("rewrites the outdented whitespace as a tab when the style is tab", () => {
    const { view } = openEditor({ doc: "      字", settings: { style: "tab", width: 4 } });

    pressShiftTab(view);

    expect(textOf(view)).toBe("\t字");
  });

  it.each([0, -2, 23, 2.5])("falls back to two spaces for the unreasonable width %s", (width) => {
    const { view } = openEditor({ doc: "字", settings: { style: "spaces", width } });

    pressTab(view);

    expect(textOf(view)).toBe("  字");
  });

  it("draws tab characters at the width of the indent unit", () => {
    const { view } = openEditor({ doc: "字", settings: { style: "tab", width: 8 } });

    expect(view.state.tabSize).toBe(8);
  });
});
