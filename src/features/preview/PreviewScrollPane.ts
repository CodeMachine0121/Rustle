import { PreviewLineMap } from "./PreviewLineMap";
import type { ScrollPane } from "./ScrollSynchronizer";

/** The preview's scroller as a sync side; blocks are measured on every question, since images load late. */
export class PreviewScrollPane implements ScrollPane {
  readonly #scroller: HTMLElement;
  readonly #lineCount: number;

  constructor(scroller: HTMLElement, lineCount: number) {
    this.#scroller = scroller;
    this.#lineCount = lineCount;
  }

  position(): number {
    return this.#scroller.scrollTop;
  }

  maximumPosition(): number {
    return Math.max(0, this.#scroller.scrollHeight - this.#scroller.clientHeight);
  }

  lineAtTop(): number {
    return PreviewLineMap.measure(this.#scroller, this.#lineCount).lineAt(this.position());
  }

  positionForLine(line: number): number {
    return PreviewLineMap.measure(this.#scroller, this.#lineCount).positionFor(line);
  }

  scrollTo(position: number): void {
    this.#scroller.scrollTop = position;
  }
}
