import type { ReactNode } from "react";

type SidebarRowProps = {
  label: string;
  /** Before the label: what kind of row it is at a glance. */
  leading?: ReactNode;
  count: number;
  isChosen: boolean;
  onClick: () => void;
};

export function SidebarRow({ label, leading, count, isChosen, onClick }: SidebarRowProps) {
  return (
    <button type="button" className="column-row" aria-pressed={isChosen} onClick={onClick}>
      {leading}
      <span className="row-title">{label}</span>
      <span className="row-count">{count}</span>
    </button>
  );
}
