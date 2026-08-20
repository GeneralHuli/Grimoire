import { db } from "../../src/db.js";
import { encrypt, decrypt } from "../../src/secretBox.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS smart_home_connection (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    base_url TEXT NOT NULL,
    access_token TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

export interface StoredConnection {
  baseUrl: string;
  accessToken: string;
}

/** One household Home Assistant instance per Grimoire deployment, so this is a singleton row. */
export function saveConnection(connection: StoredConnection): void {
  db.prepare(
    `INSERT INTO smart_home_connection (id, base_url, access_token, updated_at)
     VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       base_url = excluded.base_url,
       access_token = excluded.access_token,
       updated_at = excluded.updated_at`
  ).run(connection.baseUrl, encrypt(connection.accessToken));
}

export function loadConnection(): StoredConnection | null {
  const row = db
    .prepare<[], { base_url: string; access_token: string }>(
      "SELECT base_url, access_token FROM smart_home_connection WHERE id = 1"
    )
    .get();
  if (!row) return null;
  return {
    baseUrl: row.base_url,
    accessToken: decrypt(row.access_token),
  };
}

export function isConnected(): boolean {
  return loadConnection() !== null;
}

export function clearConnection(): void {
  db.prepare("DELETE FROM smart_home_connection WHERE id = 1").run();
}
