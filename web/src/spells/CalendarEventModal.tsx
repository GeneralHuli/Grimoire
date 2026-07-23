import { useState } from "react";
import type { CalendarEvent } from "./CalendarSpell";

interface CalendarEventModalProps {
  event: CalendarEvent;
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
}

export function CalendarEventModal({ event, onClose, onSaved }: CalendarEventModalProps) {
  const [title, setTitle] = useState(event.title);
  const [allDay, setAllDay] = useState(event.allDay);
  const [start, setStart] = useState(() => (event.allDay ? event.start : toDateTimeLocal(event.start)));
  const [end, setEnd] = useState(() => (event.allDay ? event.end : toDateTimeLocal(event.end)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAllDay(checked: boolean) {
    setAllDay(checked);
    setStart((prev) => (checked ? prev.slice(0, 10) : `${prev.slice(0, 10)}T09:00`));
    setEnd((prev) => (checked ? prev.slice(0, 10) : `${prev.slice(0, 10)}T10:00`));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const updated: CalendarEvent = {
      id: event.id,
      title,
      allDay,
      start: allDay ? start : new Date(start).toISOString(),
      end: allDay ? end : new Date(end).toISOString(),
    };
    const res = await fetch(`/api/spells/calendar/events/${event.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Couldn't save. Try again.");
      return;
    }
    onSaved(updated);
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="calendar-event-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Edit Event"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-actions">
          <h3 className="modal-actions-title">Edit Event</h3>
          <button type="button" className="settings-save" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <label className="settings-field">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="settings-field settings-field-inline">
            <input type="checkbox" checked={allDay} onChange={(e) => toggleAllDay(e.target.checked)} />
            All day
          </label>
          <label className="settings-field">
            Starts
            <input
              type={allDay ? "date" : "datetime-local"}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="settings-field">
            Ends
            <input
              type={allDay ? "date" : "datetime-local"}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          {error && <p className="calendar-event-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
