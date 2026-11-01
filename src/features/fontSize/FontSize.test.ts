import { describe, expect, it } from "vitest";

import { FontSize } from "./FontSize";

describe("FontSize", () => {
  it("is fifteen pixels by default, between ten and twenty-eight", () => {
    expect(FontSize.DEFAULT.pixels).toBe(15);
    expect(FontSize.of(undefined).pixels).toBe(15);
    expect(FontSize.of(9).pixels).toBe(10);
    expect(FontSize.of(17.3).pixels).toBe(17.3);
  });

  it("opens a hand-written absurd size exactly where zooming all the way in stops", () => {
    let zoomedIn = FontSize.DEFAULT;
    for (let step = 0; step < 50; step += 1) {
      zoomedIn = zoomedIn.scaledBy(1.25);
    }

    expect(FontSize.of(999)).toEqual(zoomedIn);
    expect(zoomedIn.pixels).toBe(28);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])("reads %s as the default", (pixels) => {
    expect(FontSize.of(pixels)).toBe(FontSize.DEFAULT);
  });

  it("stays at the minimum when shrunk further, never wrapping round", () => {
    const smallest = FontSize.of(10);

    expect(smallest.scaledBy(0.5).pixels).toBe(10);
  });

  it("stays at the maximum when grown further", () => {
    expect(FontSize.of(28).scaledBy(1.5).pixels).toBe(28);
  });

  it("comes back to where it started when scaled back by the same amount", () => {
    const start = FontSize.of(16.23);

    expect(start.scaledBy(1.01).scaledBy(1 / 1.01).pixels).toBeCloseTo(16.23, 12);
    expect(start.scaledBy(1.0004).pixels).not.toBe(start.pixels);
  });

  it("spends the travel pushed against the maximum", () => {
    const pushed = FontSize.of(25).scaledBy(1.5);

    expect(pushed.scaledBy(1 / 1.5).pixels).toBeCloseTo(28 / 1.5, 12);
  });

  it("is kept in the settings to a tenth of a pixel", () => {
    expect(FontSize.of(17.34).forSettings()).toBe(17.3);
    expect(FontSize.of(17.36).forSettings()).toBe(17.4);
  });

  it("knows when it is the default", () => {
    expect(FontSize.of(15).isDefault).toBe(true);
    expect(FontSize.of(16).isDefault).toBe(false);
  });
});
