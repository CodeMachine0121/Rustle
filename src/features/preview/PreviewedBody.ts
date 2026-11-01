import type { AutosaveSession } from "../autosave/AutosaveSession";
import { CompositionAwareDebouncer } from "../../shared/composition/CompositionAwareDebouncer";
import type { CompositionState } from "../../shared/composition/CompositionState";

export const PREVIEW_DELAY_MILLISECONDS = 150;

export type PreviewSource = Pick<AutosaveSession, "subscribe" | "document" | "body">;

/**
 * The body the preview shows. A newly opened (or closed) article shows at
 * once and drops any update still pending for the previous one; typing
 * shows 150 ms after it stops, and never while composing.
 */
export class PreviewedBody {
  readonly #source: PreviewSource;
  readonly #debouncer: CompositionAwareDebouncer;
  readonly #listeners = new Set<() => void>();
  readonly #stopFollowing: () => void;
  #documentVersion: number;
  #latestBody: string | null;
  #body: string | null;

  constructor(
    source: PreviewSource,
    composition: CompositionState,
    delayMilliseconds = PREVIEW_DELAY_MILLISECONDS,
  ) {
    this.#source = source;
    this.#debouncer = new CompositionAwareDebouncer(composition, delayMilliseconds);
    this.#documentVersion = source.document.version;
    this.#latestBody = source.body;
    this.#body = source.body;
    this.#stopFollowing = source.subscribe(() => this.#follow());
  }

  /** `null` while no article is open. */
  get body(): string | null {
    return this.#body;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  dispose(): void {
    this.#stopFollowing();
    this.#debouncer.dispose();
    this.#listeners.clear();
  }

  #follow(): void {
    const body = this.#source.body;
    const { version } = this.#source.document;
    if (version !== this.#documentVersion) {
      this.#documentVersion = version;
      this.#latestBody = body;
      this.#debouncer.cancel();
      this.#show(body);
      return;
    }
    if (body === this.#latestBody) {
      return;
    }
    this.#latestBody = body;
    this.#debouncer.schedule(() => this.#show(body));
  }

  #show(body: string | null): void {
    this.#body = body;
    this.#listeners.forEach((listener) => listener());
  }
}
