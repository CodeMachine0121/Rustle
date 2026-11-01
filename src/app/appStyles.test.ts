import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

function tokenIn(block: string, token: string): string | undefined {
  return new RegExp(`--${token}:\\s*(#[0-9a-f]{6})`).exec(block)?.[1];
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

  it.each([
    ["editor-text", "#000000", "#dfdfe0"],
    ["editor-background", "#ffffff", "#1f1f24"],
    ["editor-heading", "#9b2393", "#fc5fa3"],
    ["editor-link", "#0e0eff", "#5482ff"],
    ["editor-code", "#c41a16", "#fc6a5d"],
    ["editor-quote", "#5d6c79", "#6c7986"],
    ["editor-mark", "#643820", "#fd8f3f"],
  ])("colours the editor's %s with Xcode's default light and dark values", (token, light, dark) => {
    const [lightBlock = "", darkBlock = ""] = CSS.split("@media (prefers-color-scheme: dark)");

    expect(tokenIn(lightBlock, `color-${token}`)).toBe(light);
    expect(tokenIn(darkBlock, `color-${token}`)).toBe(dark);
  });
});
