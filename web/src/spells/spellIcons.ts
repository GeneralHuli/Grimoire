/**
 * Emoji icon per Spell manifest name, used by the side dock and widget drawer. A Spell
 * absent from this map still works -- falls back to the first letter of its
 * displayName -- so a new Spell doesn't require a mandatory registration step here.
 */
const SPELL_ICONS: Record<string, string> = {
  calendar: "📅",
  chores: "✅",
  recipes: "📖",
  "meal-plan": "🍽️",
  "grocery-list": "🛒",
  "voice-commands": "🎙️",
  "smart-home": "🏠",
  weather: "⛅",
};

export function spellIcon(name: string, displayName: string): string {
  return SPELL_ICONS[name] ?? displayName.charAt(0).toUpperCase();
}
