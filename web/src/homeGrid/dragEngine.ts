import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { GRID_COLS, GRID_ROWS } from "./gridConfig";
import { fits, occupiedCells } from "./collision";
import type { PlacedWidget } from "./types";

/**
 * Touch+mouse+pen-unified drag, replacing recipeDrag.ts's HTML5 DnD (which has no
 * reliable touch support -- unsuitable for the kiosk touchscreen this interaction must
 * work on). The dragged card's live position is a CSS transform driven by `dragState`,
 * not a per-frame widgets-array update, so an invalid drop is free: just clear
 * `dragState` and never touch layout state -- the card re-renders at its original grid
 * cell automatically.
 */
export interface DragState {
  spellName: string;
  w: number;
  h: number;
  offsetX: number;
  offsetY: number;
  targetX: number;
  targetY: number;
  valid: boolean;
}

interface UseGridDragOptions {
  containerRef: RefObject<HTMLElement | null>;
  widgets: PlacedWidget[];
  onDrop: (spellName: string, x: number, y: number) => void;
}

export function useGridDrag({ containerRef, widgets, onDrop }: UseGridDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<{
    spellName: string;
    w: number;
    h: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const widgetsRef = useRef(widgets);
  widgetsRef.current = widgets;

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      const container = containerRef.current;
      if (!drag || !container) return;
      const rect = container.getBoundingClientRect();
      const cellW = rect.width / GRID_COLS;
      const cellH = rect.height / GRID_ROWS;
      const offsetX = e.clientX - drag.startClientX;
      const offsetY = e.clientY - drag.startClientY;
      const rawX = drag.startX + offsetX / cellW;
      const rawY = drag.startY + offsetY / cellH;
      const targetX = Math.min(Math.max(Math.round(rawX), 0), GRID_COLS - drag.w);
      const targetY = Math.min(Math.max(Math.round(rawY), 0), GRID_ROWS - drag.h);
      const occupied = occupiedCells(widgetsRef.current, drag.spellName);
      const valid = fits(targetX, targetY, drag.w, drag.h, occupied);
      setDragState({ spellName: drag.spellName, w: drag.w, h: drag.h, offsetX, offsetY, targetX, targetY, valid });
    },
    [containerRef]
  );

  const endDrag = useCallback(() => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    setDragState((current) => {
      if (current && current.valid) onDrop(current.spellName, current.targetX, current.targetY);
      return null;
    });
    dragRef.current = null;
  }, [handlePointerMove, onDrop]);

  const startDrag = useCallback(
    (widget: PlacedWidget, e: ReactPointerEvent) => {
      e.preventDefault();
      dragRef.current = {
        spellName: widget.spellName,
        w: widget.w,
        h: widget.h,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: widget.x,
        startY: widget.y,
      };
      setDragState({
        spellName: widget.spellName,
        w: widget.w,
        h: widget.h,
        offsetX: 0,
        offsetY: 0,
        targetX: widget.x,
        targetY: widget.y,
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
