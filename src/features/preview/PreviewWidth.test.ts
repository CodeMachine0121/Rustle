import { describe, expect, it } from "vitest";

import { PreviewWidth } from "./PreviewWidth";

describe("PreviewWidth", () => {
  it.each([
    [0.35, 0.35],
    [0.97, 0.8],
    [0.05, 0.2],
    [Number.NaN, 0.5],
  ])("shows a stored ratio of %f as %f", (stored, shown) => {
    expect(PreviewWidth.of(stored).ratio).toBeCloseTo(shown);
  });

  it.each([
    ["left by 100px", -100, 0.6],
    ["left past the area", -900, 0.8],
    ["right past the area", 900, 0.2],
    ["right by 100px", 100, 0.4],
  ])("widens or narrows by the share of the area dragged: %s", (_case, pixelsToTheRight, ratio) => {
    expect(PreviewWidth.of(0.5).draggedBy(pixelsToTheRight, 1000).ratio).toBeCloseTo(ratio);
  });

  it("stays put when the area has no width", () => {
    expect(PreviewWidth.of(0.5).draggedBy(100, 0).ratio).toBe(0.5);
  });

  it("narrows by one step to the right and widens by one to the left, within the bounds", () => {
    expect(PreviewWidth.of(0.5).steppedBy(1).ratio).toBeCloseTo(0.45);
    expect(PreviewWidth.of(0.5).steppedBy(-1).ratio).toBeCloseTo(0.55);
    expect(PreviewWidth.of(0.2).steppedBy(1).ratio).toBeCloseTo(0.2);
  });

  it("lands on a whole percent however many steps are taken", () => {
    let width = PreviewWidth.of(0.5);
    for (let step = 0; step < 4; step += 1) {
      width = width.steppedBy(1);
    }

    expect(width.ratio).toBe(0.3);
  });

  it("says its share in whole percent", () => {
    expect(PreviewWidth.of(0.354).percent).toBe(35);
  });
});
