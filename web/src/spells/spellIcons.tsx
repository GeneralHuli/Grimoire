import {
  BookOpen,
  CalendarDays,
  CloudSun,
  HousePlug,
  ListChecks,
  Mic,
  ShoppingCart,
  UtensilsCrossed,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * Icon component per Spell manifest name, used by the side dock and widget drawer. A
 * Spell absent from this map still works -- SpellIcon falls back to the first letter of
 * its displayName -- so a new Spell doesn't require a mandatory registration step here.
 */
const SPELL_ICONS: Record<string, ComponentType<LucideProps>> = {
  calendar: CalendarDays,
  chores: ListChecks,
  recipes: BookOpen,
  "meal-plan": UtensilsCrossed,
  "grocery-list": ShoppingCart,
  "voice-commands": Mic,
  "smart-home": HousePlug,
  weather: CloudSun,
};

export function SpellIcon({
  name,
  displayName,
  ...props
}: { name: string; displayName: string } & LucideProps) {
  const Icon = SPELL_ICONS[name];
  if (Icon) return <Icon {...props} />;
  return <span className="spell-icon-fallback">{displayName.charAt(0).toUpperCase()}</span>;
}
