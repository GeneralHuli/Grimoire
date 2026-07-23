import { useEffect, useState } from "react";

interface ChoreTask {
  id: string;
  title: string;
  status: "needsAction" | "completed";
}

interface ChoreList {
  id: string;
  title: string;
  tasks: ChoreTask[];
}

export function ChoresSpell() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [board, setBoard] = useState<ChoreList[] | null>(null);
  const [newTaskTitles, setNewTaskTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    // Chores requires the google-account Spell (see spell.json) and has no
    // connection state of its own — it just checks the shared account status.
    fetch("/api/spells/google-account/status")
      .then((res) => res.json())
      .then((data: { connected: boolean }) => setConnected(data.connected));
  }, []);

  useEffect(() => {
    if (!connected) return;
    fetch("/api/spells/chores/board")
      .then((res) => res.json())
      .then((data: { board: ChoreList[] }) => setBoard(data.board));
  }, [connected]);

  async function toggleTask(listId: string, task: ChoreTask) {
    const nextStatus: ChoreTask["status"] = task.status === "completed" ? "needsAction" : "completed";
    setBoard((prev) =>
      prev?.map((list) =>
        list.id === listId
          ? { ...list, tasks: list.tasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)) }
          : list
      ) ?? prev
    );
    await fetch(`/api/spells/chores/tasks/${listId}/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  async function addTask(listId: string) {
    const title = (newTaskTitles[listId] ?? "").trim();
    if (!title) return;
    const res = await fetch("/api/spells/chores/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId, title }),
    });
    const created: ChoreTask = await res.json();
    setBoard((prev) =>
      prev?.map((list) => (list.id === listId ? { ...list, tasks: [...list.tasks, created] } : list)) ?? prev
    );
    setNewTaskTitles((prev) => ({ ...prev, [listId]: "" }));
  }

  if (connected === null || board === null) {
    return (
      <div className="spell-card">
        <h2>Chores</h2>
        <p>Loading…</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="spell-card">
        <h2>Chores</h2>
        <p>Needs a connected Google Account.</p>
        <a className="calendar-connect" href="/api/spells/google-account/auth/start">
          Sign in with Google
        </a>
      </div>
    );
  }

  if (board.length === 0) {
    return (
      <div className="spell-card">
        <h2>Chores</h2>
        <p>No task lists chosen yet. Pick some in Settings.</p>
      </div>
    );
  }

  return (
    <div className="spell-card chores-card">
      <h2>Chores</h2>
      <div className="chores-board">
        {board.map((list) => (
          <div className="chores-list" key={list.id}>
            <h3>{list.title}</h3>
            <ul className="chores-tasks">
              {list.tasks.map((task) => (
                <li key={task.id}>
                  <label className={`chores-task${task.status === "completed" ? " done" : ""}`}>
                    <input
                      type="checkbox"
                      checked={task.status === "completed"}
                      onChange={() => toggleTask(list.id, task)}
                    />
                    {task.title}
                  </label>
                </li>
              ))}
            </ul>
            <form
              className="chores-add"
              onSubmit={(e) => {
                e.preventDefault();
                addTask(list.id);
              }}
            >
              <input
                placeholder="Add a chore…"
                value={newTaskTitles[list.id] ?? ""}
                onChange={(e) => setNewTaskTitles((prev) => ({ ...prev, [list.id]: e.target.value }))}
              />
              <button type="submit">Add</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
