import { defaultKeymap, history, historyKeymap, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CompositionState } from "../../shared/composition/CompositionState";
import { IndentUnit } from "../editor/IndentUnit";
import { TabIndentation } from "../editor/TabIndentation";
import { SnippetCatalog } from "./SnippetCatalog";
import { SnippetExpansion } from "./SnippetExpansion";

const CURSOR = "‸";
const SHIPPED_ORDER = ["H1", "H2", "H3", "H4", "H5", "H6", "Link", "Image", "Table"];

const openViews: EditorView[] = [];

afterEach(() => {
  openViews.splice(0).forEach((view) => view.destroy());
});

function editorState(marked: string, composition: CompositionState, catalog: SnippetCatalog) {
  return EditorState.create({
    doc: marked.replace(CURSOR, ""),
    selection: EditorSelection.single(Math.max(marked.indexOf(CURSOR), 0)),
    extensions: [
      new TabIndentation(composition, IndentUnit.from()).extension(),
      new SnippetExpansion(composition, catalog, () => "片段").extension(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown(),
    ],
  });
}

/** Opens an editor on `marked`, where `‸` is the cursor, with snippets installed as the app installs them. */
function openEditor(marked = CURSOR, catalog = SnippetCatalog.shipped()) {
  const composition = new CompositionState();
  const view = new EditorView({ parent: document.body, state: editorState(marked, composition, catalog) });
  openViews.push(view);
  return { view, composition };
}

function type(view: EditorView, text: string, userEvent = "input.type") {
  for (const character of text) {
    const { head } = view.state.selection.main;
    view.dispatch({ changes: { from: head, insert: character }, selection: { anchor: head + 1 }, userEvent });
  }
}

function press(view: EditorView, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  view.contentDOM.dispatchEvent(event);
  return event;
}

function menuRows(view: EditorView): string[] | null {
  const menu = view.dom.querySelector(".snippet-menu");
  return menu === null ? null : [...menu.querySelectorAll('[role="option"]')].map((row) => row.textContent ?? "");
}

function highlightedRow(view: EditorView): string | null {
  return view.dom.querySelector('.snippet-menu [aria-selected="true"]')?.textContent ?? null;
}

/** The document with `‸` at the cursor, or `[` `]` around a selection. */
function marked(view: EditorView): string {
  const { from, to } = view.state.selection.main;
  const text = view.state.doc.toString();
  return from === to ? text.slice(0, from) + CURSOR + text.slice(from) : `${text.slice(0, from)}[${text.slice(from, to)}]${text.slice(to)}`;
}

function markers(view: EditorView): number {
  return view.dom.querySelectorAll(".snippet-field-marker").length;
}

function expand(view: EditorView, query: string) {
  type(view, `/${query}`);
  press(view, "Enter");
}

describe("opening the snippet menu", () => {
  it("lists the nine snippets in order when a slash starts an empty line", () => {
    const { view } = openEditor();

    type(view, "/");

    expect(menuRows(view)).toEqual(SHIPPED_ORDER);
    expect(view.dom.querySelector(".snippet-menu")?.getAttribute("role")).toBe("listbox");
    expect(view.dom.querySelector(".snippet-menu")?.getAttribute("aria-label")).toBe("片段");
    expect(highlightedRow(view)).toBe("H1");
  });

  it.each([
    ["after a space", "參考這裡 ‸"],
    ["after one level of indentation", "  ‸"],
    ["after three spaces", "   ‸"],
    ["in a list item", "- ‸"],
  ])("opens %s", (_case, text) => {
    const { view } = openEditor(text);

    type(view, "/");

    expect(menuRows(view)).toEqual(SHIPPED_ORDER);
  });

  it.each([
    ["after four spaces, where Markdown reads code", "    ‸"],
    ["after a tab, where Markdown reads code", "\t‸"],
    ["after a letter", "a‸"],
    ["inside a fenced code block", "```\n‸\n```"],
    ["inside an unclosed fenced code block", "```js\nconst a = 1;\n‸"],
    ["inside a table cell", "| a | ‸ |\n| --- | --- |"],
  ])("does not open %s and keeps the slash as text", (_case, text) => {
    const { view } = openEditor(text);

    type(view, "/");

    expect(menuRows(view)).toBeNull();
    expect(view.state.doc.toString()).toBe(text.replace(CURSOR, "/"));
  });

  it("never opens while typing a web address", () => {
    const { view } = openEditor();

    type(view, "https:/");
    expect(menuRows(view)).toBeNull();
    type(view, "/");

    expect(menuRows(view)).toBeNull();
    expect(view.state.doc.toString()).toBe("https://");
  });

  it("treats a full-width slash as punctuation", () => {
    const { view } = openEditor();

    type(view, "／");

    expect(menuRows(view)).toBeNull();
    expect(view.state.doc.toString()).toBe("／");
  });

  it("does nothing while an input method composes", () => {
    const { view, composition } = openEditor();
    composition.start();

    type(view, "/", "input.type.compose");

    expect(menuRows(view)).toBeNull();
  });

  it("does not open for a slash typed through the input method, even after it ended", () => {
    const { view } = openEditor();

    type(view, "/", "input.type.compose");

    expect(menuRows(view)).toBeNull();
  });

  it("does not open for a slash that was pasted", () => {
    const { view } = openEditor();

    type(view, "/", "input.paste");

    expect(menuRows(view)).toBeNull();
  });

  it("closes the moment a composition starts typing into it", () => {
    const { view, composition } = openEditor();
    type(view, "/");

    composition.start();
    type(view, "ㄅ", "input.type.compose");

    expect(menuRows(view)).toBeNull();
    expect(view.state.doc.toString()).toBe("/ㄅ");
  });

  it("leaves out a snippet that cannot be read and still lands the others", () => {
    const { view } = openEditor(
      CURSOR,
      new SnippetCatalog({
        "./snippets/01-h1.json": { name: "H1", template: "# {{標題文字}}" },
        "./snippets/02-h2.json": { name: "H2", template: "## {{標題文字" },
        "./snippets/07-link.json": { name: "Link", template: "[{{要填的文字}}]({{要填的網址}})" },
      }),
    );

    type(view, "/");
    expect(menuRows(view)).toEqual(["H1", "Link"]);
    type(view, "h");
    press(view, "Enter");

    expect(marked(view)).toBe("# ‸");
  });

  it("offers nothing when no snippet could be read", () => {
    const { view } = openEditor(CURSOR, new SnippetCatalog({}));

    type(view, "/");

    expect(menuRows(view)).toBeNull();
    expect(view.state.doc.toString()).toBe("/");
  });
});

describe("the menu for assistive technology", () => {
  it("points the editor at the highlighted row while the menu is open", () => {
    const { view } = openEditor();
    type(view, "/");
    press(view, "ArrowDown");

    const activeRow = view.contentDOM.getAttribute("aria-activedescendant");
    const controlled = view.contentDOM.getAttribute("aria-controls");

    expect(activeRow === null ? null : document.getElementById(activeRow)?.textContent).toBe("H2");
    expect(controlled === null ? null : document.getElementById(controlled)?.getAttribute("role")).toBe("listbox");
  });

  it("tells assistive technology a list of suggestions is open while the menu is open", () => {
    const { view } = openEditor();

    type(view, "/");

    expect(view.contentDOM.getAttribute("aria-expanded")).toBe("true");
    expect(view.contentDOM.getAttribute("aria-haspopup")).toBe("listbox");
    expect(view.contentDOM.getAttribute("aria-autocomplete")).toBe("list");
  });

  it("points at nothing once the menu is closed", () => {
    const { view } = openEditor();
    type(view, "/");

    press(view, "Escape");

    expect(view.contentDOM.getAttribute("aria-activedescendant")).toBeNull();
    expect(view.contentDOM.getAttribute("aria-controls")).toBeNull();
    expect(view.contentDOM.getAttribute("aria-expanded")).toBeNull();
  });
});

describe("filtering and choosing", () => {
  it.each([
    ["h", ["H1", "H2", "H3", "H4", "H5", "H6"]],
    ["h2", ["H2"]],
    ["H2", ["H2"]],
  ])("keeps the snippets whose name starts with %j", (query, rows) => {
    const { view } = openEditor();

    type(view, `/${query}`);

    expect(menuRows(view)).toEqual(rows);
  });

  it("closes by itself when nothing matches and keeps the typed text", () => {
    const { view } = openEditor();

    type(view, "/zzz");

    expect(menuRows(view)).toBeNull();
    expect(view.state.doc.toString()).toBe("/zzz");
  });

  it("closes when the filter matches no name, a blank included", () => {
    const { view } = openEditor();

    type(view, "/h ");

    expect(menuRows(view)).toBeNull();
  });

  it("closes when the slash alone is deleted", () => {
    const { view } = openEditor();
    type(view, "/h");

    view.dispatch({ changes: { from: 0, to: 1 }, userEvent: "delete.forward" });

    expect(marked(view)).toBe("h‸");
    expect(menuRows(view)).toBeNull();
  });

  it("closes when text is selected", () => {
    const { view } = openEditor();
    type(view, "/h2");

    view.dispatch({ selection: { anchor: 1, head: 3 }, userEvent: "select" });

    expect(menuRows(view)).toBeNull();
  });

  it("closes when the cursor moves before the filter", () => {
    const { view } = openEditor();
    type(view, "/");

    view.dispatch({ changes: { from: 0, to: 1 }, userEvent: "delete.backward" });

    expect(menuRows(view)).toBeNull();
  });

  it("replaces the slash and the filter with the heading on Enter, cursor on its empty field", () => {
    const { view } = openEditor();
    type(view, "/h2");

    const event = press(view, "Enter");

    expect(marked(view)).toBe("## ‸");
    expect(markers(view)).toBe(1);
    expect(menuRows(view)).toBeNull();
    expect(event.defaultPrevented).toBe(true);
  });

  it("moves the highlighted row with the arrows and lands the one chosen", () => {
    const { view } = openEditor();
    type(view, "/");

    for (let row = 0; row < 8; row += 1) {
      press(view, "ArrowDown");
    }
    expect(highlightedRow(view)).toBe("Table");
    press(view, "Enter");

    expect(marked(view)).toBe("| ‸ |  |\n| --- | --- |\n|  |  |");
  });

  it("stops the highlight at the first and the last row", () => {
    const { view } = openEditor();
    type(view, "/h");

    press(view, "ArrowUp");
    expect(highlightedRow(view)).toBe("H1");
    for (let row = 0; row < 9; row += 1) {
      press(view, "ArrowDown");
    }

    expect(highlightedRow(view)).toBe("H6");
  });

  it("starts the highlight at the first row again when the filter changes", () => {
    const { view } = openEditor();
    type(view, "/");
    press(view, "ArrowDown");
    press(view, "ArrowDown");

    type(view, "h");

    expect(highlightedRow(view)).toBe("H1");
  });

  it("lands the snippet clicked, as Enter would", () => {
    const { view } = openEditor("見 ‸");
    type(view, "/");

    const link = [...view.dom.querySelectorAll('.snippet-menu [role="option"]')].find((row) => row.textContent === "Link");
    if (link === undefined) {
      throw new Error("no Link row");
    }
    fireEvent.mouseDown(link);

    expect(marked(view)).toBe("見 [‸]()");
  });

  it("ignores a click between the rows", () => {
    const { view } = openEditor();
    type(view, "/");

    const menu = view.dom.querySelector(".snippet-menu");
    if (menu === null) {
      throw new Error("no menu");
    }
    fireEvent.mouseDown(menu);

    expect(view.state.doc.toString()).toBe("/");
  });

  it("never confirms on Tab: the line indents and nothing lands", () => {
    const { view } = openEditor();
    type(view, "/h2");

    press(view, "Tab");

    expect(view.state.doc.toString()).toBe("  /h2");
  });

  it("leaves Enter to the input method while it composes", () => {
    const { view } = openEditor();
    type(view, "/h2");

    press(view, "Enter", { keyCode: 229 });

    expect(view.state.doc.toString()).not.toContain("#");
  });

  it("leaves arrows and Enter alone while no menu is open", () => {
    const { view } = openEditor("a‸");

    press(view, "Enter");

    expect(view.state.doc.toString()).toBe("a\n");
  });

  it("puts the whole snippet into one undo step, back to the typed filter", () => {
    const { view } = openEditor();
    type(view, "/table");
    press(view, "Enter");

    undo(view);

    expect(view.state.doc.toString()).toBe("/table");
  });
});

describe("what lands", () => {
  it("lands every field empty, so leaving it behind leaves nothing to clean", () => {
    const { view } = openEditor();
    expand(view, "h2");

    press(view, "Escape");

    expect(view.state.doc.toString()).toBe("## ");
  });

  it("starts a heading on a line of its own when text comes before the slash", () => {
    const { view } = openEditor("foo ‸");

    expand(view, "h2");

    expect(marked(view)).toBe("foo\n## ‸");
  });

  it("starts a table on a line of its own when text comes before the slash", () => {
    const { view } = openEditor("foo ‸");

    expand(view, "table");

    expect(marked(view)).toBe("foo\n| ‸ |  |\n| --- | --- |\n|  |  |");
  });

  it("keeps a link inside the line it was typed in", () => {
    const { view } = openEditor("參考這裡 ‸");

    expand(view, "link");

    expect(marked(view)).toBe("參考這裡 [‸]()");
  });

  it("keeps a heading on an indented line, where it is still a heading", () => {
    const { view } = openEditor("  ‸");

    expand(view, "h2");

    expect(marked(view)).toBe("  ## ‸");
  });

  it("takes a heading moved to its own line back in one undo step", () => {
    const { view } = openEditor("foo ‸");
    expand(view, "h2");

    undo(view);

    expect(view.state.doc.toString()).toBe("foo /h2");
  });

  it("lands an empty link with the cursor between the brackets", () => {
    const { view } = openEditor();

    expand(view, "link");

    expect(marked(view)).toBe("[‸]()");
  });

  it("lands an empty image with the cursor between the brackets", () => {
    const { view } = openEditor();

    expand(view, "image");

    expect(marked(view)).toBe("![‸]()");
  });

  it("marks every empty field and drops the mark once it is filled", () => {
    const { view } = openEditor();
    expand(view, "table");
    expect(markers(view)).toBe(4);

    type(view, "甲");

    expect(markers(view)).toBe(3);
  });

  it("types into the heading's field", () => {
    const { view } = openEditor();
    expand(view, "h2");

    type(view, "安裝步驟");

    expect(view.state.doc.toString()).toBe("## 安裝步驟");
  });

  it("fills one of two fields without touching the other", () => {
    const { view } = openEditor();
    expand(view, "link");

    type(view, "官方文件");

    expect(view.state.doc.toString()).toBe("[官方文件]()");
  });

  it("keeps the table's two fields with the same name apart", () => {
    const { view } = openEditor();
    expand(view, "table");

    press(view, "Tab");
    press(view, "Tab");
    type(view, "甲");

    expect(view.state.doc.toString().split("\n")[2]).toBe("| 甲 |  |");
  });
});

describe("Tab between fields", () => {
  it("moves to the next field instead of indenting, selecting what was typed there", () => {
    const { view } = openEditor();
    expand(view, "link");
    press(view, "Tab");
    type(view, "https://example.com");
    press(view, "Tab", { shiftKey: true });
    press(view, "Tab");

    expect(marked(view)).toBe("[]([https://example.com])");
  });

  it("goes back with Shift+Tab and stays on the first field", () => {
    const { view } = openEditor();
    expand(view, "table");
    press(view, "Tab");

    press(view, "Tab", { shiftKey: true });
    expect(marked(view)).toBe("| ‸ |  |\n| --- | --- |\n|  |  |");
    press(view, "Tab", { shiftKey: true });

    expect(marked(view)).toBe("| ‸ |  |\n| --- | --- |\n|  |  |");
  });

  it("ends the fields on the last one, without indenting, and indents on the next Tab", () => {
    const { view } = openEditor();
    expand(view, "link");
    press(view, "Tab");

    press(view, "Tab");
    expect(marked(view)).toBe("[]()‸");
    expect(markers(view)).toBe(0);
    press(view, "Tab");

    expect(view.state.doc.toString()).toBe("  []()");
  });

  it("indents as always when no field waits", () => {
    const { view } = openEditor("字‸");

    const event = press(view, "Tab");

    expect(view.state.doc.toString()).toBe("  字");
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves Tab to the input method while it composes", () => {
    const { view } = openEditor();
    expand(view, "link");

    press(view, "Tab", { keyCode: 229 });

    expect(marked(view)).toBe("[‸]()");
  });

  it("ends the fields when the cursor leaves the snippet", () => {
    const { view } = openEditor("前文\n‸");
    expand(view, "link");

    view.dispatch({ selection: { anchor: 0 }, userEvent: "select.pointer" });
    press(view, "Tab");

    expect(view.state.doc.toString()).toBe("  前文\n[]()");
  });

  it("ends the fields once a line break follows the heading, so Tab indents the next paragraph", () => {
    const { view } = openEditor();
    expand(view, "h2");
    type(view, "Title");
    press(view, "Enter");
    type(view, "para text here");

    view.dispatch({ selection: { anchor: "## Title\npar".length } });
    press(view, "Tab");

    expect(view.state.doc.toString()).toBe("## Title\n  para text here");
  });

  it("ends the fields once text is typed after the snippet, so Tab indents the line", () => {
    const { view } = openEditor();
    expand(view, "link");
    type(view, "a");
    press(view, "Tab");
    type(view, "u");

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    type(view, " and more");
    view.dispatch({ selection: { anchor: "[a](u) an".length } });
    press(view, "Tab");

    expect(view.state.doc.toString()).toBe("  [a](u) and more");
  });

  it("keeps the fields while the heading's title grows at the end of the snippet", () => {
    const { view } = openEditor();
    expand(view, "h2");
    type(view, "Title");

    press(view, "Tab");

    expect(marked(view)).toBe("## Title‸");
    expect(view.state.doc.toString()).toBe("## Title");
  });

  it("keeps the fields while the cursor moves inside the snippet", () => {
    const { view } = openEditor();
    expand(view, "link");

    view.dispatch({ selection: { anchor: 2 } });
    press(view, "Tab");

    expect(marked(view)).toBe("[](‸)");
  });

  it("ends the fields when another article is shown", () => {
    const { view } = openEditor();
    expand(view, "link");

    view.setState(editorState("另一篇‸", new CompositionState(), SnippetCatalog.shipped()));
    view.setState(editorState("[‸]()", new CompositionState(), SnippetCatalog.shipped()));
    press(view, "Tab");

    expect(view.state.doc.toString()).toBe("  []()");
  });

  it("ends the fields on undo", () => {
    const { view } = openEditor();
    expand(view, "link");

    undo(view);
    press(view, "Tab");

    expect(view.state.doc.toString()).toBe("  /link");
  });

  it("lets a second snippet replace the waiting fields, never returning to the first", () => {
    const { view } = openEditor();
    expand(view, "h2");

    expand(view, "link");
    expect(marked(view)).toBe("## [‸]()");
    press(view, "Tab");
    press(view, "Tab");
    press(view, "Tab");

    expect(view.state.doc.toString()).toBe("  ## []()");
  });

  it("keeps what is typed into a field a step of its own", () => {
    const { view } = openEditor();
    expand(view, "table");
    type(view, "甲");

    undo(view);

    expect(marked(view)).toBe("| ‸ |  |\n| --- | --- |\n|  |  |");
  });

  it("moves between fields without adding an undo step", () => {
    const { view } = openEditor();
    expand(view, "table");
    press(view, "Tab");
    press(view, "Tab");

    undo(view);

    expect(view.state.doc.toString()).toBe("/table");
  });
});

describe("Esc, one layer at a time", () => {
  it("closes the menu, keeps the typed text and indents on the next Tab", () => {
    const { view } = openEditor();
    type(view, "/h2");

    press(view, "Escape");
    expect(menuRows(view)).toBeNull();
    const tab = press(view, "Tab");

    expect(view.state.doc.toString()).toBe("  /h2");
    expect(tab.defaultPrevented).toBe(true);
  });

  it("opens the way out with a second Esc after the menu closed", () => {
    const { view } = openEditor();
    type(view, "/h2");
    press(view, "Escape");

    const escape = press(view, "Escape");
    const tab = press(view, "Tab");

    expect(escape.defaultPrevented).toBe(false);
    expect(view.state.doc.toString()).toBe("/h2");
    expect(tab.defaultPrevented).toBe(false);
  });

  it("ends the waiting fields and takes that Esc", () => {
    const { view } = openEditor();
    expand(view, "link");

    const escape = press(view, "Escape");
    expect(markers(view)).toBe(0);
    const tab = press(view, "Tab");

    expect(escape.defaultPrevented).toBe(true);
    expect(view.state.doc.toString()).toBe("  []()");
    expect(tab.defaultPrevented).toBe(true);
  });

  it("closes only the menu while fields also wait", () => {
    const { view } = openEditor();
    expand(view, "h2");
    type(view, "/l");

    press(view, "Escape");
    expect(menuRows(view)).toBeNull();
    press(view, "Escape");
    const tab = press(view, "Tab");

    expect(view.state.doc.toString()).toBe("  ## /l");
    expect(tab.defaultPrevented).toBe(true);
  });

  it("opens the way out as always when neither waits", () => {
    const { view } = openEditor("字‸");

    press(view, "Escape");
    const tab = press(view, "Tab");

    expect(view.state.doc.toString()).toBe("字");
    expect(tab.defaultPrevented).toBe(false);
  });
});

describe("composition", () => {
  it("keeps the markers where they are while composing and redraws them after", async () => {
    const { view, composition } = openEditor();
    expand(view, "link");

    composition.start();
    type(view, "ㄍ", "input.type.compose");
    expect(markers(view)).toBe(2);
    composition.end();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(markers(view)).toBe(1);
  });
});
