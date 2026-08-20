import { useView } from "../appState/ViewContext";
import { useTheme } from "../appState/ThemeContext";
import { spellIcon } from "../spells/spellIcons";
import type { SpellManifest } from "../types";

interface SideDockProps {
  spells: SpellManifest[];
  onOpenSettings: () => void;
}

export function SideDock({ spells, onOpenSettings }: SideDockProps) {
  const { view, goHome, openSpell } = useView();
  const { resolved, setChoice } = useTheme();

  const dockable = spells.filter((s) => s.frontend);

  return (
    <nav className="grimoire-dock" aria-label="Spell navigation">
      <button
        className={`btn btn-icon btn-icon-lg${view.kind === "home" ? " active" : ""}`}
        onClick={goHome}
        aria-label="Home"
        title="Home"
      >
        🏡
      </button>
      <div className="grimoire-dock-spells">
        {dockable.map((spell) => (
          <button
            key={spell.name}
            className={`btn btn-icon btn-icon-lg${
              view.kind === "spell" && view.name === spell.name ? " active" : ""
            }`}
            onClick={() => openSpell(spell.name)}
            aria-label={spell.displayName}
            title={spell.displayName}
          >
            {spellIcon(spell.name, spell.displayName)}
          </button>
        ))}
      </div>
      <div className="grimoire-dock-footer">
        <button
          className="btn btn-icon btn-icon-lg"
          onClick={() => setChoice(resolved === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {resolved === "dark" ? "🌙" : "☀️"}
        </button>
        <button className="btn btn-icon btn-icon-lg" onClick={onOpenSettings} aria-label="Open settings" title="Settings">
          ⚙
        </button>
      </div>
    </nav>
  );
}
