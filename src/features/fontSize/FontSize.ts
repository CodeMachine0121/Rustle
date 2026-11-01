/**
 * The size of one surface's text, in pixels. The only place that knows the
 * default, the range and the precision: a gesture, the settings file and a
 * reset all arrive here, so a hand-written 999 opens exactly where zooming
 * all the way in would stop.
 */
export class FontSize {
  static readonly DEFAULT_PIXELS = 15;
  static readonly MINIMUM_PIXELS = 10;
  static readonly MAXIMUM_PIXELS = 28;

  static readonly DEFAULT = new FontSize(FontSize.DEFAULT_PIXELS);

  readonly pixels: number;

  private constructor(pixels: number) {
    this.pixels = pixels;
  }

  static of(pixels: number | undefined): FontSize {
    if (pixels === undefined || !Number.isFinite(pixels)) {
      return FontSize.DEFAULT;
    }
    return new FontSize(Math.min(FontSize.MAXIMUM_PIXELS, Math.max(FontSize.MINIMUM_PIXELS, pixels)));
  }

  get isDefault(): boolean {
    return this.pixels === FontSize.DEFAULT_PIXELS;
  }

  /** Never rounded, so scaling back by the inverse ratio lands exactly where it started. */
  scaledBy(ratio: number): FontSize {
    return FontSize.of(this.pixels * ratio);
  }

  /** What the settings file keeps: a tenth of a pixel, below what the eye reads as a step. */
  forSettings(): number {
    return Math.round(this.pixels * 10) / 10;
  }
}
