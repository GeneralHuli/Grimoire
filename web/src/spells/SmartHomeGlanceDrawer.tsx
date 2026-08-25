import type { SmartHomeArea, SmartHomeDevice } from "./smartHomeActions";
import { controlGridSize } from "./smartHomeGrid";
import { SMART_HOME_DOMAIN_ICONS } from "./smartHomeIcons";
import { buildGroupDevices } from "./smartHomeGroups";

interface SmartHomeGlanceDrawerProps {
  edge: "left" | "right" | "top" | "bottom";
  /** Every device -- room-wide/whole-home group chips are built from this, since they
   * represent live device state regardless of which individual devices are already on
   * the grid. */
  allDevices: SmartHomeDevice[];
  /** Individual devices not yet on the compact grid -- these are the ones offered as
   * per-device draggable chips. A subset of allDevices. */
  availableDevices: SmartHomeDevice[];
  areas: SmartHomeArea[];
  /** entityIds (real or synthetic group ids) already on the compact grid -- used to hide
   * a group chip once it's been dragged out, the same way availableDevices already hides
   * a placed individual device. */
  placedIds: Set<string>;
  onStartDragChip: (device: SmartHomeDevice, e: React.PointerEvent) => void;
  onClose: () => void;
}

function DeviceChip({
  device,
  onStartDragChip,
  group,
}: {
  device: SmartHomeDevice;
  onStartDragChip: (device: SmartHomeDevice, e: React.PointerEvent) => void;
  group?: boolean;
}) {
  const { w, h } = controlGridSize(device);
  const DomainIcon = SMART_HOME_DOMAIN_ICONS[device.domain];
  return (
    <div
      className={`smart-home-glance-chip${group ? " smart-home-glance-chip-group" : ""}`}
      onPointerDown={(e) => onStartDragChip(device, e)}
    >
      <span className="smart-home-glance-chip-icon">{DomainIcon ? <DomainIcon /> : "•"}</span>
      <span className="smart-home-glance-chip-name">{device.name}</span>
      <span className="smart-home-glance-chip-size">
        {w}×{h}
      </span>
    </div>
  );
}

/** Slide-out palette of every controllable device -- plus one room-wide "group" chip per
 * device type each room has -- not currently on the compact view. Drag a chip out onto
 * the grid to place it there. Which edge it slides from is picked by the caller based on
 * where the widget sits on the dashboard (see pickDrawerEdge in SmartHomeGlance.tsx), so
 * it opens toward whichever side of the screen has room.
 *
 * Devices are grouped by Home Assistant area/room. Each room section's group chips
 * ("Living Room Lights") drop the exact same control a single device of that type would
 * (SmartHomeDeviceTile, dispatched off `device.domain` same as any other tile) -- just
 * wired (smartHomeGroups.ts / smartHomeGroupActions.ts) to bulk-act on every device of
 * that domain in that room. A "Whole home" section pinned above every room offers the
 * same, scoped to every matching device in the house.
 *
 * Deliberately no full-viewport backdrop here: the grid itself has to stay clickable
 * while this is open (it's the drop target for chips dragged out of here, and its own
 * tiles are still draggable/removable in this same edit mode) -- a backdrop covering the
 * whole screen would sit on top of the grid too and swallow every click meant for it.
 * Closing happens via the gear icon (toggle) or this drawer's own close button. */
export function SmartHomeGlanceDrawer({ edge, allDevices, availableDevices, areas, placedIds, onStartDragChip, onClose }: SmartHomeGlanceDrawerProps) {
  const availableIds = new Set(availableDevices.map((d) => d.entityId));
  const deviceById = new Map(allDevices.map((d) => [d.entityId, d]));

  const wholeHomeGroups = buildGroupDevices(null, "Home", allDevices).filter((g) => !placedIds.has(g.entityId));

  return (
    <div
      className={`smart-home-glance-drawer smart-home-glance-drawer-${edge}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="smart-home-glance-drawer-header">
        <span>Drag onto the grid to add</span>
        <button type="button" className="btn btn-icon smart-home-glance-drawer-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="smart-home-glance-drawer-list">
        {allDevices.length === 0 && <p className="glance-empty">No devices found.</p>}

        {wholeHomeGroups.length > 0 && (
          <div className="smart-home-glance-drawer-section smart-home-glance-drawer-whole-home">
            <div className="smart-home-glance-drawer-section-header">
              <span className="smart-home-glance-drawer-section-title">Whole home</span>
            </div>
            {wholeHomeGroups.map((g) => (
              <DeviceChip key={g.entityId} device={g} onStartDragChip={onStartDragChip} group />
            ))}
          </div>
        )}

        {areas.map((area) => {
          const areaDevices = area.entityIds.map((id) => deviceById.get(id)).filter((d): d is SmartHomeDevice => d !== undefined);
          if (areaDevices.length === 0) return null;
          const groupChips = buildGroupDevices(area.id, area.name, areaDevices).filter((g) => !placedIds.has(g.entityId));
          const deviceChips = areaDevices.filter((d) => availableIds.has(d.entityId));
          if (groupChips.length === 0 && deviceChips.length === 0) return null;
          return (
            <div key={area.id} className="smart-home-glance-drawer-section smart-home-glance-drawer-area">
              <div className="smart-home-glance-drawer-section-header">
                <span className="smart-home-glance-drawer-section-title">{area.name}</span>
              </div>
              {groupChips.map((g) => (
                <DeviceChip key={g.entityId} device={g} onStartDragChip={onStartDragChip} group />
              ))}
              {deviceChips.length > 0 ? (
                deviceChips.map((device) => <DeviceChip key={device.entityId} device={device} onStartDragChip={onStartDragChip} />)
              ) : (
                <p className="glance-empty smart-home-glance-drawer-area-empty">Every device here is already on the grid.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
