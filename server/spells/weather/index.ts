import type { Express, Request, Response } from "express";
import type { SpellModule } from "../../src/types.js";
import { getSettings } from "../../src/settingsStore.js";
import { geocodeLocations, getForecast } from "./client.js";
import type { Units } from "./client.js";

function handleErrors(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error("[weather spell]", err);
      res.status(500).json({ error: "Weather request failed" });
    });
  };
}

interface WeatherSettings {
  latitude?: number | null;
  longitude?: number | null;
  units?: Units;
}

const mod: SpellModule = {
  register(app: Express) {
    app.get(
      "/api/spells/weather/geocode",
      handleErrors(async (req, res) => {
        const q = req.query.q;
        if (typeof q !== "string" || !q.trim()) {
          res.status(400).json({ error: "q is required" });
          return;
        }
        const results = await geocodeLocations(q.trim());
        res.json({ results });
      })
    );

    app.get(
      "/api/spells/weather/forecast",
      handleErrors(async (_req, res) => {
        const { latitude, longitude, units } = getSettings("weather") as WeatherSettings;
        if (latitude == null || longitude == null) {
          res.status(400).json({ error: "no_location" });
          return;
        }
        const forecast = await getForecast(latitude, longitude, units ?? "us");
        res.json(forecast);
      })
    );
  },
};

export default mod;
