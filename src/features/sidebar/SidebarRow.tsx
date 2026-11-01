type SidebarRowProps = {
  label: string;
  count: number;
  isChosen: boolean;
  onClick: () => void;
};

export function SidebarRow({ label, count, isChosen, onClick }: SidebarRowProps) {
  return (
    <button type="button" className="column-row" aria-pressed={isChosen} onClick={onClick}>
      <span className="row-title">{label}</span>
      <span className="row-count">{count}</span>
    </button>
  );
}
