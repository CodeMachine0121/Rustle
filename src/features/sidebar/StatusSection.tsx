import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { StatusCount } from "./sidebarCounts";
import { SidebarRow } from "./SidebarRow";
import { StatusDot } from "./StatusDot";
import type { StatusChoice } from "./statusChoice";

type StatusSectionProps = {
  statuses: readonly StatusCount[];
  chosen: StatusChoice | null;
  onToggle: (choice: StatusChoice) => void;
};

export function StatusSection({ statuses, chosen, onToggle }: StatusSectionProps) {
  const messages = useMessages();
  return (
    <ul className="column-list">
      {statuses.map(({ choice, count }) => (
        <li key={choice} className="column-item">
          <SidebarRow
            label={messages.statusLabels[choice]}
            leading={<StatusDot choice={choice} />}
            count={count}
            isChosen={choice === chosen}
            onClick={() => onToggle(choice)}
          />
        </li>
      ))}
    </ul>
  );
}
