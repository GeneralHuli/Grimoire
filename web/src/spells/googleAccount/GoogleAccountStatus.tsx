import { useEffect, useState } from "react";

/**
 * Shared status + connect/disconnect UI, used by both the dashboard card
 * (GoogleAccountSpell) and the settings tab (GoogleAccountSettings) so there's one
 * place that knows how to talk to the google-account Spell's API.
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
      <button className="settings-save" onClick={disconnect}>
        Disconnect Google Account
      </button>
    </>
  ) : (
    <>
      <p>Status: Not connected</p>
      <a className="calendar-connect" href="/api/spells/google-account/auth/start">
        Sign in with Google
      </a>
    </>
  );
}
