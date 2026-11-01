// @vitest-environment jsdom
import { undo } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { renderPreviewHtml } from "../preview/renderPreviewHtml";
import { MarkdownEditor } from "./MarkdownEditor";

// The writing surface continues task lists through Markdown's own list
// continuation; these tests hold the editor to it, next to plain and
// ordered lists, so an editor upgrade has to keep it or say so. Enter while
// composing never reaches it (CodeMirror ignores keys during a composition
// that has changed the document); that needs a real input method, so it is
// on the manual input method checklist.

const CURSOR = "‸";

function openEditor(marked: string) {
  const composition = new CompositionState();
  const body = marked.replace(CURSOR, "");
  const rendered = render(
    <CompositionProvider state={composition}>
      <MarkdownEditor documentKey={marked} body={body} />
    </CompositionProvider>,
  );
  const content = rendered.container.querySelector(".cm-content");
  const view = content instanceof HTMLElement ? EditorView.findFromDOM(content) : null;
  if (view === null) {
    throw new Error("the editor did not render");
  }
  view.dispatch({ selection: EditorSelection.single(marked.indexOf(CURSOR)) });
  return { view, unmount: () => rendered.unmount() };
}

function pressEnter(view: EditorView, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(view.contentDOM, { key: "Enter", ...init });
}

function shown(view: EditorView): string {
  const doc = view.state.doc.toString();
  const head = view.state.selection.main.head;
  return doc.slice(0, head) + CURSOR + doc.slice(head);
}

function afterEnters(marked: string, presses = 1): string {
  const { view, unmount } = openEditor(marked);
  for (let press = 0; press < presses; press += 1) {
    pressEnter(view);
  }
  const result = shown(view);
  unmount();
  return result;
}

describe("Enter in a task list", () => {
  it("grows an unticked task item after the last word", () => {
    expect(afterEnters("- [ ] 買牛奶‸")).toBe("- [ ] 買牛奶\n- [ ] ‸");
  });

  it("does not hand the tick to the next item", () => {
    expect(afterEnters("- [x] 買牛奶‸")).toBe("- [x] 買牛奶\n- [ ] ‸");
  });

  it("removes an item with only its box and ends the list", () => {
    expect(afterEnters("- [ ] 甲\n- [ ] 乙\n- [ ] ‸")).toBe("- [ ] 甲\n- [ ] 乙\n‸");
  });

  it("counts a box followed only by spaces as empty", () => {
    expect(afterEnters("- [ ] 甲\n- [ ] 乙\n- [ ]   ‸")).toBe("- [ ] 甲\n- [ ] 乙\n‸");
  });

  it("keeps the next item at the same depth", () => {
    expect(afterEnters("- [ ] 甲\n  - [ ] 買牛奶‸")).toBe("- [ ] 甲\n  - [ ] 買牛奶\n  - [ ] ‸");
  });

  it("grows the next item on the document's last line", () => {
    expect(afterEnters("- [ ] 甲‸")).toBe("- [ ] 甲\n- [ ] ‸");
  });

  it.each([
    ["task", "- [ ] 買牛奶‸", "- [ ] 買牛奶\n\n- [ ] ‸"],
    ["plain", "- 買牛奶‸", "- 買牛奶\n\n- ‸"],
    ["ordered", "1. 買牛奶‸", "1. 買牛奶\n\n2. ‸"],
  ])("opens a blank line for an empty second item of a %s list", (_kind, before, after) => {
    expect(afterEnters(before, 2)).toBe(after);
  });

  it.each([
    ["task", "- [ ] 甲\n  - [ ] ‸", "- [ ] 甲\n- [ ] ‸"],
    ["plain", "- 甲\n  - ‸", "- 甲\n- ‸"],
  ])("moves an empty indented %s item out one level", (_kind, before, after) => {
    expect(afterEnters(before)).toBe(after);
  });

  it("splits the line inside the words, the marker moving with them, like a plain item", () => {
    expect(afterEnters("- [ ] 買‸牛奶")).toBe("- [ ] 買\n- [ ] ‸牛奶");
    expect(afterEnters("- 買‸牛奶")).toBe("- 買\n- ‸牛奶");
  });

  it("keeps plain and ordered lists growing as before", () => {
    expect(afterEnters("- 買牛奶‸")).toBe("- 買牛奶\n- ‸");
    expect(afterEnters("1. 買牛奶‸")).toBe("1. 買牛奶\n2. ‸");
  });

  it("is undone in one step", () => {
    const { view, unmount } = openEditor("- [ ] 買牛奶‸");

    pressEnter(view);
    undo(view);

    expect(view.state.doc.toString()).toBe("- [ ] 買牛奶");
    unmount();
  });

  it("continues a table row before any list rule", () => {
    expect(afterEnters("| 甲 | 乙 |‸")).toBe("| 甲 | 乙 |\n| ‸ |  |");
  });

  it("writes items the preview draws as a task list", () => {
    const html = renderPreviewHtml("- [ ] 甲\n- [ ] 乙\n- [x] 丙");

    expect(html.match(/role="checkbox"/g)).toHaveLength(3);
  });
});
