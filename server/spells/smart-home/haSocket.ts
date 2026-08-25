import { EventEmitter } from "node:events";
import WebSocket, { type RawData } from "ws";
import { loadConnection } from "./tokenStore.js";

/** A state_changed push from Home Assistant, re-shaped to match haClient.ts's HaState. */
export interface HaPushedState {
  entityId: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface HaArea {
  id: string;
  name: string;
}

const MAX_RECONNECT_DELAY_MS = 30_000;
const REGISTRY_REFRESH_DEBOUNCE_MS = 2_000;

/** Entities whose device_class marks them as a doorbell button/sensor across the various
 * HA integrations (binary_sensor for most, `event` domain for newer ones) -- there's no
 * single doorbell domain or event type to key off of. */
const DOORBELL_DEVICE_CLASS = "doorbell";

const emitter = new EventEmitter();

let ws: WebSocket | null = null;
let stopped = true;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelayMs = 1000;
let nextCommandId = 1;
let registryRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const pendingResults = new Map<number, { resolve: (value: unknown) => void; reject: (err: unknown) => void }>();

// Registry caches used to resolve an entity to its room/area.
let areaNameById = new Map<string, string>();
let entityAreaId = new Map<string, string>();

function domainOf(entityId: string): string {
  return entityId.split(".", 1)[0];
}

function wsUrlFromBase(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/api/websocket`;
  return url.toString();
}

function send(socket: WebSocket, msg: Record<string, unknown>) {
  socket.send(JSON.stringify(msg));
}

function sendCommand<T>(type: string, extra?: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error("Home Assistant socket is not open"));
      return;
    }
    const id = nextCommandId++;
    pendingResults.set(id, { resolve: resolve as (value: unknown) => void, reject });
    send(ws, { id, type, ...extra });
  });
}

function handleResult(msg: { id: number; success: boolean; result: unknown; error?: { message?: string } }) {
  const pending = pendingResults.get(msg.id);
  if (!pending) return;
  pendingResults.delete(msg.id);
  if (msg.success) pending.resolve(msg.result);
  else pending.reject(new Error(msg.error?.message ?? "Home Assistant command failed"));
}

interface HaRegistryArea {
  area_id: string;
  name: string;
}
interface HaRegistryDevice {
  id: string;
  area_id: string | null;
}
interface HaRegistryEntity {
  entity_id: string;
  device_id: string | null;
  area_id: string | null;
}

async function refreshRegistries(): Promise<void> {
  try {
    const [areas, devices, entities] = await Promise.all([
      sendCommand<HaRegistryArea[]>("config/area_registry/list"),
      sendCommand<HaRegistryDevice[]>("config/device_registry/list"),
      sendCommand<HaRegistryEntity[]>("config/entity_registry/list"),
    ]);
    const deviceAreaId = new Map(devices.map((d) => [d.id, d.area_id]));
    const nextEntityAreaId = new Map<string, string>();
    for (const entity of entities) {
      const areaId = entity.area_id ?? (entity.device_id ? (deviceAreaId.get(entity.device_id) ?? null) : null);
      if (areaId) nextEntityAreaId.set(entity.entity_id, areaId);
    }
    areaNameById = new Map(areas.map((a) => [a.area_id, a.name]));
    entityAreaId = nextEntityAreaId;
  } catch (err) {
    console.error("[smart-home] Couldn't load Home Assistant's area registry", err);
  }
}

function scheduleRegistryRefresh() {
  if (registryRefreshTimer) return;
  registryRefreshTimer = setTimeout(() => {
    registryRefreshTimer = null;
    void refreshRegistries();
  }, REGISTRY_REFRESH_DEBOUNCE_MS);
}

function checkDoorbell(entityId: string, oldState: { state?: string } | null, newState: { state: string; attributes: Record<string, unknown> }) {
  if (newState.attributes?.device_class !== DOORBELL_DEVICE_CLASS) return;
  const domain = domainOf(entityId);
  if (domain === "binary_sensor") {
    // Edge-triggered: only the off->on transition is a "ring", not every state push.
    if (oldState?.state !== "on" && newState.state === "on") emitter.emit("doorbell", entityId);
  } else if (domain === "event") {
    // An `event` entity's state is the timestamp it last fired -- any change is a new ring.
    emitter.emit("doorbell", entityId);
  }
}

interface HaEventMessage {
  event_type: string;
  data?: {
    entity_id: string;
    old_state: { state: string; attributes: Record<string, unknown> } | null;
    new_state: { state: string; attributes: Record<string, unknown> } | null;
  };
}

function handleEvent(event: HaEventMessage | undefined) {
  if (!event) return;
  switch (event.event_type) {
    case "state_changed": {
      const data = event.data;
      if (!data?.new_state) return;
      emitter.emit("device", {
        entityId: data.entity_id,
        state: data.new_state.state,
        attributes: data.new_state.attributes,
      } satisfies HaPushedState);
      checkDoorbell(data.entity_id, data.old_state, data.new_state);
      break;
    }
    case "area_registry_updated":
    case "device_registry_updated":
    case "entity_registry_updated":
      scheduleRegistryRefresh();
      break;
  }
}

async function subscribeAndLoadRegistries() {
  try {
    // No event_type filter -- subscribes to everything, so registry-updated events (used
    // to know when to re-resolve rooms) arrive over the same subscription as state_changed.
    await sendCommand("subscribe_events");
  } catch (err) {
    console.error("[smart-home] Couldn't subscribe to Home Assistant events", err);
  }
  await refreshRegistries();
}

function scheduleReconnect() {
  if (stopped || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelayMs);
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
}

function connect() {
  if (stopped) return;
  const connection = loadConnection();
  if (!connection) return;

  let socket: WebSocket;
  try {
    socket = new WebSocket(wsUrlFromBase(connection.baseUrl));
  } catch (err) {
    console.error("[smart-home] Couldn't open a WebSocket to Home Assistant", err);
    scheduleReconnect();
    return;
  }
  ws = socket;

  socket.on("message", (raw: RawData) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.type) {
      case "auth_required":
        send(socket, { type: "auth", access_token: connection.accessToken });
        break;
      case "auth_ok":
        reconnectDelayMs = 1000;
        void subscribeAndLoadRegistries();
        break;
      case "auth_invalid":
        console.error("[smart-home] Home Assistant rejected the stored access token");
        socket.close();
        break;
      case "result":
        handleResult(msg as { id: number; success: boolean; result: unknown; error?: { message?: string } });
        break;
      case "event":
        handleEvent(msg.event as HaEventMessage | undefined);
        break;
    }
  });

  socket.on("close", () => {
    if (ws === socket) ws = null;
    pendingResults.forEach(({ reject }) => reject(new Error("Home Assistant socket disconnected")));
    pendingResults.clear();
    scheduleReconnect();
  });

  socket.on("error", () => {
    socket.close();
  });
}

export function startHaSocket(): void {
  stopped = false;
  reconnectDelayMs = 1000;
  if (!ws) connect();
}

export function stopHaSocket(): void {
  stopped = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (registryRefreshTimer) {
    clearTimeout(registryRefreshTimer);
    registryRefreshTimer = null;
  }
  ws?.close();
  ws = null;
  areaNameById = new Map();
  entityAreaId = new Map();
}

export function isSocketConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export function getAreaForEntity(entityId: string): HaArea | null {
  const areaId = entityAreaId.get(entityId);
  if (!areaId) return null;
  const name = areaNameById.get(areaId);
  if (!name) return null;
  return { id: areaId, name };
}

export function listAreas(): HaArea[] {
  return Array.from(areaNameById.entries()).map(([id, name]) => ({ id, name }));
}

/** Emits `"device"` with a HaPushedState on every state_changed, and `"doorbell"` with an
 * entityId whenever a device_class:"doorbell" entity rings. */
export const haSocketEvents = emitter;
