import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { PaneDivider } from "./PaneDivider";
import { PreviewWidth } from "./PreviewWidth";

function renderDivider(ratio = 0.5, composition = new CompositionState()) {
  const onResize = vi.fn<(width: PreviewWidth) => void>();
  const onResizeEnd = vi.fn<(width: PreviewWidth) => void>();
  render(
    <CompositionProvider state={composition}>
      <div data-testid="area">
        <PaneDivider width={PreviewWidth.of(ratio)} onResize={onResize} onResizeEnd={onResizeEnd} />
      </div>
    </CompositionProvider>,
  );
  const area = screen.getByTestId("area");
  vi.spyOn(area, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1000, 600));
  const ratios = (mock: typeof onResize) => mock.mock.calls.map(([width]) => width.ratio);
  return { divider: screen.getByRole("separator"), onResize, onResizeEnd, ratios };
}

describe("PaneDivider", () => {
  it("follows every move on screen and reports the width once on release", () => {
    const { divider, onResize, onResizeEnd, ratios } = renderDivider();

    fireEvent.pointerDown(divider, { pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(divider, { pointerId: 1, clientX: 480 });
    fireEvent.pointerMove(divider, { pointerId: 1, clientX: 450 });
    fireEvent.pointerMove(divider, { pointerId: 1, clientX: 400 });

    expect(ratios(onResize).map((ratio) => ratio.toFixed(2))).toEqual(["0.52", "0.55", "0.60"]);
    expect(onResizeEnd).not.toHaveBeenCalled();

    fireEvent.pointerUp(divider, { pointerId: 1, clientX: 400 });

    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    expect(ratios(onResizeEnd)[0]).toBeCloseTo(0.6);
  });

  it.each([
    ["left", -900, 0.8],
    ["right", 900, 0.2],
  ])("stops at the bound when dragged far to the %s", (_side, distance, ratio) => {
    const { divider, onResizeEnd, ratios } = renderDivider();

    fireEvent.pointerDown(divider, { pointerId: 1, clientX: 500 });
    fireEvent.pointerUp(divider, { pointerId: 1, clientX: 500 + distance });

    expect(ratios(onResizeEnd)[0]).toBeCloseTo(ratio);
  });

  it("stops following the pointer once released", () => {
    const { divider, onResize } = renderDivider();
    fireEvent.pointerDown(divider, { pointerId: 1, clientX: 500 });
    fireEvent.pointerUp(divider, { pointerId: 1, clientX: 400 });

    fireEvent.pointerMove(divider, { pointerId: 1, clientX: 300 });

    expect(onResize).not.toHaveBeenCalled();
  });

  it("ignores moves that are not part of a drag", () => {
    const { divider, onResize, onResizeEnd } = renderDivider();

    fireEvent.pointerMove(divider, { pointerId: 1, clientX: 400 });
    fireEvent.pointerUp(divider, { pointerId: 1, clientX: 400 });

    expect(onResize).not.toHaveBeenCalled();
    expect(onResizeEnd).not.toHaveBeenCalled();
  });

  it.each([
    ["ArrowRight", 0.45],
    ["ArrowLeft", 0.55],
  ])("moves one step on %s and remembers it", (key, ratio) => {
    const { divider, onResizeEnd, ratios } = renderDivider();

    fireEvent.keyDown(divider, { key, keyCode: 39 });

    expect(ratios(onResizeEnd)[0]).toBeCloseTo(ratio);
  });

  it("follows a held arrow key on screen and remembers only where it stops", () => {
    const { divider, onResize, onResizeEnd, ratios } = renderDivider();

    fireEvent.keyDown(divider, { key: "ArrowRight", keyCode: 39 });
    fireEvent.keyDown(divider, { key: "ArrowRight", keyCode: 39, repeat: true });
    fireEvent.keyDown(divider, { key: "ArrowRight", keyCode: 39, repeat: true });

    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenCalledTimes(2);

    fireEvent.keyUp(divider, { key: "ArrowRight", keyCode: 39 });

    expect(onResizeEnd).toHaveBeenCalledTimes(2);
    expect(ratios(onResizeEnd)[1]).toBe(ratios(onResize)[1]);
  });

  it("remembers a held arrow key's width when focus leaves before the key is released", () => {
    const { divider, onResizeEnd } = renderDivider();

    fireEvent.keyDown(divider, { key: "ArrowLeft", keyCode: 37, repeat: true });
    fireEvent.blur(divider);

    expect(onResizeEnd).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["middle", 1],
    ["right", 2],
  ])("does not start a drag on a %s click", (_button, button) => {
    const { divider, onResize, onResizeEnd } = renderDivider();

    fireEvent.pointerDown(divider, { pointerId: 1, clientX: 500, button });
    fireEvent.pointerMove(divider, { pointerId: 1, clientX: 400, button });
    fireEvent.pointerUp(divider, { pointerId: 1, clientX: 400, button });

    expect(onResize).not.toHaveBeenCalled();
    expect(onResizeEnd).not.toHaveBeenCalled();
  });

  it("leaves arrow keys to the input method while composing", () => {
    const composition = new CompositionState();
    composition.start();
    const { divider, onResizeEnd } = renderDivider(0.5, composition);

    fireEvent.keyDown(divider, { key: "ArrowRight", keyCode: 39 });

    expect(onResizeEnd).not.toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const { divider, onResizeEnd } = renderDivider();

    fireEvent.keyDown(divider, { key: "Enter", keyCode: 13 });

    expect(onResizeEnd).not.toHaveBeenCalled();
  });

  it("is a focusable separator that says where it is and its bounds", () => {
    const { divider } = renderDivider(0.35);

    expect(divider).toHaveAttribute("tabindex", "0");
    expect(divider).toHaveAttribute("aria-valuenow", "35");
    expect(divider).toHaveAttribute("aria-valuemin", "20");
    expect(divider).toHaveAttribute("aria-valuemax", "80");
  });
});
