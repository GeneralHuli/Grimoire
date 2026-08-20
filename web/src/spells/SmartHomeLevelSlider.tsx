import { useRef, useState, type CSSProperties, type ReactNode } from "react";

const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD_PX = 6;

interface GestureState {
  /** True from pointerdown until pointerup/cancel -- guards pointermove so hovering
   * (which also fires "pointermove" for a mouse, with no button held) never drags. */
  pressed: boolean;
  startX: number;
  startY: number;
  dragging: boolean;
  longPressTimer: number | null;
  longPressFired: boolean;
}

interface SmartHomeLevelSliderProps {
  /** 0-100 committed level (ignored visually while the user is mid-drag). */
  value: number;
  /** Whether the device is currently "on" -- an off device always renders an empty fill. */
  active: boolean;
  /** CSS color for the fill gradient; falls back to the app accent color. */
  color?: string;
  icon?: ReactNode;
  label: string;
  sublabel?: string;
  onToggle: () => void;
  /** Fired once, on release, with the final 0-100 level -- not on every intermediate move. */
  onChangeLevel: (value: number) => void;
  /** Held past LONG_PRESS_MS without dragging -- e.g. open a color picker. Suppresses the toggle. */
  onLongPress?: () => void;
  disabled?: boolean;
}

export function SmartHomeLevelSlider({
  value,
  active,
  color,
  icon,
  label,
  sublabel,
  onToggle,
  onChangeLevel,
  onLongPress,
  disabled,
}: SmartHomeLevelSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const gesture = useRef<GestureState>({
    pressed: false,
    startX: 0,
    startY: 0,
    dragging: false,
    longPressTimer: null,
    longPressFired: false,
  });

  const displayValue = dragValue ?? value;

  function levelFromPointer(clientY: number): number {
    const track = trackRef.current;
    if (!track) return displayValue;
    const rect = track.getBoundingClientRect();
    const fraction = 1 - (clientY - rect.top) / rect.height;
    return Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  }

  function clearLongPressTimer() {
    if (gesture.current.longPressTimer !== null) {
      window.clearTimeout(gesture.current.longPressTimer);
      gesture.current.longPressTimer = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current.pressed = true;
    gesture.current.startX = e.clientX;
    gesture.current.startY = e.clientY;
    gesture.current.dragging = false;
    gesture.current.longPressFired = false;
    if (onLongPress) {
      gesture.current.longPressTimer = window.setTimeout(() => {
        gesture.current.longPressFired = true;
        onLongPress();
      }, LONG_PRESS_MS);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !gesture.current.pressed) return;
    const dx = e.clientX - gesture.current.startX;
    const dy = e.clientY - gesture.current.startY;
    if (!gesture.current.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      gesture.current.dragging = true;
      clearLongPressTimer();
    }
    if (gesture.current.dragging) {
      setDragValue(levelFromPointer(e.clientY));
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    clearLongPressTimer();
    gesture.current.pressed = false;
    if (gesture.current.dragging) {
      const finalLevel = levelFromPointer(e.clientY);
      gesture.current.dragging = false;
      setDragValue(null);
      onChangeLevel(finalLevel);
    } else if (!gesture.current.longPressFired) {
      onToggle();
    }
  }

  function handlePointerCancel() {
    clearLongPressTimer();
    gesture.current.pressed = false;
    gesture.current.dragging = false;
    setDragValue(null);
  }

  const trackStyle: CSSProperties & Record<string, string | undefined> = color ? { "--slider-color": color } : {};

  return (
    <div className={`smart-home-slider${disabled ? " disabled" : ""}`}>
      <div
        ref={trackRef}
        className={`smart-home-slider-track${active ? " active" : ""}`}
        style={trackStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="smart-home-slider-fill" style={{ height: `${active ? displayValue : 0}%` }} />
        {icon && <div className="smart-home-slider-icon">{icon}</div>}
        <div className="smart-home-slider-value">{active ? `${Math.round(displayValue)}%` : "Off"}</div>
      </div>
      <div className="smart-home-slider-label">{label}</div>
      {sublabel && <div className="smart-home-slider-sublabel">{sublabel}</div>}
    </div>
  );
}
