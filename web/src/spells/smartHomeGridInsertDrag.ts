import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { SMART_HOME_GRID_COLS, SMART_HOME_GRID_ROWS, fits, occupiedCells } from "./smartHomeGrid";
import type { PlacedControl } from "./smartHomeGridDrag";

/** Dragging a not-yet-placed control in from the drawer, as opposed to
 * `smartHomeGridDrag.ts` which repositions a control already on the grid -- this one
 * has no starting grid cell, so the target has to be hit-tested against the grid
 * container's own rect on every move rather than tracked as a relative offset. */
export interface InsertDragState {
  entityId: string;
  w: number;
  h: number;
  clientX: number;
  clientY: number;
  /** null while the pointer isn't over the grid at all. */
  targetX: number | null;
  targetY: number | null;
  valid: boolean;
}

interface UseSmartHomeGridInsertDragOptions {
  gridRef: RefObject<HTMLElement | null>;
  cellSize: number;
  items: PlacedControl[];
  onDrop: (entityId: string, x: number, y: number) => void;
}

export function useSmartHomeGridInsertDrag({ gridRef, cellSize, items, onDrop }: UseSmartHomeGridInsertDragOptions) {
  const [dragState, setDragState] = useState<InsertDragState | null>(null);
  const dragRef = useRef<{ entityId: string; w: number; h: number } | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      const grid = gridRef.current;
      if (!drag) return;
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) {
        setDragState({ entityId: drag.entityId, w: drag.w, h: drag.h, clientX: e.clientX, clientY: e.clientY, targetX: null, targetY: null, valid: false });
        return;
      }
      const rawX = (e.clientX - rect.left) / cellSize - drag.w / 2;
      const rawY = (e.clientY - rect.top) / cellSize - drag.h / 2;
      const targetX = Math.min(Math.max(Math.round(rawX), 0), SMART_HOME_GRID_COLS - drag.w);
      const targetY = Math.min(Math.max(Math.round(rawY), 0), SMART_HOME_GRID_ROWS - drag.h);
      const occupied = occupiedCells(itemsRef.current);
      const valid = fits(targetX, targetY, drag.w, drag.h, occupied);
      setDragState({ entityId: drag.entityId, w: drag.w, h: drag.h, clientX: e.clientX, clientY: e.clientY, targetX, targetY, valid });
    },
    [gridRef, cellSize]
  );

  const endDrag = useCallback(() => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    setDragState((current) => {
      if (current && current.valid && current.targetX !== null && current.targetY !== null) {
        onDrop(current.entityId, current.targetX, current.targetY);
      }
      return null;
    });
    dragRef.current = null;
  }, [handlePointerMove, onDrop]);

  const startDrag = useCallback(
    (control: { entityId: string; w: number; h: number }, e: ReactPointerEvent) => {
      e.preventDefault();
      dragRef.current = control;
      setDragState({ entityId: control.entityId, w: control.w, h: control.h, clientX: e.clientX, clientY: e.clientY, targetX: null, targetY: null, valid: false });
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    },
    [handlePointerMove, endDrag]
  );

  return { dragState, startDrag };
}
