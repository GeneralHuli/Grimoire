import { useEffect, useRef, useState } from "react";
import type { CalendarEvent } from "./CalendarSpell";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function formatDateParam(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function sortByStart(a: CalendarEvent, b: CalendarEvent): number {
  return a.start.localeCompare(b.start);
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

function monthGridDays(anchor: Date): Date[] {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function useCalendarEvents(range: "week" | "month") {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    fetch(`/api/spells/calendar/events?range=${range}&date=${formatDateParam(new Date())}`)
      .then(async (res) => {
        if (!res.ok) {
          setConnected(false);
          return;
        }
        const data = (await res.json()) as { events: CalendarEvent[] };
        setEvents(data.events);
      })
      .catch(() => setConnected(false));
  }, [range]);

  return { events, connected };
}

export function CalendarAgendaGlance() {
  const { events, connected } = useCalendarEvents("week");

  if (!connected) return <p className="glance-empty">Connect Google in Settings</p>;
  if (!events) return <p className="glance-empty">Loading…</p>;

  const now = Date.now();
  const upcoming = events
    .filter((e) => new Date(e.end || e.start).getTime() >= now)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 3);

  if (upcoming.length === 0) return <p className="glance-empty">No upcoming events</p>;

  return (
    <ul className="glance-list">
      {upcoming.map((event) => (
        <li key={event.id} className="glance-list-row">
          <span className="glance-list-time">
            {event.allDay ? "All day" : new Date(event.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
          <span className="glance-list-title">{event.title}</span>
        </li>
      ))}
    </ul>
  );
}

/** Shared by both the click-to-expand overlay (CalendarMiniMonthGlance) and the
 * permanently-visible detail column (CalendarMonthDayGlance) -- the two variants only
 * differ in how they position this. */
function DayEventList({ day, events }: { day: Date; events: CalendarEvent[] }) {
  const dayEvents = events.slice().sort(sortByStart);
  return (
    <div className="mini-month-day-detail">
      <h4 className="mini-month-day-detail-title">
        {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
      </h4>
      {dayEvents.length === 0 ? (
        <p className="glance-empty">No events</p>
      ) : (
        <ul className="mini-month-day-detail-list">
          {dayEvents.map((event) => (
            <li key={event.id}>
              {!event.allDay && <span className="calendar-time">{formatTime(event.start)}</span>}
              <span>{event.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The month grid itself, shared by both calendar widget variants -- always anchored to
 * the current month (glances don't get their own month navigation, unlike the full
 * CalendarSpell page). */
function MonthGrid({
  events,
  selectedDay,
  onSelectDay,
}: {
  events: CalendarEvent[];
  selectedDay: Date | null;
  onSelectDay: (day: Date) => void;
}) {
  const today = new Date();
  const days = monthGridDays(today);
  const eventsByDay = groupEventsByDate(events);

  return (
    <div className="mini-month">
      {WEEKDAY_LABELS.map((label, i) => (
        <div className="mini-month-weekday" key={i}>
          {label}
        </div>
      ))}
      {days.map((day) => {
        const key = formatDateParam(day);
        const dayEvents = (eventsByDay.get(key) ?? []).slice().sort(sortByStart);
        const outside = day.getMonth() !== today.getMonth();
        const isToday = key === formatDateParam(today);
        const isSelected = selectedDay !== null && key === formatDateParam(selectedDay);
        const classes = ["mini-month-day"];
        if (outside) classes.push("outside");
        if (isToday) classes.push("today");
        if (isSelected) classes.push("selected");
        return (
          <button
            type="button"
            key={key}
            className={classes.join(" ")}
            onClick={(e) => {
              e.stopPropagation();
              onSelectDay(day);
            }}
          >
            <span className="mini-month-day-number">{day.getDate()}</span>
            {dayEvents.length > 0 && <span className="mini-month-day-title">{dayEvents[0].title}</span>}
            {dayEvents.length > 1 && <span className="mini-month-day-more">+{dayEvents.length - 1}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact month grid (matches HOME_WIDGET_VARIANTS' "mini-month" size). Tapping a day
 * doesn't resize the widget's saved grid footprint -- it pops a fixed-position detail
 * panel out over whatever sits to the widget's right (same idea as
 * SmartHomeGlanceDrawer), sized to roughly one of this widget's own grid columns. This
 * works regardless of what's actually placed next to it on the dashboard, including the
 * default layout where this widget already sits flush against the grid's right edge.
 */
export function CalendarMiniMonthGlance() {
  const { events, connected } = useCalendarEvents("month");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [overlayRect, setOverlayRect] = useState<{ left: number; top: number; height: number; width: number } | null>(
    null
  );

  useEffect(() => {
    if (!selectedDay || !wrapRef.current) {
      setOverlayRect(null);
      return;
    }
    const rect = wrapRef.current.getBoundingClientRect();
    setOverlayRect({ left: rect.right, top: rect.top, height: rect.height, width: rect.width / 3 });
  }, [selectedDay]);

  if (!connected) return <p className="glance-empty">Connect Google in Settings</p>;
  if (!events) return <p className="glance-empty">Loading…</p>;

  const eventsByDay = groupEventsByDate(events);

  return (
    <div className="mini-month-wrap" ref={wrapRef} onClick={(e) => e.stopPropagation()}>
      <MonthGrid
        events={events}
        selectedDay={selectedDay}
        onSelectDay={(day) =>
          setSelectedDay((prev) => (prev && formatDateParam(prev) === formatDateParam(day) ? null : day))
        }
      />
      {selectedDay && overlayRect && (
        <div
          className="mini-month-overlay"
          style={{ left: overlayRect.left, top: overlayRect.top, height: overlayRect.height, width: overlayRect.width }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="btn btn-icon mini-month-overlay-close"
            onClick={() => setSelectedDay(null)}
            aria-label="Close"
          >
            ×
          </button>
          <DayEventList day={selectedDay} events={eventsByDay.get(formatDateParam(selectedDay)) ?? []} />
        </div>
      )}
    </div>
  );
}

/**
 * Wider variant (one grid column more than "mini-month", see HOME_WIDGET_VARIANTS) that
 * permanently reserves that extra column for a day-detail panel instead of popping one
 * out on tap -- defaults to today and updates in place when another day is tapped.
 */
export function CalendarMonthDayGlance() {
  const { events, connected } = useCalendarEvents("month");
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  if (!connected) return <p className="glance-empty">Connect Google in Settings</p>;
  if (!events) return <p className="glance-empty">Loading…</p>;

  const eventsByDay = groupEventsByDate(events);

  return (
    <div className="calendar-month-day-glance" onClick={(e) => e.stopPropagation()}>
      <div className="calendar-month-day-glance-grid">
        <MonthGrid events={events} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
      </div>
      <div className="calendar-month-day-glance-detail">
        <DayEventList day={selectedDay} events={eventsByDay.get(formatDateParam(selectedDay)) ?? []} />
      </div>
    </div>
  );
}
