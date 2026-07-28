import { db } from "../../src/db.js";
import { encrypt, decrypt } from "../../src/secretBox.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS kroger_account_tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** ISO timestamp. */
  expiresAt: string;
}

/** One family Fred Meyer account per Grimoire instance, so this is a singleton row. */
export function saveTokens(tokens: StoredTokens): void {
  db.prepare(
    `INSERT INTO kroger_account_tokens (id, access_token, refresh_token, expires_at, updated_at)
     VALUES (1, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`
  ).run(encrypt(tokens.accessToken), encrypt(tokens.refreshToken), tokens.expiresAt);
}

export function loadTokens(): StoredTokens | null {
  const row = db
    .prepare<[], { access_token: string; refresh_token: string; expires_at: string }>(
      "SELECT access_token, refresh_token, expires_at FROM kroger_account_tokens WHERE id = 1"
    )
    .get();
  if (!row) return null;
  return {
    accessToken: decrypt(row.access_token),
    refreshToken: decrypt(row.refresh_token),
    expiresAt: row.expires_at,
  };
}

export function isConnected(): boolean {
  return loadTokens() !== null;
}

export function clearTokens(): void {
  db.prepare("DELETE FROM kroger_account_tokens WHERE id = 1").run();
}
