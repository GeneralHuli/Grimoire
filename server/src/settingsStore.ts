import { db } from "./db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    scope TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (scope, key)
  )
`);

/**
 * "scope" is either "general" or a Spell's manifest `name`. Values are stored as JSON
 * text so a setting can be a string, number, or boolean without a schema migration.
 */
export function getSettings(scope: string): Record<string, unknown> {
  const rows = db
    .prepare("SELECT key, value FROM settings WHERE scope = ?")
    .all(scope) as { key: string; value: string }[];

  const result: Record<string, unknown> = {};
  for (const row of rows) {
    result[row.key] = JSON.parse(row.value);
  }
  return result;
}

export function setSettings(scope: string, values: Record<string, unknown>): void {
  const stmt = db.prepare(
    `INSERT INTO settings (scope, key, value) VALUES (?, ?, ?)
     ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value`
  );
  const tx = db.transaction((entries: [string, unknown][]) => {
    for (const [key, value] of entries) {
      stmt.run(scope, key, JSON.stringify(value));
    }
  });
  tx(Object.entries(values));
}
