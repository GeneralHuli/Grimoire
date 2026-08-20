import type { ComponentType } from "react";
import { WeatherSmallGlance, WeatherLargeGlance } from "../WeatherGlance";
import { CalendarAgendaGlance, CalendarMiniMonthGlance, CalendarMonthDayGlance } from "../CalendarGlance";
import { ChoresProgressGlance, ChoresBoardGlance } from "../ChoresGlance";
import { RecipesSpotlightGlance, RecipesBoxGlance } from "../RecipesGlance";
import { MealPlanTonightGlance, MealPlanWeekGlance } from "../MealPlanGlance";
import { GroceryListCountGlance, GroceryListChecklistGlance } from "../GroceryListGlance";
import { VoiceCommandShortcutGlance } from "../VoiceCommandGlance";
import { SmartHomeSummaryGlance, SmartHomeBoardGlance } from "../SmartHomeGlance";

export interface HomeWidgetVariant {
  id: string;
  label: string;
  cols: number;
  rows: number;
  component: ComponentType;
}

/**
 * Maps a Spell's manifest `name` to the glance-widget size variants it offers on the
 * home dashboard grid -- mirrors SPELL_COMPONENTS/SPELL_SETTINGS_COMPONENTS. A Spell
 * absent from this map simply can't be placed on the home grid (it's still reachable
 * via the side dock's full-screen view). The first entry in each list is that Spell's
 * default size when newly added from the widget drawer.
 */
export const HOME_WIDGET_VARIANTS: Record<string, HomeWidgetVariant[]> = {
  weather: [
    { id: "small", label: "Small", cols: 1, rows: 1, component: WeatherSmallGlance },
    { id: "large", label: "Large", cols: 2, rows: 2, component: WeatherLargeGlance },
  ],
  calendar: [
    { id: "agenda", label: "Agenda", cols: 2, rows: 1, component: CalendarAgendaGlance },
    { id: "mini-month", label: "Month", cols: 3, rows: 2, component: CalendarMiniMonthGlance },
    { id: "month-day", label: "Month + Day", cols: 4, rows: 2, component: CalendarMonthDayGlance },
  ],
  chores: [
    { id: "progress", label: "Progress", cols: 1, rows: 1, component: ChoresProgressGlance },
    { id: "board", label: "Board", cols: 2, rows: 2, component: ChoresBoardGlance },
  ],
  recipes: [
    { id: "spotlight", label: "Spotlight", cols: 1, rows: 1, component: RecipesSpotlightGlance },
    { id: "box", label: "Box", cols: 2, rows: 2, component: RecipesBoxGlance },
  ],
  "meal-plan": [
    { id: "tonight", label: "Tonight", cols: 2, rows: 1, component: MealPlanTonightGlance },
    { id: "week", label: "Week", cols: 3, rows: 2, component: MealPlanWeekGlance },
  ],
  "grocery-list": [
    { id: "count", label: "Count", cols: 1, rows: 1, component: GroceryListCountGlance },
    { id: "checklist", label: "Checklist", cols: 2, rows: 2, component: GroceryListChecklistGlance },
  ],
  "voice-commands": [{ id: "shortcut", label: "Shortcut", cols: 1, rows: 1, component: VoiceCommandShortcutGlance }],
  "smart-home": [
    { id: "summary", label: "Summary", cols: 2, rows: 1, component: SmartHomeSummaryGlance },
    { id: "board", label: "Board", cols: 2, rows: 2, component: SmartHomeBoardGlance },
  ],
};
