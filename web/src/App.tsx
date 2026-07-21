import { useEffect, useState } from "react";
import { SPELL_COMPONENTS } from "./spells/registry";

interface SpellManifest {
  name: string;
  displayName: string;
  version: string;
  frontend: string;
  config?: Record<string, unknown>;
}

export function App() {
  const [spells, setSpells] = useState<SpellManifest[]>([]);

  useEffect(() => {
    fetch("/api/spells")
      .then((res) => res.json())
      .then(setSpells);
  }, []);

  return (
    <main className="grimoire-grid">
      {spells.map((spell) => {
        const Component = SPELL_COMPONENTS[spell.frontend];
        if (!Component) return null;
        return <Component key={spell.name} />;
      })}
    </main>
  );
}
