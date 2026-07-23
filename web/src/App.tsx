import { useEffect, useState } from "react";
import { SPELL_COMPONENTS } from "./spells/registry";
import { SettingsModal } from "./components/SettingsModal";
import type { SpellManifest } from "./types";

export function App() {
  const [spells, setSpells] = useState<SpellManifest[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);

  useEffect(() => {
    fetch("/api/spells")
      .then((res) => res.json())
      .then(setSpells);
  }, []);

  return (
    <>
      <header className="grimoire-header">
        <h1>Grimoire</h1>
        <button
          className="settings-open"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
        >
          ⚙
        </button>
      </header>
      <main className="grimoire-grid">
        {spells.map((spell) => {
          const Component = spell.frontend ? SPELL_COMPONENTS[spell.frontend] : undefined;
          if (!Component) return null;
          // Remounting on settings close is a blunt tool, but it guarantees every
          // widget re-fetches with whatever just changed (e.g. Calendar's selected
          // calendarId) without each Spell needing its own "did settings change" wiring.
          return <Component key={`${spell.name}-${settingsVersion}`} />;
        })}
      </main>
      {settingsOpen && (
        <SettingsModal
          spells={spells}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
