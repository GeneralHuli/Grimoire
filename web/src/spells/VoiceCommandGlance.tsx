/**
 * Nav-shortcut only, not inline mic capture -- VoiceCommandSpell.tsx has no capture hook
 * exposed to reuse without editing it, and there's no other meaningfully glanceable
 * state for a command-input Spell. Tapping the card (handled by WidgetCard, not here)
 * navigates to the full Spell.
 */
export function VoiceCommandShortcutGlance() {
  return (
    <div className="voice-command-glance">
      <span className="voice-command-glance-icon">🎙️</span>
      <span>Voice Commands</span>
    </div>
  );
}
