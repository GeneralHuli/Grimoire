import { useEffect, useState } from "react";
import { SPELL_COMPONENTS } from "./spells/registry";
import { SettingsModal } from "./components/SettingsModal";
import type { SpellManifest } from "./types";

export function App() {
  const [spells, setSpells] = useState<SpellManifest[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          const Component = SPELL_COMPONENTS[spell.frontend];
          if (!Component) return null;
          return <Component key={spell.name} />;
        })}
      </main>
      {settingsOpen && (
        <SettingsModal spells={spells} onClose={() => setSettingsOpen(false)} />
      )}
    </>
  );
}
