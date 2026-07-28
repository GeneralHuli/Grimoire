import type { Express } from "express";
import type { SpellModule } from "../../src/types.js";
import { listItems, addItem, addItemFromText, setItemChecked, setItemSearchTerm, deleteItem } from "./store.js";

const mod: SpellModule = {
  register(app: Express) {
    app.get("/api/spells/grocery-list/items", (_req, res) => {
      res.json({ items: listItems() });
    });

    app.post("/api/spells/grocery-list/items", (req, res) => {
      const { text, quantity, name } = req.body as { text?: string; quantity?: string; name?: string };
      if (typeof name === "string" && name.trim()) {
        const item = addItem((quantity ?? "").trim(), name.trim());
        res.status(201).json(item);
        return;
      }
      if (!text || !text.trim()) {
        res.status(400).json({ error: "name or text is required" });
        return;
      }
      const item = addItemFromText(text.trim());
      res.status(201).json(item);
    });

    app.put("/api/spells/grocery-list/items/:id", (req, res) => {
      const { checked, searchTerm } = req.body as { checked?: boolean; searchTerm?: string };
      if (typeof checked === "boolean") {
        setItemChecked(req.params.id, checked);
      }
      if (typeof searchTerm === "string" && searchTerm.trim()) {
        setItemSearchTerm(req.params.id, searchTerm.trim());
      }
      res.status(204).end();
    });

    app.delete("/api/spells/grocery-list/items/:id", (req, res) => {
      deleteItem(req.params.id);
      res.status(204).end();
    });
  },
};

export default mod;
