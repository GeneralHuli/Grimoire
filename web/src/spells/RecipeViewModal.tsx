import { useState } from "react";
import type { RecipeFields } from "./RecipesSpell";
import { SendToGroceryListModal } from "./SendToGroceryListModal";

interface RecipeViewModalProps {
  recipe: RecipeFields & { id: string };
  onClose: () => void;
  onEdit?: () => void;
}

export function RecipeViewModal({ recipe, onClose, onEdit }: RecipeViewModalProps) {
  const [sendingToGrocery, setSendingToGrocery] = useState(false);

  return (
    <>
      <div className="settings-overlay" onClick={onClose}>
        <div
          className="recipe-view-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={recipe.title}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-actions">
            <h3 className="modal-actions-title">{recipe.title}</h3>
            <button
              type="button"
              className="settings-save"
              onClick={() => setSendingToGrocery(true)}
              disabled={recipe.ingredients.length === 0}
            >
              Send to Grocery List
            </button>
            {onEdit && (
              <button type="button" className="settings-save" onClick={onEdit}>
                Edit
              </button>
            )}
            <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <p className="recipe-view-meta">
            {recipe.mealType || "—"} · {recipe.ease}
            {recipe.rating > 0 ? ` · ${"★".repeat(recipe.rating)}` : ""}
          </p>

          <div className="recipe-view-columns">
            <div className="recipe-view-column">
              <h4>Ingredients</h4>
              {recipe.ingredients.length > 0 ? (
                <ul className="recipe-view-list">
                  {recipe.ingredients.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="recipe-view-empty">No ingredients listed.</p>
              )}
            </div>
            <div className="recipe-view-column">
              <h4>Steps</h4>
              {recipe.steps.length > 0 ? (
                <ul className="recipe-view-list">
                  {recipe.steps.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="recipe-view-empty">No steps listed.</p>
              )}
            </div>
          </div>

          {recipe.sourceUrl && (
            <p className="recipe-view-source">
              <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
                View original source
              </a>
            </p>
          )}
        </div>
      </div>

      {sendingToGrocery && (
        <SendToGroceryListModal ingredients={recipe.ingredients} onClose={() => setSendingToGrocery(false)} />
      )}
    </>
  );
}
