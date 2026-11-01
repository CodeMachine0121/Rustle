import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";

/** What the editor and the preview both say while no article is open. */
export function NoArticleState() {
  const messages = useMessages();
  return <p className="empty-state">{messages.noArticleOpen}</p>;
}
