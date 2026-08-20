import { useRef, useState } from "react";

/**
 * Nest-style dial: a 270° arc (12-14 o'clock, going clockwise, gap at the bottom) drawn in
 * SVG polar coordinates. Angle 0 = 3 o'clock, increasing clockwise, matching screen-space
 * atan2(dy, dx) directly -- no separate coordinate-system conversion needed for the drag math.
 */
const CENTER = 100;
const RADIUS = 82;
const STROKE = 14;
const START_DEG = 135;
const SWEEP_DEG = 270;
/** How far (in viewBox units) from the ring's centerline a pointerdown still counts as
 * "on the track" -- generous enough for a fingertip, not so wide it swallows the center. */
const TRACK_TOLERANCE = 10;

/** Modes this control will cycle a click on the dial's center through, in order -- only
 * the ones the device actually reports supporting via `hvac_modes`. */
const CYCLE_MODES = ["heat", "cool", "heat_cool"];

const MODE_LABEL: Record<string, string> = {
  heat: "Heat",
  cool: "Cool",
  heat_cool: "Heat/Cool",
  auto: "Auto",
  off: "Off",
  fan_only: "Fan",
  dry: "Dry",
};

function polarPoint(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number, radius: number) {
  const start = polarPoint(startDeg, radius);
  const end = polarPoint(endDeg, radius);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function angleFromPointer(clientX: number, clientY: number, rect: DOMRect): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const angle = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
  return angle < 0 ? angle + 360 : angle;
}

/** Distance from the dial's center, in the SVG's own 0-200 viewBox units, regardless of
 * how large the dial is actually rendered on screen. */
function distanceFromCenter(clientX: number, clientY: number, rect: DOMRect): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const scale = rect.width / 200;
  return Math.hypot(clientX - cx, clientY - cy) / scale;
}

function isOnTrack(clientX: number, clientY: number, rect: DOMRect): boolean {
  const dist = distanceFromCenter(clientX, clientY, rect);
  if (Math.abs(dist - RADIUS) > STROKE / 2 + TRACK_TOLERANCE) return false;
  const rel = ((angleFromPointer(clientX, clientY, rect) - START_DEG) % 360 + 360) % 360;
  return rel <= SWEEP_DEG;
}

function isInCenter(clientX: number, clientY: number, rect: DOMRect): boolean {
  return distanceFromCenter(clientX, clientY, rect) < RADIUS - STROKE / 2 - TRACK_TOLERANCE;
}

function fractionFromAngle(angleDeg: number): number {
  const rel = ((angleDeg - START_DEG) % 360 + 360) % 360;
  if (rel <= SWEEP_DEG) return rel / SWEEP_DEG;
  // In the bottom gap: snap to whichever end of the arc it's closer to.
  return rel - SWEEP_DEG < 360 - rel ? 1 : 0;
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function arcColor(hvacAction: string | undefined, hvacMode: string | undefined): string {
  const key = hvacAction || hvacMode || "";
  if (key.includes("heat")) return "#f2994a";
  if (key.includes("cool")) return "#56ccf2";
  if (key === "off") return "color-mix(in srgb, currentColor 30%, transparent)";
  return "var(--grim-accent)";
}

interface SmartHomeThermostatControlProps {
  name: string;
  currentTemp: number | null;
  targetTemp: number | null;
  minTemp: number;
  maxTemp: number;
  step: number;
  hvacMode?: string;
  hvacAction?: string;
  /** The device's supported `hvac_modes` -- determines which modes a center-tap cycles
   * through (heat/cool/heat_cool, whichever apply) and skips the tap entirely if fewer
   * than two of those apply. */
  hvacModes: string[];
  onChangeTarget: (value: number) => void;
  onChangeMode: (mode: string) => void;
  disabled?: boolean;
}

export function SmartHomeThermostatControl({
  name,
  currentTemp,
  targetTemp,
  minTemp,
  maxTemp,
  step,
  hvacMode,
  hvacAction,
  hvacModes,
  onChangeTarget,
  onChangeMode,
  disabled,
}: SmartHomeThermostatControlProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const [dragTemp, setDragTemp] = useState<number | null>(null);
  const dragging = useRef(false);
  /** True for the rest of the gesture once a pointerdown lands on the track -- a click
   * that follows (which fires wherever the pointer happens to be released, not where it
   * started) must not be treated as a center tap just because it let go over the middle. */
  const trackEngaged = useRef(false);

  const baseTemp = targetTemp ?? minTemp;
  const displayTemp = dragTemp ?? baseTemp;
  const color = arcColor(hvacAction, hvacMode);
  const cycleModes = CYCLE_MODES.filter((m) => hvacModes.includes(m));

  function tempFromPointer(clientX: number, clientY: number): number {
    const dial = dialRef.current;
    if (!dial) return displayTemp;
    const fraction = fractionFromAngle(angleFromPointer(clientX, clientY, dial.getBoundingClientRect()));
    const raw = minTemp + fraction * (maxTemp - minTemp);
    return Math.min(maxTemp, Math.max(minTemp, roundToStep(raw, step)));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    trackEngaged.current = false;
    if (disabled || targetTemp === null) return;
    const dial = dialRef.current;
    if (!dial || !isOnTrack(e.clientX, e.clientY, dial.getBoundingClientRect())) return;
    trackEngaged.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    setDragTemp(tempFromPointer(e.clientX, e.clientY));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    setDragTemp(tempFromPointer(e.clientX, e.clientY));
  }

  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragTemp !== null) onChangeTarget(dragTemp);
    setDragTemp(null);
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (trackEngaged.current) {
      trackEngaged.current = false;
      return;
    }
    if (disabled || cycleModes.length < 2) return;
    const dial = dialRef.current;
    if (!dial || !isInCenter(e.clientX, e.clientY, dial.getBoundingClientRect())) return;
    const currentIndex = cycleModes.indexOf(hvacMode ?? "");
    onChangeMode(cycleModes[(currentIndex + 1) % cycleModes.length]);
  }

  const fraction = targetTemp === null ? 0 : (displayTemp - minTemp) / (maxTemp - minTemp);
  const handleAngle = START_DEG + fraction * SWEEP_DEG;
  const handlePos = polarPoint(handleAngle, RADIUS);

  return (
    <div className="smart-home-thermostat">
      <div
        ref={dialRef}
        className={`smart-home-thermostat-dial${targetTemp === null ? " disabled" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={handleClick}
      >
        <svg viewBox="0 0 200 200" className="smart-home-thermostat-svg" aria-hidden="true">
          <path
            d={arcPath(START_DEG, START_DEG + SWEEP_DEG, RADIUS)}
            className="smart-home-thermostat-track"
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {targetTemp !== null && (
            <path
              d={arcPath(START_DEG, handleAngle, RADIUS)}
              fill="none"
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          )}
          {targetTemp !== null && <circle cx={handlePos.x} cy={handlePos.y} r={STROKE / 2 + 3} className="smart-home-thermostat-knob" />}
        </svg>
        <div className="smart-home-thermostat-readout">
          <div className="smart-home-thermostat-target">{targetTemp !== null ? `${Math.round(displayTemp)}°` : "—"}</div>
          <div className="smart-home-thermostat-current">
            {currentTemp !== null ? `Now ${Math.round(currentTemp)}°` : ""}
          </div>
          <div className="smart-home-thermostat-mode" style={{ color }}>
            {MODE_LABEL[hvacAction ?? ""] ?? MODE_LABEL[hvacMode ?? ""] ?? hvacMode ?? ""}
          </div>
        </div>
      </div>
      <div className="smart-home-thermostat-label">{name}</div>
    </div>
  );
}
