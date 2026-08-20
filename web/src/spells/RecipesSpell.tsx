import { useEffect, useMemo, useState } from "react";
import { RecipeEditorModal } from "./RecipeEditorModal";
import { RecipeImportModal } from "./RecipeImportModal";
import { RecipeGenerateModal } from "./RecipeGenerateModal";
import { RecipeViewModal } from "./RecipeViewModal";
import { RECIPE_DRAG_TYPE } from "./recipeDrag";

export interface RecipeIngredient {
  quantity: string;
  name: string;
}

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
  const [viewing, setViewing] = useState<(RecipeFields & { id: string; ingredientDetails: RecipeIngredient[] }) | null>(
    null
  );
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    if (!recipes) return recipes;
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (recipe) => recipe.title.toLowerCase().includes(q) || recipe.mealType.toLowerCase().includes(q)
    );
  }, [recipes, search]);

  function refresh() {
    fetch("/api/spells/recipes/recipes")
      .then((res) => res.json())
      .then((data: { recipes: RecipeSummary[] }) => setRecipes(data.recipes));
  }

  async function openRecipe(id: string) {
    const res = await fetch(`/api/spells/recipes/recipes/${id}`);
    setViewing((await res.json()) as RecipeFields & { id: string; ingredientDetails: RecipeIngredient[] });
  }

  function editViewing() {
    if (!viewing) return;
    const { id, ...fields } = viewing;
    setViewing(null);
    setEditing({ id, fields });
  }

  return (
    <div className="spell-card recipes-card">
      <h2>Recipes</h2>
      <div className="recipes-toolbar">
        <button type="button" className="btn" onClick={() => setEditing({ fields: EMPTY_FIELDS })}>
          + New
        </button>
        <button type="button" className="btn" onClick={() => setImporting(true)}>
          Import from URL
        </button>
        <button type="button" className="btn" onClick={() => setGenerating(true)}>
          Generate with AI
        </button>
        <input
          type="search"
          className="field recipes-search"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search recipes"
        />
      </div>

      {recipes === null && <p>Loading…</p>}
      {recipes !== null && recipes.length === 0 && <p>No recipes yet.</p>}
      {filtered !== null && filtered.length === 0 && recipes !== null && recipes.length > 0 && (
        <p>No recipes match "{search}".</p>
      )}
      {filtered !== null && filtered.length > 0 && (
        <ul className="recipes-list">
          {filtered.map((recipe) => (
            <li key={recipe.id}>
              <button
                type="button"
                className="recipes-item"
                draggable
                onDragStart={(e) => e.dataTransfer.setData(RECIPE_DRAG_TYPE, recipe.id)}
                onClick={() => openRecipe(recipe.id)}
              >
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

      {viewing && <RecipeViewModal recipe={viewing} onClose={() => setViewing(null)} onEdit={editViewing} />}

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
