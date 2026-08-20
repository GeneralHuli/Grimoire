import type { Express, Request, Response } from "express";
import type { SpellModule } from "../../src/types.js";
import { saveConnection, isConnected, clearConnection } from "./tokenStore.js";
import { listStates, callService, proxyCameraSnapshot, proxyCameraStream, NotConnectedError } from "./haClient.js";

/** Domains this Spell knows how to render/control — everything else in `/api/states` is ignored. */
const SUPPORTED_DOMAINS = new Set(["light", "switch", "climate", "lock", "fan", "cover", "camera"]);

/** Domains a "3 lights on" style glance summary counts, and each one's "active" state. */
const SUMMARY_ACTIVE_STATE: Record<string, string> = {
  light: "on",
  switch: "on",
  fan: "on",
  lock: "locked",
  cover: "open",
};

function domainOf(entityId: string): string {
  return entityId.split(".", 1)[0];
}

function handleErrors(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      if (err instanceof NotConnectedError) {
        res.status(401).json({ error: "not_connected" });
        return;
      }
      console.error("[smart-home spell]", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "internal_error" });
    });
  };
}

const mod: SpellModule = {
  register(app: Express) {
    app.get("/api/spells/smart-home/status", (_req, res) => {
      res.json({ connected: isConnected() });
    });

    app.post(
      "/api/spells/smart-home/connect",
      handleErrors(async (req, res) => {
        const { baseUrl, accessToken } = req.body as { baseUrl?: string; accessToken?: string };
        if (!baseUrl || !accessToken) {
          res.status(400).json({ error: "baseUrl and accessToken are required" });
          return;
        }
        const normalizedBaseUrl = baseUrl.trim().replace(/\/$/, "");
        saveConnection({ baseUrl: normalizedBaseUrl, accessToken: accessToken.trim() });
        try {
          await listStates();
        } catch {
          clearConnection();
          res.status(400).json({ error: "Couldn't reach Home Assistant with that URL/token" });
          return;
        }
        res.status(204).end();
      })
    );

    app.post("/api/spells/smart-home/disconnect", (_req, res) => {
      clearConnection();
      res.status(204).end();
    });

    app.get(
      "/api/spells/smart-home/devices",
      handleErrors(async (_req, res) => {
        const states = await listStates();
        const devices = states
          .filter((s) => SUPPORTED_DOMAINS.has(domainOf(s.entity_id)))
          .map((s) => ({
            entityId: s.entity_id,
            domain: domainOf(s.entity_id),
            name: typeof s.attributes.friendly_name === "string" ? s.attributes.friendly_name : s.entity_id,
            state: s.state,
            attributes: s.attributes,
          }));
        res.json({ devices });
      })
    );

    app.get(
      "/api/spells/smart-home/summary",
      handleErrors(async (_req, res) => {
        const states = await listStates();
        const byDomain = new Map<string, { onCount: number; totalCount: number }>();
        for (const state of states) {
          const domain = domainOf(state.entity_id);
          const activeState = SUMMARY_ACTIVE_STATE[domain];
          if (!activeState) continue;
          const counts = byDomain.get(domain) ?? { onCount: 0, totalCount: 0 };
          counts.totalCount += 1;
          if (state.state === activeState) counts.onCount += 1;
          byDomain.set(domain, counts);
        }
        const summary = Array.from(byDomain.entries()).map(([domain, counts]) => ({ domain, ...counts }));
        res.json({ summary });
      })
    );

    app.post(
      "/api/spells/smart-home/devices/:entityId/call",
      handleErrors(async (req, res) => {
        const { service, data } = req.body as { service?: string; data?: Record<string, unknown> };
        if (!service) {
          res.status(400).json({ error: "service is required" });
          return;
        }
        const entityId = req.params.entityId;
        const states = await callService(domainOf(entityId), service, { entity_id: entityId, ...(data ?? {}) });
        res.json({ states });
      })
    );

    app.get(
      "/api/spells/smart-home/devices/:entityId/snapshot",
      handleErrors(async (req, res) => {
        await proxyCameraSnapshot(req.params.entityId, res);
      })
    );

    app.get(
      "/api/spells/smart-home/devices/:entityId/stream",
      handleErrors(async (req, res) => {
        await proxyCameraStream(req.params.entityId, res);
      })
    );
  },
};

export default mod;
