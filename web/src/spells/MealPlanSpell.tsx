import { useEffect, useState } from "react";
import type { RecipeFields, RecipeIngredient, RecipeSummary } from "./RecipesSpell";
import { MealPlanRecipePickerModal } from "./MealPlanRecipePickerModal";
import { RecipeViewModal } from "./RecipeViewModal";
import { SendToGroceryListModal } from "./SendToGroceryListModal";
import { RECIPE_DRAG_TYPE } from "./recipeDrag";

interface MealPlanEntry {
  id: string;
  date: string;
  recipeId: string;
  title: string;
  mealType: string;
  ease: string;
  rating: number;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MealPlanSpell() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState<Record<string, MealPlanEntry[]>>({});
  const [pickingDate, setPickingDate] = useState<string | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<
    (RecipeFields & { id: string; ingredientDetails: RecipeIngredient[] }) | null
  >(null);
  const [weekLines, setWeekLines] = useState<string[] | null>(null);
  const [gatheringWeek, setGatheringWeek] = useState(false);

  useEffect(() => {
    fetch("/api/spells/recipes/recipes")
      .then((res) => res.json())
      .then((data: { recipes: RecipeSummary[] }) => setRecipes(data.recipes));
  }, []);

  useEffect(() => {
    fetch(`/api/spells/meal-plan/week?date=${formatDateParam(weekStart)}`)
      .then((res) => res.json())
      .then((data: { entries: MealPlanEntry[] }) => {
        const byDate: Record<string, MealPlanEntry[]> = {};
        for (const entry of data.entries) {
          (byDate[entry.date] ??= []).push(entry);
        }
        setEntries(byDate);
      });
  }, [weekStart]);

  async function assign(date: string, recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    setPickingDate(null);
    const res = await fetch("/api/spells/meal-plan/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, recipeId }),
    });
    const { id } = await res.json();
    setEntries((prev) => ({
      ...prev,
      [date]: [
        ...(prev[date] ?? []),
        { id, date, recipeId, title: recipe.title, mealType: recipe.mealType, ease: recipe.ease, rating: recipe.rating },
      ],
    }));
  }

  async function openRecipe(id: string) {
    const res = await fetch(`/api/spells/recipes/recipes/${id}`);
    setViewingRecipe((await res.json()) as RecipeFields & { id: string; ingredientDetails: RecipeIngredient[] });
  }

  async function sendWeekToGrocery() {
    const recipeIds = [...new Set(Object.values(entries).flat().map((e) => e.recipeId))];
    if (recipeIds.length === 0) return;
    setGatheringWeek(true);
    const recipeDetails = await Promise.all(
      recipeIds.map((id) =>
        fetch(`/api/spells/recipes/recipes/${id}`).then((res) => res.json() as Promise<RecipeFields>)
      )
    );
    setGatheringWeek(false);
    setWeekLines(recipeDetails.flatMap((r) => r.ingredients));
  }

  async function clear(entryId: string, date: string) {
    setEntries((prev) => ({
      ...prev,
      [date]: (prev[date] ?? []).filter((e) => e.id !== entryId),
    }));
    await fetch(`/api/spells/meal-plan/entries/${entryId}`, { method: "DELETE" });
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="spell-card meal-plan-card">
      <h2>Meal Planner</h2>
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" className="btn" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
            ‹
          </button>
          <button type="button" className="btn" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Today
          </button>
          <button type="button" className="btn" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
            ›
          </button>
        </div>
        <span className="calendar-label">{headerLabel(weekStart)}</span>
        {Object.values(entries).some((dayEntries) => dayEntries.length > 0) && (
          <button type="button" className="btn btn-sm" onClick={sendWeekToGrocery} disabled={gatheringWeek}>
            {gatheringWeek ? "Gathering…" : "Send Week to Grocery List"}
          </button>
        )}
      </div>

      <p className="meal-plan-hint">
        {recipes.length === 0
          ? "Add recipes in the Recipes Spell to start planning meals."
          : "Tap a day to add a recipe (you can add more than one), drag a recipe from the Recipes Spell onto a day, or tap an assigned recipe to view/prepare it."}
      </p>

      <div className="meal-plan-grid">
        {days.map((day) => {
          const key = formatDateParam(day);
          const dayEntries = entries[key] ?? [];
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
              onClick={() => setPickingDate(key)}
            >
              <h4>
                {WEEKDAY_LABELS[day.getDay()]} {day.getDate()}
              </h4>
              {dayEntries.length === 0 && <p className="meal-plan-empty">No meal planned</p>}
              {dayEntries.map((entry) => (
                <div key={entry.id} className="meal-plan-entry">
                  <button
                    type="button"
                    className="meal-plan-entry-title"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRecipe(entry.recipeId);
                    }}
                  >
                    {entry.title}
                  </button>
                  <button
                    type="button"
                    className="meal-plan-clear"
                    onClick={(e) => {
                      e.stopPropagation();
                      clear(entry.id, key);
                    }}
                    aria-label={`Remove ${entry.title} from ${key}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {pickingDate && (
        <MealPlanRecipePickerModal
          date={pickingDate}
          recipes={recipes}
          onClose={() => setPickingDate(null)}
          onSelect={(recipeId) => assign(pickingDate, recipeId)}
        />
      )}

      {viewingRecipe && <RecipeViewModal recipe={viewingRecipe} onClose={() => setViewingRecipe(null)} />}

      {weekLines && <SendToGroceryListModal lines={weekLines} onClose={() => setWeekLines(null)} />}
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
