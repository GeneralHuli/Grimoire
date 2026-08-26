import { useEffect, useState } from "react";
import { Pin, ShoppingCart } from "lucide-react";
import { SendToKrogerCartModal } from "./SendToKrogerCartModal";

interface GroceryItem {
  id: string;
  quantity: string;
  name: string;
  searchTerm: string;
  checked: boolean;
  isStaple: boolean;
  note: string;
  inCart: boolean;
}

function displayLine(item: GroceryItem): string {
  return item.quantity ? `${item.quantity} ${item.name}`.trim() : item.name;
}

export function GroceryListSpell() {
  const [items, setItems] = useState<GroceryItem[] | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [krogerConnected, setKrogerConnected] = useState(false);
  const [showKrogerModal, setShowKrogerModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!items) return;
    setSelectedIds((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  async function bulkAction(action: "check" | "uncheck" | "cart" | "uncart" | "delete") {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (action === "delete") {
      setItems((prev) => prev?.filter((i) => !selectedIds.has(i.id)) ?? prev);
    } else {
      const patch: Partial<GroceryItem> =
        action === "check" ? { checked: true } : action === "uncheck" ? { checked: false } : action === "cart" ? { inCart: true } : { inCart: false };
      setItems((prev) => prev?.map((i) => (selectedIds.has(i.id) ? { ...i, ...patch } : i)) ?? prev);
    }
    setSelectedIds(new Set());
    await fetch("/api/spells/grocery-list/items/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
  }

  async function removeItem(id: string) {
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? prev);
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await fetch(`/api/spells/grocery-list/items/${id}`, { method: "DELETE" });
  }

  async function toggleStaple(item: GroceryItem) {
    const isStaple = !item.isStaple;
    setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, isStaple } : i)) ?? prev);
    await fetch(`/api/spells/grocery-list/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStaple }),
    });
  }

  function handleSentToCart(itemIds: string[]) {
    setItems((prev) => prev?.map((i) => (itemIds.includes(i.id) ? { ...i, inCart: true } : i)) ?? prev);
    setSelectedIds(new Set());
    fetch("/api/spells/grocery-list/items/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: itemIds, action: "cart" }),
    });
  }

  function renderItem(item: GroceryItem) {
    return (
      <li key={item.id} className="grocery-item">
        <label className="grocery-item-select">
          <input
            type="checkbox"
            checked={selectedIds.has(item.id)}
            onChange={() => toggleSelect(item.id)}
            aria-label={`Select ${displayLine(item)}`}
          />
          <span className={`grocery-item-text${item.checked ? " done" : ""}${item.inCart ? " in-cart" : ""}`}>
            {item.inCart && <ShoppingCart className="grocery-cart-icon" aria-label="In store cart" />}
            {displayLine(item)}
            {item.note && <span className="grocery-item-note">{item.note}</span>}
          </span>
        </label>
        <button
          type="button"
          className={`grocery-pin${item.isStaple ? " active" : ""}`}
          onClick={() => toggleStaple(item)}
          aria-label={item.isStaple ? `Unmark ${item.name} as a staple` : `Mark ${item.name} as a staple`}
          title={item.isStaple ? "Marked as a staple you usually have" : "Mark as a staple you usually have"}
        >
          <Pin />
        </button>
        <button
          type="button"
          className="grocery-remove"
          onClick={() => removeItem(item.id)}
          aria-label={`Remove ${displayLine(item)}`}
        >
          ×
        </button>
      </li>
    );
  }

  const selectedCount = selectedIds.size;
  const allSelected = items !== null && items.length > 0 && selectedCount === items.length;
  const selectedItems = items?.filter((i) => selectedIds.has(i.id)) ?? [];

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
          className="field"
          placeholder="Add an item…"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          aria-label="Add a grocery item"
        />
        <button type="submit" className="btn">
          Add
        </button>
      </form>

      {items !== null && items.length > 0 && (
        <div className="grocery-bulk-toolbar">
          <button type="button" className="btn btn-sm" onClick={toggleSelectAll}>
            {allSelected ? "Deselect All" : "Select All"}
          </button>
          <button type="button" className="btn btn-sm" disabled={selectedCount === 0} onClick={() => bulkAction("check")}>
            Mark Complete
          </button>
          <button type="button" className="btn btn-sm" disabled={selectedCount === 0} onClick={() => bulkAction("cart")}>
            Mark In Cart
          </button>
          <button type="button" className="btn btn-sm" disabled={selectedCount === 0} onClick={() => bulkAction("delete")}>
            Remove
          </button>
          {krogerConnected && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={selectedCount === 0}
              onClick={() => setShowKrogerModal(true)}
            >
              Send to Fred Meyer
            </button>
          )}
        </div>
      )}

      {items === null && <p>Loading…</p>}
      {items !== null && items.length === 0 && (
        <p className="grocery-empty">
          Nothing on the list yet. Add items above, or send ingredients here from a recipe's screen.
        </p>
      )}
      {items !== null && items.length > 0 && (
        <>
          <ul className="grocery-list">{items.filter((i) => !i.isStaple).map(renderItem)}</ul>
          {items.some((i) => i.isStaple) && (
            <div className="grocery-staples-section">
              <h4>Staples (usually on hand)</h4>
              <ul className="grocery-list">{items.filter((i) => i.isStaple).map(renderItem)}</ul>
            </div>
          )}
        </>
      )}

      {showKrogerModal && (
        <SendToKrogerCartModal
          items={selectedItems}
          onClose={() => setShowKrogerModal(false)}
          onSent={handleSentToCart}
        />
      )}
    </div>
  );
}
