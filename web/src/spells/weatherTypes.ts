/** Shared shape of GET /api/spells/weather/forecast, used by WeatherSpell and WeatherGlance. */
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
  units: "us" | "metric";
  current: {
    temperature: number;
    apparentTemperature: number;
    weatherCode: number;
    isDay: boolean;
  };
  hourly: HourForecast[];
  daily: DayForecast[];
}
