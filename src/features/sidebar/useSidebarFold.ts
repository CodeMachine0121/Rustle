import type { SettingsSession } from "../settings/SettingsSession";
import { useSettings } from "../settings/useSettings";

export type SidebarFold = {
  isFolded: boolean;
  toggle: () => void;
};

/** Whether the whole sidebar is folded away, kept in the settings so the next start looks the same. */
export function useSidebarFold(settings: SettingsSession): SidebarFold {
  const isFolded = useSettings(settings).sidebar.isFolded === true;
  return {
    isFolded,
    toggle: () =>
      settings.change((current) => ({
        ...current,
        sidebar: { ...current.sidebar, isFolded: current.sidebar.isFolded !== true },
      })),
  };
}
