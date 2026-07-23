import { useEffect, useState } from "react";
import { CalendarEventModal } from "./CalendarEventModal";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

type ViewMode = "month" | "week" | "day";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarSpell() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [defaultViewLoaded, setDefaultViewLoaded] = useState(false);
  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    // Calendar requires the google-account Spell (see spell.json) and has no
    // connection state of its own — it just checks the shared account status.
    fetch("/api/spells/google-account/status")
      .then((res) => res.json())
      .then((data: { connected: boolean }) => setConnected(data.connected));
  }, []);

  useEffect(() => {
    if (!connected) return;
    fetch("/api/settings/calendar")
      .then((res) => res.json())
      .then((data: { defaultView?: ViewMode }) => {
        if (data.defaultView) setView(data.defaultView);
        setDefaultViewLoaded(true);
      });
  }, [connected]);

  useEffect(() => {
    if (!connected || !defaultViewLoaded) return;
    fetch(`/api/spells/calendar/events?range=${view}&date=${formatDateParam(anchor)}`)
      .then((res) => res.json())
      .then((data: { events: CalendarEvent[] }) => setEvents(data.events));
  }, [connected, defaultViewLoaded, view, anchor]);

  function shift(delta: number) {
    setAnchor((prev) => {
      if (view === "month") return new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      if (view === "week") return addDays(prev, delta * 7);
      return addDays(prev, delta);
    });
  }

  function openDay(date: Date) {
    setAnchor(startOfDay(date));
    setView("day");
  }

  function switchView(mode: ViewMode) {
    setAnchor((prev) => (mode === "month" ? new Date(prev.getFullYear(), prev.getMonth(), 1) : prev));
    setView(mode);
  }

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
    <div className="spell-card calendar-card">
      <h2>Family Calendar</h2>
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous">
            ‹
          </button>
          <button type="button" onClick={() => setAnchor(startOfDay(new Date()))}>
            Today
          </button>
          <button type="button" onClick={() => shift(1)} aria-label="Next">
            ›
          </button>
        </div>
        <span className="calendar-label">{headerLabel(view, anchor)}</span>
        <div className="calendar-view-switch">
          {(["month", "week", "day"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={mode === view ? "active" : undefined}
              onClick={() => switchView(mode)}
            >
              {mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {view === "month" && (
        <MonthView anchor={anchor} events={events} onOpenDay={openDay} onSelectEvent={setEditingEvent} />
      )}
      {view === "week" && (
        <WeekView anchor={anchor} events={events} onOpenDay={openDay} onSelectEvent={setEditingEvent} />
      )}
      {view === "day" && <DayView events={events} onSelectEvent={setEditingEvent} />}

      {editingEvent && (
        <CalendarEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={(updated) => {
            setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
            setEditingEvent(null);
          }}
        />
      )}
    </div>
  );
}

function MonthView({
  anchor,
  events,
  onOpenDay,
  onSelectEvent,
}: {
  anchor: Date;
  events: CalendarEvent[];
  onOpenDay: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const gridStart = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const eventsByDay = groupEventsByDate(events);
  const today = new Date();

  return (
    <div className="calendar-month">
      {WEEKDAY_LABELS.map((label) => (
        <div className="calendar-month-weekday" key={label}>
          {label}
        </div>
      ))}
      {days.map((day) => {
        const key = formatDateParam(day);
        const dayEvents = (eventsByDay.get(key) ?? []).slice().sort(sortByStart);
        const classes = ["calendar-month-day"];
        if (day.getMonth() !== anchor.getMonth()) classes.push("outside");
        if (isSameDay(day, today)) classes.push("today");
        return (
          <button
            key={key}
            type="button"
            className={classes.join(" ")}
            onClick={() => onOpenDay(day)}
          >
            <span className="calendar-month-day-number">{day.getDate()}</span>
            <ul className="calendar-month-day-events">
              {dayEvents.slice(0, 3).map((event) => (
                <li
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvent(event);
                  }}
                >
                  {event.title}
                </li>
              ))}
              {dayEvents.length > 3 && <li className="calendar-more">+{dayEvents.length - 3} more</li>}
            </ul>
          </button>
        );
      })}
    </div>
  );
}

function WeekView({
  anchor,
  events,
  onOpenDay,
  onSelectEvent,
}: {
  anchor: Date;
  events: CalendarEvent[];
  onOpenDay: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const eventsByDay = groupEventsByDate(events);
  const today = new Date();

  return (
    <div className="calendar-week">
      {days.map((day) => {
        const key = formatDateParam(day);
        const dayEvents = (eventsByDay.get(key) ?? []).slice().sort(sortByStart);
        return (
          <div className={`calendar-day${isSameDay(day, today) ? " today" : ""}`} key={key}>
            <button type="button" className="calendar-day-header" onClick={() => onOpenDay(day)}>
              <h3>{day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</h3>
            </button>
            <ul>
              {dayEvents.map((event) => (
                <li key={event.id}>
                  <button type="button" className="calendar-event" onClick={() => onSelectEvent(event)}>
                    {!event.allDay && <span className="calendar-time">{formatTime(event.start)}</span>}
                    {event.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function DayView({
  events,
  onSelectEvent,
}: {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const dayEvents = events.slice().sort(sortByStart);
  if (dayEvents.length === 0) {
    return <p className="calendar-empty">No events.</p>;
  }
  return (
    <ul className="calendar-day-detail">
      {dayEvents.map((event) => (
        <li key={event.id}>
          <button type="button" className="calendar-event" onClick={() => onSelectEvent(event)}>
            {!event.allDay && <span className="calendar-time">{formatTime(event.start)}</span>}
            {event.title}
          </button>
        </li>
      ))}
    </ul>
  );
}

function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = event.allDay ? event.start : formatDateParam(new Date(event.start));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }
  return groups;
}

function sortByStart(a: CalendarEvent, b: CalendarEvent): number {
  return a.start.localeCompare(b.start);
}

function headerLabel(view: ViewMode, anchor: Date): string {
  if (view === "month") {
    return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endLabel = end.toLocaleDateString(
      undefined,
      start.getMonth() === end.getMonth()
        ? { day: "numeric", year: "numeric" }
        : { month: "short", day: "numeric", year: "numeric" }
    );
    return `${startLabel} – ${endLabel}`;
  }
  return anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date): Date {
  const start = startOfDay(d);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateParam(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
