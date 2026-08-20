import { useEffect, useState } from "react";

type SettingValue = string | number | boolean;

interface SpellSettingsPanelProps {
  scope: string;
}

/**
 * Generic fallback settings editor: renders one field per key already present in the
 * Spell's merged settings (manifest config defaults + saved overrides), typed off the
 * current value. A Spell can opt out of this by registering a custom component in
 * spells/settings/registry.tsx instead (see CalendarSettings for an example).
 */
export function SpellSettingsPanel({ scope }: SpellSettingsPanelProps) {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoaded(false);
    fetch(`/api/settings/${scope}`)
      .then((res) => res.json())
      .then((data: Record<string, SettingValue>) => {
        setSettings(data);
        setLoaded(true);
      });
  }, [scope]);

  function update(key: string, value: SettingValue) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    await fetch(`/api/settings/${scope}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
  }

  if (!loaded) return <p>Loading…</p>;

  const keys = Object.keys(settings);
  if (keys.length === 0) {
    return <p>No settings for this Spell yet.</p>;
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel-actions">
        <button className="btn btn-lg" onClick={save}>
          {saved ? "Saved" : "Save"}
        </button>
      </div>
      {keys.map((key) => (
        <label className="settings-field" key={key}>
          {key}
          <SettingInput value={settings[key]} onChange={(value) => update(key, value)} />
        </label>
      ))}
    </div>
  );
}

function SettingInput({
  value,
  onChange,
}: {
  value: SettingValue;
  onChange: (value: SettingValue) => void;
}) {
  if (typeof value === "boolean") {
    return <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />;
  }
  if (typeof value === "number") {
    return (
      <input type="number" className="field" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    );
  }
  return <input type="text" className="field" value={value} onChange={(e) => onChange(e.target.value)} />;
}
