import type { StatusCount } from "./sidebarCounts";
import { SidebarRow } from "./SidebarRow";
import type { StatusChoice } from "./statusChoice";

type StatusSectionProps = {
  statuses: readonly StatusCount[];
  chosen: StatusChoice | null;
  onToggle: (choice: StatusChoice) => void;
};

export function StatusSection({ statuses, chosen, onToggle }: StatusSectionProps) {
  return (
    <ul className="column-list">
      {statuses.map(({ choice, label, count }) => (
        <li key={choice} className="column-item">
          <SidebarRow label={label} count={count} isChosen={choice === chosen} onClick={() => onToggle(choice)} />
        </li>
      ))}
    </ul>
  );
}
