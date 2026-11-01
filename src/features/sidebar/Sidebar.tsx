import { useMemo, type ReactNode } from "react";

import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { SettingsSession } from "../settings/SettingsSession";
import type { VaultSnapshot } from "../vault/VaultSession";
import { CollapsibleSection } from "./CollapsibleSection";
import { sidebarCounts } from "./sidebarCounts";
import { StatusSection } from "./StatusSection";
import type { StatusChoice } from "./statusChoice";
import { TagSection } from "./TagSection";
import { useCollapsedSections } from "./useCollapsedSections";

type SidebarProps = {
  snapshot: VaultSnapshot;
  settings: SettingsSession;
  workspaces: ReactNode;
  /** Beside the WORKSPACES title: what creates a workspace. */
  workspacesAction?: ReactNode;
  onSelectAllNotes: () => void;
  onToggleStatus: (choice: StatusChoice) => void;
  onToggleTag: (tag: string) => void;
};

/**
 * All Notes above three foldable sections: the workspaces, then the status
 * and tag counts of the scope's articles, whose rows narrow the article list.
 */
export function Sidebar({
  snapshot,
  settings,
  workspaces,
  workspacesAction,
  onSelectAllNotes,
  onToggleStatus,
  onToggleTag,
}: SidebarProps) {
  const messages = useMessages();
  const sections = useCollapsedSections(settings);
  const counts = useMemo(() => sidebarCounts(snapshot.articles), [snapshot.articles]);
  const { sidebarFilter } = snapshot;
  return (
    <>
      <button
        type="button"
        className="column-row all-notes-row"
        aria-pressed={snapshot.showsAllNotes}
        onClick={onSelectAllNotes}
      >
        <span className="row-title">{messages.allNotes}</span>
      </button>
      <CollapsibleSection
        title={messages.workspacesTitle}
        isCollapsed={sections.isCollapsed("workspaces")}
        onToggle={() => sections.toggle("workspaces")}
        action={workspacesAction}
      >
        {workspaces}
      </CollapsibleSection>
      <CollapsibleSection
        title={messages.statusTitle}
        isCollapsed={sections.isCollapsed("status")}
        onToggle={() => sections.toggle("status")}
      >
        <StatusSection statuses={counts.statuses} chosen={sidebarFilter.status} onToggle={onToggleStatus} />
      </CollapsibleSection>
      <CollapsibleSection
        title={messages.tagsTitle}
        isCollapsed={sections.isCollapsed("tags")}
        onToggle={() => sections.toggle("tags")}
      >
        <TagSection tags={counts.tags} chosen={sidebarFilter.tags} onToggle={onToggleTag} />
      </CollapsibleSection>
    </>
  );
}
