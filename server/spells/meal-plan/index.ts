import type { Express } from "express";
import type { SpellModule } from "../../src/types.js";
import { getWeek, addEntry, removeEntry } from "./store.js";

function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay());
  return s;
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses a `YYYY-MM-DD` query param into a local-midnight Date, defaulting to today. */
function parseAnchor(dateParam: unknown): Date {
  if (typeof dateParam === "string") {
    const parsed = new Date(`${dateParam}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

const mod: SpellModule = {
  register(app: Express) {
    app.get("/api/spells/meal-plan/week", (req, res) => {
      const anchor = parseAnchor(req.query.date);
      const start = startOfWeek(anchor);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const entries = getWeek(formatDate(start), formatDate(end));
      res.json({ entries });
    });

    app.post("/api/spells/meal-plan/entries", (req, res) => {
      const { date, recipeId } = req.body as { date?: string; recipeId?: string };
      if (!date || !recipeId) {
        res.status(400).json({ error: "date and recipeId are required" });
        return;
      }
      const id = addEntry(date, recipeId);
      res.status(201).json({ id });
    });

    app.delete("/api/spells/meal-plan/entries/:id", (req, res) => {
      removeEntry(req.params.id);
      res.status(204).end();
    });
  },
};

export default mod;
