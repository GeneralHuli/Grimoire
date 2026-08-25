export interface SmartHomeDevice {
  entityId: string;
  domain: string;
  name: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface SmartHomeArea {
  id: string;
  name: string;
  entityIds: string[];
}

export type UpdateSmartHomeDevice = (
  entityId: string,
  patch: Partial<SmartHomeDevice> | ((d: SmartHomeDevice) => Partial<SmartHomeDevice>)
) => void;

export async function callDeviceService(entityId: string, service: string, data?: Record<string, unknown>) {
  await fetch(`/api/spells/smart-home/devices/${encodeURIComponent(entityId)}/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service, data }),
  });
}

export interface SmartHomeActions {
  toggleOnOff: (device: SmartHomeDevice) => Promise<void>;
  toggleLock: (device: SmartHomeDevice) => Promise<void>;
  toggleCover: (device: SmartHomeDevice) => Promise<void>;
  openCover: (device: SmartHomeDevice) => Promise<void>;
  closeCover: (device: SmartHomeDevice) => Promise<void>;
  stopCover: (device: SmartHomeDevice) => Promise<void>;
  setCoverPosition: (device: SmartHomeDevice, pct: number) => Promise<void>;
  setTemperature: (device: SmartHomeDevice, value: number) => Promise<void>;
  setHvacMode: (device: SmartHomeDevice, mode: string) => Promise<void>;
  setLightLevel: (device: SmartHomeDevice, pct: number) => Promise<void>;
  setLightHue: (device: SmartHomeDevice, hue: number) => Promise<void>;
  setLightColorTemp: (device: SmartHomeDevice, kelvin: number) => Promise<void>;
  setFanLevel: (device: SmartHomeDevice, pct: number) => Promise<void>;
  mediaPlayPause: (device: SmartHomeDevice) => Promise<void>;
  mediaStop: (device: SmartHomeDevice) => Promise<void>;
  setMediaVolume: (device: SmartHomeDevice, pct: number) => Promise<void>;
}

/** Bundles the optimistic-update + Home Assistant service-call pairs shared by the full
 * Smart Home Spell view and its home-dashboard glance widget, so both drive the exact
 * same controls (SmartHomeDeviceTile) against their own local `devices` state. */
export function createSmartHomeActions(updateDevice: UpdateSmartHomeDevice): SmartHomeActions {
  return {
    async toggleOnOff(device) {
      const turningOn = device.state !== "on";
      updateDevice(device.entityId, { state: turningOn ? "on" : "off" });
      await callDeviceService(device.entityId, turningOn ? "turn_on" : "turn_off");
    },

    async toggleLock(device) {
      const locking = device.state !== "locked";
      updateDevice(device.entityId, { state: locking ? "locked" : "unlocked" });
      await callDeviceService(device.entityId, locking ? "lock" : "unlock");
    },

    async toggleCover(device) {
      const opening = device.state !== "open";
      updateDevice(device.entityId, { state: opening ? "open" : "closed" });
      await callDeviceService(device.entityId, opening ? "open_cover" : "close_cover");
    },

    async openCover(device) {
      updateDevice(device.entityId, { state: "open" });
      await callDeviceService(device.entityId, "open_cover");
    },

    async closeCover(device) {
      updateDevice(device.entityId, { state: "closed" });
      await callDeviceService(device.entityId, "close_cover");
    },

    async stopCover(device) {
      await callDeviceService(device.entityId, "stop_cover");
    },

    async setCoverPosition(device, pct) {
      updateDevice(device.entityId, (d) => ({
        state: pct <= 0 ? "closed" : "open",
        attributes: { ...d.attributes, current_position: pct },
      }));
      await callDeviceService(device.entityId, "set_cover_position", { position: pct });
    },

    async setTemperature(device, value) {
      updateDevice(device.entityId, (d) => ({ attributes: { ...d.attributes, temperature: value } }));
      await callDeviceService(device.entityId, "set_temperature", { temperature: value });
    },

    async setHvacMode(device, mode) {
      // hvac_action (idle/heating/cooling, which the dial's arc color is keyed off of
      // first) reflects real equipment activity that only Home Assistant's own polling
      // knows -- there's no live push here, so the stale value has to be cleared rather
      // than left in place, or the arc would stay the old color until the next full
      // device-list reload.
      updateDevice(device.entityId, (d) => ({
        state: mode,
        attributes: { ...d.attributes, hvac_action: undefined },
      }));
      await callDeviceService(device.entityId, "set_hvac_mode", { hvac_mode: mode });
    },

    async setLightLevel(device, pct) {
      if (pct <= 0) {
        updateDevice(device.entityId, { state: "off" });
        await callDeviceService(device.entityId, "turn_off");
        return;
      }
      updateDevice(device.entityId, (d) => ({
        state: "on",
        attributes: { ...d.attributes, brightness: Math.round((pct / 100) * 255) },
      }));
      await callDeviceService(device.entityId, "turn_on", { brightness_pct: pct });
    },

    async setLightHue(device, hue) {
      updateDevice(device.entityId, (d) => ({
        state: "on",
        attributes: { ...d.attributes, hs_color: [hue, 100], rgb_color: undefined },
      }));
      await callDeviceService(device.entityId, "turn_on", { hs_color: [hue, 100] });
    },

    async setLightColorTemp(device, kelvin) {
      updateDevice(device.entityId, (d) => ({
        state: "on",
        attributes: { ...d.attributes, color_temp_kelvin: kelvin, hs_color: undefined, rgb_color: undefined },
      }));
      await callDeviceService(device.entityId, "turn_on", { color_temp_kelvin: kelvin });
    },

    async setFanLevel(device, pct) {
      if (pct <= 0) {
        updateDevice(device.entityId, { state: "off" });
        await callDeviceService(device.entityId, "turn_off");
        return;
      }
      updateDevice(device.entityId, (d) => ({ state: "on", attributes: { ...d.attributes, percentage: pct } }));
      await callDeviceService(device.entityId, "turn_on", { percentage: pct });
    },

    async mediaPlayPause(device) {
      const playing = device.state === "playing";
      updateDevice(device.entityId, { state: playing ? "paused" : "playing" });
      await callDeviceService(device.entityId, "media_play_pause");
    },

    async mediaStop(device) {
      updateDevice(device.entityId, { state: "idle" });
      await callDeviceService(device.entityId, "media_stop");
    },

    async setMediaVolume(device, pct) {
      updateDevice(device.entityId, (d) => ({ attributes: { ...d.attributes, volume_level: pct / 100 } }));
      await callDeviceService(device.entityId, "volume_set", { volume_level: pct / 100 });
    },
  };
}
