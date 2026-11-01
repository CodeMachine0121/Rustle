import type { CompositionState } from "./CompositionState";

type Task = () => void;

/**
 * Runs the latest scheduled task once `delayMilliseconds` have passed
 * without composing. Composition pauses the countdown; ending it resumes
 * with the time that was left.
 */
export class CompositionAwareDebouncer {
  readonly #composition: CompositionState;
  readonly #delayMilliseconds: number;
  readonly #unsubscribe: () => void;
  #pendingTask: Task | undefined;
  #remainingMilliseconds = 0;
  #deadline = 0;
  #timeoutId: ReturnType<typeof setTimeout> | undefined;

  constructor(composition: CompositionState, delayMilliseconds: number) {
    this.#composition = composition;
    this.#delayMilliseconds = delayMilliseconds;
    this.#unsubscribe = composition.subscribe((isComposing) =>
      isComposing ? this.#pause() : this.#resume(),
    );
  }

  schedule(task: Task): void {
    this.#stopCountdown();
    this.#pendingTask = task;
    this.#remainingMilliseconds = this.#delayMilliseconds;
    this.#resume();
  }

  cancel(): void {
    this.#stopCountdown();
    this.#pendingTask = undefined;
  }

  dispose(): void {
    this.cancel();
    this.#unsubscribe();
  }

  #pause(): void {
    if (this.#timeoutId === undefined) {
      return;
    }
    this.#remainingMilliseconds = Math.max(0, this.#deadline - Date.now());
    this.#stopCountdown();
  }

  #resume(): void {
    if (this.#pendingTask === undefined || this.#composition.isComposing) {
      return;
    }
    this.#deadline = Date.now() + this.#remainingMilliseconds;
    this.#timeoutId = setTimeout(() => this.#run(), this.#remainingMilliseconds);
  }

  #run(): void {
    const task = this.#pendingTask;
    this.#timeoutId = undefined;
    this.#pendingTask = undefined;
    task?.();
  }

  #stopCountdown(): void {
    clearTimeout(this.#timeoutId);
    this.#timeoutId = undefined;
  }
}
