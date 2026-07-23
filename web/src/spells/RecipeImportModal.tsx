import { useState } from "react";
import type { RecipeFields } from "./RecipesSpell";

interface RecipeImportModalProps {
  onClose: () => void;
  onImported: (draft: Partial<RecipeFields>) => void;
}

export function RecipeImportModal({ onClose, onImported }: RecipeImportModalProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importUrl() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/spells/recipes/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't import that page.");
      return;
    }
    onImported(await res.json());
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="recipe-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Import Recipe from URL"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-actions">
          <h3 className="modal-actions-title">Import from URL</h3>
          <button type="button" className="settings-save" onClick={importUrl} disabled={loading || !url}>
            {loading ? "Importing…" : "Import"}
          </button>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>Paste a link to a recipe page. Works with most sites that publish structured recipe data.</p>
          <label className="settings-field">
            Recipe URL
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/recipe"
            />
          </label>
          {error && <p className="calendar-event-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
