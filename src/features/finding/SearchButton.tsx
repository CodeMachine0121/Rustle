import { Search } from "lucide-react";

import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { FinderRequests } from "./FinderRequests";

const TITLE_FINDER_KEY = "⌘T";
const TITLE_FINDER_KEY_FOR_ASSISTIVE_TECHNOLOGY = "Meta+T";

type SearchButtonProps = {
  requests: FinderRequests;
};

/** Finding an article by its title without knowing the key, which it shows. */
export function SearchButton({ requests }: SearchButtonProps) {
  const messages = useMessages();
  return (
    <button
      type="button"
      className="search-button"
      aria-keyshortcuts={TITLE_FINDER_KEY_FOR_ASSISTIVE_TECHNOLOGY}
      onClick={() => requests.request("title")}
    >
      <Search className="icon" aria-hidden="true" />
      <span className="search-button__label">{messages.search}</span>
      <kbd className="search-button__key">{TITLE_FINDER_KEY}</kbd>
    </button>
  );
}
