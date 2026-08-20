import { useEffect, useState } from "react";

interface GeocodeResult {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

type Units = "us" | "metric";

export function WeatherSettings() {
  const [locationName, setLocationName] = useState("");
  const [units, setUnits] = useState<Units>("us");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings/weather")
      .then((res) => res.json())
      .then((data: { locationName?: string; units?: Units }) => {
        setLocationName(data.locationName ?? "");
        setUnits(data.units ?? "us");
        setLoaded(true);
      });
  }, []);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/spells/weather/geocode?q=${encodeURIComponent(query.trim())}`);
      const data: { results: GeocodeResult[] } = await res.json();
      setResults(data.results);
    } finally {
      setSearching(false);
    }
  }

  async function chooseLocation(result: GeocodeResult) {
    const name = [result.name, result.admin1, result.country].filter(Boolean).join(", ");
    setLocationName(name);
    setResults(null);
    await fetch("/api/settings/weather", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: result.latitude, longitude: result.longitude, locationName: name, units }),
    });
  }

  async function changeUnits(next: Units) {
    setUnits(next);
    await fetch("/api/settings/weather", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ units: next }),
    });
  }

  if (!loaded) return <p>Loading…</p>;

  return (
    <div className="settings-panel">
      <h3>Location</h3>
      {locationName ? <p>Current location: {locationName}</p> : <p>No location set yet.</p>}
      <div className="chores-add">
        <input
          className="field"
          placeholder="City or zip code"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Location search"
        />
        <button type="button" className="btn" onClick={search} disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </button>
      </div>
      {results !== null && results.length === 0 && <p>No matching locations found.</p>}
      {results !== null && results.length > 0 && (
        <ul className="recipes-list">
          {results.map((result) => (
            <li key={result.id}>
              <button type="button" className="recipes-item" onClick={() => chooseLocation(result)}>
                <span className="recipes-item-title">{result.name}</span>
                <span className="recipes-item-meta">{[result.admin1, result.country].filter(Boolean).join(", ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="settings-field">
        Units
        <select className="field" value={units} onChange={(e) => changeUnits(e.target.value as Units)}>
          <option value="us">Fahrenheit (US)</option>
          <option value="metric">Celsius (Metric)</option>
        </select>
      </label>
    </div>
  );
}
