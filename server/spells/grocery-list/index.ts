import type { Express } from "express";
import type { SpellModule } from "../../src/types.js";
import {
  listItems,
  addItem,
  addItemFromText,
  addParsedItem,
  setItemChecked,
  setItemInCart,
  setItemStaple,
  setItemSearchTerm,
  setItemsChecked,
  setItemsInCart,
  deleteItem,
  deleteItems,
} from "./store.js";

const BULK_ACTIONS = ["check", "uncheck", "cart", "uncart", "delete"] as const;
type BulkAction = (typeof BULK_ACTIONS)[number];

const mod: SpellModule = {
  register(app: Express) {
    app.get("/api/spells/grocery-list/items", (_req, res) => {
      res.json({ items: listItems() });
    });

    app.post("/api/spells/grocery-list/items", (req, res) => {
      const { text, quantity, name, isStaple, note, amount, unit } = req.body as {
        text?: string;
        quantity?: string;
        name?: string;
        isStaple?: boolean;
        note?: string;
        amount?: number | null;
        unit?: string | null;
      };
      if (typeof name === "string" && name.trim()) {
        if (isStaple !== undefined || note !== undefined || amount !== undefined || unit !== undefined) {
          const item = addParsedItem({
            name: name.trim(),
            quantity: (quantity ?? "").trim(),
            isStaple: Boolean(isStaple),
            note: note ?? "",
            amount: typeof amount === "number" ? amount : null,
            unit: unit || null,
          });
          res.status(201).json(item);
          return;
        }
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
      const { checked, searchTerm, isStaple, inCart } = req.body as {
        checked?: boolean;
        searchTerm?: string;
        isStaple?: boolean;
        inCart?: boolean;
      };
      if (typeof checked === "boolean") {
        setItemChecked(req.params.id, checked);
      }
      if (typeof searchTerm === "string" && searchTerm.trim()) {
        setItemSearchTerm(req.params.id, searchTerm.trim());
      }
      if (typeof isStaple === "boolean") {
        setItemStaple(req.params.id, isStaple);
      }
      if (typeof inCart === "boolean") {
        setItemInCart(req.params.id, inCart);
      }
      res.status(204).end();
    });

    app.post("/api/spells/grocery-list/items/bulk", (req, res) => {
      const { ids, action } = req.body as { ids?: string[]; action?: string };
      if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
        res.status(400).json({ error: "ids is required" });
        return;
      }
      if (!BULK_ACTIONS.includes(action as BulkAction)) {
        res.status(400).json({ error: `action must be one of: ${BULK_ACTIONS.join(", ")}` });
        return;
      }
      switch (action as BulkAction) {
        case "check":
          setItemsChecked(ids, true);
          break;
        case "uncheck":
          setItemsChecked(ids, false);
          break;
        case "cart":
          setItemsInCart(ids, true);
          break;
        case "uncart":
          setItemsInCart(ids, false);
          break;
        case "delete":
          deleteItems(ids);
          break;
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
