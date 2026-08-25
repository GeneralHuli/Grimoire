import { Blinds, Fan, Lightbulb, Lock, Plug, Thermometer, Tv, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";

/** Icon per Home Assistant domain, shared by every Smart Home view (device tiles, room
 * master toggles, the whole-house Summaries panel, and the glance drawer's device
 * palette) so a domain reads the same icon everywhere it appears. */
export const SMART_HOME_DOMAIN_ICONS: Record<string, ComponentType<LucideProps>> = {
  light: Lightbulb,
  switch: Plug,
  fan: Fan,
  cover: Blinds,
  lock: Lock,
  climate: Thermometer,
  media_player: Tv,
};
