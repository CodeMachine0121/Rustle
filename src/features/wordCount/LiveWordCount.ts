import type { AutosaveSession } from "../autosave/AutosaveSession";
import type { CompositionState } from "../../shared/composition/CompositionState";
import { WordCount } from "./WordCount";

export type WordCountSource = Pick<AutosaveSession, "subscribe" | "document" | "body">;

/**
 * The word count of the open article as the writer types. While an input
 * method is composing, the count stays where it was and catches up once the
 * candidate is chosen; a newly opened article is counted at once.
 */
export class LiveWordCount {
  readonly #source: WordCountSource;
  readonly #composition: CompositionState;
  readonly #listeners = new Set<() => void>();
  readonly #stopFollowing: () => void;
  #documentVersion: number;
  #countedBody: string | null;
  #count: number | null;

  constructor(source: WordCountSource, composition: CompositionState) {
    this.#source = source;
    this.#composition = composition;
    this.#documentVersion = source.document.version;
    this.#countedBody = source.body;
    this.#count = this.#countNow();
    const stopFollowingSource = source.subscribe(() => this.#follow());
    const stopFollowingComposition = composition.subscribe((isComposing) => {
      if (!isComposing) {
        this.#recount();
      }
    });
    this.#stopFollowing = () => {
      stopFollowingSource();
      stopFollowingComposition();
    };
  }

  /** `null` while no article is open. */
  get count(): number | null {
    return this.#count;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  dispose(): void {
    this.#stopFollowing();
    this.#listeners.clear();
  }

  #follow(): void {
    const { version } = this.#source.document;
    const isAnotherArticle = version !== this.#documentVersion;
    this.#documentVersion = version;
    if (isAnotherArticle || !this.#composition.isComposing) {
      this.#recount();
    }
  }

  #recount(): void {
    if (this.#source.body === this.#countedBody) {
      return;
    }
    this.#countedBody = this.#source.body;
    const count = this.#countNow();
    if (count === this.#count) {
      return;
    }
    this.#count = count;
    this.#listeners.forEach((listener) => listener());
  }

  #countNow(): number | null {
    const body = this.#source.body;
    return body === null ? null : WordCount.of(body).value;
  }
}
