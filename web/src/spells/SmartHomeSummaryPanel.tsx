import type { ReactNode } from "react";
import type { SmartHomeDevice, UpdateSmartHomeDevice } from "./smartHomeActions";
import { allMatchState, runBulk } from "./smartHomeBulk";

interface SmartHomeSummaryPanelProps {
  devices: SmartHomeDevice[];
  /** Same optimistic-update shape createSmartHomeActions uses for a single device --
   * reused here so a bulk action patches every affected tile immediately instead of
   * waiting on the round trip through Home Assistant and back over SSE. */
  updateDevice: UpdateSmartHomeDevice;
}

interface SummaryRowProps {
  icon: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}

function SummaryRow({ icon, title, subtitle, children }: SummaryRowProps) {
  return (
    <div className="smart-home-summary-row">
      <div className="smart-home-summary-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="smart-home-summary-text">
        <div className="smart-home-summary-title">{title}</div>
        <div className="smart-home-summary-subtitle">{subtitle}</div>
      </div>
      {children && <div className="smart-home-summary-actions">{children}</div>}
    </div>
  );
}

/** A bulk-toggle pair ("All on"/"All off", "Lock all"/"Unlock all"...) -- whichever side
 * is currently true for every matching device lights up, both dim when the group is in a
 * mixed state, matching how the individual per-device toggles already read. */
function ToggleActions({
  onLabel,
  offLabel,
  isOn,
  isOff,
  onPressOn,
  onPressOff,
}: {
  onLabel: string;
  offLabel: string;
  isOn: boolean;
  isOff: boolean;
  onPressOn: () => void;
  onPressOff: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className={`btn btn-sm smart-home-summary-btn${isOn ? " active" : ""}`}
        onClick={onPressOn}
      >
        {onLabel}
      </button>
      <button
        type="button"
        className={`btn btn-sm smart-home-summary-btn${isOff ? " active" : ""}`}
        onClick={onPressOff}
      >
        {offLabel}
      </button>
    </>
  );
}

export function SmartHomeSummaryPanel({ devices, updateDevice }: SmartHomeSummaryPanelProps) {
  const lights = devices.filter((d) => d.domain === "light");
  const climate = devices.filter((d) => d.domain === "climate");
  const locks = devices.filter((d) => d.domain === "lock");
  const mediaPlayers = devices.filter((d) => d.domain === "media_player");
  const fans = devices.filter((d) => d.domain === "fan");
  const covers = devices.filter((d) => d.domain === "cover");

  const locksUnlocked = locks.filter((d) => d.state === "unlocked").length;
  const coversOpen = covers.filter((d) => d.state !== "closed").length;
  const playersPlaying = mediaPlayers.filter((d) => d.state === "playing").length;

  return (
    <div className="smart-home-summary">
      <h3>Summaries</h3>

      {lights.length > 0 && (
        <SummaryRow icon="💡" title="Lights" subtitle={`${lights.filter((d) => d.state === "on").length} on`}>
          <ToggleActions
            onLabel="All on"
            offLabel="All off"
            isOn={allMatchState(lights, "on")}
            isOff={allMatchState(lights, "off")}
            onPressOn={() => runBulk(updateDevice, lights, "turn_on", "on")}
            onPressOff={() => runBulk(updateDevice, lights, "turn_off", "off")}
          />
        </SummaryRow>
      )}

      {climate.length > 0 && (
        <SummaryRow icon="🌡️" title="Climate" subtitle={`${climate.length} device${climate.length === 1 ? "" : "s"}`} />
      )}

      {locks.length > 0 && (
        <SummaryRow icon="🔒" title="Security" subtitle={`${locksUnlocked} unlocked`}>
          <ToggleActions
            onLabel="Unlock all"
            offLabel="Lock all"
            isOn={locksUnlocked === locks.length}
            isOff={locksUnlocked === 0}
            onPressOn={() => runBulk(updateDevice, locks, "unlock", "unlocked")}
            onPressOff={() => runBulk(updateDevice, locks, "lock", "locked")}
          />
        </SummaryRow>
      )}

      {mediaPlayers.length > 0 && (
        <SummaryRow icon="📺" title="Media players" subtitle={`${playersPlaying} playing`}>
          <button
            type="button"
            className="btn btn-sm smart-home-summary-btn"
            onClick={() => runBulk(updateDevice, mediaPlayers, "media_pause", "paused")}
          >
            Pause all
          </button>
          <button
            type="button"
            className="btn btn-sm smart-home-summary-btn"
            onClick={() => runBulk(updateDevice, mediaPlayers, "media_stop", "idle")}
          >
            Stop all
          </button>
        </SummaryRow>
      )}

      {fans.length > 0 && (
        <SummaryRow icon="🌀" title="Fans" subtitle={`${fans.filter((d) => d.state === "on").length} on`}>
          <ToggleActions
            onLabel="All on"
            offLabel="All off"
            isOn={allMatchState(fans, "on")}
            isOff={allMatchState(fans, "off")}
            onPressOn={() => runBulk(updateDevice, fans, "turn_on", "on")}
            onPressOff={() => runBulk(updateDevice, fans, "turn_off", "off")}
          />
        </SummaryRow>
      )}

      {covers.length > 0 && (
        <SummaryRow icon="🪟" title="Covers" subtitle={`${coversOpen} open`}>
          <ToggleActions
            onLabel="Open all"
            offLabel="Close all"
            isOn={coversOpen === covers.length}
            isOff={coversOpen === 0}
            onPressOn={() => runBulk(updateDevice, covers, "open_cover", "open")}
            onPressOff={() => runBulk(updateDevice, covers, "close_cover", "closed")}
          />
        </SummaryRow>
      )}
    </div>
  );
}
