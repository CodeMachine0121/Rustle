import { Search } from "lucide-react";

import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { FinderRequests } from "./FinderRequests";
import { FINDING_SHORTCUTS } from "./FindingKeys";

const TITLE_FINDER_KEYS = FINDING_SHORTCUTS.find(({ finder }) => finder === "title")?.keys ?? "";

type SearchButtonProps = {
  requests: FinderRequests;
  /** Finding articles needs a workspace or All Notes, as the key does. */
  isAvailable: boolean;
};

/** Finding an article by its title without knowing the key, which it shows. */
export function SearchButton({ requests, isAvailable }: SearchButtonProps) {
  const messages = useMessages();
  return (
    <button
      type="button"
      className="search-button"
      aria-keyshortcuts={TITLE_FINDER_KEYS.replace("Cmd", "Meta")}
      disabled={!isAvailable}
      onClick={() => requests.request("title")}
    >
      <Search className="icon" aria-hidden="true" />
      <span className="search-button__label">{messages.search}</span>
      <kbd className="search-button__key">{TITLE_FINDER_KEYS.replace("Cmd+", "⌘")}</kbd>
    </button>
  );
}
