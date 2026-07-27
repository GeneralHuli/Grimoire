import type { Express } from "express";
import type { SpellModule } from "../../src/types.js";
import { listItems, addItem, setItemChecked, deleteItem } from "./store.js";

const mod: SpellModule = {
  register(app: Express) {
    app.get("/api/spells/grocery-list/items", (_req, res) => {
      res.json({ items: listItems() });
    });

    app.post("/api/spells/grocery-list/items", (req, res) => {
      const { text } = req.body as { text?: string };
      if (!text || !text.trim()) {
        res.status(400).json({ error: "text is required" });
        return;
      }
      const item = addItem(text.trim());
      res.status(201).json(item);
    });

    app.put("/api/spells/grocery-list/items/:id", (req, res) => {
      const { checked } = req.body as { checked?: boolean };
      setItemChecked(req.params.id, Boolean(checked));
      res.status(204).end();
    });

    app.delete("/api/spells/grocery-list/items/:id", (req, res) => {
      deleteItem(req.params.id);
      res.status(204).end();
    });
  },
};

export default mod;
