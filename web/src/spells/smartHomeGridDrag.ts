import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { SMART_HOME_GRID_COLS, SMART_HOME_GRID_ROWS, fits, occupiedCells } from "./smartHomeGrid";

/** Placed-in-the-compact-view shape the drag math and collision checks operate on. */
export interface PlacedControl {
  entityId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SmartHomeDragState {
  entityId: string;
  w: number;
  h: number;
  offsetX: number;
  offsetY: number;
  targetX: number;
  targetY: number;
  valid: boolean;
}

interface UseSmartHomeGridDragOptions {
  /** Fixed pixel size of one square grid cell -- unlike the home dashboard's outer grid
   * (which measures its container and divides by column/row count), this grid's cells
   * are a fixed size set in CSS, so the drag math can work off that directly instead of
   * measuring a container that may be scroll-clipped. */
  cellSize: number;
  items: PlacedControl[];
  onDrop: (entityId: string, x: number, y: number) => void;
}

export function useSmartHomeGridDrag({ cellSize, items, onDrop }: UseSmartHomeGridDragOptions) {
  const [dragState, setDragState] = useState<SmartHomeDragState | null>(null);
  const dragRef = useRef<{
    entityId: string;
    w: number;
    h: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const offsetX = e.clientX - drag.startClientX;
      const offsetY = e.clientY - drag.startClientY;
      const rawX = drag.startX + offsetX / cellSize;
      const rawY = drag.startY + offsetY / cellSize;
      const targetX = Math.min(Math.max(Math.round(rawX), 0), SMART_HOME_GRID_COLS - drag.w);
      const targetY = Math.min(Math.max(Math.round(rawY), 0), SMART_HOME_GRID_ROWS - drag.h);
      const occupied = occupiedCells(itemsRef.current, drag.entityId);
      const valid = fits(targetX, targetY, drag.w, drag.h, occupied);
      setDragState({ entityId: drag.entityId, w: drag.w, h: drag.h, offsetX, offsetY, targetX, targetY, valid });
    },
    [cellSize]
  );

  const endDrag = useCallback(() => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    setDragState((current) => {
      if (current && current.valid) onDrop(current.entityId, current.targetX, current.targetY);
      return null;
    });
    dragRef.current = null;
  }, [handlePointerMove, onDrop]);

  const startDrag = useCallback(
    (control: PlacedControl, e: ReactPointerEvent) => {
      e.preventDefault();
      dragRef.current = {
        entityId: control.entityId,
        w: control.w,
        h: control.h,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: control.x,
        startY: control.y,
      };
      setDragState({
        entityId: control.entityId,
        w: control.w,
        h: control.h,
        offsetX: 0,
        offsetY: 0,
        targetX: control.x,
        targetY: control.y,
        valid: true,
      });
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    },
    [handlePointerMove, endDrag]
  );

  return { dragState, startDrag };
}
