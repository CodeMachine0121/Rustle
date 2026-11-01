/**
 * The share of the editor-and-preview area the preview takes. It never
 * leaves 20%–80%: folding the preview away is the panel's own toggle, not
 * a drag to zero.
 */
export class PreviewWidth {
  static readonly MINIMUM_RATIO = 0.2;
  static readonly MAXIMUM_RATIO = 0.8;
  static readonly STEP_RATIO = 0.05;

  readonly ratio: number;

  private constructor(ratio: number) {
    this.ratio = ratio;
  }

  static of(ratio: number): PreviewWidth {
    const clamped = Math.min(PreviewWidth.MAXIMUM_RATIO, Math.max(PreviewWidth.MINIMUM_RATIO, ratio));
    return new PreviewWidth(Number.isFinite(clamped) ? clamped : 0.5);
  }

  get percent(): number {
    return Math.round(this.ratio * 100);
  }

  /** Dragging the divider to the right narrows the preview. */
  draggedBy(pixelsToTheRight: number, areaWidth: number): PreviewWidth {
    if (areaWidth <= 0) {
      return this;
    }
    return PreviewWidth.of(this.ratio - pixelsToTheRight / areaWidth);
  }

  /** One step to the right narrows the preview by five points, landing on a whole percent. */
  steppedBy(stepsToTheRight: number): PreviewWidth {
    const stepped = this.ratio - stepsToTheRight * PreviewWidth.STEP_RATIO;
    return PreviewWidth.of(Math.round(stepped * 100) / 100);
  }
}
