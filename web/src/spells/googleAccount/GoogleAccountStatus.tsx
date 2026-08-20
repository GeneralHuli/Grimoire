import { useEffect, useState } from "react";

/**
 * Status + connect/disconnect UI for the settings tab (GoogleAccountSettings).
 * google-account is a Ritual — it has no home-page display, only this settings panel.
 */
export function GoogleAccountStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    fetch("/api/spells/google-account/status")
      .then((res) => res.json())
      .then((data: { connected: boolean }) => setConnected(data.connected));
  }

  async function disconnect() {
    await fetch("/api/spells/google-account/auth/disconnect", { method: "POST" });
    refresh();
  }

  if (connected === null) {
    return <p>Checking…</p>;
  }

  return connected ? (
    <>
      <p>Status: Connected</p>
      <button className="btn btn-lg" onClick={disconnect}>
        Disconnect Google Account
      </button>
    </>
  ) : (
    <>
      <p>Status: Not connected</p>
      <a className="btn btn-lg" href="/api/spells/google-account/auth/start">
        Sign in with Google
      </a>
    </>
  );
}
