import { GRID_COLS, GRID_ROWS } from "./gridConfig";
import type { PlacedWidget } from "./types";

/** Set of "x,y" cell keys occupied by every widget except `excludeSpellName` (the one being dragged/resized). */
export function occupiedCells(widgets: PlacedWidget[], excludeSpellName?: string): Set<string> {
  const cells = new Set<string>();
  for (const widget of widgets) {
    if (widget.spellName === excludeSpellName) continue;
    for (let dx = 0; dx < widget.w; dx++) {
      for (let dy = 0; dy < widget.h; dy++) {
        cells.add(`${widget.x + dx},${widget.y + dy}`);
      }
    }
  }
  return cells;
}

export function fits(x: number, y: number, w: number, h: number, occupied: Set<string>): boolean {
  if (x < 0 || y < 0 || x + w > GRID_COLS || y + h > GRID_ROWS) return false;
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      if (occupied.has(`${x + dx},${y + dy}`)) return false;
    }
  }
  return true;
}

/** Row-major scan for the first free slot big enough for a w×h widget, or null if the grid is full. */
export function firstFreeSlot(w: number, h: number, occupied: Set<string>): { x: number; y: number } | null {
  for (let y = 0; y <= GRID_ROWS - h; y++) {
    for (let x = 0; x <= GRID_COLS - w; x++) {
      if (fits(x, y, w, h, occupied)) return { x, y };
    }
  }
  return null;
}
