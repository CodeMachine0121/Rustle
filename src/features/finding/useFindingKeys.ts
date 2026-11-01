import { useEffect, useRef } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import { finderForKey, type FinderKind } from "./FindingKeys";

/**
 * Answers the finding keys before anything else on the page, the editor
 * included: the key stops here, whatever the editor's own keymap holds.
 */
export function useFindingKeys(onFinderKey: (finder: FinderKind) => void): void {
  const composition = useCompositionState();
  const onFinderKeyRef = useRef(onFinderKey);

  useEffect(() => {
    onFinderKeyRef.current = onFinderKey;
  }, [onFinderKey]);

  useEffect(() => {
    const answer = (event: KeyboardEvent) => {
      const finder = finderForKey(event);
      if (finder === null || composition.ownsKey(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        onFinderKeyRef.current(finder);
      }
    };
    window.addEventListener("keydown", answer, { capture: true });
    return () => window.removeEventListener("keydown", answer, { capture: true });
  }, [composition]);
}
