import { db } from "../../src/db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS meal_plan_entries (
    date TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL
  )
`);

export interface MealPlanEntry {
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
      `SELECT e.date as date, e.recipe_id as recipeId, r.title as title,
              r.meal_type as mealType, r.ease as ease, r.rating as rating
       FROM meal_plan_entries e
       JOIN recipes r ON r.id = e.recipe_id
       WHERE e.date >= ? AND e.date < ?
       ORDER BY e.date`
    )
    .all(startDate, endDate) as MealPlanEntry[];
}

export function setEntry(date: string, recipeId: string): void {
  db.prepare(
    `INSERT INTO meal_plan_entries (date, recipe_id) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET recipe_id = excluded.recipe_id`
  ).run(date, recipeId);
}

export function clearEntry(date: string): void {
  db.prepare("DELETE FROM meal_plan_entries WHERE date = ?").run(date);
}
