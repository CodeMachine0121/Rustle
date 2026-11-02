import type { FinderKind } from "./FindingKeys";

/** Opening a finder from something on screen, the same way its key opens it. */
export class FinderRequests {
  readonly #listeners = new Set<(finder: FinderKind) => void>();

  request(finder: FinderKind): void {
    this.#listeners.forEach((listener) => listener(finder));
  }

  subscribe(listener: (finder: FinderKind) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
