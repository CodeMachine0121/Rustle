import { describe, expect, it } from "vitest";

import { SOURCE_LINE_ATTRIBUTE } from "./PreviewHtmlPolicy";
import { PreviewLineMap } from "./PreviewLineMap";

const TALL_IMAGE_BLOCKS = [
  { line: 0, top: 0 },
  { line: 10, top: 200 },
  { line: 11, top: 800 },
  { line: 20, top: 980 },
];

const GEOMETRY = { lineCount: 30, scrollHeight: 1500, clientHeight: 300 };

const map = new PreviewLineMap(TALL_IMAGE_BLOCKS, GEOMETRY);

describe("PreviewLineMap", () => {
  it("puts the line after a tall image at the image's lower edge, not at a share of the height", () => {
    expect(map.positionFor(11)).toBe(800);
  });

  it("moves through a block in proportion to its lines", () => {
    expect(map.positionFor(15)).toBeCloseTo(880);
  });

  it("finds the line at a position inside a tall image between its line and the next", () => {
    expect(map.lineAt(500)).toBeCloseTo(10.5);
  });

  it.each([
    [999, 1200],
    [-3, 0],
  ])("keeps the position for line %i within the scrollable range", (line, position) => {
    expect(map.positionFor(line)).toBe(position);
  });

  it("finds the first and last lines past the ends", () => {
    expect(map.lineAt(-10)).toBe(0);
    expect(map.lineAt(5000)).toBe(30);
  });

  it("stays at the top when nothing carries a line", () => {
    const empty = new PreviewLineMap([], GEOMETRY);

    expect(empty.positionFor(5)).toBe(0);
    expect(empty.lineAt(400)).toBe(0);
  });

  it("uses the first of nested blocks that start on the same line, in any order", () => {
    const nested = new PreviewLineMap(
      [
        { line: 20, top: 980 },
        { line: 0, top: 0 },
        { line: 0, top: 16 },
        { line: 10, top: 200 },
      ],
      { lineCount: 20, scrollHeight: 1000, clientHeight: 300 },
    );

    expect(nested.positionFor(5)).toBe(100);
  });

  it("measures the blocks that carry the preview's source line attribute, relative to the scroller", () => {
    const scroller = document.createElement("div");
    scroller.innerHTML = `
      <p ${SOURCE_LINE_ATTRIBUTE}="0">a</p>
      <p ${SOURCE_LINE_ATTRIBUTE}="10">b</p>
      <p data-line="5">not a source line</p>`;
    const [first, second, other] = Array.from(scroller.children);
    if (first === undefined || second === undefined || other === undefined) {
      throw new Error("the blocks did not render");
    }
    Object.defineProperties(scroller, {
      scrollHeight: { value: 1000 },
      clientHeight: { value: 300 },
      scrollTop: { value: 100, writable: true },
    });
    scroller.getBoundingClientRect = () => new DOMRect(0, 50, 400, 300);
    first.getBoundingClientRect = () => new DOMRect(0, -50, 400, 20);
    second.getBoundingClientRect = () => new DOMRect(0, 150, 400, 20);
    other.getBoundingClientRect = () => new DOMRect(0, 60, 400, 20);

    const measured = PreviewLineMap.measure(scroller, 10);

    expect(measured.positionFor(10)).toBe(200);
    expect(measured.positionFor(5)).toBe(100);
    expect(measured.maximumPosition).toBe(700);
  });
});
