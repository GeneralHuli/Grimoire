import type { Response } from "express";
import { loadConnection } from "./tokenStore.js";

export interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

class NotConnectedError extends Error {
  constructor() {
    super("Home Assistant is not connected");
  }
}

function requireConnection() {
  const connection = loadConnection();
  if (!connection) throw new NotConnectedError();
  return connection;
}

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function listStates(): Promise<HaState[]> {
  const { baseUrl, accessToken } = requireConnection();
  const res = await fetch(`${baseUrl}/api/states`, { headers: authHeaders(accessToken) });
  if (!res.ok) throw new Error(`Home Assistant returned ${res.status} listing states`);
  return (await res.json()) as HaState[];
}

export async function callService(
  domain: string,
  service: string,
  data: Record<string, unknown>
): Promise<HaState[]> {
  const { baseUrl, accessToken } = requireConnection();
  const res = await fetch(`${baseUrl}/api/services/${domain}/${service}`, {
    method: "POST",
    headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Home Assistant returned ${res.status} calling ${domain}.${service}`);
  return (await res.json()) as HaState[];
}

/** Proxies a Home Assistant camera endpoint straight through to an Express response — the
 * access token must never reach the browser, so Grimoire's server fetches it and pipes the
 * body/content-type back rather than handing out a URL the client could call directly. */
async function proxyToResponse(path: string, res: Response): Promise<void> {
  const { baseUrl, accessToken } = requireConnection();
  const haRes = await fetch(`${baseUrl}${path}`, { headers: authHeaders(accessToken) });
  if (!haRes.ok || !haRes.body) {
    res.status(haRes.status || 502).json({ error: "Home Assistant camera request failed" });
    return;
  }
  res.status(200);
  const contentType = haRes.headers.get("content-type");
  if (contentType) res.setHeader("Content-Type", contentType);
  const reader = haRes.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    res.end();
  }
}

export function proxyCameraSnapshot(entityId: string, res: Response): Promise<void> {
  return proxyToResponse(`/api/camera_proxy/${entityId}`, res);
}

/** Multipart MJPEG stream — browsers render `multipart/x-mixed-replace` natively in a
 * plain <img> tag, so this needs no WebSocket client or video-player library. */
export function proxyCameraStream(entityId: string, res: Response): Promise<void> {
  return proxyToResponse(`/api/camera_proxy_stream/${entityId}`, res);
}

export { NotConnectedError };
