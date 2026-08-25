import { useEffect, useMemo, useState } from "react";
import { SmartHomeDeviceTile } from "./SmartHomeDeviceTile";
import { SmartHomeSummaryPanel } from "./SmartHomeSummaryPanel";
import { SmartHomeRoomControls } from "./SmartHomeRoomControls";
import { SmartHomeCameraModal } from "./SmartHomeCameraModal";
import { createSmartHomeActions, type SmartHomeArea, type SmartHomeDevice, type UpdateSmartHomeDevice } from "./smartHomeActions";
import { useSmartHomeDeviceSync } from "./smartHomeEvents";

/** Same-type tiles cluster together within a room card (climate dial, then lights, then
 * switches...) instead of interleaving in whatever order Home Assistant happened to
 * return them -- domains not listed here (shouldn't occur, SUPPORTED_DOMAINS is the same
 * set server-side) just sort last. */
const DOMAIN_ORDER = ["climate", "light", "switch", "fan", "cover", "lock", "media_player"];

function byDomainOrder(a: SmartHomeDevice, b: SmartHomeDevice): number {
  const ai = DOMAIN_ORDER.indexOf(a.domain);
  const bi = DOMAIN_ORDER.indexOf(b.domain);
  return (ai === -1 ? DOMAIN_ORDER.length : ai) - (bi === -1 ? DOMAIN_ORDER.length : bi);
}

/** A snapshot that refreshes on its own timer, not a live MJPEG stream -- rendering every
 * camera live at once would be a lot of simultaneous streams for not much benefit on a
 * room card; the live feed is one "Expand" tap away (SmartHomeCameraModal). */
function CameraThumbnail({ device, onExpand }: { device: SmartHomeDevice; onExpand: () => void }) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setRefreshKey((k) => k + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  const encodedId = encodeURIComponent(device.entityId);

  return (
    <div className="smart-home-camera-thumb">
      <img
        src={`/api/spells/smart-home/devices/${encodedId}/snapshot?t=${refreshKey}`}
        alt={device.name}
        className="smart-home-camera-thumb-img"
      />
      <div className="smart-home-camera-thumb-footer">
        <span className="smart-home-camera-thumb-name">{device.name}</span>
        <button type="button" className="btn btn-sm" onClick={onExpand}>
          Expand
        </button>
      </div>
    </div>
  );
}

export function SmartHomeSpell() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<SmartHomeDevice[] | null>(null);
  const [areas, setAreas] = useState<SmartHomeArea[] | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [expandedCamera, setExpandedCamera] = useState<SmartHomeDevice | null>(null);

  useEffect(() => {
    fetch("/api/spells/smart-home/status")
      .then((res) => res.json())
      .then((data: { connected: boolean }) => setConnected(data.connected));
  }, []);

  useEffect(() => {
    if (!connected) return;
    setDevicesError(null);
    Promise.all([fetch("/api/spells/smart-home/devices"), fetch("/api/spells/smart-home/areas")])
      .then(async ([devicesRes, areasRes]) => {
        const devicesData = await devicesRes.json();
        if (!devicesRes.ok) {
          throw new Error(typeof devicesData.error === "string" ? devicesData.error : "Couldn't load devices");
        }
        setDevices((devicesData as { devices: SmartHomeDevice[] }).devices);
        setAreas(areasRes.ok ? ((await areasRes.json()) as { areas: SmartHomeArea[] }).areas : []);
      })
      .catch((err) => {
        setDevicesError(err instanceof Error ? err.message : "Couldn't load devices");
      });
  }, [connected]);

  const updateDevice = useMemo<UpdateSmartHomeDevice>(
    () => (entityId, patch) => {
      setDevices(
        (prev) =>
          prev?.map((d) => (d.entityId === entityId ? { ...d, ...(typeof patch === "function" ? patch(d) : patch) } : d)) ??
          prev
      );
    },
    []
  );

  const actions = useMemo(() => createSmartHomeActions(updateDevice), [updateDevice]);

  // Keeps every tile in sync when a device changes outside this app (a wall switch, the
  // Home Assistant app, another Grimoire tab) -- and when this tab's own bulk/tile
  // actions round-trip back through Home Assistant's event stream.
  useSmartHomeDeviceSync((update) => {
    updateDevice(update.entityId, { state: update.state, attributes: update.attributes });
  });

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

  if (devices === null || areas === null) {
    return (
      <div className="spell-card smart-home-card">
        <h2>Smart Home</h2>
        <p>Loading devices…</p>
      </div>
    );
  }

  const deviceById = new Map(devices.map((d) => [d.entityId, d]));

  return (
    <div className="spell-card smart-home-card">
      <h2>Smart Home</h2>
      {colorPickerFor !== null && (
        <div className="smart-home-color-picker-backdrop" onClick={() => setColorPickerFor(null)} aria-hidden="true" />
      )}
      {devices.length === 0 && <p>No devices found in Home Assistant yet.</p>}
      <div className="smart-home-layout">
        <div className="smart-home-rooms">
          {areas.map((area) => {
            const areaDevices = area.entityIds
              .map((id) => deviceById.get(id))
              .filter((d): d is SmartHomeDevice => d !== undefined);
            if (areaDevices.length === 0) return null;
            const controlDevices = areaDevices.filter((d) => d.domain !== "camera").sort(byDomainOrder);
            const cameras = areaDevices.filter((d) => d.domain === "camera");
            return (
              <div key={area.id} className="smart-home-room">
                <div className="smart-home-room-header">
                  <h3>{area.name}</h3>
                  <SmartHomeRoomControls areaName={area.name} devices={controlDevices} updateDevice={updateDevice} />
                </div>
                {controlDevices.length > 0 && (
                  <ul className="smart-home-devices smart-home-tiles">
                    {controlDevices.map((device) => (
                      <li key={device.entityId} className="smart-home-tile">
                        <SmartHomeDeviceTile
                          device={device}
                          actions={actions}
                          colorPickerFor={colorPickerFor}
                          onOpenColorPicker={setColorPickerFor}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {cameras.length > 0 && (
                  <div className="smart-home-camera-thumbs">
                    {cameras.map((device) => (
                      <CameraThumbnail key={device.entityId} device={device} onExpand={() => setExpandedCamera(device)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <SmartHomeSummaryPanel devices={devices} updateDevice={updateDevice} />
      </div>
      {expandedCamera && (
        <SmartHomeCameraModal
          entityId={expandedCamera.entityId}
          name={expandedCamera.name}
          onClose={() => setExpandedCamera(null)}
        />
      )}
    </div>
  );
}
