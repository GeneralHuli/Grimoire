/** Pure helpers for reading Home Assistant entity `attributes` into display-ready values. */

const COLOR_MODES_WITH_HUE = new Set(["hs", "rgb", "rgbw", "rgbww", "xy"]);

function num(attrs: Record<string, unknown>, key: string): number | null {
  const v = attrs[key];
  return typeof v === "number" ? v : null;
}

function numArray(attrs: Record<string, unknown>, key: string): number[] | null {
  const v = attrs[key];
  return Array.isArray(v) && v.every((n) => typeof n === "number") ? (v as number[]) : null;
}

function stringArray(attrs: Record<string, unknown>, key: string): string[] {
  const v = attrs[key];
  return Array.isArray(v) && v.every((s) => typeof s === "string") ? (v as string[]) : [];
}

export function lightBrightnessPct(attrs: Record<string, unknown>): number {
  const brightness = num(attrs, "brightness");
  return brightness !== null ? Math.round((brightness / 255) * 100) : 100;
}

export function lightSupportsHue(attrs: Record<string, unknown>): boolean {
  return stringArray(attrs, "supported_color_modes").some((m) => COLOR_MODES_WITH_HUE.has(m));
}

export function lightSupportsColorTemp(attrs: Record<string, unknown>): boolean {
  return stringArray(attrs, "supported_color_modes").includes("color_temp");
}

export function lightColorTempRangeKelvin(attrs: Record<string, unknown>): [number, number] {
  const min = num(attrs, "min_color_temp_kelvin");
  const max = num(attrs, "max_color_temp_kelvin");
  return [min ?? 2000, max ?? 6500];
}

/** Tanner Helland's black-body approximation, clamped to the visible incandescent-to-daylight range. */
export function kelvinToRgb(kelvin: number): [number, number, number] {
  const temp = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r: number, g: number, b: number;
  if (temp <= 66) {
    r = 255;
    g = 99.47 * Math.log(temp) - 161.12;
  } else {
    r = 329.7 * Math.pow(temp - 60, -0.1332);
    g = 288.12 * Math.pow(temp - 60, -0.0755);
  }
  if (temp >= 66) b = 255;
  else if (temp <= 19) b = 0;
  else b = 138.52 * Math.log(temp - 10) - 305.04;
  const clamp = (n: number) => Math.round(Math.min(255, Math.max(0, n)));
  return [clamp(r), clamp(g), clamp(b)];
}

/** CSS color for a light's slider fill, or undefined to fall back to the app accent. */
export function lightFillColor(attrs: Record<string, unknown>): string | undefined {
  const rgb = numArray(attrs, "rgb_color");
  if (rgb && rgb.length >= 3) return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  const hs = numArray(attrs, "hs_color");
  if (hs && hs.length >= 2) return `hsl(${hs[0]}, ${hs[1]}%, 50%)`;
  const kelvin = num(attrs, "color_temp_kelvin");
  if (kelvin !== null) {
    const [r, g, b] = kelvinToRgb(kelvin);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return undefined;
}

/** Home Assistant reports `percentage: null` for a speed-capable fan that's off, so
 * capability has to be read from `percentage_step` (only present when supported), not
 * from whether `percentage` currently holds a number. */
export function fanSupportsSpeed(attrs: Record<string, unknown>): boolean {
  return num(attrs, "percentage_step") !== null;
}

export function fanPercentage(attrs: Record<string, unknown>): number {
  return num(attrs, "percentage") ?? 0;
}

export function coverSupportsPosition(attrs: Record<string, unknown>): boolean {
  return num(attrs, "current_position") !== null;
}

export function coverSupportsStop(attrs: Record<string, unknown>): boolean {
  const features = num(attrs, "supported_features");
  return features === null || (features & 8) !== 0;
}

export function climateStep(attrs: Record<string, unknown>): number {
  return num(attrs, "target_temp_step") ?? 1;
}

export function climateRange(attrs: Record<string, unknown>, fallbackAround: number | null): [number, number] {
  const min = num(attrs, "min_temp");
  const max = num(attrs, "max_temp");
  if (min !== null && max !== null) return [min, max];
  const center = fallbackAround ?? 70;
  return [center - 10, center + 10];
}

export function climateHvacModes(attrs: Record<string, unknown>): string[] {
  return stringArray(attrs, "hvac_modes");
}

/** MediaPlayerEntityFeature bit flags (Home Assistant's own enum) relevant here --
 * https://developers.home-assistant.io/docs/core/entity/media-player/#supported-features */
const MEDIA_FEATURE_PAUSE = 1;
const MEDIA_FEATURE_VOLUME_SET = 4;
const MEDIA_FEATURE_STOP = 4096;

export function mediaPlayerIsPlaying(state: string): boolean {
  return state === "playing";
}

/** Most players support pause/stop without advertising it in `supported_features`, so
 * (like coverSupportsStop) a missing bitmask defaults to "supported" rather than hiding
 * the button. */
export function mediaSupportsPause(attrs: Record<string, unknown>): boolean {
  const features = num(attrs, "supported_features");
  return features === null || (features & MEDIA_FEATURE_PAUSE) !== 0;
}

export function mediaSupportsStop(attrs: Record<string, unknown>): boolean {
  const features = num(attrs, "supported_features");
  return features === null || (features & MEDIA_FEATURE_STOP) !== 0;
}

export function mediaSupportsVolume(attrs: Record<string, unknown>): boolean {
  const features = num(attrs, "supported_features");
  return features !== null && (features & MEDIA_FEATURE_VOLUME_SET) !== 0;
}

export function mediaVolumePct(attrs: Record<string, unknown>): number {
  const level = num(attrs, "volume_level");
  return level !== null ? Math.round(level * 100) : 0;
}

export function mediaTitle(attrs: Record<string, unknown>): string | undefined {
  const value = attrs.media_title;
  return typeof value === "string" ? value : undefined;
}

export function mediaArtist(attrs: Record<string, unknown>): string | undefined {
  const value = attrs.media_artist;
  return typeof value === "string" ? value : undefined;
}
