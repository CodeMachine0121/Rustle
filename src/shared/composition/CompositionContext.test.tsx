import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider, useCompositionState } from "./CompositionContext";
import { CompositionState } from "./CompositionState";

describe("useCompositionState", () => {
  it("returns the state given to the provider", () => {
    const state = new CompositionState();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CompositionProvider state={state}>{children}</CompositionProvider>
    );

    const { result } = renderHook(() => useCompositionState(), { wrapper });

    expect(result.current).toBe(state);
  });

  it("gives every consumer under one provider the same state", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CompositionProvider>{children}</CompositionProvider>
    );

    const { result } = renderHook(() => [useCompositionState(), useCompositionState()], {
      wrapper,
    });

    expect(result.current[0]).toBe(result.current[1]);
  });

  it("refuses to work without a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderHook(() => useCompositionState())).toThrow(/CompositionProvider/);
  });
});
