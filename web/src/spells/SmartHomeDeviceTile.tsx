import { useRef } from "react";
import { SmartHomeLevelSlider } from "./SmartHomeLevelSlider";
import { SMART_HOME_DOMAIN_ICONS } from "./smartHomeIcons";
import { SmartHomeColorPicker } from "./SmartHomeColorPicker";
import { SmartHomeLockControl } from "./SmartHomeLockControl";
import { SmartHomeThermostatControl } from "./SmartHomeThermostatControl";
import { SmartHomeSwitchToggle } from "./SmartHomeSwitchToggle";
import { SmartHomeCoverControl } from "./SmartHomeCoverControl";
import { SmartHomeMediaPlayerControl } from "./SmartHomeMediaPlayerControl";
import type { SmartHomeActions, SmartHomeDevice } from "./smartHomeActions";
import {
  lightBrightnessPct,
  lightSupportsHue,
  lightSupportsColorTemp,
  lightColorTempRangeKelvin,
  lightFillColor,
  fanSupportsSpeed,
  fanPercentage,
  coverSupportsPosition,
  coverSupportsStop,
  climateStep,
  climateRange,
  climateHvacModes,
  mediaSupportsPause,
  mediaSupportsStop,
  mediaSupportsVolume,
  mediaVolumePct,
  mediaTitle,
  mediaArtist,
} from "./smartHomeAttributes";

interface SmartHomeDeviceTileProps {
  device: SmartHomeDevice;
  actions: SmartHomeActions;
  /** entityId of the light whose color/warmth popover is currently open, if any. */
  colorPickerFor: string | null;
  onOpenColorPicker: (entityId: string | null) => void;
  /** Compact-grid rendering (SmartHomeGlance.tsx) omits the decorative domain icons --
   * at that scale they end up dominating a tiny cell instead of reading as a subtle
   * accent, and the control itself (fill color, lock shape) already conveys the type. */
  compact?: boolean;
}

/**
 * Dispatches a device to its domain-specific control -- the same component tree used by
 * both the full Smart Home Spell view and its home-dashboard glance widget, so a device
 * looks and behaves identically wherever it's placed. Cameras aren't handled here (a
 * live feed doesn't belong in a compact tile); callers should filter that domain out.
 */
export function SmartHomeDeviceTile({ device, actions, colorPickerFor, onOpenColorPicker, compact }: SmartHomeDeviceTileProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  switch (device.domain) {
    case "light": {
      const supportsHue = lightSupportsHue(device.attributes);
      const supportsTemp = lightSupportsColorTemp(device.attributes);
      const canPickColor = supportsHue || supportsTemp;
      const showPicker = colorPickerFor === device.entityId;
      return (
        <div className="smart-home-tile-anchor" ref={anchorRef}>
          <SmartHomeLevelSlider
            value={lightBrightnessPct(device.attributes)}
            active={device.state === "on"}
            color={lightFillColor(device.attributes)}
            icon={compact ? undefined : <SMART_HOME_DOMAIN_ICONS.light />}
            label={device.name}
            onToggle={() => actions.toggleOnOff(device)}
            onChangeLevel={(pct) => actions.setLightLevel(device, pct)}
            onLongPress={canPickColor ? () => onOpenColorPicker(device.entityId) : undefined}
          />
          {showPicker &&
            (supportsHue ? (
              <SmartHomeColorPicker
                mode="color"
                anchorRef={anchorRef}
                onPick={(hue) => actions.setLightHue(device, hue)}
                onClose={() => onOpenColorPicker(null)}
              />
            ) : (
              <SmartHomeColorPicker
                mode="temp"
                anchorRef={anchorRef}
                minKelvin={lightColorTempRangeKelvin(device.attributes)[0]}
                maxKelvin={lightColorTempRangeKelvin(device.attributes)[1]}
                onPick={(kelvin) => actions.setLightColorTemp(device, kelvin)}
                onClose={() => onOpenColorPicker(null)}
              />
            ))}
        </div>
      );
    }
    case "switch":
      return (
        <SmartHomeSwitchToggle
          checked={device.state === "on"}
          label={device.name}
          icon={compact ? undefined : <SMART_HOME_DOMAIN_ICONS.switch />}
          onToggle={() => actions.toggleOnOff(device)}
        />
      );
    case "fan": {
      if (fanSupportsSpeed(device.attributes)) {
        return (
          <SmartHomeLevelSlider
            value={fanPercentage(device.attributes)}
            active={device.state === "on"}
            icon={compact ? undefined : <SMART_HOME_DOMAIN_ICONS.fan />}
            label={device.name}
            onToggle={() => actions.toggleOnOff(device)}
            onChangeLevel={(pct) => actions.setFanLevel(device, pct)}
          />
        );
      }
      return (
        <SmartHomeSwitchToggle
          checked={device.state === "on"}
          label={device.name}
          icon={compact ? undefined : <SMART_HOME_DOMAIN_ICONS.fan />}
          onToggle={() => actions.toggleOnOff(device)}
        />
      );
    }
    case "lock":
      return <SmartHomeLockControl state={device.state} label={device.name} onToggle={() => actions.toggleLock(device)} />;
    case "cover": {
      if (coverSupportsPosition(device.attributes)) {
        return (
          <SmartHomeLevelSlider
            value={typeof device.attributes.current_position === "number" ? device.attributes.current_position : 0}
            active={device.state !== "closed"}
            icon={compact ? undefined : <SMART_HOME_DOMAIN_ICONS.cover />}
            label={device.name}
            onToggle={() => actions.toggleCover(device)}
            onChangeLevel={(pct) => actions.setCoverPosition(device, pct)}
          />
        );
      }
      return (
        <SmartHomeCoverControl
          name={device.name}
          state={device.state}
          canStop={coverSupportsStop(device.attributes)}
          onOpen={() => actions.openCover(device)}
          onClose={() => actions.closeCover(device)}
          onStop={() => actions.stopCover(device)}
        />
      );
    }
    case "climate": {
      const current = typeof device.attributes.current_temperature === "number" ? device.attributes.current_temperature : null;
      const target = typeof device.attributes.temperature === "number" ? device.attributes.temperature : null;
      const [minTemp, maxTemp] = climateRange(device.attributes, target ?? current);
      return (
        <SmartHomeThermostatControl
          name={device.name}
          currentTemp={current}
          targetTemp={target}
          minTemp={minTemp}
          maxTemp={maxTemp}
          step={climateStep(device.attributes)}
          hvacMode={device.state}
          hvacAction={typeof device.attributes.hvac_action === "string" ? device.attributes.hvac_action : undefined}
          hvacModes={climateHvacModes(device.attributes)}
          onChangeTarget={(value) => actions.setTemperature(device, value)}
          onChangeMode={(mode) => actions.setHvacMode(device, mode)}
        />
      );
    }
    case "media_player":
      return (
        <SmartHomeMediaPlayerControl
          name={device.name}
          state={device.state}
          title={mediaTitle(device.attributes)}
          artist={mediaArtist(device.attributes)}
          supportsPause={mediaSupportsPause(device.attributes)}
          supportsStop={mediaSupportsStop(device.attributes)}
          volumePct={mediaSupportsVolume(device.attributes) ? mediaVolumePct(device.attributes) : null}
          onPlayPause={() => actions.mediaPlayPause(device)}
          onStop={() => actions.mediaStop(device)}
          onChangeVolume={(pct) => actions.setMediaVolume(device, pct)}
        />
      );
    default:
      return null;
  }
}
