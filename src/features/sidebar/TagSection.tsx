import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { TagCount } from "./sidebarCounts";
import { SidebarRow } from "./SidebarRow";

type TagSectionProps = {
  tags: readonly TagCount[];
  chosen: readonly string[];
  onToggle: (tag: string) => void;
};

export function TagSection({ tags, chosen, onToggle }: TagSectionProps) {
  const messages = useMessages();
  if (tags.length === 0) {
    return <p className="empty-state">{messages.noTagsYet}</p>;
  }
  return (
    <ul className="column-list">
      {tags.map(({ tag, count }) => (
        <li key={tag} className="column-item">
          <SidebarRow label={tag} count={count} isChosen={chosen.includes(tag)} onClick={() => onToggle(tag)} />
        </li>
      ))}
    </ul>
  );
}
