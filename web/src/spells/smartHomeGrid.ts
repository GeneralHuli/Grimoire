import type { SmartHomeDevice } from "./smartHomeActions";
import { fanSupportsSpeed, coverSupportsPosition } from "./smartHomeAttributes";

/** The compact view's own small grid, independent of the home dashboard's outer grid --
 * sized for a widget card, not the full page, so it gets its own coordinate system and
 * responsive cell size (measured from the widget's own container, see
 * SmartHomeGlance.tsx) rather than reusing web/src/homeGrid/gridConfig.ts. 8 wide x 4
 * tall so the whole thing fits in a widget card without needing to scroll. */
export const SMART_HOME_GRID_COLS = 8;
export const SMART_HOME_GRID_ROWS = 4;

export interface SmartHomeGridPlacement {
  entityId: string;
  x: number;
  y: number;
}

/** Domains the compact view's drawer will offer -- cameras aren't placeable here, same
 * reasoning as SmartHomeDeviceTile.tsx (a live feed doesn't belong in a small tile). */
export const PICKABLE_DOMAINS = new Set(["climate", "light", "switch", "lock", "fan", "cover"]);

/** Slider-style controls (brightness/speed/position) read tall and narrow; the
 * thermostat dial reads roughly square and needs the extra width; everything else
 * (switches, the lock button, the cover open/stop/close trio) is compact. */
export function controlGridSize(device: SmartHomeDevice): { w: number; h: number } {
  if (device.domain === "climate") return { w: 2, h: 2 };
  if (device.domain === "light") return { w: 1, h: 2 };
  if (device.domain === "fan" && fanSupportsSpeed(device.attributes)) return { w: 1, h: 2 };
  if (device.domain === "cover" && coverSupportsPosition(device.attributes)) return { w: 1, h: 2 };
  return { w: 1, h: 1 };
}

interface GridRect {
  entityId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function occupiedCells(items: GridRect[], excludeEntityId?: string): Set<string> {
  const cells = new Set<string>();
  for (const item of items) {
    if (item.entityId === excludeEntityId) continue;
    for (let dx = 0; dx < item.w; dx++) {
      for (let dy = 0; dy < item.h; dy++) {
        cells.add(`${item.x + dx},${item.y + dy}`);
      }
    }
  }
  return cells;
}

export function fits(x: number, y: number, w: number, h: number, occupied: Set<string>): boolean {
  if (x < 0 || y < 0 || x + w > SMART_HOME_GRID_COLS || y + h > SMART_HOME_GRID_ROWS) return false;
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      if (occupied.has(`${x + dx},${y + dy}`)) return false;
    }
  }
  return true;
}

export function firstFreeSlot(w: number, h: number, occupied: Set<string>): { x: number; y: number } | null {
  for (let y = 0; y <= SMART_HOME_GRID_ROWS - h; y++) {
    for (let x = 0; x <= SMART_HOME_GRID_COLS - w; x++) {
      if (fits(x, y, w, h, occupied)) return { x, y };
    }
  }
  return null;
}
