import { useSyncExternalStore } from "react";

import type { VaultSession, VaultSnapshot } from "./VaultSession";

export function useVaultSnapshot(session: VaultSession): VaultSnapshot {
  return useSyncExternalStore(session.subscribe, () => session.snapshot);
}
