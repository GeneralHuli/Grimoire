import { Settings } from "lucide-react";
import { useEffect, useState } from "react";

export function SmartHomeSettings() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    refreshStatus();
  }, []);

  function refreshStatus() {
    setStatusError(null);
    fetch("/api/spells/smart-home/status")
      .then((res) => res.json())
      .then((data: { connected: boolean }) => setConnected(data.connected))
      .catch(() => setStatusError("Couldn't reach the server to check connection status."));
  }

  async function connect() {
    if (!baseUrl.trim() || !accessToken.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/spells/smart-home/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), accessToken: accessToken.trim() }),
      });
      if (!res.ok) {
        const body: { error?: string } = await res.json().catch(() => ({}));
        setConnectError(body.error || "Couldn't connect to Home Assistant.");
        return;
      }
      setAccessToken("");
      refreshStatus();
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    await fetch("/api/spells/smart-home/disconnect", { method: "POST" });
    refreshStatus();
  }

  if (statusError) {
    return (
      <div className="settings-panel">
        <p>{statusError}</p>
        <button className="btn btn-lg" onClick={refreshStatus}>
          Retry
        </button>
      </div>
    );
  }

  if (connected === null) {
    return <p>Checking…</p>;
  }

  return (
    <div className="settings-panel">
      <p>
        Controls lights, switches, thermostats, locks, fans, covers, and cameras through a self-hosted Home
        Assistant instance.
      </p>

      {connected ? (
        <>
          <p>Status: Connected</p>
          <p>
            Choose which controls show on the home dashboard's compact Smart Home widget from the widget itself --
            tap its <Settings size={14} style={{ verticalAlign: -2 }} /> icon.
          </p>
          <button className="btn btn-lg" onClick={disconnect}>
            Disconnect Home Assistant
          </button>
        </>
      ) : (
        <>
          <p>Status: Not connected</p>
          <div className="settings-field">
            <label htmlFor="smart-home-base-url">Home Assistant URL</label>
            <input
              className="field"
              id="smart-home-base-url"
              placeholder="http://homeassistant.local:8123"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div className="settings-field">
            <label htmlFor="smart-home-token">Long-lived access token</label>
            <input
              className="field"
              id="smart-home-token"
              type="password"
              placeholder="Generated from your profile page in Home Assistant"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
          </div>
          {connectError && <p className="calendar-event-error">{connectError}</p>}
          <button
            className="btn btn-lg"
            onClick={connect}
            disabled={connecting || !baseUrl.trim() || !accessToken.trim()}
          >
            {connecting ? "Connecting…" : "Connect"}
          </button>
        </>
      )}
    </div>
  );
}
