import { readFileSync } from "node:fs";
import { join } from "node:path";

import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";

import { writingSurfaceHighlightStyle } from "./writingSurfaceHighlightStyle";

const openViews: EditorView[] = [];

afterEach(() => {
  openViews.splice(0).forEach((view) => view.destroy());
});

function openEditor(doc: string) {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      extensions: [
        markdown(),
        syntaxHighlighting(writingSurfaceHighlightStyle),
        syntaxHighlighting(defaultHighlightStyle),
      ],
    }),
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

/** The colour given to `text` on `lineText`, or `null` for the body colour. */
function colourOf(view: EditorView, lineText: string, text: string): string | null {
  return declarationsOf(view, lineText, text).get("color") ?? null;
}

const HEADING_COLOUR = "var(--color-editor-heading, var(--color-editor-heading-fallback))";
const MARK_COLOUR = "#404740";

describe("the writing surface's colours", () => {
  it("colours heading text apart from the body, from a token a theme may set", () => {
    const view = openEditor("# 今天\n\n最近在選桌面框架");

    expect(colourOf(view, "# 今天", "今天")).toBe(HEADING_COLOUR);
    expect(colourOf(view, "最近在選桌面框架", "最近在選桌面框架")).toBeNull();
  });

  it("keeps the hash mark the quiet colour every other mark already had", () => {
    const view = openEditor("# 今天\n\n這是**重點**\n\n> 引言");

    expect(colourOf(view, "# 今天", "#")).toBe(MARK_COLOUR);
    expect(colourOf(view, "這是**重點**", "**")).toBe(MARK_COLOUR);
    expect(colourOf(view, "> 引言", ">")).toBe(MARK_COLOUR);
  });

  it("gives all six heading levels the same colour", () => {
    const levels = [1, 2, 3, 4, 5, 6].map((level) => `${"#".repeat(level)} 第${level}級`);
    const view = openEditor(levels.join("\n\n"));

    expect(levels.map((line) => colourOf(view, line, line.slice(line.indexOf(" ") + 1)))).toEqual(
      Array<string>(6).fill(HEADING_COLOUR),
    );
  });

  it("makes bold text only heavier, in the body colour", () => {
    const view = openEditor("這是**重點**的地方");

    expect(declarationsOf(view, "這是**重點**的地方", "重點").get("font-weight")).toBe("bold");
    expect(colourOf(view, "這是**重點**的地方", "重點")).toBeNull();
  });

  it("makes italic text only slanted, in the body colour", () => {
    const view = openEditor("這是*重點*的地方");

    expect(declarationsOf(view, "這是*重點*的地方", "重點").get("font-style")).toBe("italic");
    expect(colourOf(view, "這是*重點*的地方", "重點")).toBeNull();
  });
});

describe("the heading colour every scheme falls back to", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "app.css"), "utf8");
  const schemes = [
    ["light", css.slice(0, css.indexOf("@media (prefers-color-scheme: dark)"))],
    ["dark", css.slice(css.indexOf("@media (prefers-color-scheme: dark)"))],
  ];

  function token(block: string, name: string): string | undefined {
    return block.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();
  }

  it.each(schemes)("is a colour of its own in the %s scheme", (_scheme, block) => {
    const heading = token(block, "color-editor-heading-fallback");
    const otherColours = ["color-text", "color-muted-text", "color-link", "color-code-string", "color-error"].map(
      (name) => token(block, name),
    );

    expect(heading).toMatch(/^#[0-9a-f]{6}$/);
    expect(otherColours).not.toContain(heading);
  });
});
