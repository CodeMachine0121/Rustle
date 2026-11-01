import { SOURCE_LINE_ATTRIBUTE } from "./PreviewHtmlPolicy";

/** A preview block: the zero-based body line it starts at and its top in the scroller. */
export type LineAnchor = { line: number; top: number };

export type PreviewScrollGeometry = { lineCount: number; scrollHeight: number; clientHeight: number };

/**
 * Turns body lines into preview scroll positions and back, through the
 * blocks the preview drew: between two blocks the position moves in
 * proportion to the lines, so a tall image or a long code block takes the
 * space it really has.
 */
export class PreviewLineMap {
  readonly #anchors: readonly LineAnchor[];
  readonly #maximumPosition: number;

  constructor(blocks: readonly LineAnchor[], geometry: PreviewScrollGeometry) {
    this.#maximumPosition = Math.max(0, geometry.scrollHeight - geometry.clientHeight);
    const anchors = increasingAnchors(blocks);
    const last = anchors.at(-1);
    if (last !== undefined && geometry.lineCount > last.line && geometry.scrollHeight > last.top) {
      anchors.push({ line: geometry.lineCount, top: geometry.scrollHeight });
    }
    this.#anchors = anchors;
  }

  static measure(scroller: HTMLElement, lineCount: number): PreviewLineMap {
    const scrollerTop = scroller.getBoundingClientRect().top - scroller.scrollTop;
    const blocks = Array.from(scroller.querySelectorAll(`[${SOURCE_LINE_ATTRIBUTE}]`)).map(
      (block) => ({
        line: Number(block.getAttribute(SOURCE_LINE_ATTRIBUTE)),
        top: block.getBoundingClientRect().top - scrollerTop,
      }),
    );
    return new PreviewLineMap(blocks, {
      lineCount,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
    });
  }

  get maximumPosition(): number {
    return this.#maximumPosition;
  }

  /** The scroll position that puts this line at the top, within the scrollable range. */
  positionFor(line: number): number {
    const position = interpolate(this.#anchors, line, "line", "top") ?? 0;
    return Math.min(this.#maximumPosition, Math.max(0, position));
  }

  /** The line, with a fraction, at the top when scrolled to this position. */
  lineAt(position: number): number {
    return interpolate(this.#anchors, position, "top", "line") ?? 0;
  }
}

function increasingAnchors(blocks: readonly LineAnchor[]): LineAnchor[] {
  const sorted = blocks
    .filter(({ line, top }) => Number.isFinite(line) && Number.isFinite(top))
    .sort((first, second) => first.line - second.line || first.top - second.top);
  return sorted.reduce<LineAnchor[]>((anchors, block) => {
    const previous = anchors.at(-1);
    if (previous === undefined || (block.line > previous.line && block.top >= previous.top)) {
      anchors.push(block);
    }
    return anchors;
  }, []);
}

function interpolate(
  anchors: readonly LineAnchor[],
  value: number,
  from: keyof LineAnchor,
  to: keyof LineAnchor,
): number | null {
  const first = anchors[0];
  if (first === undefined) {
    return null;
  }
  if (value <= first[from]) {
    return first[to];
  }
  const nextIndex = anchors.findIndex((anchor) => anchor[from] > value);
  const start = anchors[nextIndex - 1];
  const end = anchors[nextIndex];
  if (nextIndex === -1 || start === undefined || end === undefined) {
    return anchors[anchors.length - 1]?.[to] ?? null;
  }
  const share = (value - start[from]) / (end[from] - start[from]);
  return start[to] + share * (end[to] - start[to]);
}
