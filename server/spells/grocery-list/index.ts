import type { Express } from "express";
import type { SpellModule } from "../../src/types.js";
import {
  listManualItems,
  addManualItem,
  setItemChecked,
  deleteManualItem,
  getIngredientLinesForWeek,
} from "./store.js";
import { aggregateIngredients } from "./aggregate.js";

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
    app.get("/api/spells/grocery-list/list", (req, res) => {
      const anchor = parseAnchor(req.query.date);
      const start = startOfWeek(anchor);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const lines = getIngredientLinesForWeek(formatDate(start), formatDate(end));
      const aggregated = aggregateIngredients(lines);
      const manual = listManualItems();
      res.json({ weekStart: formatDate(start), aggregated, manual });
    });

    app.post("/api/spells/grocery-list/items", (req, res) => {
      const { text } = req.body as { text?: string };
      if (!text || !text.trim()) {
        res.status(400).json({ error: "text is required" });
        return;
      }
      const item = addManualItem(text.trim());
      res.status(201).json(item);
    });

    app.put("/api/spells/grocery-list/items/:id", (req, res) => {
      const { checked } = req.body as { checked?: boolean };
      setItemChecked(req.params.id, Boolean(checked));
      res.status(204).end();
    });

    app.delete("/api/spells/grocery-list/items/:id", (req, res) => {
      deleteManualItem(req.params.id);
      res.status(204).end();
    });
  },
};

export default mod;
