import type { Express, Request, Response } from "express";
import type { SpellModule } from "../../src/types.js";
import { listRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe, type RecipeFields } from "./store.js";
import { importRecipeFromUrl } from "./importRecipe.js";
import { generateRecipe } from "./generateRecipe.js";
import { parseIngredientsForGrocery } from "./parseIngredientsForGrocery.js";
import { getSettings } from "../../src/settingsStore.js";

function handleErrors(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error("[recipes spell]", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "internal_error" });
    });
  };
}

function parseFields(body: unknown): RecipeFields {
  const b = (body ?? {}) as Partial<RecipeFields>;
  return {
    title: typeof b.title === "string" ? b.title : "",
    mealType: typeof b.mealType === "string" ? b.mealType : "",
    ease: typeof b.ease === "string" ? b.ease : "medium",
    rating: typeof b.rating === "number" ? b.rating : 0,
    ingredients: Array.isArray(b.ingredients) ? b.ingredients.filter((s): s is string => typeof s === "string") : [],
    steps: Array.isArray(b.steps) ? b.steps.filter((s): s is string => typeof s === "string") : [],
    sourceUrl: typeof b.sourceUrl === "string" ? b.sourceUrl : undefined,
  };
}

const mod: SpellModule = {
  register(app: Express) {
    app.get("/api/spells/recipes/recipes", (_req, res) => {
      res.json({ recipes: listRecipes() });
    });

    app.get("/api/spells/recipes/recipes/:id", (req, res) => {
      const recipe = getRecipe(req.params.id);
      if (!recipe) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json(recipe);
    });

    app.post("/api/spells/recipes/recipes", (req, res) => {
      const id = createRecipe(parseFields(req.body));
      res.status(201).json({ id });
    });

    app.put("/api/spells/recipes/recipes/:id", (req, res) => {
      updateRecipe(req.params.id, parseFields(req.body));
      res.status(204).end();
    });

    app.delete("/api/spells/recipes/recipes/:id", (req, res) => {
      deleteRecipe(req.params.id);
      res.status(204).end();
    });

    app.post(
      "/api/spells/recipes/import",
      handleErrors(async (req, res) => {
        const { url } = req.body as { url?: string };
        if (!url) {
          res.status(400).json({ error: "url is required" });
          return;
        }
        const draft = await importRecipeFromUrl(url);
        res.json(draft);
      })
    );

    app.post(
      "/api/spells/recipes/generate",
      handleErrors(async (req, res) => {
        const { prompt } = req.body as { prompt?: string };
        if (!prompt) {
          res.status(400).json({ error: "prompt is required" });
          return;
        }
        const draft = await generateRecipe(prompt);
        res.json(draft);
      })
    );

    app.post(
      "/api/spells/recipes/parse-for-grocery",
      handleErrors(async (req, res) => {
        const { lines } = req.body as { lines?: string[] };
        if (!Array.isArray(lines) || lines.length === 0) {
          res.status(400).json({ error: "lines is required" });
          return;
        }
        const knownStaples = getSettings("grocery-list").staples;
        const items = await parseIngredientsForGrocery(
          lines.filter((l): l is string => typeof l === "string" && l.trim().length > 0),
          Array.isArray(knownStaples) ? knownStaples.filter((s): s is string => typeof s === "string") : []
        );
        res.json({ items });
      })
    );
  },
};

export default mod;
