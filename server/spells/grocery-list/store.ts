import { randomUUID } from "node:crypto";
import { db } from "../../src/db.js";
import { splitIngredientText } from "../../src/ingredientText.js";
import { getSettings, setSettings } from "../../src/settingsStore.js";
import { parseQuantity, combineQuantities, formatQuantity } from "../../src/quantity.js";

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
        is_staple INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        amount REAL,
        unit TEXT,
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
      is_staple INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      amount REAL,
      unit TEXT,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

// Additive migration for DBs created before the staple/note/amount/unit columns
// existed (ALTER TABLE ADD COLUMN is safe/idempotent-checked here since these are
// all nullable or have a constant default, unlike the name/quantity split above).
const columnsAfterBase = db.prepare("PRAGMA table_info(grocery_items)").all() as { name: string }[];
function ensureColumn(name: string, ddl: string) {
  if (!columnsAfterBase.some((c) => c.name === name)) {
    db.exec(`ALTER TABLE grocery_items ADD COLUMN ${ddl}`);
  }
}
ensureColumn("is_staple", "is_staple INTEGER NOT NULL DEFAULT 0");
ensureColumn("note", "note TEXT NOT NULL DEFAULT ''");
ensureColumn("amount", "amount REAL");
ensureColumn("unit", "unit TEXT");
ensureColumn("in_cart", "in_cart INTEGER NOT NULL DEFAULT 0");

