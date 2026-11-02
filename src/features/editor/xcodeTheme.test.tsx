import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { THEME_TOKENS, type ThemeToken } from "../theme/Theme";
import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { MarkdownEditor } from "./MarkdownEditor";
import { xcodeHighlightStyle, xcodeTheme } from "./xcodeTheme";

const EDITOR_TOKENS = ["heading", "link", "code", "quote", "mark"];

function renderLines(body: string): HTMLElement[] {
  const view = render(
    <CompositionProvider state={new CompositionState()}>
      <MarkdownEditor documentKey={body} body={body} />
    </CompositionProvider>,
  );
  return Array.from(view.container.querySelectorAll<HTMLElement>(".cm-line"));
}

function colourOf(...tagsOfText: Parameters<typeof xcodeHighlightStyle.style>[0]): string | undefined {
  const className = xcodeHighlightStyle.style(tagsOfText);
  const rules = xcodeHighlightStyle.module?.getRules() ?? "";
  if (className === null) {
    return undefined;
  }
  const rule = rules.split("}").find((candidate) => candidate.includes(`.${className.split(" ")[0]}`));
  return /color:\s*var\((--color-editor-[a-z]+)\)/.exec(rule ?? "")?.[1];
}

describe("the writing area's Xcode theme", () => {
  it.each([
    ["a heading", [tags.heading1], "--color-editor-heading"],
    ["a link", [tags.link], "--color-editor-link"],
    ["a URL", [tags.url], "--color-editor-link"],
    ["inline code", [tags.monospace], "--color-editor-code"],
    ["a quote", [tags.quote], "--color-editor-quote"],
    ["a Markdown mark", [tags.processingInstruction], "--color-editor-mark"],
    ["a horizontal rule", [tags.contentSeparator], "--color-editor-mark"],
  ])("colours %s with its Xcode colour", (_case, tagsOfText, token) => {
    expect(colourOf(...tagsOfText)).toBe(token);
  });

  it("leaves text without syntax uncoloured", () => {
    expect(xcodeHighlightStyle.style([])).toBeNull();
  });

  it("marks up the heading of a body and leaves a line of prose as plain text", () => {
    const [heading, , prose] = renderLines("# 寫作的禪\n\n慢慢寫，一天一段。");

    expect(heading?.querySelector("span")).not.toBeNull();
    expect(prose?.querySelector("span")).toBeNull();
    expect(prose?.textContent).toBe("慢慢寫，一天一段。");
  });

  it("paints a selection in the theme's selected colour, focused or not", () => {
    renderLines("選取");
    const rules = [
      ...Array.from(document.querySelectorAll("style"), (style) => style.textContent ?? ""),
      ...document.adoptedStyleSheets.flatMap((sheet) => Array.from(sheet.cssRules, (rule) => rule.cssText)),
    ]
      .join("\n")
      .split("}")
      .filter((rule) => rule.includes(".cm-selectionBackground") && rule.includes("--color-selected"));

    expect(rules.some((rule) => rule.includes(".cm-focused"))).toBe(true);
    expect(rules.some((rule) => !rule.includes(".cm-focused"))).toBe(true);
  });

  it("takes every colour it uses from the theme", () => {
    const source = readFileSync(join(process.cwd(), "src/features/editor/xcodeTheme.ts"), "utf8");
    const used = [...source.matchAll(/var\(--color-([a-z-]+)\)/g)].map((match) => match[1] as ThemeToken);

    expect(used).toEqual(expect.arrayContaining([...EDITOR_TOKENS, "text", "background"].map((token) => `editor-${token}`)));
    expect(used.every((token) => THEME_TOKENS.includes(token))).toBe(true);
  });

  it("uses the editor colours only inside the editor", () => {
    const css = readFileSync(join(process.cwd(), "src/app/app.css"), "utf8");
    const users = css
      .split("}")
      .filter((rule) => rule.includes("var(--color-editor-"))
      .map((rule) => rule.slice(0, rule.indexOf("{")).trim());

    expect(users).toEqual([".markdown-editor"]);
  });
});

describe("the writing area's Markdown colours", () => {
  const openViews: EditorView[] = [];

  afterEach(() => {
    openViews.splice(0).forEach((view) => view.destroy());
  });

  function openEditor(doc: string) {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc, extensions: [markdown(), xcodeTheme()] }),
    });
    openViews.push(view);
    return view;
  }

  /**
   * The CSS declarations the mounted stylesheets give the text `text` on the
   * line `lineText`. Rules of equal weight cascade: a later one wins.
   */
  function declarationsOf(view: EditorView, lineText: string, text: string): Map<string, string> {
    const line = [...view.contentDOM.querySelectorAll(".cm-line")].find((element) => element.textContent === lineText);
    const span = [...(line?.querySelectorAll("span") ?? [])].find((element) => element.textContent?.trim() === text);
    const rules = [...document.querySelectorAll("style")].flatMap((style) => (style.textContent ?? "").split("}"));
    const applying = rules.filter((rule) =>
      [...(span?.classList ?? [])].some((name) => rule.trimStart().startsWith(`.${name} `)),
    );
    return new Map(
      applying.flatMap((rule) =>
        [...rule.matchAll(/([a-z-]+):\s*([^;]+);/g)].map((match) => [match[1] ?? "", (match[2] ?? "").trim()] as const),
      ),
    );
  }

  function colourOfText(view: EditorView, lineText: string, text: string): string | null {
    return declarationsOf(view, lineText, text).get("color") ?? null;
  }

  const HEADING_COLOUR = "var(--color-editor-heading)";
  const MARK_COLOUR = "var(--color-editor-mark)";

  it("colours heading text apart from the body", () => {
    const view = openEditor("# 今天\n\n最近在選桌面框架");

    expect(colourOfText(view, "# 今天", "今天")).toBe(HEADING_COLOUR);
    expect(colourOfText(view, "最近在選桌面框架", "最近在選桌面框架")).toBeNull();
  });

  it("keeps the hash mark in the colour of every other mark", () => {
    const view = openEditor("# 今天\n\n這是**重點**\n\n> 引言");

    expect(colourOfText(view, "# 今天", "#")).toBe(MARK_COLOUR);
    expect(colourOfText(view, "這是**重點**", "**")).toBe(MARK_COLOUR);
    expect(colourOfText(view, "> 引言", ">")).toBe(MARK_COLOUR);
  });

  it("gives all six heading levels the same colour", () => {
    const levels = [1, 2, 3, 4, 5, 6].map((level) => `${"#".repeat(level)} 第${level}級`);
    const view = openEditor(levels.join("\n\n"));

    expect(levels.map((line) => colourOfText(view, line, line.slice(line.indexOf(" ") + 1)))).toEqual(
      Array<string>(6).fill(HEADING_COLOUR),
    );
  });

  it("makes bold text only heavier, in the body colour", () => {
    const view = openEditor("這是**重點**的地方");

    expect(declarationsOf(view, "這是**重點**的地方", "重點").get("font-weight")).toBe("bold");
    expect(colourOfText(view, "這是**重點**的地方", "重點")).toBeNull();
  });

  it("makes italic text only slanted, in the body colour", () => {
    const view = openEditor("這是*重點*的地方");

    expect(declarationsOf(view, "這是*重點*的地方", "重點").get("font-style")).toBe("italic");
    expect(colourOfText(view, "這是*重點*的地方", "重點")).toBeNull();
  });
});
