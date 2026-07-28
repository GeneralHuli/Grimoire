import { randomUUID } from "node:crypto";
import { db } from "../../src/db.js";
import { splitIngredientText, joinIngredientText } from "../../src/ingredientText.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    meal_type TEXT NOT NULL DEFAULT '',
    ease TEXT NOT NULL DEFAULT 'medium',
    rating INTEGER NOT NULL DEFAULT 0,
    source_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const existingIngredientColumns = db.prepare("PRAGMA table_info(recipe_ingredients)").all() as { name: string }[];
const hasNameColumn = existingIngredientColumns.some((c) => c.name === "name");

if (existingIngredientColumns.length > 0 && !hasNameColumn) {
  // Migrate from a single free-text ingredient line ("2 cups flour") to a
  // separate quantity/name so grocery-list search can target just the name.
  const migrate = db.transaction(() => {
    const rows = db.prepare("SELECT recipe_id, position, text FROM recipe_ingredients ORDER BY recipe_id, position").all() as {
      recipe_id: string;
      position: number;
      text: string;
    }[];
    db.exec("DROP TABLE recipe_ingredients");
    db.exec(`
      CREATE TABLE recipe_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        quantity TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL
      )
    `);
    const insert = db.prepare(
      "INSERT INTO recipe_ingredients (recipe_id, position, quantity, name) VALUES (?, ?, ?, ?)"
    );
    for (const row of rows) {
      const { quantity, name } = splitIngredientText(row.text);
      insert.run(row.recipe_id, row.position, quantity, name);
    }
  });
  migrate();
} else {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      quantity TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL
    )
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS recipe_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    text TEXT NOT NULL
  )
`);

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

export interface RecipeDetail extends RecipeFields {
  id: string;
  ingredientDetails: RecipeIngredient[];
}

export function listRecipes(): RecipeSummary[] {
  return db
    .prepare("SELECT id, title, meal_type as mealType, ease, rating FROM recipes ORDER BY title COLLATE NOCASE")
    .all() as RecipeSummary[];
}

export function getRecipe(id: string): RecipeDetail | null {
  const row = db
    .prepare(
      "SELECT id, title, meal_type as mealType, ease, rating, source_url as sourceUrl FROM recipes WHERE id = ?"
    )
    .get(id) as (RecipeSummary & { sourceUrl: string | null }) | undefined;
  if (!row) return null;
  const ingredientRows = db
    .prepare("SELECT quantity, name FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position")
    .all(id) as RecipeIngredient[];
  const steps = db
    .prepare("SELECT text FROM recipe_steps WHERE recipe_id = ? ORDER BY position")
    .all(id) as { text: string }[];
  return {
    ...row,
    sourceUrl: row.sourceUrl ?? undefined,
    ingredients: ingredientRows.map((r) => joinIngredientText(r.quantity, r.name)),
    ingredientDetails: ingredientRows,
    steps: steps.map((r) => r.text),
  };
}

function replaceSteps(recipeId: string, lines: string[]): void {
  db.prepare("DELETE FROM recipe_steps WHERE recipe_id = ?").run(recipeId);
  const insert = db.prepare("INSERT INTO recipe_steps (recipe_id, position, text) VALUES (?, ?, ?)");
  lines.forEach((text, i) => insert.run(recipeId, i, text));
}

function replaceIngredients(recipeId: string, lines: string[]): void {
  db.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").run(recipeId);
  const insert = db.prepare(
    "INSERT INTO recipe_ingredients (recipe_id, position, quantity, name) VALUES (?, ?, ?, ?)"
  );
  lines.forEach((line, i) => {
    const { quantity, name } = splitIngredientText(line);
    insert.run(recipeId, i, quantity, name);
  });
}

export function createRecipe(fields: RecipeFields): string {
  const id = randomUUID();
  const tx = db.transaction(() => {
    db.prepare(
      "INSERT INTO recipes (id, title, meal_type, ease, rating, source_url) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, fields.title, fields.mealType, fields.ease, fields.rating, fields.sourceUrl ?? null);
    replaceIngredients(id, fields.ingredients);
    replaceSteps(id, fields.steps);
  });
  tx();
  return id;
}

export function updateRecipe(id: string, fields: RecipeFields): void {
  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE recipes SET title = ?, meal_type = ?, ease = ?, rating = ?, source_url = ? WHERE id = ?"
    ).run(fields.title, fields.mealType, fields.ease, fields.rating, fields.sourceUrl ?? null, id);
    replaceIngredients(id, fields.ingredients);
    replaceSteps(id, fields.steps);
  });
  tx();
}

export function deleteRecipe(id: string): void {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").run(id);
    db.prepare("DELETE FROM recipe_steps WHERE recipe_id = ?").run(id);
    db.prepare("DELETE FROM recipes WHERE id = ?").run(id);
  });
  tx();
}
