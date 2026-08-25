import type { SmartHomeDevice, UpdateSmartHomeDevice } from "./smartHomeActions";

/** Shared by the whole-house Summaries panel and each room card's master toggles -- both
 * need the same "call one service against every matching entity" + "is this group
 * uniformly in state X" building blocks, just scoped to a different device list. */

export async function bulkCall(entityIds: string[], service: string, data?: Record<string, unknown>) {
  await fetch("/api/spells/smart-home/bulk-call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityIds, service, data }),
  });
}

/** Optimistically patches every device in `list` to `optimisticState`, then fires one
 * bulk-call request -- the same "patch now, let the SSE push confirm/correct later"
 * pattern every other action in this Spell uses. */
export function runBulk(
  updateDevice: UpdateSmartHomeDevice,
  list: SmartHomeDevice[],
  service: string,
  optimisticState: string,
  data?: Record<string, unknown>
) {
  for (const device of list) updateDevice(device.entityId, { state: optimisticState });
  void bulkCall(
    list.map((d) => d.entityId),
    service,
    data
  );
}

export function allMatch(devices: SmartHomeDevice[], predicate: (d: SmartHomeDevice) => boolean): boolean {
  return devices.length > 0 && devices.every(predicate);
}

export function allMatchState(devices: SmartHomeDevice[], state: string): boolean {
  return allMatch(devices, (d) => d.state === state);
}
