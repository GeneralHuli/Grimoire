import { useEffect, useState } from "react";
import { useTheme } from "../appState/ThemeContext";

interface GeneralSettings {
  familyName?: string;
}

export function GeneralSettingsPanel() {
  const { choice, setChoice } = useTheme();
  const [settings, setSettings] = useState<GeneralSettings>({});
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/general")
      .then((res) => res.json())
      .then((data: GeneralSettings) => {
        setSettings(data);
        setLoaded(true);
      });
  }, []);

  function update<K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    await fetch("/api/settings/general", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
  }

  if (!loaded) return <p>Loading…</p>;

  return (
    <div className="settings-panel">
      <div className="settings-panel-actions">
        <button className="btn btn-lg" onClick={save}>
          {saved ? "Saved" : "Save"}
        </button>
      </div>
      <label className="settings-field">
        Family name
        <input
          type="text"
          className="field"
          value={settings.familyName ?? ""}
          onChange={(e) => update("familyName", e.target.value)}
        />
      </label>
      <label className="settings-field">
        Theme
        <select className="field" value={choice} onChange={(e) => setChoice(e.target.value as typeof choice)}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
      </label>
    </div>
  );
}
