import { useEffect, useState } from "react";
import { SendToKrogerCartModal } from "./SendToKrogerCartModal";

interface GroceryItem {
  id: string;
  text: string;
  checked: boolean;
}

export function GroceryListSpell() {
  const [items, setItems] = useState<GroceryItem[] | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [krogerConnected, setKrogerConnected] = useState(false);
  const [showKrogerModal, setShowKrogerModal] = useState(false);

  useEffect(() => {
    refresh();
    fetch("/api/spells/retail-kroger/status")
      .then((res) => res.json())
      .then((data: { connected: boolean }) => setKrogerConnected(data.connected));
  }, []);

  function refresh() {
    fetch("/api/spells/grocery-list/items")
      .then((res) => res.json())
      .then((data: { items: GroceryItem[] }) => setItems(data.items));
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
    setItems((prev) => [...(prev ?? []), created]);
  }

  async function toggleItem(item: GroceryItem) {
    const checked = !item.checked;
    setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, checked } : i)) ?? prev);
    await fetch(`/api/spells/grocery-list/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked }),
    });
  }

  async function removeItem(id: string) {
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? prev);
    await fetch(`/api/spells/grocery-list/items/${id}`, { method: "DELETE" });
  }

  return (
    <div className="spell-card grocery-list-card">
      <h2>Grocery List</h2>
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

      {krogerConnected && items !== null && items.some((i) => !i.checked) && (
        <div className="send-grocery-toolbar">
          <button type="button" onClick={() => setShowKrogerModal(true)}>
            Send to Fred Meyer
          </button>
        </div>
      )}

      {items === null && <p>Loading…</p>}
      {items !== null && items.length === 0 && (
        <p className="grocery-empty">
          Nothing on the list yet. Add items above, or send ingredients here from a recipe's screen.
        </p>
      )}
      {items !== null && items.length > 0 && (
        <ul className="grocery-list">
          {items.map((item) => (
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

      {showKrogerModal && items !== null && (
        <SendToKrogerCartModal items={items.filter((i) => !i.checked)} onClose={() => setShowKrogerModal(false)} />
      )}
    </div>
  );
}
