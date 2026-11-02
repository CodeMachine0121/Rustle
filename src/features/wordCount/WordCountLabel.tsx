import { useSyncExternalStore } from "react";

import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { LiveWordCount } from "./LiveWordCount";

type WordCountLabelProps = {
  wordCount: LiveWordCount;
};

/** How many words the open article holds; nothing while no article is open. */
export function WordCountLabel({ wordCount }: WordCountLabelProps) {
  const messages = useMessages();
  const count = useSyncExternalStore(wordCount.subscribe, () => wordCount.count);
  if (count === null) {
    return null;
  }
  return <span className="word-count">{messages.wordCount(count)}</span>;
}
