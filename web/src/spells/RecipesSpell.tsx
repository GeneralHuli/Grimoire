import { useEffect, useState } from "react";
import { RecipeEditorModal } from "./RecipeEditorModal";
import { RecipeImportModal } from "./RecipeImportModal";
import { RecipeGenerateModal } from "./RecipeGenerateModal";

export interface RecipeFields {
  title: string;
  mealType: string;
  ease: string;
  rating: number;
  ingredients: string[];
  steps: string[];
  sourceUrl?: string;
}

export interface RecipeSummary {
  id: string;
  title: string;
  mealType: string;
  ease: string;
  rating: number;
}

interface EditingState {
  id?: string;
  fields: RecipeFields;
}

const EMPTY_FIELDS: RecipeFields = {
  title: "",
  mealType: "",
  ease: "medium",
  rating: 0,
  ingredients: [],
  steps: [],
};

export function RecipesSpell() {
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    fetch("/api/spells/recipes/recipes")
      .then((res) => res.json())
      .then((data: { recipes: RecipeSummary[] }) => setRecipes(data.recipes));
  }

  async function openRecipe(id: string) {
    const res = await fetch(`/api/spells/recipes/recipes/${id}`);
    const detail = (await res.json()) as EditingState["fields"] & { id: string };
    const { id: recipeId, ...fields } = detail;
    setEditing({ id: recipeId, fields });
  }

  return (
    <div className="spell-card recipes-card">
      <h2>Recipes</h2>
      <div className="recipes-toolbar">
        <button type="button" onClick={() => setEditing({ fields: EMPTY_FIELDS })}>
          + New
        </button>
        <button type="button" onClick={() => setImporting(true)}>
          Import from URL
        </button>
        <button type="button" onClick={() => setGenerating(true)}>
          Generate with AI
        </button>
      </div>

      {recipes === null && <p>Loading…</p>}
      {recipes !== null && recipes.length === 0 && <p>No recipes yet.</p>}
      {recipes !== null && recipes.length > 0 && (
        <ul className="recipes-list">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <button type="button" className="recipes-item" onClick={() => openRecipe(recipe.id)}>
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

      {editing && (
        <RecipeEditorModal
          id={editing.id}
          initial={editing.fields}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
          onDeleted={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      {importing && (
        <RecipeImportModal
          onClose={() => setImporting(false)}
          onImported={(draft) => {
            setImporting(false);
            setEditing({ fields: { ...EMPTY_FIELDS, ...draft, rating: 0 } });
          }}
        />
      )}

      {generating && (
        <RecipeGenerateModal
          onClose={() => setGenerating(false)}
          onGenerated={(draft) => {
            setGenerating(false);
            setEditing({ fields: { ...EMPTY_FIELDS, ...draft, rating: 0 } });
          }}
        />
      )}
    </div>
  );
}
