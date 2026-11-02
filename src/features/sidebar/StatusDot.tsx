import type { StatusChoice } from "./statusChoice";

type StatusDotProps = {
  choice: StatusChoice;
  /** Read out when nothing beside the dot names the status. */
  label?: string;
};

/** A status in its own colour; an article without a status has no dot. */
export function StatusDot({ choice, label }: StatusDotProps) {
  if (choice === "noStatus") {
    return null;
  }
  const className = `status-dot status-dot--${choice}`;
  if (label === undefined) {
    return <span className={className} aria-hidden="true" />;
  }
  return <span className={className} role="img" aria-label={label} />;
}
