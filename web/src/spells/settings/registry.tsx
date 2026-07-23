import type { ComponentType } from "react";
import { CalendarSettings } from "../CalendarSettings";

/**
 * Maps a Spell's manifest `frontend` field to a custom settings panel. Spells not
 * listed here fall back to the generic key/value editor (SpellSettingsPanel).
 */
export const SPELL_SETTINGS_COMPONENTS: Record<string, ComponentType> = {
  calendar: CalendarSettings,
};
