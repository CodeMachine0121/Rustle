export type CompositionListener = (isComposing: boolean) => void;

/** Whether an input method is composing text right now, shared app-wide. */
export class CompositionState {
  #isComposing = false;
  readonly #listeners = new Set<CompositionListener>();

  get isComposing(): boolean {
    return this.#isComposing;
  }

  start(): void {
    this.#change(true);
  }

  end(): void {
    this.#change(false);
  }

  subscribe(listener: CompositionListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #change(isComposing: boolean): void {
    if (this.#isComposing === isComposing) {
      return;
    }
    this.#isComposing = isComposing;
    this.#listeners.forEach((listener) => listener(isComposing));
  }
}
