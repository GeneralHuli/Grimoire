import type { ComponentType } from "react";
import { GoogleAccountSettings } from "../GoogleAccountSettings";
import { CalendarSettings } from "../CalendarSettings";
import { ChoresSettings } from "../ChoresSettings";
import { RetailKrogerSettings } from "../RetailKrogerSettings";
import { SmartHomeSettings } from "../SmartHomeSettings";
import { WeatherSettings } from "../WeatherSettings";

/**
 * Maps a Spell's manifest `name` to a custom settings panel. Spells not
 * listed here fall back to the generic key/value editor (SpellSettingsPanel).
 */
export const SPELL_SETTINGS_COMPONENTS: Record<string, ComponentType> = {
  "google-account": GoogleAccountSettings,
  calendar: CalendarSettings,
  chores: ChoresSettings,
  "retail-kroger": RetailKrogerSettings,
  "smart-home": SmartHomeSettings,
  weather: WeatherSettings,
};
