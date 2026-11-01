export type CompositionListener = (isComposing: boolean) => void;

// WebKit reports the key that confirms a candidate with this code, sometimes
// after the composition has already ended.
const INPUT_METHOD_KEY_CODE = 229;

/** Whether an input method is composing text right now, shared app-wide. */
export class CompositionState {
  #isComposing = false;
  readonly #listeners = new Set<CompositionListener>();

  get isComposing(): boolean {
    return this.#isComposing;
  }

  /** Whether this key press belongs to the input method rather than to the app. */
  ownsKey(event: Pick<KeyboardEvent, "isComposing" | "keyCode">): boolean {
    return this.#isComposing || event.isComposing || event.keyCode === INPUT_METHOD_KEY_CODE;
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
