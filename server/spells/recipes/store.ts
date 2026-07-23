import { randomUUID } from "node:crypto";
import { db } from "../../src/db.js";

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
db.exec(`
  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    text TEXT NOT NULL
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS recipe_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    text TEXT NOT NULL
  )
`);

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
  const ingredients = db
    .prepare("SELECT text FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position")
    .all(id) as { text: string }[];
  const steps = db
    .prepare("SELECT text FROM recipe_steps WHERE recipe_id = ? ORDER BY position")
    .all(id) as { text: string }[];
  return {
    ...row,
    sourceUrl: row.sourceUrl ?? undefined,
    ingredients: ingredients.map((r) => r.text),
    steps: steps.map((r) => r.text),
  };
}

function replaceLines(table: "recipe_ingredients" | "recipe_steps", recipeId: string, lines: string[]): void {
  db.prepare(`DELETE FROM ${table} WHERE recipe_id = ?`).run(recipeId);
  const insert = db.prepare(`INSERT INTO ${table} (recipe_id, position, text) VALUES (?, ?, ?)`);
  lines.forEach((text, i) => insert.run(recipeId, i, text));
}

export function createRecipe(fields: RecipeFields): string {
  const id = randomUUID();
  const tx = db.transaction(() => {
    db.prepare(
      "INSERT INTO recipes (id, title, meal_type, ease, rating, source_url) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, fields.title, fields.mealType, fields.ease, fields.rating, fields.sourceUrl ?? null);
    replaceLines("recipe_ingredients", id, fields.ingredients);
    replaceLines("recipe_steps", id, fields.steps);
  });
  tx();
  return id;
}

export function updateRecipe(id: string, fields: RecipeFields): void {
  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE recipes SET title = ?, meal_type = ?, ease = ?, rating = ?, source_url = ? WHERE id = ?"
    ).run(fields.title, fields.mealType, fields.ease, fields.rating, fields.sourceUrl ?? null, id);
    replaceLines("recipe_ingredients", id, fields.ingredients);
    replaceLines("recipe_steps", id, fields.steps);
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
