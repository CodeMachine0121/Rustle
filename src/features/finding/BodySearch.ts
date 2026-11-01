import type { ArticleLocation } from "../../ipc/articleSummary";
import type { BodySearchRequest, BodySearchResult } from "../../ipc/bodySearch";
import type { ChannelResult } from "../../ipc/channelResult";
import { CompositionAwareDebouncer } from "../../shared/composition/CompositionAwareDebouncer";
import type { CompositionState } from "../../shared/composition/CompositionState";
import type { FindingText } from "./FindingText";

/** The same pause the article filter waits for after typing stops. */
export const BODY_SEARCH_DELAY_MILLISECONDS = 150;

export type BodySearchState =
  | { kind: "waitingForText" }
  | { kind: "found"; result: BodySearchResult }
  | { kind: "failed" };

export type SearchBodies = (request: BodySearchRequest) => Promise<ChannelResult<BodySearchResult>>;

/**
 * Searches the saved bodies for the latest text once typing (and any
 * composition) has paused. The previous answer stays until the next one
 * arrives, and an answer to an older text is dropped.
 */
export class BodySearch {
  readonly #searchBodies: SearchBodies;
  readonly #debouncer: CompositionAwareDebouncer;
  readonly #listeners = new Set<() => void>();
  #state: BodySearchState = { kind: "waitingForText" };
  #latestSearch = 0;

  constructor(
    composition: CompositionState,
    searchBodies: SearchBodies,
    delayMilliseconds = BODY_SEARCH_DELAY_MILLISECONDS,
  ) {
    this.#searchBodies = searchBodies;
    this.#debouncer = new CompositionAwareDebouncer(composition, delayMilliseconds);
  }

  get state(): BodySearchState {
    return this.#state;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** Searches `articles`, in their order, for `text`; blank text clears the answer at once. */
  search(text: FindingText, articles: readonly ArticleLocation[]): void {
    const search = ++this.#latestSearch;
    if (text.isBlank) {
      this.#debouncer.cancel();
      this.#change({ kind: "waitingForText" });
      return;
    }
    const request = {
      text: text.searched,
      articles: articles.map(({ workspace, fileName }) => ({ workspace, fileName })),
    };
    this.#debouncer.schedule(() => void this.#run(request, search));
  }

  dispose(): void {
    this.#debouncer.dispose();
    this.#listeners.clear();
  }

  async #run(request: BodySearchRequest, search: number): Promise<void> {
    const result = await this.#searchBodies(request);
    if (search !== this.#latestSearch) {
      return;
    }
    this.#change(result.ok ? { kind: "found", result: result.payload } : { kind: "failed" });
  }

  #change(state: BodySearchState): void {
    this.#state = state;
    this.#listeners.forEach((listener) => listener());
  }
}
