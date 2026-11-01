import { describe, expect, it } from "vitest";

import { SOURCE_LINE_ATTRIBUTE } from "./PreviewHtmlPolicy";
import { PreviewScrollPane } from "./PreviewScrollPane";

function tallImageScroller(): HTMLElement {
  const scroller = document.createElement("div");
  scroller.innerHTML = [0, 10, 11, 20]
    .map((line) => `<p ${SOURCE_LINE_ATTRIBUTE}="${line}">line ${line}</p>`)
    .join("");
  const tops = [0, 200, 800, 980];
  Array.from(scroller.children).forEach((block, index) => {
    block.getBoundingClientRect = () => new DOMRect(0, (tops[index] ?? 0) - scroller.scrollTop, 400, 20);
  });
  let position = 0;
  Object.defineProperties(scroller, {
    scrollHeight: { value: 1500 },
    clientHeight: { value: 300 },
    scrollTop: { get: () => position, set: (next: number) => (position = next) },
  });
  scroller.getBoundingClientRect = () => new DOMRect(0, 0, 400, 300);
  return scroller;
}

describe("PreviewScrollPane", () => {
  it("scrolls the line after a tall image to the image's lower edge", () => {
    const pane = new PreviewScrollPane(tallImageScroller(), 30);

    pane.scrollTo(pane.positionForLine(11));

    expect(pane.position()).toBe(800);
    expect(pane.maximumPosition()).toBe(1200);
  });

  it("says which line is at the top, measuring where it is now", () => {
    const scroller = tallImageScroller();
    const pane = new PreviewScrollPane(scroller, 30);

    scroller.scrollTop = 500;

    expect(pane.lineAtTop()).toBeCloseTo(10.5);
  });
});
