import { tags } from "@lezer/highlight";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { MarkdownEditor } from "./MarkdownEditor";
import { xcodeHighlightStyle } from "./xcodeTheme";

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

  it("defines every editor colour for both the light and the dark appearance", () => {
    const css = readFileSync(join(process.cwd(), "src/app/app.css"), "utf8");
    const [light = "", dark = ""] = css.split("@media (prefers-color-scheme: dark)");

    for (const token of [...EDITOR_TOKENS, "text", "background"]) {
      expect(light).toContain(`--color-editor-${token}:`);
      expect(dark.slice(0, dark.indexOf("}\n}"))).toContain(`--color-editor-${token}:`);
    }
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
