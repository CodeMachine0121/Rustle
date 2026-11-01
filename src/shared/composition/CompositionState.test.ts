import { describe, expect, it } from "vitest";

import { CompositionState } from "./CompositionState";

describe("CompositionState", () => {
  it("is not composing to begin with", () => {
    expect(new CompositionState().isComposing).toBe(false);
  });

  it.each([
    ["while composing", true, { isComposing: false, keyCode: 13 }, true],
    ["the event says it is composing", false, { isComposing: true, keyCode: 13 }, true],
    ["the input method key code", false, { isComposing: false, keyCode: 229 }, true],
    ["an ordinary key outside a composition", false, { isComposing: false, keyCode: 13 }, false],
  ])("decides whether a key belongs to the input method: %s", (_case, composing, event, owned) => {
    const state = new CompositionState();
    if (composing) {
      state.start();
    }

    expect(state.ownsKey(event)).toBe(owned);
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
