import type { ComponentType } from "react";
import { HelloSpell } from "./HelloSpell";
import { CalendarSpell } from "./CalendarSpell";
import { GoogleAccountSpell } from "./GoogleAccountSpell";

/**
 * Maps a Spell's manifest `frontend` field to the component that renders it.
 * Adding a Spell means adding one entry here + the backend spell.json/index.ts —
 * the grid layout in App.tsx never changes.
 */
export const SPELL_COMPONENTS: Record<string, ComponentType> = {
  "hello-spell": HelloSpell,
  calendar: CalendarSpell,
  "google-account": GoogleAccountSpell,
};
