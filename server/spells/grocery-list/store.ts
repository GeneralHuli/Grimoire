import { randomUUID } from "node:crypto";
import { db } from "../../src/db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS grocery_items (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

export interface GroceryItem {
  id: string;
  text: string;
  checked: boolean;
}

export function listManualItems(): GroceryItem[] {
  const rows = db
    .prepare("SELECT id, text, checked FROM grocery_items ORDER BY position")
    .all() as { id: string; text: string; checked: number }[];
  return rows.map((r) => ({ id: r.id, text: r.text, checked: Boolean(r.checked) }));
}

export function addManualItem(text: string): GroceryItem {
  const id = randomUUID();
  const { next } = db.prepare("SELECT COALESCE(MAX(position) + 1, 0) as next FROM grocery_items").get() as {
    next: number;
  };
  db.prepare("INSERT INTO grocery_items (id, text, checked, position) VALUES (?, ?, 0, ?)").run(id, text, next);
  return { id, text, checked: false };
}

export function setItemChecked(id: string, checked: boolean): void {
  db.prepare("UPDATE grocery_items SET checked = ? WHERE id = ?").run(checked ? 1 : 0, id);
}

export function deleteManualItem(id: string): void {
  db.prepare("DELETE FROM grocery_items WHERE id = ?").run(id);
}

/**
 * Reads ingredient lines straight from the Recipes/Meal Planner Spells' own tables via a
 * SQL join, the same cross-Spell pattern meal-plan/store.ts uses against `recipes` — no
 * TS import needed since it's a plain read against tables another Spell owns.
 */
export function getIngredientLinesForWeek(startDate: string, endDate: string): string[] {
  const rows = db
    .prepare(
      `SELECT ri.text as text
       FROM meal_plan_entries e
       JOIN recipe_ingredients ri ON ri.recipe_id = e.recipe_id
       WHERE e.date >= ? AND e.date < ?`
    )
    .all(startDate, endDate) as { text: string }[];
  return rows.map((r) => r.text);
}
