import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { EditorScrollPane, type EditorGeometry } from "./EditorScrollPane";

const LINE_HEIGHT = 20;
const PADDING = 24;

function editorGeometry(scrollTop: number): EditorGeometry & { scrollDOM: HTMLElement } {
  const state = EditorState.create({ doc: Array.from({ length: 50 }, (_, index) => `line ${index}`).join("\n") });
  const scrollDOM = document.createElement("div");
  Object.defineProperties(scrollDOM, {
    scrollHeight: { value: 50 * LINE_HEIGHT + 2 * PADDING },
    clientHeight: { value: 300 },
  });
  scrollDOM.scrollTop = scrollTop;
  scrollDOM.getBoundingClientRect = () => new DOMRect(0, 100, 400, 300);
  const blockOfLine = (number: number) => {
    const line = state.doc.line(number);
    return { from: line.from, top: (number - 1) * LINE_HEIGHT, height: LINE_HEIGHT };
  };
  return {
    scrollDOM,
    get documentTop() {
      return 100 + PADDING - scrollDOM.scrollTop;
    },
    state,
    lineBlockAtHeight: (height) =>
      blockOfLine(Math.min(50, Math.max(1, Math.floor(height / LINE_HEIGHT) + 1))),
    lineBlockAt: (position) => blockOfLine(state.doc.lineAt(position).number),
  };
}

describe("EditorScrollPane", () => {
  it("counts half a line scrolled past as half a line", () => {
    const pane = new EditorScrollPane(editorGeometry(PADDING + 7 * LINE_HEIGHT + 10));

    expect(pane.lineAtTop()).toBeCloseTo(7.5);
  });

  it("puts a line's block top at the top of the editor", () => {
    const geometry = editorGeometry(0);
    const pane = new EditorScrollPane(geometry);

    expect(pane.positionForLine(7)).toBe(PADDING + 140);
    pane.scrollTo(pane.positionForLine(7.5));
    expect(geometry.scrollDOM.scrollTop).toBe(PADDING + 150);
    expect(pane.position()).toBe(PADDING + 150);
  });

  it("keeps lines past either end on the first or last line", () => {
    const pane = new EditorScrollPane(editorGeometry(0));

    expect(pane.positionForLine(-4)).toBe(PADDING);
    expect(pane.positionForLine(999)).toBe(PADDING + 49 * LINE_HEIGHT + LINE_HEIGHT);
  });

  it("counts a line without height as its start", () => {
    const geometry = editorGeometry(PADDING + 7 * LINE_HEIGHT + 10);
    const flat = { ...geometry, lineBlockAtHeight: (height: number) => ({ ...geometry.lineBlockAtHeight(height), height: 0 }) };

    expect(new EditorScrollPane(flat).lineAtTop()).toBe(7);
  });

  it("is at line zero in the top padding", () => {
    expect(new EditorScrollPane(editorGeometry(0)).lineAtTop()).toBe(0);
  });

  it("knows how far it can scroll", () => {
    expect(new EditorScrollPane(editorGeometry(0)).maximumPosition()).toBe(50 * LINE_HEIGHT + 2 * PADDING - 300);
  });
});
