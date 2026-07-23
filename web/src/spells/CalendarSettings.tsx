import { useEffect, useState } from "react";

interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
}

interface CalendarSettingsValues {
  calendarId?: string;
  defaultView?: "day" | "week";
}

export function CalendarSettings() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [settings, setSettings] = useState<CalendarSettingsValues>({});
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/spells/google-account/status")
      .then((res) => res.json())
      .then((data: { connected: boolean }) => setConnected(data.connected));
  }, []);

  useEffect(() => {
    if (!connected) return;
    Promise.all([
      fetch("/api/spells/calendar/calendars").then((res) => res.json()),
      fetch("/api/settings/calendar").then((res) => res.json()),
    ]).then(([calendarsData, settingsData]: [{ calendars: GoogleCalendar[] }, CalendarSettingsValues]) => {
      setCalendars(calendarsData.calendars);
      setSettings(settingsData);
      setLoaded(true);
    });
  }, [connected]);

  function update<K extends keyof CalendarSettingsValues>(key: K, value: CalendarSettingsValues[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    await fetch("/api/settings/calendar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
  }

  if (connected === null) {
    return <p>Checking…</p>;
  }

  if (!connected) {
    return <p>Sign in with Google (see the Google Account tab) to choose a calendar.</p>;
  }

  if (!loaded) {
    return <p>Loading…</p>;
  }

  return (
    <div className="settings-panel">
      <h3>Family Calendar</h3>
      <label className="settings-field">
        Calendar to display
        <select
          value={settings.calendarId ?? "primary"}
          onChange={(e) => update("calendarId", e.target.value)}
        >
          {calendars.map((cal) => (
            <option key={cal.id} value={cal.id}>
              {cal.summary}
              {cal.primary ? " (primary)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        Default view
        <select
          value={settings.defaultView ?? "week"}
          onChange={(e) => update("defaultView", e.target.value as CalendarSettingsValues["defaultView"])}
        >
          <option value="day">Day</option>
          <option value="week">Week</option>
        </select>
      </label>
      <button className="settings-save" onClick={save}>
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
