import type { Express, Request, Response } from "express";
import type { SpellModule } from "../../src/types.js";
import { saveConnection, isConnected, clearConnection } from "./tokenStore.js";
import { listStates, callService, proxyCameraSnapshot, proxyCameraStream, NotConnectedError } from "./haClient.js";
import {
  startHaSocket,
  stopHaSocket,
  getAreaForEntity,
  haSocketEvents,
  type HaPushedState,
} from "./haSocket.js";
import { addSseClient, removeSseClient, broadcast } from "./sseHub.js";

/** Domains this Spell knows how to render/control — everything else in `/api/states` is ignored. */
const SUPPORTED_DOMAINS = new Set(["light", "switch", "climate", "lock", "fan", "cover", "camera", "media_player"]);

/** Domains a "3 lights on" style glance summary counts, and each one's "active" state. */
const SUMMARY_ACTIVE_STATE: Record<string, string> = {
  light: "on",
  switch: "on",
  fan: "on",
  lock: "locked",
  cover: "open",
  media_player: "playing",
};

/** Areas without a real Home Assistant room (no registry entry, or one whose area_id
 * isn't set) all land in this synthetic bucket, sorted last. */
const OTHER_AREA_ID = "__other__";

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

/** Relays haSocket's live events to every connected browser over SSE -- registered once
 * at module load, independent of any single request. */
function wireLiveEvents() {
  haSocketEvents.on("device", (pushed: HaPushedState) => {
    if (!SUPPORTED_DOMAINS.has(domainOf(pushed.entityId))) return;
    broadcast("device-update", {
      entityId: pushed.entityId,
      domain: domainOf(pushed.entityId),
      state: pushed.state,
      attributes: pushed.attributes,
    });
  });

  haSocketEvents.on("doorbell", (entityId: string) => {
    void (async () => {
      try {
        const states = await listStates();
        const cameras = states.filter((s) => domainOf(s.entity_id) === "camera");
        if (cameras.length === 0) return; // "if anyone rings a doorbell WITH a camera"
        const doorbellArea = getAreaForEntity(entityId);
        const sameAreaCamera = doorbellArea
          ? cameras.find((c) => getAreaForEntity(c.entity_id)?.id === doorbellArea.id)
          : undefined;
        const cameraEntityId = sameAreaCamera?.entity_id ?? (cameras.length === 1 ? cameras[0].entity_id : null);
        if (!cameraEntityId) return;
        const doorbellState = states.find((s) => s.entity_id === entityId);
        const name =
          typeof doorbellState?.attributes.friendly_name === "string" ? doorbellState.attributes.friendly_name : entityId;
        broadcast("doorbell", { entityId, name, cameraEntityId });
      } catch (err) {
        console.error("[smart-home spell] doorbell handling failed", err);
      }
    })();
  });
}

const mod: SpellModule = {
  register(app: Express) {
    wireLiveEvents();
    if (isConnected()) startHaSocket();

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
        startHaSocket();
        res.status(204).end();
      })
    );

    app.post("/api/spells/smart-home/disconnect", (_req, res) => {
      stopHaSocket();
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
      "/api/spells/smart-home/areas",
      handleErrors(async (_req, res) => {
        const states = await listStates();
        const devices = states.filter((s) => SUPPORTED_DOMAINS.has(domainOf(s.entity_id)));
        const areas = new Map<string, { id: string; name: string; entityIds: string[] }>();
        for (const device of devices) {
          const area = getAreaForEntity(device.entity_id);
          const id = area?.id ?? OTHER_AREA_ID;
          const name = area?.name ?? "Other";
          const bucket = areas.get(id) ?? { id, name, entityIds: [] };
          bucket.entityIds.push(device.entity_id);
          areas.set(id, bucket);
        }
        const areaList = Array.from(areas.values()).sort((a, b) =>
          a.id === OTHER_AREA_ID ? 1 : b.id === OTHER_AREA_ID ? -1 : a.name.localeCompare(b.name)
        );
        res.json({ areas: areaList });
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

    app.post(
      "/api/spells/smart-home/bulk-call",
      handleErrors(async (req, res) => {
        const { entityIds, service, data } = req.body as {
          entityIds?: string[];
          service?: string;
          data?: Record<string, unknown>;
        };
        if (!Array.isArray(entityIds) || entityIds.length === 0 || !service) {
          res.status(400).json({ error: "entityIds and service are required" });
          return;
        }
        const idsByDomain = new Map<string, string[]>();
        for (const entityId of entityIds) {
          const domain = domainOf(entityId);
          const list = idsByDomain.get(domain);
          if (list) list.push(entityId);
          else idsByDomain.set(domain, [entityId]);
        }
        await Promise.all(
          Array.from(idsByDomain.entries()).map(([domain, ids]) =>
            callService(domain, service, { entity_id: ids, ...(data ?? {}) })
          )
        );
        res.status(204).end();
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

    app.get("/api/spells/smart-home/events", (req, res) => {
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
      res.write("retry: 3000\n\n");
      addSseClient(res);
      req.on("close", () => removeSseClient(res));
    });
  },
};

export default mod;
