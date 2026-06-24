/**
 * Calendar reminder helpers — no backend/push infra needed.
 * "Add to Google Calendar" link + .ics download (with a 1h-before alarm) so the
 * reminder lands in the calendar the user already checks.
 */

export interface CalendarEvent {
  title: string;
  startsAt: string; // ISO timestamp
  location?: string | null;
  notes?: string | null;
  durationMinutes?: number; // defaults to 60
}

/** ISO → compact UTC `YYYYMMDDTHHMMSSZ` (iCal / Google format). */
function toCompactUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function endIso(e: CalendarEvent): string {
  const ms = new Date(e.startsAt).getTime() + (e.durationMinutes ?? 60) * 60_000;
  return new Date(ms).toISOString();
}

/** "Add to Google Calendar" prefilled-event URL. */
export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${toCompactUtc(e.startsAt)}/${toCompactUtc(endIso(e))}`,
  });
  if (e.notes) params.set("details", e.notes);
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(s: string): string {
  return s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

/** A standalone .ics file body with a reminder alarm 1 hour before. */
export function buildIcs(e: CalendarEvent): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AutoHired//Schedule//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@autohired`,
    `DTSTAMP:${toCompactUtc(new Date().toISOString())}`,
    `DTSTART:${toCompactUtc(e.startsAt)}`,
    `DTEND:${toCompactUtc(endIso(e))}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    e.location ? `LOCATION:${escapeIcs(e.location)}` : "",
    e.notes ? `DESCRIPTION:${escapeIcs(e.notes)}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

/** Triggers a browser download of the event as an .ics file. */
export function downloadIcs(e: CalendarEvent): void {
  const blob = new Blob([buildIcs(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.title.replace(/\s+/g, "_").slice(0, 50) || "event"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
