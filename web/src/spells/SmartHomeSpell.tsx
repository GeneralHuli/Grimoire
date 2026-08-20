import { useEffect, useMemo, useState } from "react";
import { SmartHomeDeviceTile } from "./SmartHomeDeviceTile";
import { createSmartHomeActions, type SmartHomeDevice } from "./smartHomeActions";

const DOMAIN_ORDER = ["climate", "light", "switch", "lock", "fan", "cover", "camera"];
const DOMAIN_LABELS: Record<string, string> = {
  climate: "Climate",
  light: "Lights",
  switch: "Switches",
  lock: "Locks",
  fan: "Fans",
  cover: "Covers",
  camera: "Cameras",
};

function CameraTile({ device }: { device: SmartHomeDevice }) {
  const [live, setLive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (live) return;
    const interval = setInterval(() => setRefreshKey((k) => k + 1), 10_000);
    return () => clearInterval(interval);
  }, [live]);

  const encodedId = encodeURIComponent(device.entityId);
  const src = live
    ? `/api/spells/smart-home/devices/${encodedId}/stream`
    : `/api/spells/smart-home/devices/${encodedId}/snapshot?t=${refreshKey}`;

  return (
    <div className="smart-home-camera">
      <p>{device.name}</p>
      {/* multipart/x-mixed-replace (the live stream) and a plain image both render fine in <img> */}
      <img src={src} alt={device.name} className="smart-home-camera-img" />
      <button type="button" className="btn btn-sm" onClick={() => setLive((l) => !l)}>
        {live ? "Stop live view" : "Watch live"}
      </button>
    </div>
  );
}

export function SmartHomeSpell() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<SmartHomeDevice[] | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spells/smart-home/status")
      .then((res) => res.json())
      .then((data: { connected: boolean }) => setConnected(data.connected));
  }, []);

  useEffect(() => {
    if (!connected) return;
    setDevicesError(null);
    fetch("/api/spells/smart-home/devices")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Couldn't load devices");
        }
        setDevices((data as { devices: SmartHomeDevice[] }).devices);
      })
      .catch((err) => {
        setDevicesError(err instanceof Error ? err.message : "Couldn't load devices");
      });
  }, [connected]);

  const actions = useMemo(
    () =>
      createSmartHomeActions((entityId, patch) => {
        setDevices(
          (prev) =>
            prev?.map((d) => (d.entityId === entityId ? { ...d, ...(typeof patch === "function" ? patch(d) : patch) } : d)) ??
            prev
        );
      }),
    []
  );

  if (connected === null) {
    return (
      <div className="spell-card">
        <h2>Smart Home</h2>
        <p>Loading…</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="spell-card">
        <h2>Smart Home</h2>
        <p>Needs a connected Home Assistant instance. Set it up in Settings.</p>
      </div>
    );
  }

  if (devicesError) {
    return (
      <div className="spell-card smart-home-card">
        <h2>Smart Home</h2>
        <p>Couldn't load your Home Assistant devices ({devicesError}). Check the connection in Settings.</p>
      </div>
    );
  }

  if (devices === null) {
    return (
      <div className="spell-card smart-home-card">
        <h2>Smart Home</h2>
        <p>Loading devices…</p>
      </div>
    );
  }

  const byDomain = new Map<string, SmartHomeDevice[]>();
  for (const device of devices) {
    const list = byDomain.get(device.domain);
    if (list) list.push(device);
    else byDomain.set(device.domain, [device]);
  }

  return (
    <div className="spell-card smart-home-card">
      <h2>Smart Home</h2>
      {colorPickerFor !== null && (
        <div className="smart-home-color-picker-backdrop" onClick={() => setColorPickerFor(null)} aria-hidden="true" />
      )}
      {devices.length === 0 && <p>No devices found in Home Assistant yet.</p>}
      {DOMAIN_ORDER.filter((domain) => byDomain.has(domain)).map((domain) => (
        <div key={domain} className="smart-home-section">
          <h3>{DOMAIN_LABELS[domain]}</h3>
          <ul className={domain === "camera" ? "smart-home-devices" : "smart-home-devices smart-home-tiles"}>
            {byDomain.get(domain)!.map((device) =>
              domain === "camera" ? (
                <li key={device.entityId} className="smart-home-device smart-home-device-camera">
                  <CameraTile device={device} />
                </li>
              ) : (
                <li key={device.entityId} className="smart-home-tile">
                  <SmartHomeDeviceTile
                    device={device}
                    actions={actions}
                    colorPickerFor={colorPickerFor}
                    onOpenColorPicker={setColorPickerFor}
                  />
                </li>
              )
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}
