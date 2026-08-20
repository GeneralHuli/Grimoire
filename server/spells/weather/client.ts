const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export type Units = "us" | "metric";

export interface GeocodeResult {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

interface RawGeocodeResult {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

export async function geocodeLocations(query: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ name: query, count: "5", language: "en", format: "json" });
  const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Open-Meteo geocoding request failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { results?: RawGeocodeResult[] };
  return (body.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

export interface HourForecast {
  time: string;
  temperature: number;
  weatherCode: number;
  precipitationProbability: number;
}

export interface DayForecast {
  date: string;
  weatherCode: number;
  high: number;
  low: number;
  precipitationProbability: number;
}

export interface ForecastResponse {
  units: Units;
  current: {
    temperature: number;
    apparentTemperature: number;
    weatherCode: number;
    isDay: boolean;
  };
  hourly: HourForecast[];
  daily: DayForecast[];
}

interface RawForecastResponse {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weathercode: number;
    is_day: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weathercode: number[];
    precipitation_probability: number[];
  };
  daily: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
}

// Module-level in-memory cache, same check-then-fetch-then-store shape as
// retail-kroger/client.ts's clientToken cache -- keyed by rounded lat/lon + units since
// (unlike a single app-level OAuth token) multiple locations/units combos can be live at
// once, but a single household still only ever has one saved location in practice.
const forecastCache = new Map<string, { data: ForecastResponse; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(latitude: number, longitude: number, units: Units): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)},${units}`;
}

export async function getForecast(latitude: number, longitude: number, units: Units): Promise<ForecastResponse> {
  const key = cacheKey(latitude, longitude, units);
  const cached = forecastCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    temperature_unit: units === "us" ? "fahrenheit" : "celsius",
    current: "temperature_2m,apparent_temperature,weathercode,is_day",
    hourly: "temperature_2m,weathercode,precipitation_probability",
    daily: "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "7",
  });
  const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Open-Meteo forecast request failed: ${res.status} ${await res.text()}`);
  const raw = (await res.json()) as RawForecastResponse;

  const now = Date.now();
  const nextHours = raw.hourly.time
    .map((time, i) => ({
      time,
      temperature: raw.hourly.temperature_2m[i],
      weatherCode: raw.hourly.weathercode[i],
      precipitationProbability: raw.hourly.precipitation_probability[i],
    }))
    .filter((h) => new Date(h.time).getTime() >= now - 60 * 60 * 1000)
    .slice(0, 24);

  const data: ForecastResponse = {
    units,
    current: {
      temperature: raw.current.temperature_2m,
      apparentTemperature: raw.current.apparent_temperature,
      weatherCode: raw.current.weathercode,
      isDay: raw.current.is_day === 1,
    },
    hourly: nextHours,
    daily: raw.daily.time.map((date, i) => ({
      date,
      weatherCode: raw.daily.weathercode[i],
      high: raw.daily.temperature_2m_max[i],
      low: raw.daily.temperature_2m_min[i],
      precipitationProbability: raw.daily.precipitation_probability_max[i],
    })),
  };

  forecastCache.set(key, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}
