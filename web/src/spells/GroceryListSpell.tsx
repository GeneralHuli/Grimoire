import { useEffect, useState } from "react";

interface AggregatedIngredient {
  key: string;
  label: string;
}

interface GroceryItem {
  id: string;
  text: string;
  checked: boolean;
}

export function GroceryListSpell() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [aggregated, setAggregated] = useState<AggregatedIngredient[]>([]);
  const [manual, setManual] = useState<GroceryItem[]>([]);
  const [newItemText, setNewItemText] = useState("");

  useEffect(() => {
    refresh();
  }, [weekStart]);

  function refresh() {
    fetch(`/api/spells/grocery-list/list?date=${formatDateParam(weekStart)}`)
      .then((res) => res.json())
      .then((data: { aggregated: AggregatedIngredient[]; manual: GroceryItem[] }) => {
        setAggregated(data.aggregated);
        setManual(data.manual);
      });
  }

  async function addItem() {
    const text = newItemText.trim();
    if (!text) return;
    setNewItemText("");
    const res = await fetch("/api/spells/grocery-list/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const created: GroceryItem = await res.json();
    setManual((prev) => [...prev, created]);
  }

  async function toggleItem(item: GroceryItem) {
    const checked = !item.checked;
    setManual((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked } : i)));
    await fetch(`/api/spells/grocery-list/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked }),
    });
  }

  async function removeItem(id: string) {
    setManual((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/spells/grocery-list/items/${id}`, { method: "DELETE" });
  }

  return (
    <div className="spell-card grocery-list-card">
      <h2>Grocery List</h2>
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
            ‹
          </button>
          <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Today
          </button>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
            ›
          </button>
        </div>
        <span className="calendar-label">{headerLabel(weekStart)}</span>
      </div>

      <div className="grocery-section">
        <h3>From your meal plan</h3>
        {aggregated.length === 0 ? (
          <p className="grocery-empty">No recipes planned this week.</p>
        ) : (
          <ul className="grocery-list">
            {aggregated.map((item) => (
              <li key={item.key} className="grocery-item grocery-item-auto">
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grocery-section">
        <h3>Added by you</h3>
        <form
          className="chores-add"
          onSubmit={(e) => {
            e.preventDefault();
            addItem();
          }}
        >
          <input
            placeholder="Add an item…"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            aria-label="Add a grocery item"
          />
          <button type="submit">Add</button>
        </form>
        {manual.length === 0 ? (
          <p className="grocery-empty">Nothing added yet.</p>
        ) : (
          <ul className="grocery-list">
            {manual.map((item) => (
              <li key={item.id} className="grocery-item">
                <label className={`grocery-item-manual${item.checked ? " done" : ""}`}>
                  <input type="checkbox" checked={item.checked} onChange={() => toggleItem(item)} />
                  {item.text}
                </label>
                <button
                  type="button"
                  className="grocery-remove"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.text}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function startOfWeek(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function formatDateParam(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function headerLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const startLabel = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(
    undefined,
    weekStart.getMonth() === end.getMonth()
      ? { day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" }
  );
  return `${startLabel} – ${endLabel}`;
}
