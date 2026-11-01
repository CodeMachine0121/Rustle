import { useId, type ReactNode } from "react";

type CollapsibleSectionProps = {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** A sidebar section whose title folds its content away; folding hides it, nothing else. */
export function CollapsibleSection({ title, isCollapsed, onToggle, children }: CollapsibleSectionProps) {
  const contentId = useId();
  return (
    <section className="sidebar-section" aria-label={title}>
      <h2 className="region-title">
        <button
          type="button"
          className="sidebar-section-toggle"
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          onClick={onToggle}
        >
          <span>{title}</span>
          <span aria-hidden="true">{isCollapsed ? "▸" : "▾"}</span>
        </button>
      </h2>
      {!isCollapsed && <div id={contentId}>{children}</div>}
    </section>
  );
}
