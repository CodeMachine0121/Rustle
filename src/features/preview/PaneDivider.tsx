import { useRef, type KeyboardEvent, type PointerEvent } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import { PreviewWidth } from "./PreviewWidth";

type Drag = { pointerId: number; startX: number; areaWidth: number; startWidth: PreviewWidth };

type PaneDividerProps = {
  width: PreviewWidth;
  /** While dragging: the screen follows, nothing is written. */
  onResize: (width: PreviewWidth) => void;
  /** Once per release or key press: the width to remember. */
  onResizeEnd: (width: PreviewWidth) => void;
};

const ARROW_STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

/** The draggable line between the editor and the preview, measured against its parent. */
export function PaneDivider({ width, onResize, onResizeEnd }: PaneDividerProps) {
  const composition = useCompositionState();
  const dragRef = useRef<Drag | null>(null);

  const widthAt = (event: PointerEvent<HTMLDivElement>): PreviewWidth | null => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) {
      return null;
    }
    return drag.startWidth.draggedBy(event.clientX - drag.startX, drag.areaWidth);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      areaWidth: event.currentTarget.parentElement?.getBoundingClientRect().width ?? 0,
      startWidth: width,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const next = widthAt(event);
    if (next !== null) {
      onResize(next);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const next = widthAt(event);
    if (next !== null) {
      dragRef.current = null;
      onResizeEnd(next);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps = ARROW_STEPS[event.key];
    if (steps === undefined || composition.ownsKey(event.nativeEvent)) {
      return;
    }
    event.preventDefault();
    onResizeEnd(width.steppedBy(steps));
  };

  return (
    <div
      className="pane-divider"
      role="separator"
      aria-orientation="vertical"
      aria-label="調整預覽寬度"
      aria-valuenow={width.percent}
      aria-valuemin={PreviewWidth.of(0).percent}
      aria-valuemax={PreviewWidth.of(1).percent}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    />
  );
}
