import { describe, expect, it } from "vitest";

import { THEME_TOKENS, Theme, type ThemeToken } from "./Theme";
import template from "./themeTemplate.json";
import light from "./themes/01-light.json";
import dark from "./themes/02-dark.json";
import forest from "./themes/03-forest.json";

/** Every colour the app showed before themes existed, light then dark. */
const TODAY: Record<ThemeToken, [string, string]> = {
  background: ["#ffffff", "#1c1c1e"],
  "editor-background": ["#ffffff", "#1f1f24"],
  sidebar: ["#f6f6f4", "#232325"],
  "article-list": ["#ffffff", "#1c1c1e"],
  panel: ["#ffffff", "#1c1c1e"],
  text: ["#1f1f1f", "#e8e8e6"],
  "editor-text": ["#000000", "#dfdfe0"],
  "muted-text": ["#6b6b6b", "#9a9a98"],
  border: ["#e2e2de", "#3a3a3c"],
  link: ["#1a5fb4", "#8ab4f8"],
  selected: ["#e4ecf7", "#2f3d52"],
  "cursor-line": ["#f3f3f0", "#262628"],
  warning: ["#a35200", "#e3a35c"],
  error: ["#b3261e", "#f28b82"],
  success: ["#248a3d", "#30d158"],
  "code-background": ["#f4f4f2", "#262628"],
  "code-keyword": ["#a626a4", "#c678dd"],
  "code-string": ["#50a14f", "#98c379"],
  "code-number": ["#986801", "#d19a66"],
  "code-comment": ["#a0a1a7", "#7f848e"],
  "code-title": ["#4078f2", "#61afef"],
  "code-type": ["#c18401", "#e5c07b"],
  "editor-heading": ["#9b2393", "#fc5fa3"],
  "editor-link": ["#0e0eff", "#5482ff"],
  "editor-code": ["#c41a16", "#fc6a5d"],
  "editor-quote": ["#5d6c79", "#6c7986"],
  "editor-mark": ["#643820", "#fd8f3f"],
  shade: ["#000000", "#000000"],
};

function parsed(file: unknown): Theme {
  const theme = Theme.parse(file);
  if (theme === null) {
    throw new Error("expected a usable theme");
  }
  return theme;
}

function withBase(changes: Record<string, unknown>) {
  return { ...forest, base: { ...forest.base, ...changes } };
}

