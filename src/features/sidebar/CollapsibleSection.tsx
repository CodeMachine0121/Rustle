import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, type ReactNode } from "react";

type CollapsibleSectionProps = {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  /** Sits beside the title, outside the fold toggle. */
  action?: ReactNode;
  children: ReactNode;
};

/** A sidebar section whose title folds its content away; folding hides it, nothing else. */
export function CollapsibleSection({ title, isCollapsed, onToggle, action, children }: CollapsibleSectionProps) {
  const contentId = useId();
  const FoldMark = isCollapsed ? ChevronRight : ChevronDown;
  return (
    <section className="sidebar-section" aria-label={title}>
      <div className="sidebar-section-header">
        <h2 className="region-title">
          <button
            type="button"
            className="sidebar-section-toggle"
            aria-expanded={!isCollapsed}
            aria-controls={contentId}
            onClick={onToggle}
          >
            <span>{title}</span>
            <FoldMark className="icon" aria-hidden="true" />
          </button>
        </h2>
        {action}
      </div>
      {!isCollapsed && <div id={contentId}>{children}</div>}
    </section>
  );
}
