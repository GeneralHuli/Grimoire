import { HOME_WIDGET_VARIANTS } from "../spells/homeWidgets/registry";
import { SpellIcon } from "../spells/spellIcons";
import type { SpellManifest } from "../types";

interface WidgetDrawerProps {
  spells: SpellManifest[];
  placedSpellNames: Set<string>;
  onAdd: (spellName: string) => void;
  onClose: () => void;
}

export function WidgetDrawer({ spells, placedSpellNames, onAdd, onClose }: WidgetDrawerProps) {
  const available = spells.filter((s) => HOME_WIDGET_VARIANTS[s.name] && !placedSpellNames.has(s.name));

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="widget-drawer-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add a widget"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-actions">
          <h3 className="modal-actions-title">Add a widget</h3>
          <button className="btn btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          {available.length === 0 ? (
            <p>Every available widget is already on your home screen.</p>
          ) : (
            <ul className="widget-drawer-list">
              {available.map((spell) => (
                <li key={spell.name}>
                  <button type="button" className="widget-drawer-item" onClick={() => onAdd(spell.name)}>
                    <span className="widget-drawer-item-icon">
                      <SpellIcon name={spell.name} displayName={spell.displayName} />
                    </span>
                    <span>{spell.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
