import type { SmartHomeArea, SmartHomeDevice } from "./smartHomeActions";
import { allMatch, allMatchState } from "./smartHomeBulk";

/** Domains a room-wide / whole-home master control can represent -- the same set
 * SmartHomeRoomControls already offers per room card in the full Spell view. Media
 * players and climate devices don't reduce to a single on/off style toggle the way
 * these do, so they're left out here too. */
export const GROUP_CONTROL_DOMAINS = ["light", "switch", "fan", "cover", "lock"] as const;

const GROUP_DOMAIN_LABELS: Record<string, string> = {
  light: "Lights",
  switch: "Switches",
  fan: "Fans",
  cover: "Covers",
  lock: "Locks",
};

/** Group placements live in the same glanceLayout entityId slot a real device would --
 * this prefix is how a placed entry is recognized as "every <domain> device in <area>"
 * rather than one real Home Assistant entity, with no change needed to the grid/drag
 * plumbing (smartHomeGrid.ts, smartHomeGridDrag.ts, the settings persistence) since none
 * of it looks at entityId beyond treating it as an opaque key. */
const GROUP_ID_PREFIX = "group:";
const WHOLE_HOME_TOKEN = "__home__";

export function groupControlId(areaId: string | null, domain: string): string {
  return `${GROUP_ID_PREFIX}${areaId ?? WHOLE_HOME_TOKEN}:${domain}`;
}

export function parseGroupControlId(id: string): { areaId: string | null; domain: string } | null {
  if (!id.startsWith(GROUP_ID_PREFIX)) return null;
  const [areaToken, domain] = id.slice(GROUP_ID_PREFIX.length).split(":");
  if (!areaToken || !domain) return null;
  return { areaId: areaToken === WHOLE_HOME_TOKEN ? null : areaToken, domain };
}

export function groupDisplayName(areaId: string | null, areaName: string, domain: string): string {
  return `${areaId === null ? "Home" : areaName} ${GROUP_DOMAIN_LABELS[domain]}`;
}

/** Resolves a group id straight to its display name, for spots (like the drag ghost)
 * that only have the id and the areas list on hand, not a full device object. */
export function groupNameFromId(id: string, areas: SmartHomeArea[]): string | null {
  const info = parseGroupControlId(id);
  if (!info) return null;
  const areaName = info.areaId === null ? "Home" : (areas.find((a) => a.id === info.areaId)?.name ?? "Home");
  return groupDisplayName(info.areaId, areaName, info.domain);
}

function isActiveState(domain: string, state: string): boolean {
  if (domain === "cover") return state !== "closed";
  if (domain === "lock") return state === "locked";
  return state === "on";
}

function groupState(domain: string, members: SmartHomeDevice[]): string {
  if (domain === "lock") return allMatchState(members, "locked") ? "locked" : "unlocked";
  if (domain === "cover") return allMatch(members, (d) => d.state !== "closed") ? "open" : "closed";
  return allMatchState(members, "on") ? "on" : "off";
}

/** A synthetic device standing in for "every <domain> device in <area>" -- rendered
 * through the exact same SmartHomeDeviceTile as a real device (same slider/toggle/lock
 * control), just paired with createSmartHomeGroupActions (smartHomeGroupActions.ts) so
 * its actions bulk-apply to every member instead of one entity. Its attributes borrow
 * from whichever member is currently active (or the first member, if none are) so a
 * brightness/position slider starts from a representative value -- not scientifically
 * exact when a room's devices are in mixed states, but matches what the slider does
 * next: set every member to wherever the user drags it. */
export function buildGroupDevice(id: string, name: string, domain: string, members: SmartHomeDevice[]): SmartHomeDevice {
  const state = groupState(domain, members);
  const representative = members.find((d) => isActiveState(domain, d.state)) ?? members[0];
  return { entityId: id, domain, name, state, attributes: representative?.attributes ?? {} };
}

/** Every group control offerable for `members` (already scoped to one area, or the
 * whole house) -- one per domain that has at least one matching device. */
export function buildGroupDevices(areaId: string | null, areaName: string, members: SmartHomeDevice[]): SmartHomeDevice[] {
  return GROUP_CONTROL_DOMAINS.map((domain) => {
    const domainMembers = members.filter((d) => d.domain === domain);
    if (domainMembers.length === 0) return null;
    return buildGroupDevice(groupControlId(areaId, domain), groupDisplayName(areaId, areaName, domain), domain, domainMembers);
  }).filter((d): d is SmartHomeDevice => d !== null);
}

/** Resolves a placed group control's synthetic id back to its live member devices --
 * called on every render so a group tile always reflects current device state and area
 * membership, the same way a real device's tile reflects live SSE updates. */
export function resolveGroupMembers(areaId: string | null, domain: string, devices: SmartHomeDevice[], areas: SmartHomeArea[]): SmartHomeDevice[] {
  if (areaId === null) return devices.filter((d) => d.domain === domain);
  const area = areas.find((a) => a.id === areaId);
  if (!area) return [];
  const memberIds = new Set(area.entityIds);
  return devices.filter((d) => d.domain === domain && memberIds.has(d.entityId));
}
