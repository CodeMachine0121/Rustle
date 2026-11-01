import { describe, expect, it } from "vitest";

import { ZoomGesture, type ZoomWheel } from "./ZoomGesture";

function wheel(deltaY: number, modifiers: Partial<ZoomWheel> = { metaKey: true }): ZoomWheel {
  return { deltaY, deltaMode: 0, ctrlKey: false, metaKey: false, ...modifiers };
}

function product(ratios: number[]): number {
  return ratios.reduce((total, ratio) => total * ratio, 1);
}

describe("ZoomGesture", () => {
  it("leaves a wheel without Cmd or Ctrl to scrolling", () => {
    expect(new ZoomGesture().ratioForWheel(wheel(-100, {}))).toBeNull();
  });

  it.each([{ metaKey: true }, { ctrlKey: true }])("zooms with %o", (modifiers) => {
    expect(new ZoomGesture().ratioForWheel(wheel(-100, modifiers))).toBeGreaterThan(1);
  });

  it("grows when scrolled up and shrinks when scrolled down", () => {
    const gesture = new ZoomGesture();

    expect(gesture.ratioForWheel(wheel(-1))).toBeGreaterThan(1);
    expect(gesture.ratioForWheel(wheel(1))).toBeLessThan(1);
  });

  it("makes a mouse notch about two thirds larger", () => {
    const ratio = new ZoomGesture().ratioForWheel(wheel(-100)) ?? 0;

    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(1.8);
  });

  it("makes a trackpad pinch of many small events about a quarter larger, every event counting", () => {
    const gesture = new ZoomGesture();
    const ratios = Array.from({ length: 30 }, () => gesture.ratioForWheel(wheel(-1.5)) ?? 0);

    expect(ratios.every((ratio) => ratio > 1)).toBe(true);
    expect(product(ratios)).toBeGreaterThan(1.15);
    expect(product(ratios)).toBeLessThan(1.4);
  });

  it("arrives at the same place in one large step as in many small ones", () => {
    const gesture = new ZoomGesture();
    const small = Array.from({ length: 10 }, () => gesture.ratioForWheel(wheel(-10)) ?? 0);

    expect(product(small)).toBeCloseTo(gesture.ratioForWheel(wheel(-100)) ?? 0, 12);
  });

  it("comes back to where it started after the same distance the other way", () => {
    const gesture = new ZoomGesture();

    expect((gesture.ratioForWheel(wheel(-37)) ?? 0) * (gesture.ratioForWheel(wheel(37)) ?? 0)).toBeCloseTo(1, 12);
  });

  it("counts a wheel reported in lines as about a third of a notch per line", () => {
    const gesture = new ZoomGesture();

    expect(gesture.ratioForWheel({ ...wheel(-3), deltaMode: 1 })).toBeCloseTo(
      gesture.ratioForWheel(wheel(-100)) ?? 0,
      12,
    );
  });

  it("turns a WebKit pinch into the same ratio as the equivalent Ctrl wheel, step by step", () => {
    const gesture = new ZoomGesture();
    gesture.startPinch();
    const steps = [1.1, 1.3, 1.5].map((scale) => gesture.ratioForPinch(scale));

    expect(steps.every((ratio) => ratio > 1)).toBe(true);
    expect(product(steps)).toBeCloseTo(Math.sqrt(1.5), 12);
    expect(product(steps)).toBeCloseTo(gesture.ratioForWheel(wheel(100 * Math.log(1 / 1.5))) ?? 0, 12);
  });

  it("starts every pinch from no magnification", () => {
    const gesture = new ZoomGesture();
    gesture.startPinch();
    gesture.ratioForPinch(2);
    gesture.startPinch();

    expect(gesture.ratioForPinch(1)).toBe(1);
  });

  it("ignores a pinch scale that is not a magnification", () => {
    const gesture = new ZoomGesture();
    gesture.startPinch();

    expect(gesture.ratioForPinch(0)).toBe(1);
    expect(gesture.ratioForPinch(Number.NaN)).toBe(1);
  });
});
