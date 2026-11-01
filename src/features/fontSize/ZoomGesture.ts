// One pixel of wheel travel scales by this much in the exponent: a pinch
// (about 45 pixels) is roughly a quarter larger, a mouse notch (100 pixels)
// roughly two thirds.
const SCALE_EXPONENT_PER_PIXEL = 0.005;
// Indexed by `WheelEvent.deltaMode`: pixels, lines, pages.
const PIXELS_PER_DELTA_UNIT = [1, 100 / 3, 800];
// WebKit reports a pinch as a magnification; this is how many wheel pixels
// one natural-log unit of it is worth (Chromium converts a pinch the same way).
const PIXELS_PER_PINCH_LOG_SCALE = 100;

export type ZoomWheel = Pick<WheelEvent, "deltaY" | "deltaMode" | "ctrlKey" | "metaKey">;

/**
 * Turns whatever the device reports into one request: "scale by this
 * ratio". Every event asks for something, however small, and the ratios of
 * one gesture multiply; a mouse and a trackpad differ only in how big and
 * how frequent their requests are.
 */
export class ZoomGesture {
  #lastPinchScale = 1;

  /** `null` when the wheel only scrolls: without Cmd or Ctrl it is not a zoom. */
  ratioForWheel(wheel: ZoomWheel): number | null {
    if (!wheel.ctrlKey && !wheel.metaKey) {
      return null;
    }
    return ratioForPixels(wheel.deltaY * (PIXELS_PER_DELTA_UNIT[wheel.deltaMode] ?? 1));
  }

  startPinch(): void {
    this.#lastPinchScale = 1;
  }

  /** `scale` is WebKit's magnification since the pinch started. */
  ratioForPinch(scale: number): number {
    if (!(scale > 0)) {
      return 1;
    }
    const step = scale / this.#lastPinchScale;
    this.#lastPinchScale = scale;
    return ratioForPixels(-Math.log(step) * PIXELS_PER_PINCH_LOG_SCALE);
  }
}

// Scrolling down (positive delta) shrinks, up grows.
function ratioForPixels(pixels: number): number {
  return Math.exp(-pixels * SCALE_EXPONENT_PER_PIXEL);
}
