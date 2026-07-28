import { randomUUID } from "node:crypto";
import { db } from "../../src/db.js";
import { splitIngredientText } from "../../src/ingredientText.js";

const existingColumns = db.prepare("PRAGMA table_info(grocery_items)").all() as { name: string }[];
const hasNameColumn = existingColumns.some((c) => c.name === "name");

if (existingColumns.length > 0 && !hasNameColumn) {
  // Migrate from a single free-text item ("2 cups flour") to a separate
  // quantity/name/search_term, so the Fred Meyer product search can target
  // just the name instead of the whole line.
  const migrate = db.transaction(() => {
    const rows = db.prepare("SELECT id, text, checked, position, created_at FROM grocery_items").all() as {
      id: string;
      text: string;
      checked: number;
      position: number;
      created_at: string;
    }[];
    db.exec("DROP TABLE grocery_items");
    db.exec(`
      CREATE TABLE grocery_items (
        id TEXT PRIMARY KEY,
        quantity TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        search_term TEXT NOT NULL,
        checked INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    const insert = db.prepare(
      "INSERT INTO grocery_items (id, quantity, name, search_term, checked, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const row of rows) {
      const { quantity, name } = splitIngredientText(row.text);
      insert.run(row.id, quantity, name, name, row.checked, row.position, row.created_at);
    }
  });
  migrate();
} else {
  db.exec(`
    CREATE TABLE IF NOT EXISTS grocery_items (
      id TEXT PRIMARY KEY,
      quantity TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      search_term TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export interface GroceryItem {
  id: string;
  quantity: string;
  name: string;
  searchTerm: string;
  checked: boolean;
}

function rowToItem(row: {
  id: string;
  quantity: string;
  name: string;
  search_term: string;
  checked: number;
}): GroceryItem {
  return {
    id: row.id,
    quantity: row.quantity,
    name: row.name,
    searchTerm: row.search_term,
    checked: Boolean(row.checked),
  };
}

export function listItems(): GroceryItem[] {
  const rows = db
    .prepare("SELECT id, quantity, name, search_term, checked FROM grocery_items ORDER BY position")
    .all() as { id: string; quantity: string; name: string; search_term: string; checked: number }[];
  return rows.map(rowToItem);
}

export function addItem(quantity: string, name: string, searchTerm?: string): GroceryItem {
  const id = randomUUID();
  const { next } = db.prepare("SELECT COALESCE(MAX(position) + 1, 0) as next FROM grocery_items").get() as {
    next: number;
  };
  const resolvedSearchTerm = searchTerm?.trim() || name;
  db.prepare(
    "INSERT INTO grocery_items (id, quantity, name, search_term, checked, position) VALUES (?, ?, ?, ?, 0, ?)"
  ).run(id, quantity, name, resolvedSearchTerm, next);
  return { id, quantity, name, searchTerm: resolvedSearchTerm, checked: false };
}

export function addItemFromText(text: string): GroceryItem {
  const { quantity, name } = splitIngredientText(text);
  return addItem(quantity, name);
}

export function setItemChecked(id: string, checked: boolean): void {
  db.prepare("UPDATE grocery_items SET checked = ? WHERE id = ?").run(checked ? 1 : 0, id);
}

export function setItemSearchTerm(id: string, searchTerm: string): void {
  db.prepare("UPDATE grocery_items SET search_term = ? WHERE id = ?").run(searchTerm, id);
}

export function deleteItem(id: string): void {
  db.prepare("DELETE FROM grocery_items WHERE id = ?").run(id);
}