const STAPLES_SCOPE = "grocery-list";
const STAPLES_KEY = "staples";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function getStaples(): string[] {
  const value = getSettings(STAPLES_SCOPE)[STAPLES_KEY];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function addStaple(name: string): void {
  const staples = getStaples();
  const normalized = normalizeName(name);
  if (staples.some((s) => normalizeName(s) === normalized)) return;
  setSettings(STAPLES_SCOPE, { [STAPLES_KEY]: [...staples, name.trim()] });
}

function removeStaple(name: string): void {
  const staples = getStaples();
  const normalized = normalizeName(name);
  setSettings(STAPLES_SCOPE, { [STAPLES_KEY]: staples.filter((s) => normalizeName(s) !== normalized) });
}

export interface GroceryItem {
  id: string;
  quantity: string;
  name: string;
  searchTerm: string;
  checked: boolean;
  isStaple: boolean;
  note: string;
  inCart: boolean;
}

interface GroceryItemRow {
  id: string;
  quantity: string;
  name: string;
  search_term: string;
  checked: number;
  is_staple: number;
  note: string;
  amount: number | null;
  unit: string | null;
  in_cart: number;
}

function rowToItem(row: GroceryItemRow): GroceryItem {
  return {
    id: row.id,
    quantity: row.quantity,
    name: row.name,
    searchTerm: row.search_term,
    checked: Boolean(row.checked),
    isStaple: Boolean(row.is_staple),
    note: row.note,
    inCart: Boolean(row.in_cart),
  };
}

const SELECT_COLUMNS = "id, quantity, name, search_term, checked, is_staple, note, amount, unit, in_cart";

export function listItems(): GroceryItem[] {
  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM grocery_items ORDER BY position`)
    .all() as GroceryItemRow[];
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
  return { id, quantity, name, searchTerm: resolvedSearchTerm, checked: false, isStaple: false, note: "", inCart: false };
}

export function addItemFromText(text: string): GroceryItem {
  const { quantity, name } = splitIngredientText(text);
  return addItem(quantity, name);
}

export interface ParsedGroceryInput {
  name: string;
  quantity: string;
  isStaple: boolean;
  note: string;
  amount: number | null;
  unit: string | null;
}

function toStructuredQuantity(amount: number | null, unitText: string | null) {
  if (amount === null) return null;
  if (!unitText) return { amount, unitKey: "", family: "count" as const };
  const probe = parseQuantity(`1 ${unitText}`);
  if (probe) return { amount, unitKey: probe.unitKey, family: probe.family };
  return { amount, unitKey: unitText.trim().toLowerCase(), family: "count" as const };
}

/**
 * Adds an AI-parsed ingredient, merging into an existing unchecked item of the same
 * name when both have a reconcilable amount/unit (see server/src/quantity.ts) rather
 * than creating a duplicate line every time the same ingredient is sent again from a
 * later recipe/meal-plan send.
 */
export function addParsedItem(input: ParsedGroceryInput): GroceryItem {
  const normalized = normalizeName(input.name);
  const existing = db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM grocery_items WHERE checked = 0 AND in_cart = 0 AND LOWER(TRIM(name)) = ?`
    )
    .get(normalized) as GroceryItemRow | undefined;

  if (existing) {
    const existingQty = toStructuredQuantity(existing.amount, existing.unit);
    const incomingQty = toStructuredQuantity(input.amount, input.unit);
    const combined = existingQty && incomingQty ? combineQuantities(existingQty, incomingQty) : null;
    if (combined) {
      const quantity = formatQuantity(combined);
      const note = input.note || existing.note;
      db.prepare("UPDATE grocery_items SET quantity = ?, amount = ?, unit = ?, note = ? WHERE id = ?").run(
        quantity,
        combined.amount,
        combined.unitKey,
        note,
        existing.id
      );
      if (input.isStaple) addStaple(input.name);
      return rowToItem({ ...existing, quantity, amount: combined.amount, unit: combined.unitKey, note });
    }
    // Same name, but the quantities can't be reconciled (missing/incompatible units)
    // — fall through and add a new line rather than guessing.
  }

  if (input.isStaple) addStaple(input.name);

  const id = randomUUID();
  const { next } = db.prepare("SELECT COALESCE(MAX(position) + 1, 0) as next FROM grocery_items").get() as {
    next: number;
  };
  db.prepare(
    `INSERT INTO grocery_items (id, quantity, name, search_term, checked, is_staple, note, amount, unit, position)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
  ).run(id, input.quantity, input.name, input.name, input.isStaple ? 1 : 0, input.note, input.amount, input.unit, next);
  return {
    id,
    quantity: input.quantity,
    name: input.name,
    searchTerm: input.name,
    checked: false,
    isStaple: input.isStaple,
    note: input.note,
    inCart: false,
  };
}

export function setItemChecked(id: string, checked: boolean): void {
  db.prepare("UPDATE grocery_items SET checked = ? WHERE id = ?").run(checked ? 1 : 0, id);
}

export function setItemInCart(id: string, inCart: boolean): void {
  db.prepare("UPDATE grocery_items SET in_cart = ? WHERE id = ?").run(inCart ? 1 : 0, id);
}

export function setItemsChecked(ids: string[], checked: boolean): void {
  const stmt = db.prepare("UPDATE grocery_items SET checked = ? WHERE id = ?");
  db.transaction((allIds: string[]) => {
    for (const id of allIds) stmt.run(checked ? 1 : 0, id);
  })(ids);
}

export function setItemsInCart(ids: string[], inCart: boolean): void {
  const stmt = db.prepare("UPDATE grocery_items SET in_cart = ? WHERE id = ?");
  db.transaction((allIds: string[]) => {
    for (const id of allIds) stmt.run(inCart ? 1 : 0, id);
  })(ids);
}

export function deleteItems(ids: string[]): void {
  const stmt = db.prepare("DELETE FROM grocery_items WHERE id = ?");
  db.transaction((allIds: string[]) => {
    for (const id of allIds) stmt.run(id);
  })(ids);
}

export function setItemStaple(id: string, isStaple: boolean): void {
  const row = db.prepare("SELECT name FROM grocery_items WHERE id = ?").get(id) as { name: string } | undefined;
  db.prepare("UPDATE grocery_items SET is_staple = ? WHERE id = ?").run(isStaple ? 1 : 0, id);
  if (row) {
    if (isStaple) addStaple(row.name);
    else removeStaple(row.name);
  }
}

export function setItemSearchTerm(id: string, searchTerm: string): void {
  db.prepare("UPDATE grocery_items SET search_term = ? WHERE id = ?").run(searchTerm, id);
}

export function deleteItem(id: string): void {
  db.prepare("DELETE FROM grocery_items WHERE id = ?").run(id);
}
