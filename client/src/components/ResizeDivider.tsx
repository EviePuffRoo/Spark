import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLocalStorage } from "../useLocalStorage";

// Persists a column width in px, keyed by storageKey, clamped to [min, max].
// Drag position is tracked in local state/ref while the pointer is down and
// only written to localStorage on pointer-up — useLocalStorage writes to
// disk on every set, so committing on every pointermove would thrash it.
//
// `sign` accounts for which side of the divider the resizable column sits
// on: 1 (default) for a column to the divider's left, where dragging right
// grows it (e.g. CombatPage's tools column); -1 for a column to the
// divider's right, where dragging left grows it instead (e.g. the tracker
// rail, which sits right of its divider with the map region to the left).
export function useResizableColumn(storageKey: string, defaultWidth: number, min: number, max: number, sign: 1 | -1 = 1) {
  const [committedWidth, setCommittedWidth] = useLocalStorage(storageKey, defaultWidth);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { startX: e.clientX, startWidth: committedWidth };
    setDragWidth(committedWidth);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    if (!start) return;
    const next = Math.min(max, Math.max(min, start.startWidth + sign * (e.clientX - start.startX)));
    setDragWidth(next);
  }

  function onPointerUp() {
    if (dragWidth !== null) setCommittedWidth(dragWidth);
    dragStartRef.current = null;
    setDragWidth(null);
  }

  return {
    width: dragWidth ?? committedWidth,
    dividerProps: { onPointerDown, onPointerMove, onPointerUp },
  };
}

export function ResizeDivider({
  onPointerDown, onPointerMove, onPointerUp, ariaLabel,
}: {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="resize-divider"
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}
