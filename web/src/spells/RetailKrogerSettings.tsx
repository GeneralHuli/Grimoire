import { useEffect, useState } from "react";

interface KrogerLocation {
  locationId: string;
  name: string;
  address: string;
}

export function RetailKrogerSettings() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string>("");
  const [locationName, setLocationName] = useState<string>("");
  const [zipCode, setZipCode] = useState("");
  const [results, setResults] = useState<KrogerLocation[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    refreshStatus();
    fetch("/api/settings/retail-kroger")
      .then((res) => res.json())
      .then((data: { locationId?: string; locationName?: string }) => {
        setLocationId(data.locationId ?? "");
        setLocationName(data.locationName ?? "");
      })
      .catch(() => {
        /* Store selection just stays blank if this fails — refreshStatus below is the
           one that must never hang, since it gates the whole panel's loading state. */
      });
  }, []);

  function refreshStatus() {
    setStatusError(null);
    fetch("/api/spells/retail-kroger/status")
      .then((res) => res.json())
      .then((data: { connected: boolean }) => setConnected(data.connected))
      .catch(() => setStatusError("Couldn't reach the server to check connection status."));
  }

  async function disconnect() {
    await fetch("/api/spells/retail-kroger/auth/disconnect", { method: "POST" });
    refreshStatus();
  }

  async function searchLocations() {
    if (!zipCode.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/spells/retail-kroger/locations?zipCode=${encodeURIComponent(zipCode.trim())}`);
      const data: { locations: KrogerLocation[] } = await res.json();
      setResults(data.locations);
    } finally {
      setSearching(false);
    }
  }

  async function chooseLocation(location: KrogerLocation) {
    setLocationId(location.locationId);
    setLocationName(`${location.name} — ${location.address}`);
    setResults(null);
    await fetch("/api/settings/retail-kroger", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: location.locationId, locationName: `${location.name} — ${location.address}` }),
    });
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
      <p>Used by the Grocery List Spell's "Send to Fred Meyer" action.</p>

      {connected ? (
        <>
          <p>Status: Connected</p>
          <button className="btn btn-lg" onClick={disconnect}>
            Disconnect Fred Meyer Account
          </button>
        </>
      ) : (
        <>
          <p>Status: Not connected</p>
          {/*
            Kroger's hosted sign-in (MSAL/Azure AD B2C under the hood) behaves
            differently when it sees a Referer pointing back at our app — it hangs
            instead of rendering the sign-in form, but works fine when the same URL is
            opened with no referrer (e.g. typed fresh in a new tab). rel="noreferrer"
            suppresses the Referer header for this navigation and its redirect chain.
          */}
          <a className="btn btn-lg" href="/api/spells/retail-kroger/auth/start" rel="noreferrer">
            Connect Fred Meyer Account
          </a>
        </>
      )}

      <h3>Store</h3>
      {locationId ? <p>Current store: {locationName || locationId}</p> : <p>No store picked yet.</p>}
      <div className="chores-add">
        <input
          className="field"
          placeholder="Zip code"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
          aria-label="Zip code"
        />
        <button type="button" className="btn" onClick={searchLocations} disabled={searching}>
          {searching ? "Searching…" : "Find stores"}
        </button>
      </div>
      {results !== null && results.length === 0 && <p>No Fred Meyer stores found near that zip code.</p>}
      {results !== null && results.length > 0 && (
        <ul className="recipes-list">
          {results.map((location) => (
            <li key={location.locationId}>
              <button type="button" className="recipes-item" onClick={() => chooseLocation(location)}>
                <span className="recipes-item-title">{location.name}</span>
                <span className="recipes-item-meta">{location.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
