import { randomUUID } from "node:crypto";
import { db } from "../../src/db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS grocery_items (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

export interface GroceryItem {
  id: string;
  text: string;
  checked: boolean;
}

export function listItems(): GroceryItem[] {
  const rows = db
    .prepare("SELECT id, text, checked FROM grocery_items ORDER BY position")
    .all() as { id: string; text: string; checked: number }[];
  return rows.map((r) => ({ id: r.id, text: r.text, checked: Boolean(r.checked) }));
}

export function addItem(text: string): GroceryItem {
  const id = randomUUID();
  const { next } = db.prepare("SELECT COALESCE(MAX(position) + 1, 0) as next FROM grocery_items").get() as {
    next: number;
  };
  db.prepare("INSERT INTO grocery_items (id, text, checked, position) VALUES (?, ?, 0, ?)").run(id, text, next);
  return { id, text, checked: false };
}

export function setItemChecked(id: string, checked: boolean): void {
  db.prepare("UPDATE grocery_items SET checked = ? WHERE id = ?").run(checked ? 1 : 0, id);
}

export function deleteItem(id: string): void {
  db.prepare("DELETE FROM grocery_items WHERE id = ?").run(id);
}
