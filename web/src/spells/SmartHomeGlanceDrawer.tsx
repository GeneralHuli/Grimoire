import type { SmartHomeDevice } from "./smartHomeActions";
import { controlGridSize } from "./smartHomeGrid";

const DOMAIN_ICON: Record<string, string> = {
  climate: "🌡️",
  light: "💡",
  switch: "🔌",
  lock: "🔒",
  fan: "🌀",
  cover: "🪟",
};

interface SmartHomeGlanceDrawerProps {
  edge: "left" | "right" | "top" | "bottom";
  devices: SmartHomeDevice[];
  onStartDragChip: (device: SmartHomeDevice, e: React.PointerEvent) => void;
  onClose: () => void;
}

/** Slide-out palette of every controllable device not currently on the compact view --
 * drag a chip out onto the grid to place it there. Which edge it slides from is picked
 * by the caller based on where the widget sits on the dashboard (see pickDrawerEdge in
 * SmartHomeGlance.tsx), so it opens toward whichever side of the screen has room.
 *
 * Deliberately no full-viewport backdrop here: the grid itself has to stay clickable
 * while this is open (it's the drop target for chips dragged out of here, and its own
 * tiles are still draggable/removable in this same edit mode) -- a backdrop covering the
 * whole screen would sit on top of the grid too and swallow every click meant for it.
 * Closing happens via the gear icon (toggle) or this drawer's own close button. */
export function SmartHomeGlanceDrawer({ edge, devices, onStartDragChip, onClose }: SmartHomeGlanceDrawerProps) {
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
        {devices.length === 0 && <p className="glance-empty">Everything controllable is already on the grid.</p>}
        {devices.map((device) => {
          const { w, h } = controlGridSize(device);
          return (
            <div key={device.entityId} className="smart-home-glance-chip" onPointerDown={(e) => onStartDragChip(device, e)}>
              <span className="smart-home-glance-chip-icon">{DOMAIN_ICON[device.domain] ?? "•"}</span>
              <span className="smart-home-glance-chip-name">{device.name}</span>
              <span className="smart-home-glance-chip-size">
                {w}×{h}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
