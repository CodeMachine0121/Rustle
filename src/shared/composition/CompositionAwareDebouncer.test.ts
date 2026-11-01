import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompositionAwareDebouncer } from "./CompositionAwareDebouncer";
import { CompositionState } from "./CompositionState";

describe("CompositionAwareDebouncer", () => {
  let composition: CompositionState;
  let debouncer: CompositionAwareDebouncer;
  const task = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    task.mockReset();
    composition = new CompositionState();
    debouncer = new CompositionAwareDebouncer(composition, 1000);
  });

  afterEach(() => {
    debouncer.dispose();
    vi.useRealTimers();
  });

  it("runs the task once the delay has passed", () => {
    debouncer.schedule(task);
    vi.advanceTimersByTime(1000);

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("restarts the countdown when scheduled again and runs only once", () => {
    debouncer.schedule(task);
    vi.advanceTimersByTime(900);
    debouncer.schedule(task);
    vi.advanceTimersByTime(900);

    expect(task).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("runs only the latest scheduled task", () => {
    const earlierTask = vi.fn();
    debouncer.schedule(earlierTask);
    debouncer.schedule(task);
    vi.advanceTimersByTime(1000);

    expect(earlierTask).not.toHaveBeenCalled();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("pauses the countdown while composing", () => {
    debouncer.schedule(task);
    vi.advanceTimersByTime(400);
    composition.start();
    vi.advanceTimersByTime(10000);

    expect(task).not.toHaveBeenCalled();
  });

  it("finishes the remaining time after the composition ends", () => {
    debouncer.schedule(task);
    vi.advanceTimersByTime(400);
    composition.start();
    vi.advanceTimersByTime(10000);
    composition.end();
    vi.advanceTimersByTime(599);

    expect(task).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("starts counting a task scheduled during composition only after it ends", () => {
    composition.start();
    debouncer.schedule(task);
    vi.advanceTimersByTime(10000);

    expect(task).not.toHaveBeenCalled();

    composition.end();
    vi.advanceTimersByTime(999);
    expect(task).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("runs nothing when a composition ends with nothing scheduled", () => {
    composition.end();
    vi.advanceTimersByTime(10000);

    expect(task).not.toHaveBeenCalled();
  });

  it("runs nothing after being cancelled", () => {
    debouncer.schedule(task);
    debouncer.cancel();
    vi.advanceTimersByTime(10000);

    expect(task).not.toHaveBeenCalled();
  });

  it("runs nothing after a cancel during composition", () => {
    debouncer.schedule(task);
    composition.start();
    debouncer.cancel();
    composition.end();
    vi.advanceTimersByTime(10000);

    expect(task).not.toHaveBeenCalled();
  });

  it("does not run twice after it has already run", () => {
    debouncer.schedule(task);
    vi.advanceTimersByTime(1000);
    composition.start();
    composition.end();
    vi.advanceTimersByTime(10000);

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("stops listening to composition once disposed", () => {
    debouncer.schedule(task);
    debouncer.dispose();
    composition.start();
    composition.end();
    vi.advanceTimersByTime(10000);

    expect(task).not.toHaveBeenCalled();
  });
});
