import { SPELL_COMPONENTS } from "../spells/registry";
import { SpellErrorBoundary } from "./SpellErrorBoundary";
import { useView } from "../appState/ViewContext";
import type { SpellManifest } from "../types";

interface SpellDetailViewProps {
  spell: SpellManifest;
}

export function SpellDetailView({ spell }: SpellDetailViewProps) {
  const { goHome } = useView();
  const SpellComponent = spell.frontend ? SPELL_COMPONENTS[spell.frontend] : undefined;

  return (
    <div className="spell-detail-view">
      <div className="modal-actions spell-detail-header">
        <button className="btn btn-icon" onClick={goHome} aria-label="Back to home">
          ←
        </button>
        <h2 className="modal-actions-title">{spell.displayName}</h2>
      </div>
      <div className="spell-detail-body">
        {SpellComponent ? (
          <SpellErrorBoundary name={spell.displayName}>
            <SpellComponent />
          </SpellErrorBoundary>
        ) : (
          <p>This Spell has no frontend view.</p>
        )}
      </div>
    </div>
  );
}
