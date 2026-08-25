import type { SmartHomeActions, SmartHomeDevice, UpdateSmartHomeDevice } from "./smartHomeActions";
import { bulkCall, runBulk } from "./smartHomeBulk";

/** Mirrors createSmartHomeActions (smartHomeActions.ts) but every call fans out to every
 * device in `members` instead of the single device SmartHomeDeviceTile passes in --
 * SmartHomeDeviceTile always calls actions with the group's own synthetic device (see
 * smartHomeGroups.ts), so `device.state` there already reflects the group's aggregate
 * on/off/open/locked state; only the target of each call needs to change. Domains
 * without a group control (climate, media_player) never reach a group tile, so their
 * methods here are unreachable stubs kept only to satisfy the SmartHomeActions shape. */
export function createSmartHomeGroupActions(members: SmartHomeDevice[], updateDevice: UpdateSmartHomeDevice): SmartHomeActions {
  const entityIds = members.map((d) => d.entityId);

  return {
    async toggleOnOff(device) {
      const turningOn = device.state !== "on";
      runBulk(updateDevice, members, turningOn ? "turn_on" : "turn_off", turningOn ? "on" : "off");
    },

    async toggleLock(device) {
      const locking = device.state !== "locked";
      runBulk(updateDevice, members, locking ? "lock" : "unlock", locking ? "locked" : "unlocked");
    },

    async toggleCover(device) {
      const opening = device.state !== "open";
      runBulk(updateDevice, members, opening ? "open_cover" : "close_cover", opening ? "open" : "closed");
    },

    async openCover() {
      runBulk(updateDevice, members, "open_cover", "open");
    },

    async closeCover() {
      runBulk(updateDevice, members, "close_cover", "closed");
    },

    async stopCover() {
      void bulkCall(entityIds, "stop_cover");
    },

    async setCoverPosition(device, pct) {
      for (const member of members) {
        updateDevice(member.entityId, (d) => ({
          state: pct <= 0 ? "closed" : "open",
          attributes: { ...d.attributes, current_position: pct },
        }));
      }
      void bulkCall(entityIds, "set_cover_position", { position: pct });
    },

    async setTemperature() {},
    async setHvacMode() {},

    async setLightLevel(device, pct) {
      if (pct <= 0) {
        runBulk(updateDevice, members, "turn_off", "off");
        return;
      }
      for (const member of members) {
        updateDevice(member.entityId, (d) => ({
          state: "on",
          attributes: { ...d.attributes, brightness: Math.round((pct / 100) * 255) },
        }));
      }
      void bulkCall(entityIds, "turn_on", { brightness_pct: pct });
    },

    async setLightHue(device, hue) {
      for (const member of members) {
        updateDevice(member.entityId, (d) => ({
          state: "on",
          attributes: { ...d.attributes, hs_color: [hue, 100], rgb_color: undefined },
        }));
      }
      void bulkCall(entityIds, "turn_on", { hs_color: [hue, 100] });
    },

    async setLightColorTemp(device, kelvin) {
      for (const member of members) {
        updateDevice(member.entityId, (d) => ({
          state: "on",
          attributes: { ...d.attributes, color_temp_kelvin: kelvin, hs_color: undefined, rgb_color: undefined },
        }));
      }
      void bulkCall(entityIds, "turn_on", { color_temp_kelvin: kelvin });
    },

    async setFanLevel(device, pct) {
      if (pct <= 0) {
        runBulk(updateDevice, members, "turn_off", "off");
        return;
      }
      for (const member of members) {
        updateDevice(member.entityId, (d) => ({ state: "on", attributes: { ...d.attributes, percentage: pct } }));
      }
      void bulkCall(entityIds, "turn_on", { percentage: pct });
    },

    async mediaPlayPause() {},
    async mediaStop() {},
    async setMediaVolume() {},
  };
}
