import { useEffect, useState } from "react";
import { SettingsModal } from "./components/SettingsModal";
import { SideDock } from "./components/SideDock";
import { SpellDetailView } from "./components/SpellDetailView";
import { SmartHomeDoorbell } from "./components/SmartHomeDoorbell";
import { HomeGrid } from "./homeGrid/HomeGrid";
import { ViewProvider, useView } from "./appState/ViewContext";
import type { SpellManifest } from "./types";

interface AppShellProps {
  spells: SpellManifest[];
  onOpenSettings: () => void;
}

function AppShell({ spells, onOpenSettings }: AppShellProps) {
  const { view } = useView();
  const activeSpell = view.kind === "spell" ? spells.find((s) => s.name === view.name) : undefined;

  return (
    <div className="grimoire-body">
      <SideDock spells={spells} onOpenSettings={onOpenSettings} />
      <div className="grimoire-main">
        {view.kind === "spell" && activeSpell ? <SpellDetailView spell={activeSpell} /> : <HomeGrid spells={spells} />}
      </div>
    </div>
  );
}

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
    <ViewProvider>
      <header className="grimoire-header">
        <h1>Grimoire</h1>
      </header>
      {/*
       * Remounting the whole shell on settings close is the same blunt-but-reliable tool
       * the old per-Spell grid used: it guarantees every widget/detail view re-fetches
       * with whatever setting just changed, without each Spell needing its own
       * "did settings change" wiring.
       */}
      <AppShell key={settingsVersion} spells={spells} onOpenSettings={() => setSettingsOpen(true)} />
      {spells.some((s) => s.name === "smart-home") && <SmartHomeDoorbell />}
      {settingsOpen && (
        <SettingsModal
          spells={spells}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsVersion((v) => v + 1);
          }}
        />
      )}
    </ViewProvider>
  );
}
