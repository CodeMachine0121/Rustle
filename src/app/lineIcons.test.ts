import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("icons on screen", () => {
  it("draws every icon as a thin line in the colour of its text, except the save indicator", () => {
    const css = readFileSync(join(process.cwd(), "src/app/app.css"), "utf8");
    const coloured = css
      .split("}")
      .filter((rule) => /var\(--color-(success|warning)\)/.test(rule))
      .map((rule) => rule.slice(0, rule.indexOf("{")).trim());

    expect(css).toMatch(/\.icon \{[^}]*stroke-width: 1\.5;/);
    expect(coloured.filter((selector) => selector.includes("icon") || selector.includes("indicator"))).toEqual([
      ".save-indicator--saved",
      ".save-indicator--failed",
    ]);
  });
});
