import { db } from "../../src/db.js";
import { encrypt, decrypt } from "../../src/secretBox.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS calendar_tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    refresh_token TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

/** Single family Google account per Grimoire instance, so this is a singleton row. */
export function saveRefreshToken(refreshToken: string): void {
  db.prepare(
    `INSERT INTO calendar_tokens (id, refresh_token, updated_at)
     VALUES (1, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET refresh_token = excluded.refresh_token, updated_at = excluded.updated_at`
  ).run(encrypt(refreshToken));
}

export function loadRefreshToken(): string | null {
  const row = db.prepare<[], { refresh_token: string }>(
    "SELECT refresh_token FROM calendar_tokens WHERE id = 1"
  ).get();
  return row ? decrypt(row.refresh_token) : null;
}

export function isConnected(): boolean {
  return loadRefreshToken() !== null;
}

export function clearRefreshToken(): void {
  db.prepare("DELETE FROM calendar_tokens WHERE id = 1").run();
}
