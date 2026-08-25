import type { Response } from "express";

/** Fan-out hub for /api/spells/smart-home/events -- every connected browser tab (spell
 * page, home-dashboard widget, the global doorbell listener) gets its own Response held
 * open here, and haSocket's device/doorbell events get broadcast to all of them at once. */
const clients = new Set<Response>();

const KEEPALIVE_MS = 25_000;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

function ensureKeepalive() {
  if (keepaliveTimer) return;
  // A silent comment frame, not a real event -- keeps the connection from going idle
  // through HAProxy (see docs/ARCHITECTURE.md) without the frontend having to parse it.
  keepaliveTimer = setInterval(() => {
    for (const res of clients) res.write(": ping\n\n");
  }, KEEPALIVE_MS);
  keepaliveTimer.unref();
}

export function addSseClient(res: Response): void {
  clients.add(res);
  ensureKeepalive();
}

export function removeSseClient(res: Response): void {
  clients.delete(res);
  if (clients.size === 0 && keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
}

export function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}
