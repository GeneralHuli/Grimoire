import { useEffect, useState } from "react";

interface GoogleTaskList {
  id: string;
  title: string;
}

export function ChoresSettings() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [tasklists, setTasklists] = useState<GoogleTaskList[]>([]);
  const [listIds, setListIds] = useState<string[]>([]);
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
      fetch("/api/spells/chores/tasklists").then((res) => res.json()),
      fetch("/api/settings/chores").then((res) => res.json()),
    ]).then(([tasklistsData, settingsData]: [{ tasklists: GoogleTaskList[] }, { listIds?: string[] }]) => {
      setTasklists(tasklistsData.tasklists);
      setListIds(settingsData.listIds ?? []);
      setLoaded(true);
    });
  }, [connected]);

  function toggle(id: string, checked: boolean) {
    setListIds((prev) => (checked ? [...prev, id] : prev.filter((existing) => existing !== id)));
    setSaved(false);
  }

  async function save() {
    await fetch("/api/settings/chores", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listIds }),
    });
    setSaved(true);
  }

  if (connected === null) {
    return <p>Checking…</p>;
  }

  if (!connected) {
    return <p>Sign in with Google (see the Google Account tab) to choose task lists.</p>;
  }

  if (!loaded) {
    return <p>Loading…</p>;
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel-actions">
        <button className="btn btn-lg" onClick={save}>
          {saved ? "Saved" : "Save"}
        </button>
      </div>
      <p>Choose which Google Task lists to show as boards — e.g. one per family member.</p>
      {tasklists.map((list) => (
        <label className="settings-field settings-field-inline" key={list.id}>
          <input
            type="checkbox"
            checked={listIds.includes(list.id)}
            onChange={(e) => toggle(list.id, e.target.checked)}
          />
          {list.title}
        </label>
      ))}
    </div>
  );
}
