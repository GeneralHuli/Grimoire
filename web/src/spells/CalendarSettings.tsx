import { useEffect, useState } from "react";
import { SpellSettingsPanel } from "../components/SpellSettingsPanel";

export function CalendarSettings() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    refreshStatus();
  }, []);

  function refreshStatus() {
    fetch("/api/spells/calendar/status")
      .then((res) => res.json())
      .then((data: { connected: boolean }) => setConnected(data.connected));
  }

  async function disconnect() {
    await fetch("/api/spells/calendar/auth/disconnect", { method: "POST" });
    refreshStatus();
  }

  return (
    <div className="settings-panel">
      <h3>Family Calendar</h3>
      <p>
        Status: {connected === null ? "Checking…" : connected ? "Connected" : "Not connected"}
      </p>
      {connected ? (
        <button className="settings-save" onClick={disconnect}>
          Disconnect Google Calendar
        </button>
      ) : (
        <a className="calendar-connect" href="/api/spells/calendar/auth/start">
          Connect Google Calendar
        </a>
      )}
      <hr />
      <SpellSettingsPanel scope="calendar" />
    </div>
  );
}