describe("Theme", () => {
  it.each([
    ["light", light, 0],
    ["dark", dark, 1],
  ] as const)("paints the %s theme exactly as the app looked before themes existed", (_, file, column) => {
    const tokens = parsed(file).tokens;

    expect(Object.fromEntries(THEME_TOKENS.map((token) => [token, tokens[token]]))).toEqual(
      Object.fromEntries(Object.entries(TODAY).map(([token, values]) => [token, values[column]])),
    );
  });

  it("gives every token a colour from base colours alone", () => {
    const tokens = parsed(forest).tokens;

    expect(Object.keys(tokens).sort()).toEqual([...THEME_TOKENS].sort());
    expect(THEME_TOKENS.every((token) => tokens[token].length > 0)).toBe(true);
  });

  it.each<[ThemeToken, string]>([
    ["editor-background", "#2d353b"],
    ["sidebar", "#232a2e"],
    ["article-list", "#272e33"],
    ["panel", "#343f44"],
    ["text", "#d3c6aa"],
    ["editor-text", "#d3c6aa"],
    ["editor-heading", "#d3c6aa"],
    ["muted-text", "#859289"],
    ["editor-mark", "#859289"],
    ["code-comment", "#859289"],
    ["border", "#3d484d"],
    ["link", "#a7c080"],
    ["error", "#e67e80"],
    ["editor-code", "#e67e80"],
    ["warning", "#e69875"],
    ["code-number", "#e69875"],
    ["success", "#a7c080"],
    ["editor-quote", "#a7c080"],
    ["code-string", "#a7c080"],
    ["editor-link", "#7fbbb3"],
    ["code-title", "#7fbbb3"],
    ["code-keyword", "#d699b6"],
    ["shade", "#000000"],
  ])("derives %s from the base colour that rule names", (token, colour) => {
    expect(parsed(forest).tokens[token]).toBe(colour);
  });

  it("darkens the panel one step for code blocks and washes the accent into the backgrounds", () => {
    const tokens = parsed(forest).tokens;

    expect(tokens["code-background"]).toBe("color-mix(in oklab, #343f44 92%, #000000)");
    expect(tokens.selected).toBe("color-mix(in oklab, #a7c080 28%, #272e33)");
    expect(tokens["cursor-line"]).toBe("color-mix(in oklab, #a7c080 6%, #2d353b)");
  });

  it("washes the accent more lightly into a light theme's backgrounds", () => {
    const tokens = parsed({ ...forest, base: { ...forest.base, appearance: "light" } }).tokens;

    expect(tokens.selected).toBe("color-mix(in oklab, #a7c080 14%, #272e33)");
  });

  it("is a theme without any overrides at all", () => {
    const withoutOverrides = Object.fromEntries(Object.entries(forest).filter(([field]) => field !== "overrides"));

    expect(parsed(withoutOverrides).tokens).toEqual(parsed(forest).tokens);
  });

  it("takes an override over the derived colour and ignores one that is not a colour", () => {
    const tokens = parsed({ ...forest, overrides: { "editor-code": "#123456", "editor-quote": "green", nonsense: "#ffffff" } })
      .tokens;

    expect(tokens["editor-code"]).toBe("#123456");
    expect(tokens["editor-quote"]).toBe("#a7c080");
    expect(tokens).not.toHaveProperty("nonsense");
  });

  it.each([
    ["the divider is missing", withBase({ divider: undefined })],
    ["a base colour is not a colour", withBase({ red: "red" })],
    ["light or dark is not said", withBase({ appearance: "dim" })],
    ["there is no id", { ...forest, id: " " }],
    ["there is no English name", { ...forest, name: { zh: "森林" } }],
    ["there are no base colours", { ...forest, base: null }],
    ["it is not an object", "forest"],
  ])("is not a theme when %s", (_, file) => {
    expect(Theme.parse(file)).toBeNull();
  });

  it("names itself in the interface language", () => {
    const theme = parsed(forest);

    expect([theme.nameIn("zh"), theme.nameIn("en")]).toEqual(["森林", "Forest"]);
  });

  it("repaints an element by setting every colour token and the colour scheme", () => {
    const element = document.createElement("div");

    parsed(forest).applyTo(element);

    expect(element.style.getPropertyValue("--color-text")).toBe("#d3c6aa");
    expect(element.style.getPropertyValue("--color-shade")).toBe("#000000");
    expect(element.style.colorScheme).toBe("dark");
  });

  it("replaces every colour of the previous theme when it names only base colours", () => {
    const element = document.createElement("div");
    parsed(light).applyTo(element);
    const forestTokens = parsed(forest).tokens;

    parsed(forest).applyTo(element);

    expect(THEME_TOKENS.map((token) => element.style.getPropertyValue(`--color-${token}`))).toEqual(
      THEME_TOKENS.map((token) => forestTokens[token]),
    );
    expect(THEME_TOKENS.filter((token) => element.style.getPropertyValue(`--color-${token}`) === "")).toEqual([]);
  });

  it("leaves nothing of the previous theme behind", () => {
    const element = document.createElement("div");
    parsed(forest).applyTo(element);

    parsed(light).applyTo(element);

    expect(THEME_TOKENS.map((token) => element.style.getPropertyValue(`--color-${token}`))).toEqual(
      THEME_TOKENS.map((token) => TODAY[token][0]),
    );
    expect(element.style.colorScheme).toBe("light");
  });
});

describe("theme files", () => {
  const shipped = [light, dark, forest];

  it("all have the template's shape: the same base colours, overrides among the template's", () => {
    shipped.forEach((file) => {
      expect(Object.keys(file).sort()).toEqual(Object.keys(template).sort());
      expect(Object.keys(file.base).sort()).toEqual(Object.keys(template.base).sort());
      expect(Object.keys(file.overrides).every((token) => token in template.overrides)).toBe(true);
    });
  });

  it("offers in the template every colour a theme may override", () => {
    expect(Object.keys(template.overrides).sort()).toEqual([...THEME_TOKENS].sort());
  });

  it("has fourteen base colours in the template", () => {
    expect(Object.keys(template.base)).toHaveLength(14);
  });

  it("ships a forest theme that says only its base colours", () => {
    expect(forest.overrides).toEqual({});
  });
});
