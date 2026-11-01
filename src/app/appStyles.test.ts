import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { THEME_TOKENS, type ThemeToken } from "../features/theme/Theme";

const CSS = readFileSync(join(process.cwd(), "src/app/app.css"), "utf8");

/** Every declaration the stylesheet gives `selector`, from all the rules that name it. */
function ruleFor(selector: string): string {
  const rules = CSS.split("}").filter((candidate) =>
    candidate
      .slice(0, candidate.indexOf("{"))
      .split(",")
      .some((part) => part.trim() === selector),
  );
  if (rules.length === 0) {
    throw new Error(`no rule for ${selector}`);
  }
  return rules.map((rule) => rule.slice(rule.indexOf("{") + 1)).join("\n");
}

describe("app styles", () => {
  it("draws every icon as a thin line in the colour of its text, except the save indicator", () => {
    const coloured = CSS.split("}")
      .filter((rule) => /var\(--color-(success|warning)\)/.test(rule))
      .map((rule) => rule.slice(0, rule.indexOf("{")).trim());

    expect(ruleFor(".icon")).toMatch(/stroke-width: 1\.5;/);
    expect(coloured.filter((selector) => selector.includes("icon") || selector.includes("indicator"))).toEqual([
      ".save-indicator--saved",
      ".save-indicator--failed",
    ]);
  });

  it("keeps the card's icons quiet until the card is hovered or the icon has the keyboard", () => {
    expect(ruleFor(".card-action")).toMatch(/opacity: 0\.35;/);
    expect(ruleFor(".article-card:hover .card-action")).toMatch(/opacity: 1;/);
    expect(ruleFor(".card-action:focus-visible")).toMatch(/opacity: 1;/);
    expect(ruleFor(".card-action--top")).toMatch(/top: /);
    expect(ruleFor(".card-action--bottom")).toMatch(/bottom: /);
  });

  it("writes every tag on a card with its #", () => {
    expect(ruleFor(".row-tag::before")).toMatch(/content: "#";/);
  });

  it("keeps the card's detail line against its left edge", () => {
    expect(ruleFor(".row-meta")).toMatch(/justify-content: flex-start;/);
    expect(ruleFor(".row-meta")).toMatch(/text-align: left;/);
  });

  it("shortens the workspace with an ellipsis and never the file name when the breadcrumb is too long", () => {
    expect(ruleFor(".article-path__workspace")).toMatch(/text-overflow: ellipsis;/);
    expect(ruleFor(".article-path__workspace")).toMatch(/min-width: 0;/);
    expect(ruleFor(".article-path__file")).toMatch(/flex-shrink: 0;/);
  });

  it("spins the saving mark and keeps the three marks the same size", () => {
    expect(ruleFor(".save-indicator--saving .icon")).toMatch(/animation: save-indicator-spin/);
    expect(ruleFor(".save-indicator")).toMatch(/width: 16px;[\s\S]*height: 16px;/);
  });

  it("really removes whatever is hidden, whatever display its own rule gives it", () => {
    expect(ruleFor("[hidden]")).toMatch(/display: none !important;/);
  });

  it("writes no colour of its own: every colour it uses is a theme token", () => {
    const usedTokens = new Set([...CSS.matchAll(/var\(--color-([a-z-]+)\)/g)].map((match) => match[1]));

    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(CSS).not.toMatch(/--color-[a-z-]+:/);
    expect([...usedTokens].filter((token) => !THEME_TOKENS.includes(token as ThemeToken))).toEqual([]);
  });

  it("gives the article list its own background and every panel the panel colour", () => {
    expect(ruleFor(".articles-region")).toMatch(/background: var\(--color-article-list\);/);
    [".create-article-dialog", ".finder", ".operation-failure-notice", ".settings-select"].forEach((selector) =>
      expect(ruleFor(selector)).toMatch(/background: var\(--color-panel\);/),
    );
  });

  it("dims behind dialogs with the theme's shade", () => {
    expect(ruleFor(".dialog-backdrop")).toMatch(/background: color-mix\(in srgb, var\(--color-shade\) 35%, transparent\);/);
  });

  it.each(["h1", "h2", "h3", "h4", "h5", "h6", "code", "table"])(
    "sizes the preview's %s relative to the article, never the window",
    (element) => {
      expect(ruleFor(`.preview-content ${element}`)).toMatch(/font-size: [\d.]+em;/);
    },
  );

  it("keeps the preview's headings larger than its text, level by level", () => {
    const sizes = ["h1", "h2", "h3"].map((heading) =>
      Number(/font-size: ([\d.]+)em;/.exec(ruleFor(`.preview-content ${heading}`))?.[1]),
    );

    expect(sizes).toEqual([...sizes].sort((first, second) => second - first));
    expect(sizes.every((size) => size > 1)).toBe(true);
  });

  it("never fixes the editor's font size in the stylesheet", () => {
    expect(ruleFor(".markdown-editor .cm-editor")).not.toMatch(/font-size/);
    expect(CSS).not.toMatch(/\.preview-content[^{]*\{[^}]*font-size: [\d.]+(px|rem)/);
  });
});
