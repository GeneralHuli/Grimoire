import { useEffect, useState } from "react";
import { weatherCodeInfo } from "./weatherCodes";
import type { ForecastResponse } from "./weatherTypes";

function useForecast() {
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

  return { locationName, forecast, error };
}

export function WeatherSmallGlance() {
  const { locationName, forecast, error } = useForecast();

  if (error) return <p className="glance-empty">{error === "no_location" ? "No location set" : "Unavailable"}</p>;
  if (!forecast) return <p className="glance-empty">Loading…</p>;

  const info = weatherCodeInfo(forecast.current.weatherCode);

  return (
    <div className="weather-glance-small">
      <span className="weather-glance-icon">{info.icon}</span>
      <span className="weather-glance-temp">{Math.round(forecast.current.temperature)}°</span>
      {locationName && <span className="weather-glance-location">{locationName}</span>}
    </div>
  );
}

export function WeatherLargeGlance() {
  const { locationName, forecast, error } = useForecast();

  if (error) return <p className="glance-empty">{error === "no_location" ? "No location set" : "Unavailable"}</p>;
  if (!forecast) return <p className="glance-empty">Loading…</p>;

  const info = weatherCodeInfo(forecast.current.weatherCode);
  const today = forecast.daily[0];
  const upcoming = forecast.daily.slice(1, 6);

  return (
    <div className="weather-glance-large">
      <div className="weather-glance-large-header">
        <span className="weather-glance-icon">{info.icon}</span>
        <div>
          <div className="weather-glance-temp">{Math.round(forecast.current.temperature)}°</div>
          <div className="weather-glance-label">{info.label}</div>
        </div>
      </div>
      {locationName && <div className="weather-glance-location">{locationName}</div>}
      {today && (
        <div className="weather-glance-hilo">
          H:{Math.round(today.high)}° L:{Math.round(today.low)}°
        </div>
      )}
      <div className="weather-hourly-strip weather-glance-hourly">
        {forecast.hourly.slice(0, 5).map((hour) => {
          const hourInfo = weatherCodeInfo(hour.weatherCode);
          return (
            <div className="weather-hour" key={hour.time}>
              <div className="weather-hour-time">
                {new Date(hour.time).toLocaleTimeString([], { hour: "numeric" })}
              </div>
              <div className="weather-hour-icon">{hourInfo.icon}</div>
              <div className="weather-hour-temp">{Math.round(hour.temperature)}°</div>
            </div>
          );
        })}
      </div>
      {upcoming.length > 0 && (
        <div className="weather-glance-daily-cards">
          {upcoming.map((day) => {
            const dayInfo = weatherCodeInfo(day.weatherCode);
            return (
              <div className="weather-glance-daily-card" key={day.date}>
                <div className="weather-glance-daily-card-label">
                  {new Date(day.date).toLocaleDateString([], { weekday: "short" })}
                </div>
                <div className="weather-glance-daily-card-icon">{dayInfo.icon}</div>
                <div className="weather-glance-daily-card-range">
                  {Math.round(day.high)}°/{Math.round(day.low)}°
                </div>
                <div className="weather-glance-daily-card-precip">{day.precipitationProbability}%</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
