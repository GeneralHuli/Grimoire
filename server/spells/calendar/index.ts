import type { Express, Request, Response } from "express";
import { google } from "googleapis";
import type { SpellModule } from "../../src/types.js";
import { getAuthorizedClient } from "../google-account/client.js";
import { getSettings } from "../../src/settingsStore.js";

function getCalendarClient() {
  const client = getAuthorizedClient();
  if (!client) return null;
  return google.calendar({ version: "v3", auth: client });
}

/** Which of the account's calendars to read/write, as picked in the Calendar Spell's settings. */
function getSelectedCalendarId(): string {
  const { calendarId } = getSettings("calendar");
  return typeof calendarId === "string" && calendarId ? calendarId : "primary";
}

/** Parses a `YYYY-MM-DD` query param into a local-midnight Date, defaulting to today. */
function parseAnchor(dateParam: unknown): Date {
  if (typeof dateParam === "string") {
    const parsed = new Date(`${dateParam}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date): Date {
  const start = startOfDay(d);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

/**
 * Month range is padded out to full calendar weeks (a 42-day/6-row grid) so every
 * day cell shown in the Month view — including leading/trailing days from adjacent
 * months — has correct event data.
 */
function getRange(range: "day" | "week" | "month", anchor: Date): { timeMin: string; timeMax: string } {
  if (range === "day") {
    const start = startOfDay(anchor);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }
  if (range === "week") {
    const start = startOfWeek(anchor);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(firstOfMonth);
  const end = new Date(start);
  end.setDate(end.getDate() + 42);
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
    app.get(
      "/api/spells/calendar/calendars",
      handleErrors(async (_req, res) => {
        const calendar = getCalendarClient();
        if (!calendar) {
          res.status(401).json({ error: "google_not_connected" });
          return;
        }
        const result = await calendar.calendarList.list();
        const calendars = (result.data.items ?? []).map((entry) => ({
          id: entry.id,
          summary: entry.summaryOverride ?? entry.summary ?? entry.id,
          primary: Boolean(entry.primary),
        }));
        res.json({ calendars });
      })
    );

    app.get(
      "/api/spells/calendar/events",
      handleErrors(async (req, res) => {
        const calendar = getCalendarClient();
        if (!calendar) {
          res.status(401).json({ error: "google_not_connected" });
          return;
        }
        const range = req.query.range === "day" || req.query.range === "month" ? req.query.range : "week";
        const anchor = parseAnchor(req.query.date);
        const { timeMin, timeMax } = getRange(range, anchor);
        const result = await calendar.events.list({
          calendarId: getSelectedCalendarId(),
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
          res.status(401).json({ error: "google_not_connected" });
          return;
        }
        const { title, start, end, allDay } = req.body as {
          title: string;
          start: string;
          end: string;
          allDay?: boolean;
        };
        const result = await calendar.events.insert({
          calendarId: getSelectedCalendarId(),
          requestBody: {
            summary: title,
            start: allDay ? { date: start } : { dateTime: start },
            end: allDay ? { date: end } : { dateTime: end },
          },
        });
        res.status(201).json({ id: result.data.id });
      })
    );

    app.put(
      "/api/spells/calendar/events/:id",
      handleErrors(async (req, res) => {
        const calendar = getCalendarClient();
        if (!calendar) {
          res.status(401).json({ error: "google_not_connected" });
          return;
        }
        const { title, start, end, allDay } = req.body as {
          title: string;
          start: string;
          end: string;
          allDay?: boolean;
        };
        await calendar.events.patch({
          calendarId: getSelectedCalendarId(),
          eventId: req.params.id,
          requestBody: {
            summary: title,
            start: allDay ? { date: start } : { dateTime: start },
            end: allDay ? { date: end } : { dateTime: end },
          },
        });
        res.status(204).end();
      })
    );
  },
};

export default mod;
