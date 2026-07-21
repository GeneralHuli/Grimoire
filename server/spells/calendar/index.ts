import type { Express, Request, Response } from "express";
import { google } from "googleapis";
import type { SpellModule } from "../../src/types.js";
import { createOAuthClient, getConsentUrl } from "./googleAuth.js";
import { saveRefreshToken, loadRefreshToken, isConnected } from "./tokenStore.js";

function getCalendarClient() {
  const refreshToken = loadRefreshToken();
  if (!refreshToken) return null;
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: client });
}

function getRange(range: string): { timeMin: string; timeMax: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = range === "day" ? 1 : 7;
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

function handleErrors(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error("[calendar spell]", err);
      res.status(500).json({ error: "internal_error" });
    });
  };
}

const mod: SpellModule = {
  register(app: Express) {
    app.get("/api/spells/calendar/status", (_req, res) => {
      res.json({ connected: isConnected() });
    });

    app.get("/api/spells/calendar/auth/start", (_req, res) => {
      res.redirect(getConsentUrl());
    });

    app.get(
      "/api/spells/calendar/auth/callback",
      handleErrors(async (req, res) => {
        const code = req.query.code;
        if (typeof code !== "string") {
          res.status(400).send("Missing authorization code");
          return;
        }
        const client = createOAuthClient();
        const { tokens } = await client.getToken(code);
        if (!tokens.refresh_token) {
          res
            .status(400)
            .send(
              "Google didn't return a refresh token. Remove Grimoire's access at " +
                "https://myaccount.google.com/permissions and try connecting again."
            );
          return;
        }
        saveRefreshToken(tokens.refresh_token);
        res.redirect("/");
      })
    );

    app.get(
      "/api/spells/calendar/events",
      handleErrors(async (req, res) => {
        const calendar = getCalendarClient();
        if (!calendar) {
          res.status(401).json({ error: "not_connected" });
          return;
        }
        const range = req.query.range === "day" ? "day" : "week";
        const { timeMin, timeMax } = getRange(range);
        const result = await calendar.events.list({
          calendarId: "primary",
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
        });
        const events = (result.data.items ?? []).map((event) => ({
          id: event.id,
          title: event.summary ?? "(untitled)",
          start: event.start?.dateTime ?? event.start?.date,
          end: event.end?.dateTime ?? event.end?.date,
          allDay: Boolean(event.start?.date),
        }));
        res.json({ events });
      })
    );

    app.post(
      "/api/spells/calendar/events",
      handleErrors(async (req, res) => {
        const calendar = getCalendarClient();
        if (!calendar) {
          res.status(401).json({ error: "not_connected" });
          return;
        }
        const { title, start, end, allDay } = req.body as {
          title: string;
          start: string;
          end: string;
          allDay?: boolean;
        };
        const result = await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: title,
            start: allDay ? { date: start } : { dateTime: start },
            end: allDay ? { date: end } : { dateTime: end },
          },
        });
        res.status(201).json({ id: result.data.id });
      })
    );
  },
};

export default mod;
