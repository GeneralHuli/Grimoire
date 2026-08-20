import { useState } from "react";
import type { SpellManifest } from "../types";
import { GeneralSettingsPanel } from "./GeneralSettingsPanel";
import { SpellSettingsPanel } from "./SpellSettingsPanel";
import { SPELL_SETTINGS_COMPONENTS } from "../spells/settings/registry";

interface SettingsModalProps {
  spells: SpellManifest[];
  onClose: () => void;
}

export function SettingsModal({ spells, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState("general");

  const tabs = [
    { id: "general", label: "General" },
    ...spells.map((s) => ({ id: s.name, label: s.displayName })),
  ];

  const activeSpell = spells.find((s) => s.name === activeTab);
  const CustomPanel = activeSpell ? SPELL_SETTINGS_COMPONENTS[activeSpell.name] : undefined;
  const activeLabel = tabs.find((t) => t.id === activeTab)?.label ?? "Settings";

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="settings-panel-wrapper">
          <div className="modal-actions">
            <h3 className="modal-actions-title">{activeLabel}</h3>
            <button className="btn btn-icon" onClick={onClose} aria-label="Close settings">
              ×
            </button>
          </div>
          <div className="settings-content">
            {activeTab === "general" ? (
              <GeneralSettingsPanel />
            ) : CustomPanel ? (
              <CustomPanel />
            ) : (
              <SpellSettingsPanel scope={activeTab} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
