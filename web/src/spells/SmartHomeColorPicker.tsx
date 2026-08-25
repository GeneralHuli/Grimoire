import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

const HUE_PRESETS = [0, 25, 45, 90, 150, 195, 230, 275, 320];

interface ColorPickerProps {
  /** Hue-only picker (fixed full saturation) for HS/RGB/XY-capable lights. */
  mode: "color";
  onPick: (hue: number) => void;
  onClose: () => void;
  /** Element the popover is visually anchored above -- see anchorRef note below. */
  anchorRef: RefObject<HTMLElement | null>;
}

interface TempPickerProps {
  /** Warm<->cool color-temperature picker for lights that only support color_temp. */
  mode: "temp";
  minKelvin: number;
  maxKelvin: number;
  onPick: (kelvin: number) => void;
  onClose: () => void;
  /** Element the popover is visually anchored above -- see anchorRef note below. */
  anchorRef: RefObject<HTMLElement | null>;
}

type SmartHomeColorPickerProps = ColorPickerProps | TempPickerProps;

/**
 * Rendered via portal to document.body, positioned in fixed coordinates from
 * anchorRef's on-screen rect, rather than as a CSS-absolute child of the tile. The home
 * dashboard's compact glance grid clips and scales its tiles (`overflow: hidden` +
 * `transform: scale()` for the grid-fit math) -- an absolutely-positioned child popping
 * up "above" the tile would be clipped or shrunk into invisibility there, even though it
 * renders fine unclipped in the full Spell view.
 */
export function SmartHomeColorPicker(props: SmartHomeColorPickerProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = props.anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPos({ left: rect.left + rect.width / 2, top: rect.top });
  }, [props.anchorRef]);

  function fractionFromPointer(clientX: number): number {
    const strip = stripRef.current;
    if (!strip) return 0;
    const rect = strip.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function emit(fraction: number) {
    if (props.mode === "color") {
      props.onPick(Math.round(fraction * 360));
    } else {
      props.onPick(Math.round(props.minKelvin + fraction * (props.maxKelvin - props.minKelvin)));
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    emit(fractionFromPointer(e.clientX));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    emit(fractionFromPointer(e.clientX));
  }

  if (!pos) return null;

  return createPortal(
    <div
      className="smart-home-color-picker"
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="smart-home-color-picker-header">
        <span>{props.mode === "color" ? "Choose a color" : "Choose warmth"}</span>
        <button type="button" className="btn btn-icon smart-home-color-picker-close" onClick={props.onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div
        ref={stripRef}
        className={`smart-home-color-strip smart-home-color-strip-${props.mode}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      />
      {props.mode === "color" && (
        <div className="smart-home-color-presets">
          {HUE_PRESETS.map((hue) => (
            <button
              key={hue}
              type="button"
              className="smart-home-color-swatch"
              style={{ background: `hsl(${hue}, 85%, 55%)` }}
              onClick={() => props.onPick(hue)}
              aria-label={`Set color to hue ${hue}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
