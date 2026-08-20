import { useRef } from "react";

const HUE_PRESETS = [0, 25, 45, 90, 150, 195, 230, 275, 320];

interface ColorPickerProps {
  /** Hue-only picker (fixed full saturation) for HS/RGB/XY-capable lights. */
  mode: "color";
  onPick: (hue: number) => void;
  onClose: () => void;
}

interface TempPickerProps {
  /** Warm<->cool color-temperature picker for lights that only support color_temp. */
  mode: "temp";
  minKelvin: number;
  maxKelvin: number;
  onPick: (kelvin: number) => void;
  onClose: () => void;
}

type SmartHomeColorPickerProps = ColorPickerProps | TempPickerProps;

export function SmartHomeColorPicker(props: SmartHomeColorPickerProps) {
  const stripRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="smart-home-color-picker" onPointerDown={(e) => e.stopPropagation()}>
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
    </div>
  );
}
