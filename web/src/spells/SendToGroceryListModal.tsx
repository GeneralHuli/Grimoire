import { useState } from "react";

interface SendToGroceryListModalProps {
  ingredients: string[];
  onClose: () => void;
}

export function SendToGroceryListModal({ ingredients, onClose }: SendToGroceryListModalProps) {
  const [checked, setChecked] = useState<boolean[]>(() => ingredients.map(() => true));
  const [sending, setSending] = useState(false);

  const checkedCount = checked.filter(Boolean).length;

  function toggle(index: number) {
    setChecked((prev) => prev.map((c, i) => (i === index ? !c : c)));
  }

  async function send() {
    setSending(true);
    const selected = ingredients.filter((_, i) => checked[i]);
    await Promise.all(
      selected.map((text) =>
        fetch("/api/spells/grocery-list/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        })
      )
    );
    setSending(false);
    onClose();
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
          <button type="button" className="settings-save" onClick={send} disabled={sending || checkedCount === 0}>
            {sending ? "Sending…" : `Send (${checkedCount})`}
          </button>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="send-grocery-toolbar">
            <button type="button" onClick={() => setChecked(ingredients.map(() => true))}>
              Check all
            </button>
            <button type="button" onClick={() => setChecked(ingredients.map(() => false))}>
              Uncheck all
            </button>
          </div>
          <ul className="grocery-list">
            {ingredients.map((text, i) => (
              <li key={i} className="grocery-item">
                <label className="grocery-item-manual">
                  <input type="checkbox" checked={checked[i]} onChange={() => toggle(i)} />
                  {text}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
