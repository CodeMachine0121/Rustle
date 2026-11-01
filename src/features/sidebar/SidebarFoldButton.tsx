import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { IconButton } from "../../shared/icons/IconButton";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { SidebarFold } from "./useSidebarFold";

/** Folds the sidebar away and brings it back; it lives beside the sidebar, so it stays on screen either way. */
export function SidebarFoldButton({ fold }: { fold: SidebarFold }) {
  const messages = useMessages();
  return (
    <IconButton
      className="sidebar-fold-button"
      label={fold.isFolded ? messages.showSidebar : messages.hideSidebar}
      icon={fold.isFolded ? PanelLeftOpen : PanelLeftClose}
      aria-expanded={!fold.isFolded}
      onClick={fold.toggle}
    />
  );
}
