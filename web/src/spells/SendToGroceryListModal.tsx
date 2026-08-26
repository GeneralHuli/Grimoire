import { useEffect, useState } from "react";
import { Pin } from "lucide-react";

interface ParsedIngredient {
  name: string;
  quantityDisplay: string;
  amount: number | null;
  unit: string | null;
  isStaple: boolean;
  note: string | null;
}

interface SendToGroceryListModalProps {
  lines: string[];
  onClose: () => void;
}

export function SendToGroceryListModal({ lines, onClose }: SendToGroceryListModalProps) {
  const [items, setItems] = useState<ParsedIngredient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [staple, setStaple] = useState<boolean[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/spells/recipes/parse-for-grocery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Couldn't parse ingredients");
        }
        return res.json() as Promise<{ items: ParsedIngredient[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setChecked(data.items.map((i) => !i.isStaple));
        setStaple(data.items.map((i) => i.isStaple));
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [lines]);

  const checkedCount = checked.filter(Boolean).length;

  function toggleChecked(index: number) {
    setChecked((prev) => prev.map((c, i) => (i === index ? !c : c)));
  }

  function toggleStaple(index: number) {
    setStaple((prev) => prev.map((s, i) => (i === index ? !s : s)));
  }

  async function send() {
    if (!items) return;
    setSending(true);
    const selected = items
      .map((item, i) => ({ item, checked: checked[i], isStaple: staple[i] }))
      .filter((entry) => entry.checked);
    await Promise.all(
      selected.map(({ item, isStaple }) =>
        fetch("/api/spells/grocery-list/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name,
            quantity: item.quantityDisplay,
            amount: item.amount,
            unit: item.unit,
            isStaple,
            note: item.note ?? "",
          }),
        })
      )
    );
    setSending(false);
    onClose();
  }

  const regularIndexes = items ? items.map((_, i) => i).filter((i) => !staple[i]) : [];
  const stapleIndexes = items ? items.map((_, i) => i).filter((i) => staple[i]) : [];

  function renderRow(i: number) {
    const item = items![i];
    return (
      <li key={i} className="grocery-item">
        <label className="grocery-item-manual">
          <input type="checkbox" checked={checked[i]} onChange={() => toggleChecked(i)} />
          <span>
            {item.quantityDisplay ? `${item.quantityDisplay} ${item.name}`.trim() : item.name}
            {item.note && <span className="grocery-item-note">{item.note}</span>}
          </span>
        </label>
        <button
          type="button"
          className={`grocery-pin${staple[i] ? " active" : ""}`}
          onClick={() => toggleStaple(i)}
          aria-label={staple[i] ? `Unmark ${item.name} as a staple` : `Mark ${item.name} as a staple`}
          title={staple[i] ? "Marked as a staple you usually have" : "Mark as a staple you usually have"}
        >
          <Pin />
        </button>
      </li>
    );
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="recipe-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Send to Grocery List"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-actions">
          <h3 className="modal-actions-title">Send to Grocery List</h3>
          <button type="button" className="btn btn-lg" onClick={send} disabled={sending || !items || checkedCount === 0}>
            {sending ? "Sending…" : `Send (${checkedCount})`}
          </button>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          {error && <p className="grocery-empty">{error}</p>}
          {!error && items === null && <p className="grocery-empty">Working out what to buy…</p>}
          {items !== null && (
            <>
              <div className="send-grocery-toolbar">
                <button type="button" className="btn btn-sm" onClick={() => setChecked(items.map(() => true))}>
                  Check all
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setChecked(items.map(() => false))}>
                  Uncheck all
                </button>
              </div>
              <ul className="grocery-list">{regularIndexes.map(renderRow)}</ul>
              {stapleIndexes.length > 0 && (
                <div className="grocery-staples-section">
                  <h4>Staples (usually on hand)</h4>
                  <ul className="grocery-list">{stapleIndexes.map(renderRow)}</ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
