import { randomUUID } from "node:crypto";
import { db } from "../../src/db.js";

const existingColumns = db.prepare("PRAGMA table_info(meal_plan_entries)").all() as { name: string }[];
const hasIdColumn = existingColumns.some((c) => c.name === "id");

if (existingColumns.length > 0 && !hasIdColumn) {
  // Migrate from the original one-recipe-per-day schema (date was the primary key) to
  // one row per assignment, so a day can hold any number of recipes.
  const migrate = db.transaction(() => {
    const rows = db.prepare("SELECT date, recipe_id FROM meal_plan_entries").all() as {
      date: string;
      recipe_id: string;
    }[];
    db.exec("DROP TABLE meal_plan_entries");
    db.exec(`
      CREATE TABLE meal_plan_entries (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        recipe_id TEXT NOT NULL
      )
    `);
    const insert = db.prepare("INSERT INTO meal_plan_entries (id, date, recipe_id) VALUES (?, ?, ?)");
    for (const row of rows) insert.run(randomUUID(), row.date, row.recipe_id);
  });
  migrate();
} else {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meal_plan_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      recipe_id TEXT NOT NULL
    )
  `);
}
db.exec("CREATE INDEX IF NOT EXISTS idx_meal_plan_entries_date ON meal_plan_entries (date)");

export interface MealPlanEntry {
  id: string;
  date: string;
  recipeId: string;
  title: string;
  mealType: string;
  ease: string;
  rating: number;
}

/**
 * Joins against `recipes` so a deleted recipe's entries simply drop out of the plan
 * instead of showing up as a dangling reference — no cross-Spell cleanup needed.
 */
export function getWeek(startDate: string, endDate: string): MealPlanEntry[] {
  return db
    .prepare(
      `SELECT e.id as id, e.date as date, e.recipe_id as recipeId, r.title as title,
              r.meal_type as mealType, r.ease as ease, r.rating as rating
       FROM meal_plan_entries e
       JOIN recipes r ON r.id = e.recipe_id
       WHERE e.date >= ? AND e.date < ?
       ORDER BY e.date, e.rowid`
    )
    .all(startDate, endDate) as MealPlanEntry[];
}

export function addEntry(date: string, recipeId: string): string {
  const id = randomUUID();
  db.prepare("INSERT INTO meal_plan_entries (id, date, recipe_id) VALUES (?, ?, ?)").run(id, date, recipeId);
  return id;
}

export function removeEntry(id: string): void {
  db.prepare("DELETE FROM meal_plan_entries WHERE id = ?").run(id);
}
