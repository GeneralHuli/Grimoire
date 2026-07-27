import { useMemo, useState } from "react";
import type { RecipeSummary } from "./RecipesSpell";

interface MealPlanRecipePickerModalProps {
  date: string;
  recipes: RecipeSummary[];
  onClose: () => void;
  onSelect: (recipeId: string) => void;
}

export function MealPlanRecipePickerModal({ date, recipes, onClose, onSelect }: MealPlanRecipePickerModalProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (recipe) => recipe.title.toLowerCase().includes(q) || recipe.mealType.toLowerCase().includes(q)
    );
  }, [recipes, search]);

  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="recipe-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Choose a recipe for ${dateLabel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-actions">
          <h3 className="modal-actions-title">{dateLabel}</h3>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <input
            type="search"
            className="recipes-search"
            placeholder="Search recipes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            aria-label="Search recipes"
          />
          {recipes.length === 0 && <p>No recipes yet — add some in the Recipes Spell first.</p>}
          {recipes.length > 0 && filtered.length === 0 && <p>No recipes match "{search}".</p>}
          {filtered.length > 0 && (
            <ul className="recipes-list">
              {filtered.map((recipe) => (
                <li key={recipe.id}>
                  <button type="button" className="recipes-item" onClick={() => onSelect(recipe.id)}>
                    <span className="recipes-item-title">{recipe.title}</span>
                    <span className="recipes-item-meta">
                      {recipe.mealType || "—"} · {recipe.ease}
                      {recipe.rating > 0 ? ` · ${"★".repeat(recipe.rating)}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
