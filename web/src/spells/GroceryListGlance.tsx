import { useEffect, useState } from "react";

interface GroceryItem {
  id: string;
  quantity: string;
  name: string;
  checked: boolean;
}

function displayLine(item: GroceryItem): string {
  return item.quantity ? `${item.quantity} ${item.name}`.trim() : item.name;
}

function useGroceryItems() {
  const [items, setItems] = useState<GroceryItem[] | null>(null);

  useEffect(() => {
    fetch("/api/spells/grocery-list/items")
      .then((res) => res.json())
      .then((data: { items: GroceryItem[] }) => setItems(data.items));
  }, []);

  return { items, setItems };
}

export function GroceryListCountGlance() {
  const { items } = useGroceryItems();
  if (!items) return <p className="glance-empty">Loading…</p>;

  const remaining = items.filter((i) => !i.checked).length;

  return (
    <div className="glance-stat">
      <div className="glance-stat-value">{remaining}</div>
      <div className="glance-stat-label">items left</div>
    </div>
  );
}

export function GroceryListChecklistGlance() {
  const { items, setItems } = useGroceryItems();
  if (!items) return <p className="glance-empty">Loading…</p>;

  const unchecked = items.filter((i) => !i.checked).slice(0, 6);
  if (unchecked.length === 0) return <p className="glance-empty">All done!</p>;

  async function toggle(item: GroceryItem) {
    const checked = !item.checked;
    setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, checked } : i)) ?? prev);
    await fetch(`/api/spells/grocery-list/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked }),
    });
  }

  return (
    <ul className="glance-list">
      {unchecked.map((item) => (
        <li key={item.id} className="glance-list-row glance-checkable">
          <label
            className="grocery-item-manual"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input type="checkbox" checked={item.checked} onChange={() => toggle(item)} />
            {displayLine(item)}
          </label>
        </li>
      ))}
    </ul>
  );
}
