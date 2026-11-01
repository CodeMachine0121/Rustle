import { useEffect, useSyncExternalStore } from "react";

import type { EditingSurfaceFontSizes, EditingSurfaceFontSizesSnapshot } from "./EditingSurfaceFontSizes";

/** The two font sizes, with the zoom gestures and Cmd/Ctrl+0 listened to while mounted. */
export function useEditingSurfaceFontSizes(fontSizes: EditingSurfaceFontSizes): EditingSurfaceFontSizesSnapshot {
  useEffect(() => fontSizes.attach(window), [fontSizes]);
  return useSyncExternalStore(fontSizes.subscribe, () => fontSizes.snapshot);
}
