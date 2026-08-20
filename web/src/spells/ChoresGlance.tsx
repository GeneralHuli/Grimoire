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

function useChoresBoard() {
  const [board, setBoard] = useState<ChoreList[] | null>(null);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    fetch("/api/spells/chores/board")
      .then(async (res) => {
        if (!res.ok) {
          setConnected(false);
          return;
        }
        const data = (await res.json()) as { board: ChoreList[] };
        setBoard(data.board);
      })
      .catch(() => setConnected(false));
  }, []);

  return { board, connected };
}

export function ChoresProgressGlance() {
  const { board, connected } = useChoresBoard();

  if (!connected) return <p className="glance-empty">Connect Google in Settings</p>;
  if (!board) return <p className="glance-empty">Loading…</p>;

  const allTasks = board.flatMap((list) => list.tasks);
  const done = allTasks.filter((t) => t.status === "completed").length;

  if (allTasks.length === 0) return <p className="glance-empty">No chores yet</p>;

  return (
    <div className="glance-stat">
      <div className="glance-stat-value">
        {done} / {allTasks.length}
      </div>
      <div className="glance-stat-label">chores done</div>
    </div>
  );
}

export function ChoresBoardGlance() {
  const { board, connected } = useChoresBoard();

  if (!connected) return <p className="glance-empty">Connect Google in Settings</p>;
  if (!board) return <p className="glance-empty">Loading…</p>;
  if (board.length === 0) return <p className="glance-empty">No task lists chosen</p>;

  return (
    <div className="chores-glance-board">
      {board.map((list) => {
        const undone = list.tasks.filter((t) => t.status !== "completed");
        return (
          <div className="chores-glance-list" key={list.id}>
            <div className="chores-glance-list-header">
              {list.title} ({list.tasks.length - undone.length}/{list.tasks.length})
            </div>
            <ul className="glance-list">
              {undone.slice(0, 3).map((task) => (
                <li key={task.id} className="glance-list-row">
                  <span className="glance-list-title">{task.title}</span>
                </li>
              ))}
              {undone.length === 0 && <li className="glance-list-row glance-empty">All done!</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
