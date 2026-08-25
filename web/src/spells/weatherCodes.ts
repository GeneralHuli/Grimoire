import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Snowflake,
  Sun,
  Thermometer,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

/** Open-Meteo/WMO weather-code lookup, shared by the full Weather view and its glance widgets. */
export interface WeatherCodeInfo {
  label: string;
  Icon: ComponentType<LucideProps>;
}

const WEATHER_CODES: Record<number, WeatherCodeInfo> = {
  0: { label: "Clear sky", Icon: Sun },
  1: { label: "Mostly clear", Icon: CloudSun },
  2: { label: "Partly cloudy", Icon: CloudSun },
  3: { label: "Overcast", Icon: Cloud },
  45: { label: "Fog", Icon: CloudFog },
  48: { label: "Icy fog", Icon: CloudFog },
  51: { label: "Light drizzle", Icon: CloudDrizzle },
  53: { label: "Drizzle", Icon: CloudDrizzle },
  55: { label: "Heavy drizzle", Icon: CloudRain },
  56: { label: "Light freezing drizzle", Icon: CloudRain },
  57: { label: "Freezing drizzle", Icon: CloudRain },
  61: { label: "Light rain", Icon: CloudRain },
  63: { label: "Rain", Icon: CloudRain },
  65: { label: "Heavy rain", Icon: CloudRain },
  66: { label: "Light freezing rain", Icon: CloudRain },
  67: { label: "Freezing rain", Icon: CloudRain },
  71: { label: "Light snow", Icon: CloudSnow },
  73: { label: "Snow", Icon: CloudSnow },
  75: { label: "Heavy snow", Icon: Snowflake },
  77: { label: "Snow grains", Icon: Snowflake },
  80: { label: "Light showers", Icon: CloudDrizzle },
  81: { label: "Showers", Icon: CloudRain },
  82: { label: "Violent showers", Icon: CloudLightning },
  85: { label: "Light snow showers", Icon: CloudSnow },
  86: { label: "Snow showers", Icon: CloudSnow },
  95: { label: "Thunderstorm", Icon: CloudLightning },
  96: { label: "Thunderstorm with hail", Icon: CloudLightning },
  99: { label: "Severe thunderstorm", Icon: CloudLightning },
};

export function weatherCodeInfo(code: number): WeatherCodeInfo {
  return WEATHER_CODES[code] ?? { label: "Unknown", Icon: Thermometer };
}
