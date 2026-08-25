import type { SmartHomeDevice, UpdateSmartHomeDevice } from "./smartHomeActions";
import { allMatch, allMatchState, runBulk } from "./smartHomeBulk";

interface SmartHomeRoomControlsProps {
  areaName: string;
  devices: SmartHomeDevice[];
  updateDevice: UpdateSmartHomeDevice;
}

interface MasterToggleProps {
  icon: string;
  active: boolean;
  label: string;
  onClick: () => void;
}

function MasterToggle({ icon, active, label, onClick }: MasterToggleProps) {
  return (
    <button
      type="button"
      className={`btn btn-icon smart-home-room-toggle${active ? " active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

/** One icon button per device type present in this room, each flipping every matching
 * device in the room at once -- the toggle-switches + lock icon sketched in the room-card
 * mockup, scaled down from the whole-house Summaries panel to just this room's devices.
 * Media players are deliberately left out: a "pause all" master doesn't map onto a
 * simple on/off toggle the way lights/switches/fans/covers/locks do. */
export function SmartHomeRoomControls({ areaName, devices, updateDevice }: SmartHomeRoomControlsProps) {
  const lights = devices.filter((d) => d.domain === "light");
  const switches = devices.filter((d) => d.domain === "switch");
  const fans = devices.filter((d) => d.domain === "fan");
  const covers = devices.filter((d) => d.domain === "cover");
  const locks = devices.filter((d) => d.domain === "lock");

  const lightsOn = allMatchState(lights, "on");
  const switchesOn = allMatchState(switches, "on");
  const fansOn = allMatchState(fans, "on");
  const coversOpen = allMatch(covers, (d) => d.state !== "closed");
  const locksLocked = allMatchState(locks, "locked");

  if (lights.length + switches.length + fans.length + covers.length + locks.length === 0) return null;

  return (
    <div className="smart-home-room-controls">
      {lights.length > 0 && (
        <MasterToggle
          icon="💡"
          active={lightsOn}
          label={`${lightsOn ? "Turn off" : "Turn on"} all lights in ${areaName}`}
          onClick={() => runBulk(updateDevice, lights, lightsOn ? "turn_off" : "turn_on", lightsOn ? "off" : "on")}
        />
      )}
      {switches.length > 0 && (
        <MasterToggle
          icon="🔌"
          active={switchesOn}
          label={`${switchesOn ? "Turn off" : "Turn on"} all switches in ${areaName}`}
          onClick={() => runBulk(updateDevice, switches, switchesOn ? "turn_off" : "turn_on", switchesOn ? "off" : "on")}
        />
      )}
      {fans.length > 0 && (
        <MasterToggle
          icon="🌀"
          active={fansOn}
          label={`${fansOn ? "Turn off" : "Turn on"} all fans in ${areaName}`}
          onClick={() => runBulk(updateDevice, fans, fansOn ? "turn_off" : "turn_on", fansOn ? "off" : "on")}
        />
      )}
      {covers.length > 0 && (
        <MasterToggle
          icon="🪟"
          active={coversOpen}
          label={`${coversOpen ? "Close" : "Open"} all covers in ${areaName}`}
          onClick={() => runBulk(updateDevice, covers, coversOpen ? "close_cover" : "open_cover", coversOpen ? "closed" : "open")}
        />
      )}
      {locks.length > 0 && (
        <MasterToggle
          icon="🔒"
          active={locksLocked}
          label={`${locksLocked ? "Unlock" : "Lock"} all locks in ${areaName}`}
          onClick={() => runBulk(updateDevice, locks, locksLocked ? "unlock" : "lock", locksLocked ? "unlocked" : "locked")}
        />
      )}
    </div>
  );
}
