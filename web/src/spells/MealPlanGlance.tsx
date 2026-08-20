import { useEffect, useState } from "react";

interface MealPlanEntry {
  id: string;
  date: string;
  recipeId: string;
  title: string;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateParam(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function useWeekEntries() {
  const [entries, setEntries] = useState<Record<string, MealPlanEntry[]> | null>(null);

  useEffect(() => {
    fetch(`/api/spells/meal-plan/week?date=${formatDateParam(startOfWeek(new Date()))}`)
      .then((res) => res.json())
      .then((data: { entries: MealPlanEntry[] }) => {
        const byDate: Record<string, MealPlanEntry[]> = {};
        for (const entry of data.entries) {
          (byDate[entry.date] ??= []).push(entry);
        }
        setEntries(byDate);
      });
  }, []);

  return entries;
}

export function MealPlanTonightGlance() {
  const entries = useWeekEntries();
  if (!entries) return <p className="glance-empty">Loading…</p>;

  const today = entries[formatDateParam(new Date())] ?? [];
  if (today.length === 0) return <p className="glance-empty">Nothing planned tonight</p>;

  return (
    <ul className="glance-list">
      {today.map((entry) => (
        <li key={entry.id} className="glance-list-row">
          <span className="glance-list-title">{entry.title}</span>
        </li>
      ))}
    </ul>
  );
}

export function MealPlanWeekGlance() {
  const entries = useWeekEntries();
  if (!entries) return <p className="glance-empty">Loading…</p>;

  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date()), i));

  return (
    <div className="meal-plan-glance-week">
      {days.map((day) => {
        const key = formatDateParam(day);
        const dayEntries = entries[key] ?? [];
        return (
          <div className="meal-plan-glance-day" key={key}>
            <div className="meal-plan-glance-day-label">{WEEKDAY_LABELS[day.getDay()]}</div>
            <div className="meal-plan-glance-day-title">
              {dayEntries.length > 0 ? dayEntries.map((e) => e.title).join(", ") : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
