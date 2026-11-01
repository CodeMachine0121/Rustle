import { describe, expect, it } from "vitest";

import { FOLLOW_SYSTEM, ThemeCatalog } from "./ThemeCatalog";
import light from "./themes/01-light.json";
import dark from "./themes/02-dark.json";
import forest from "./themes/03-forest.json";

const SHIPPED = { "./themes/01-light.json": light, "./themes/02-dark.json": dark, "./themes/03-forest.json": forest };

const forestWithoutDivider = {
  ...forest,
  base: Object.fromEntries(Object.entries(forest.base).filter(([color]) => color !== "divider")),
};

const dusk = { ...forest, id: "dusk", name: { zh: "黃昏", en: "Dusk" }, base: { ...forest.base, accent: "#ffaa00" } };

describe("ThemeCatalog", () => {
  it("ships Light, Dark and Forest, in that order", () => {
    expect(ThemeCatalog.shipped().themes.map((theme) => [theme.id, theme.nameIn("zh"), theme.nameIn("en")])).toEqual([
      ["light", "淡色", "Light"],
      ["dark", "暗色", "Dark"],
      ["forest", "森林", "Forest"],
    ]);
  });

  it("orders the themes by file name, however the files arrive", () => {
    const catalog = new ThemeCatalog({
      "./themes/03-forest.json": forest,
      "./themes/01-light.json": light,
      "./themes/02-dark.json": dark,
    });

    expect(catalog.themes.map((theme) => theme.id)).toEqual(["light", "dark", "forest"]);
  });

  it("leaves out a theme that misses a base colour and keeps the others", () => {
    const catalog = new ThemeCatalog({ ...SHIPPED, "./themes/03-forest.json": forestWithoutDivider });

    expect(catalog.themes.map((theme) => theme.id)).toEqual(["light", "dark"]);
    expect(catalog.choiceFor("forest")).toBe(FOLLOW_SYSTEM);
  });

  it("adds a fifth file as one more theme after the others, leaving their colours as they were", () => {
    const before = new ThemeCatalog(SHIPPED);
    const after = new ThemeCatalog({ ...SHIPPED, "./themes/04-dusk.json": dusk });

    expect(after.themes.map((theme) => theme.id)).toEqual(["light", "dark", "forest", "dusk"]);
    expect(after.themes.slice(0, 3).map((theme) => theme.tokens)).toEqual(before.themes.map((theme) => theme.tokens));
  });

  it("keeps the first of two themes with the same id, and never a theme named like following the system", () => {
    const catalog = new ThemeCatalog({
      ...SHIPPED,
      "./themes/04-again.json": { ...dusk, id: "forest" },
      "./themes/05-system.json": { ...dusk, id: FOLLOW_SYSTEM },
    });

    expect(catalog.themes.map((theme) => theme.id)).toEqual(["light", "dark", "forest"]);
    expect(catalog.themes[2]?.tokens.link).toBe("#a7c080");
  });

  it.each([
    ["forest", "forest"],
    ["light", "light"],
    [FOLLOW_SYSTEM, FOLLOW_SYSTEM],
    ["solarized", FOLLOW_SYSTEM],
    [undefined, FOLLOW_SYSTEM],
    [null, FOLLOW_SYSTEM],
  ])("reads the remembered %s as %s", (remembered, choice) => {
    expect(new ThemeCatalog(SHIPPED).choiceFor(remembered)).toBe(choice);
  });

  it.each([
    [FOLLOW_SYSTEM, false, "light"],
    [FOLLOW_SYSTEM, true, "dark"],
    ["forest", false, "forest"],
    ["forest", true, "forest"],
    ["light", true, "light"],
    ["solarized", true, "dark"],
  ])("paints %s with the system dark=%s as %s", (choice, systemIsDark, painted) => {
    expect(new ThemeCatalog(SHIPPED).resolve(choice, systemIsDark)?.id).toBe(painted);
  });

  it("has nothing to paint for the system when its theme is missing", () => {
    expect(new ThemeCatalog({ "./themes/03-forest.json": forest }).resolve(FOLLOW_SYSTEM, true)).toBeNull();
  });
});
