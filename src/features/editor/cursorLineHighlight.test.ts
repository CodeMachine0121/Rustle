import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";

import { cursorLineHighlight } from "./cursorLineHighlight";

const openViews: EditorView[] = [];

afterEach(() => {
  openViews.splice(0).forEach((view) => view.destroy());
});

function openEditor(doc: string, selection: EditorSelection) {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection,
      extensions: [EditorState.allowMultipleSelections.of(true), cursorLineHighlight()],
    }),
  });
  openViews.push(view);
  return view;
}

function highlightedLines(view: EditorView): string[] {
  return [...view.contentDOM.querySelectorAll(".cm-cursorLine")].map((line) => line.textContent ?? "");
}

describe("the cursor-line background", () => {
  it("is drawn on the cursor's line while nothing is selected", () => {
    const view = openEditor("第一行\n這是重點的地方\n第三行", EditorSelection.single(6));

    expect(highlightedLines(view)).toEqual(["這是重點的地方"]);
  });

  it("steps aside while a few words on that line are selected", () => {
    const view = openEditor("第一行\n這是重點的地方\n第三行", EditorSelection.single(6, 8));

    expect(highlightedLines(view)).toEqual([]);
  });

  it("steps aside while a selection runs across lines", () => {
    const view = openEditor("第一行\n第二行\n第三行", EditorSelection.single(1, 10));

    expect(highlightedLines(view)).toEqual([]);
  });

  it("comes back when the selection is dropped", () => {
    const view = openEditor("第一行\n這是重點的地方\n第三行", EditorSelection.single(6, 8));

    view.dispatch({ selection: EditorSelection.single(8) });

    expect(highlightedLines(view)).toEqual(["這是重點的地方"]);
  });

  it("is drawn once per line for several cursors", () => {
    const view = openEditor(
      "第一行\n第二行\n第三行",
      EditorSelection.create([EditorSelection.cursor(9), EditorSelection.cursor(0), EditorSelection.cursor(1)]),
    );

    expect(highlightedLines(view)).toEqual(["第一行", "第三行"]);
  });

  it("follows the cursor to the line it moves to", () => {
    const view = openEditor("第一行\n第二行", EditorSelection.single(0));

    view.dispatch({ selection: EditorSelection.single(5) });

    expect(highlightedLines(view)).toEqual(["第二行"]);
  });
});
