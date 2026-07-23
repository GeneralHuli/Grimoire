import { useState } from "react";
import type { RecipeFields } from "./RecipesSpell";

interface RecipeGenerateModalProps {
  onClose: () => void;
  onGenerated: (draft: Partial<RecipeFields>) => void;
}

export function RecipeGenerateModal({ onClose, onGenerated }: RecipeGenerateModalProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/spells/recipes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't generate a recipe.");
      return;
    }
    onGenerated(await res.json());
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="recipe-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Generate Recipe with AI"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3>Generate with AI</h3>
        <p>Describe what you're in the mood for, and a recipe will be drafted for you to review and save.</p>
        <label className="settings-field">
          What do you want to cook?
          <textarea
            className="recipe-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="e.g. A quick weeknight chicken dinner the kids will eat"
          />
        </label>
        {error && <p className="calendar-event-error">{error}</p>}
        <button type="button" className="settings-save" onClick={generate} disabled={loading || !prompt}>
          {loading ? "Generating…" : "Generate"}
        </button>
      </div>
    </div>
  );
}
