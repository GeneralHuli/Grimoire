import type { ComponentType } from "react";
import { CalendarSpell } from "./CalendarSpell";
import { ChoresSpell } from "./ChoresSpell";

/**
 * Maps a Spell's manifest `frontend` field to the component that renders it.
 * Adding a Spell means adding one entry here + the backend spell.json/index.ts —
 * the grid layout in App.tsx never changes. Rituals have no `frontend` field and
 * so never appear here.
 */
export const SPELL_COMPONENTS: Record<string, ComponentType> = {
  calendar: CalendarSpell,
  chores: ChoresSpell,
};
