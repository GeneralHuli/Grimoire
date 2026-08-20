import type { PlacedWidget } from "./types";

/**
 * First-run arrangement inside the 6×4 grid (see gridConfig.ts) -- weather + calendar
 * large and prominent up top, everything else smaller below. Applied whenever
 * GET /api/settings/layout comes back empty, and persisted back once so the household's
 * first edit has a concrete starting point rather than re-deriving this every load.
 */
export const DEFAULT_LAYOUT: PlacedWidget[] = [
  { spellName: "weather", widgetId: "large", x: 0, y: 0, w: 3, h: 2 },
  { spellName: "calendar", widgetId: "mini-month", x: 3, y: 0, w: 3, h: 2 },
  { spellName: "meal-plan", widgetId: "tonight", x: 0, y: 2, w: 2, h: 1 },
  { spellName: "grocery-list", widgetId: "count", x: 2, y: 2, w: 2, h: 1 },
  { spellName: "smart-home", widgetId: "summary", x: 4, y: 2, w: 2, h: 1 },
  { spellName: "chores", widgetId: "progress", x: 0, y: 3, w: 1, h: 1 },
  { spellName: "recipes", widgetId: "spotlight", x: 1, y: 3, w: 1, h: 1 },
  { spellName: "voice-commands", widgetId: "shortcut", x: 2, y: 3, w: 1, h: 1 },
];
