import { useEffect, useState } from "react";
import { weatherCodeInfo } from "./weatherCodes";
import type { ForecastResponse } from "./weatherTypes";

export function WeatherSpell() {
  const [locationName, setLocationName] = useState("");
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/weather")
      .then((res) => res.json())
      .then((data: { locationName?: string }) => setLocationName(data.locationName ?? ""));
  }, []);

  useEffect(() => {
    fetch("/api/spells/weather/forecast")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? "request_failed");
        }
        return res.json();
      })
      .then((data: ForecastResponse) => setForecast(data))
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error === "no_location") {
    return (
      <div className="spell-card">
        <h2>Weather</h2>
        <p>No location set — open Settings → Weather to search for one.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="spell-card">
        <h2>Weather</h2>
        <p>Couldn't load the forecast right now.</p>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="spell-card">
        <h2>Weather</h2>
        <p>Loading…</p>
      </div>
    );
  }

  const unitSuffix = forecast.units === "us" ? "°F" : "°C";
  const current = weatherCodeInfo(forecast.current.weatherCode);

  return (
    <div className="spell-card">
      <h2>Weather{locationName ? ` — ${locationName}` : ""}</h2>
      <div className="weather-current">
        <span className="weather-current-icon">
          <current.Icon />
        </span>
        <div>
          <div className="weather-current-temp">
            {Math.round(forecast.current.temperature)}
            {unitSuffix}
          </div>
          <div className="weather-current-label">{current.label}</div>
          <div className="weather-current-feels">
            Feels like {Math.round(forecast.current.apparentTemperature)}
            {unitSuffix}
          </div>
        </div>
      </div>

      <h3>Hourly</h3>
      <div className="weather-hourly-strip">
        {forecast.hourly.map((hour) => {
          const info = weatherCodeInfo(hour.weatherCode);
          return (
            <div className="weather-hour" key={hour.time}>
              <div className="weather-hour-time">
                {new Date(hour.time).toLocaleTimeString([], { hour: "numeric" })}
              </div>
              <div className="weather-hour-icon">
                <info.Icon />
              </div>
              <div className="weather-hour-temp">
                {Math.round(hour.temperature)}
                {unitSuffix}
              </div>
            </div>
          );
        })}
      </div>

      <h3>7-Day Forecast</h3>
      <ul className="weather-daily-list">
        {forecast.daily.map((day) => {
          const info = weatherCodeInfo(day.weatherCode);
          return (
            <li className="weather-daily-row" key={day.date}>
              <span className="weather-daily-date">
                {new Date(day.date).toLocaleDateString([], { weekday: "short" })}
              </span>
              <span className="weather-daily-icon">
                <info.Icon />
              </span>
              <span className="weather-daily-label">{info.label}</span>
              <span className="weather-daily-precip">{day.precipitationProbability}%</span>
              <span className="weather-daily-range">
                {Math.round(day.high)}
                {unitSuffix} / {Math.round(day.low)}
                {unitSuffix}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
