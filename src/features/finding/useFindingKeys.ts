import { useEffect, useRef } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import type { FinderRequests } from "./FinderRequests";
import { finderForKey, type FinderKind } from "./FindingKeys";

/**
 * Answers the finding keys before anything else on the page, the editor
 * included: the key stops here, whatever the editor's own keymap holds.
 * A request from something on screen is answered the same way.
 */
export function useFindingKeys(onFinderKey: (finder: FinderKind) => void, requests?: FinderRequests): void {
  const composition = useCompositionState();
  const onFinderKeyRef = useRef(onFinderKey);

  useEffect(() => {
    onFinderKeyRef.current = onFinderKey;
  }, [onFinderKey]);

  useEffect(() => requests?.subscribe((finder) => onFinderKeyRef.current(finder)), [requests]);

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
