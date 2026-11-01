import { createContext, useContext, useState, type ReactNode } from "react";

import { CompositionState } from "./CompositionState";

const CompositionContext = createContext<CompositionState | null>(null);

type CompositionProviderProps = {
  children: ReactNode;
  state?: CompositionState;
};

export function CompositionProvider({ children, state }: CompositionProviderProps) {
  const [ownState] = useState(() => new CompositionState());
  return (
    <CompositionContext.Provider value={state ?? ownState}>{children}</CompositionContext.Provider>
  );
}

export function useCompositionState(): CompositionState {
  const state = useContext(CompositionContext);
  if (state === null) {
    throw new Error("useCompositionState needs a CompositionProvider above it");
  }
  return state;
}
