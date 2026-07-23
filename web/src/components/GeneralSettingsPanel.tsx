import { useEffect, useState } from "react";

interface GeneralSettings {
  familyName?: string;
  theme?: "system" | "light" | "dark";
}

export function GeneralSettingsPanel() {
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
      <h3>General</h3>
      <label className="settings-field">
        Family name
        <input
          type="text"
          value={settings.familyName ?? ""}
          onChange={(e) => update("familyName", e.target.value)}
        />
      </label>
      <label className="settings-field">
        Theme
        <select
          value={settings.theme ?? "system"}
          onChange={(e) => update("theme", e.target.value as GeneralSettings["theme"])}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <button className="settings-save" onClick={save}>
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
