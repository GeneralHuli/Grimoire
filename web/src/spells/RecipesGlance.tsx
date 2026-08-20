import { useEffect, useState } from "react";
import type { RecipeSummary } from "./RecipesSpell";

function useRecipes() {
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/spells/recipes/recipes")
      .then((res) => res.json())
      .then((data: { recipes: RecipeSummary[] }) => setRecipes(data.recipes));
  }, []);

  return recipes;
}

function topRated(recipes: RecipeSummary[], count: number): RecipeSummary[] {
  return recipes
    .slice()
    .sort((a, b) => b.rating - a.rating)
    .slice(0, count);
}

export function RecipesSpotlightGlance() {
  const recipes = useRecipes();

  if (!recipes) return <p className="glance-empty">Loading…</p>;
  if (recipes.length === 0) return <p className="glance-empty">No recipes yet</p>;

  const [pick] = topRated(recipes, 1);

  return (
    <div className="recipes-spotlight-glance">
      <div className="recipes-spotlight-label">Try this</div>
      <div className="recipes-spotlight-title">{pick.title}</div>
      {pick.rating > 0 && <div className="recipes-spotlight-rating">{"★".repeat(pick.rating)}</div>}
    </div>
  );
}

export function RecipesBoxGlance() {
  const recipes = useRecipes();

  if (!recipes) return <p className="glance-empty">Loading…</p>;
  if (recipes.length === 0) return <p className="glance-empty">No recipes yet</p>;

  return (
    <ul className="glance-list">
      {topRated(recipes, 5).map((recipe) => (
        <li key={recipe.id} className="glance-list-row">
          <span className="glance-list-title">{recipe.title}</span>
          {recipe.rating > 0 && <span className="glance-list-meta">{"★".repeat(recipe.rating)}</span>}
        </li>
      ))}
    </ul>
  );
}
