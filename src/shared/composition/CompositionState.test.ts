import { describe, expect, it } from "vitest";

import { CompositionState } from "./CompositionState";

describe("CompositionState", () => {
  it("is not composing to begin with", () => {
    expect(new CompositionState().isComposing).toBe(false);
  });

  it("reflects a composition starting and ending", () => {
    const state = new CompositionState();

    state.start();
    expect(state.isComposing).toBe(true);

    state.end();
    expect(state.isComposing).toBe(false);
  });

  it("notifies subscribers of the start and the end in order", () => {
    const state = new CompositionState();
    const notifications: boolean[] = [];
    state.subscribe((isComposing) => notifications.push(isComposing));

    state.start();
    state.end();

    expect(notifications).toEqual([true, false]);
  });

  it("does not notify an end that was never started", () => {
    const state = new CompositionState();
    const notifications: boolean[] = [];
    state.subscribe((isComposing) => notifications.push(isComposing));

    state.end();

    expect(notifications).toEqual([]);
  });

  it("stops notifying after unsubscribing", () => {
    const state = new CompositionState();
    const notifications: boolean[] = [];
    const unsubscribe = state.subscribe((isComposing) => notifications.push(isComposing));

    unsubscribe();
    state.start();

    expect(notifications).toEqual([]);
  });
});
