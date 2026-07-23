import { useState } from "react";
import type { RecipeFields } from "./RecipesSpell";

interface RecipeEditorModalProps {
  id?: string;
  initial: RecipeFields;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export function RecipeEditorModal({ id, initial, onClose, onSaved, onDeleted }: RecipeEditorModalProps) {
  const [title, setTitle] = useState(initial.title);
  const [mealType, setMealType] = useState(initial.mealType);
  const [ease, setEase] = useState(initial.ease);
  const [rating, setRating] = useState(initial.rating);
  const [ingredientsText, setIngredientsText] = useState(initial.ingredients.join("\n"));
  const [stepsText, setStepsText] = useState(initial.steps.join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const body: RecipeFields = {
      title,
      mealType,
      ease,
      rating,
      ingredients: ingredientsText.split("\n").map((s) => s.trim()).filter(Boolean),
      steps: stepsText.split("\n").map((s) => s.trim()).filter(Boolean),
      sourceUrl: initial.sourceUrl,
    };
    const res = id
      ? await fetch(`/api/spells/recipes/recipes/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/spells/recipes/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    setSaving(false);
    if (!res.ok) {
      setError("Couldn't save. Try again.");
      return;
    }
    onSaved();
  }

  async function del() {
    if (!id) return;
    await fetch(`/api/spells/recipes/recipes/${id}`, { method: "DELETE" });
    onDeleted();
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="recipe-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={id ? "Edit Recipe" : "New Recipe"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-actions">
          <h3 className="modal-actions-title">{id ? "Edit Recipe" : "New Recipe"}</h3>
          {id && (
            <button type="button" className="recipe-delete" onClick={del}>
              Delete
            </button>
          )}
          <button type="button" className="settings-save" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <label className="settings-field">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="settings-field">
            Meal type
            <input
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              placeholder="e.g. Dinner, Breakfast"
            />
          </label>
          <label className="settings-field">
            Ease
            <select value={ease} onChange={(e) => setEase(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <div className="settings-field">
            Rating
            <div className="recipe-rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`recipe-star${n <= rating ? " filled" : ""}`}
                  onClick={() => setRating(n === rating ? 0 : n)}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <label className="settings-field">
            Ingredients (one per line)
            <textarea
              className="recipe-textarea"
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              rows={6}
            />
          </label>
          <label className="settings-field">
            Steps (one per line)
            <textarea
              className="recipe-textarea"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              rows={6}
            />
          </label>
          {error && <p className="calendar-event-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
