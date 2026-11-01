import type { SidebarSection } from "../../ipc/settings";
import type { SettingsSession } from "../settings/SettingsSession";
import { useSettings } from "../settings/useSettings";

export type CollapsedSections = {
  isCollapsed: (section: SidebarSection) => boolean;
  toggle: (section: SidebarSection) => void;
};

/** Which sidebar sections are folded, kept in the settings so the next start looks the same. */
export function useCollapsedSections(settings: SettingsSession): CollapsedSections {
  const { collapsedSections } = useSettings(settings).sidebar;
  return {
    isCollapsed: (section) => collapsedSections.includes(section),
    toggle: (section) =>
      settings.change((current) => {
        const collapsed = current.sidebar.collapsedSections;
        return {
          ...current,
          sidebar: {
            collapsedSections: collapsed.includes(section)
              ? collapsed.filter((folded) => folded !== section)
              : [...collapsed, section],
          },
        };
      }),
  };
}
