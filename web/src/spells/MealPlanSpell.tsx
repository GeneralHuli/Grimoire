import { useEffect, useState } from "react";
import type { RecipeSummary } from "./RecipesSpell";

interface MealPlanEntry {
  date: string;
  recipeId: string;
  title: string;
  mealType: string;
  ease: string;
  rating: number;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RECIPE_DRAG_TYPE = "application/x-grimoire-recipe-id";

export function MealPlanSpell() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState<Record<string, MealPlanEntry>>({});
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spells/recipes/recipes")
      .then((res) => res.json())
      .then((data: { recipes: RecipeSummary[] }) => setRecipes(data.recipes));
  }, []);

  useEffect(() => {
    fetch(`/api/spells/meal-plan/week?date=${formatDateParam(weekStart)}`)
      .then((res) => res.json())
      .then((data: { entries: MealPlanEntry[] }) => {
        const byDate: Record<string, MealPlanEntry> = {};
        for (const entry of data.entries) byDate[entry.date] = entry;
        setEntries(byDate);
      });
  }, [weekStart]);

  async function assign(date: string, recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    setEntries((prev) => ({
      ...prev,
      [date]: { date, recipeId, title: recipe.title, mealType: recipe.mealType, ease: recipe.ease, rating: recipe.rating },
    }));
    setSelectedRecipeId(null);
    await fetch(`/api/spells/meal-plan/entries/${date}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId }),
    });
  }

  async function clear(date: string) {
    setEntries((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
    await fetch(`/api/spells/meal-plan/entries/${date}`, { method: "DELETE" });
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="spell-card meal-plan-card">
      <h2>Meal Planner</h2>
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
            ‹
          </button>
          <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Today
          </button>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
            ›
          </button>
        </div>
        <span className="calendar-label">{headerLabel(weekStart)}</span>
      </div>

      {recipes.length === 0 ? (
        <p>Add recipes in the Recipes Spell to start planning meals.</p>
      ) : (
        <>
          <p className="meal-plan-hint">
            Tap a recipe, then tap a day to place it — or drag a recipe onto a day.
          </p>
          <div className="meal-plan-recipes">
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                draggable
                className={`meal-plan-recipe-chip${selectedRecipeId === recipe.id ? " selected" : ""}`}
                onDragStart={(e) => e.dataTransfer.setData(RECIPE_DRAG_TYPE, recipe.id)}
                onClick={() => setSelectedRecipeId((prev) => (prev === recipe.id ? null : recipe.id))}
              >
                {recipe.title}
              </button>
            ))}
          </div>

          <div className="meal-plan-grid">
            {days.map((day) => {
              const key = formatDateParam(day);
              const entry = entries[key];
              return (
                <div
                  key={key}
                  className={`meal-plan-day${isSameDay(day, new Date()) ? " today" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const recipeId = e.dataTransfer.getData(RECIPE_DRAG_TYPE);
                    if (recipeId) assign(key, recipeId);
                  }}
                  onClick={() => {
                    if (selectedRecipeId) assign(key, selectedRecipeId);
                  }}
                >
                  <h4>
                    {WEEKDAY_LABELS[day.getDay()]} {day.getDate()}
                  </h4>
                  {entry ? (
                    <div className="meal-plan-entry">
                      <span>{entry.title}</span>
                      <button
                        type="button"
                        className="meal-plan-clear"
                        onClick={(e) => {
                          e.stopPropagation();
                          clear(key);
                        }}
                        aria-label={`Remove ${entry.title} from ${key}`}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <p className="meal-plan-empty">No meal planned</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function startOfWeek(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateParam(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function headerLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const startLabel = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(
    undefined,
    weekStart.getMonth() === end.getMonth()
      ? { day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" }
  );
  return `${startLabel} – ${endLabel}`;
}
