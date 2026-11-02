import type { ReactNode } from "react";

type WritingToolbarProps = {
  /** On the left: where the writer is. */
  breadcrumb?: ReactNode;
  viewModeButtons: ReactNode;
  zenButton: ReactNode;
};

/** The strip across the top of the writing sheet, in the same place whatever the view mode. */
export function WritingToolbar({ breadcrumb, viewModeButtons, zenButton }: WritingToolbarProps) {
  return (
    <div className="writing-toolbar">
      <div className="writing-toolbar__breadcrumb">{breadcrumb}</div>
      {viewModeButtons}
      {zenButton}
    </div>
  );
}
