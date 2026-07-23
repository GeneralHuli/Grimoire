import { useEffect, useState } from "react";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

export function CalendarSpell() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    // Calendar requires the google-account Spell (see spell.json) and has no
    // connection state of its own — it just checks the shared account status.
    fetch("/api/spells/google-account/status")
      .then((res) => res.json())
      .then((data: { connected: boolean }) => setConnected(data.connected));
  }, []);

  useEffect(() => {
    if (!connected) return;
    fetch("/api/spells/calendar/events?range=week")
      .then((res) => res.json())
      .then((data: { events: CalendarEvent[] }) => setEvents(data.events));
  }, [connected]);

  if (connected === null) {
    return (
      <div className="spell-card">
        <h2>Family Calendar</h2>
        <p>Loading…</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="spell-card">
        <h2>Family Calendar</h2>
        <p>Needs a connected Google Account.</p>
        <a className="calendar-connect" href="/api/spells/google-account/auth/start">
          Sign in with Google
        </a>
      </div>
    );
  }

  return (
    <div className="spell-card">
      <h2>Family Calendar</h2>
      <div className="calendar-week">
        {groupByDay(events).map(([day, dayEvents]) => (
          <div className="calendar-day" key={day}>
            <h3>{day}</h3>
            <ul>
              {dayEvents.map((event) => (
                <li key={event.id}>
                  {!event.allDay && (
                    <span className="calendar-time">{formatTime(event.start)}</span>
                  )}
                  {event.title}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupByDay(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const day = new Date(event.start).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(event);
  }
  return [...groups.entries()];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
