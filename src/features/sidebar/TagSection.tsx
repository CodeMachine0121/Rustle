import type { TagCount } from "./sidebarCounts";
import { SidebarRow } from "./SidebarRow";

type TagSectionProps = {
  tags: readonly TagCount[];
  chosen: readonly string[];
  onToggle: (tag: string) => void;
};

export function TagSection({ tags, chosen, onToggle }: TagSectionProps) {
  if (tags.length === 0) {
    return <p className="empty-state">還沒有標籤</p>;
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
