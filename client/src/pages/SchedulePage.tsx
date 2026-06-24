import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, Loading } from "../components/states";
import { useApplications, useEvents } from "../hooks/useData";
import { useAuth } from "../auth/AuthContext";
import { createEvent, deleteEvent, setEventDone, type EventInput } from "../api";
import { downloadIcs, googleCalendarUrl } from "../lib/calendar";
import type { Application, EventType, ScheduleEvent } from "../types";

const TYPE_META: Record<
  EventType,
  { icon: string; label: string; tint: string; bg: string }
> = {
  interview: { icon: "event_available", label: "Interview", tint: "text-primary", bg: "bg-primary-fixed" },
  meeting: { icon: "groups", label: "Meeting", tint: "text-secondary", bg: "bg-secondary-fixed" },
  call: { icon: "call", label: "Call", tint: "text-tertiary", bg: "bg-tertiary-fixed" },
  deadline: { icon: "flag", label: "Deadline", tint: "text-error", bg: "bg-error-container" },
};

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO → value for <input type="datetime-local"> (local time). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relDay(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1) return `In ${days}d`;
  return `${Math.abs(days)}d ago`;
}

/** Default for a new event: tomorrow at the next whole hour. */
function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d.toISOString();
}

export function SchedulePage() {
  const { user, demoMode } = useAuth();
  const { data: loaded, loading, error, reload } = useEvents();
  const { data: applications } = useApplications();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (loaded) setEvents(loaded);
  }, [loaded]);

  const apps = applications ?? [];
  const appName = (id: string | null) =>
    id ? apps.find((a) => a.id === id)?.company ?? null : null;

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: ScheduleEvent[] = [];
    const old: ScheduleEvent[] = [];
    for (const e of [...events].sort(
      (a, b) => +new Date(a.startsAt) - +new Date(b.startsAt),
    )) {
      (e.done || new Date(e.startsAt).getTime() < now ? old : up).push(e);
    }
    return { upcoming: up, past: old.reverse() };
  }, [events]);

  async function toggleDone(e: ScheduleEvent) {
    const next = !e.done;
    setEvents((prev) => prev.map((x) => (x.id === e.id ? { ...x, done: next } : x)));
    if (!demoMode) {
      try {
        await setEventDone(e.id, next);
      } catch {
        setEvents((prev) =>
          prev.map((x) => (x.id === e.id ? { ...x, done: !next } : x)),
        );
      }
    }
  }

  async function remove(e: ScheduleEvent) {
    setEvents((prev) => prev.filter((x) => x.id !== e.id));
    if (!demoMode) {
      try {
        await deleteEvent(e.id);
      } catch {
        reload();
      }
    }
  }

  async function handleCreate(input: EventInput) {
    if (demoMode || !user) {
      // Demo: add locally so the UI is explorable without Supabase.
      setEvents((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          userId: "demo",
          createdAt: new Date().toISOString(),
          done: false,
          ...input,
        },
      ]);
      setAdding(false);
      return;
    }
    const created = await createEvent(user.id, input);
    setEvents((prev) => [...prev, created]);
    setAdding(false);
  }

  return (
    <main className="flex-1 px-container-margin pt-stack-lg pb-stack-xl w-full max-w-[1200px] mx-auto">
      <div className="mb-stack-lg">
        <h1 className="text-headline-lg-mobile text-on-surface">Schedule</h1>
        <p className="text-body-md text-on-surface-variant mt-unit">
          Interviews, calls, and deadlines — with calendar reminders so nothing slips.
        </p>
      </div>

      {loading && <Loading label="Loading schedule…" />}
      {error && <ErrorState message={error} />}
      {!loading && !error && events.length === 0 && (
        <EmptyState
          icon="event"
          title="Nothing scheduled"
          hint="Add an interview or meeting and get a calendar reminder."
        />
      )}

      {!loading && !error && events.length > 0 && (
        <div className="flex flex-col gap-stack-lg">
          {upcoming.length > 0 && (
            <Section title="Upcoming">
              {upcoming.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  company={appName(e.applicationId)}
                  onToggle={toggleDone}
                  onDelete={remove}
                />
              ))}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Past & done">
              {past.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  company={appName(e.applicationId)}
                  onToggle={toggleDone}
                  onDelete={remove}
                  muted
                />
              ))}
            </Section>
          )}
        </div>
      )}

      <button
        onClick={() => setAdding(true)}
        className="fixed bottom-20 right-container-margin w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center z-40 hover:opacity-80 transition-opacity active:scale-90"
        aria-label="Add event"
      >
        <Icon name="add" />
      </button>

      {adding && (
        <AddEventModal
          apps={apps}
          onClose={() => setAdding(false)}
          onSave={handleCreate}
        />
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-label-md uppercase tracking-wider mb-stack-md text-on-surface-variant">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">{children}</div>
    </section>
  );
}

function EventCard({
  event,
  company,
  onToggle,
  onDelete,
  muted,
}: {
  event: ScheduleEvent;
  company: string | null;
  onToggle: (e: ScheduleEvent) => void;
  onDelete: (e: ScheduleEvent) => void;
  muted?: boolean;
}) {
  const meta = TYPE_META[event.type];
  return (
    <div
      className={`bg-surface-container-lowest rounded-2xl p-4 shadow-level-1 border border-outline-variant/20 flex flex-col gap-3 ${
        muted ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full ${meta.bg} flex items-center justify-center ${meta.tint} shrink-0`}>
          <Icon name={meta.icon} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={`text-body-lg font-semibold text-on-surface ${event.done ? "line-through" : ""}`}>
            {event.title}
          </h3>
          <p className="text-label-sm text-on-surface-variant mt-0.5">
            {fmtWhen(event.startsAt)}
            <span className="mx-1.5">·</span>
            <span className={meta.tint}>{relDay(event.startsAt)}</span>
          </p>
        </div>
        <span className="text-label-sm text-on-surface-variant uppercase tracking-wide shrink-0">
          {meta.label}
        </span>
      </div>

      {(company || event.location) && (
        <div className="flex flex-wrap gap-2">
          {company && (
            <span className="text-label-sm text-on-surface-variant bg-surface-container rounded-full px-2.5 py-1 flex items-center gap-1">
              <Icon name="business_center" size={13} />
              {company}
            </span>
          )}
          {event.location && (
            <span className="text-label-sm text-on-surface-variant bg-surface-container rounded-full px-2.5 py-1 flex items-center gap-1">
              <Icon name="location_on" size={13} />
              {event.location}
            </span>
          )}
        </div>
      )}

      {event.notes && (
        <p className="text-body-md text-on-surface-variant whitespace-pre-line">
          {event.notes}
        </p>
      )}

      <div className="flex items-center gap-1 pt-1 border-t border-outline-variant/15 -mx-1">
        <a
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 text-label-md text-primary hover:bg-primary-fixed rounded-lg py-2 transition-colors"
        >
          <Icon name="event" size={16} />
          Calendar
        </a>
        <button
          onClick={() => downloadIcs(event)}
          className="flex-1 flex items-center justify-center gap-1.5 text-label-md text-on-surface-variant hover:bg-surface-container-low rounded-lg py-2 transition-colors"
        >
          <Icon name="download" size={16} />
          .ics
        </button>
        <button
          onClick={() => onToggle(event)}
          aria-label={event.done ? "Mark as not done" : "Mark as done"}
          className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
            event.done
              ? "text-primary hover:bg-primary-fixed"
              : "text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          <Icon name={event.done ? "task_alt" : "radio_button_unchecked"} size={18} />
        </button>
        <button
          onClick={() => onDelete(event)}
          aria-label="Delete event"
          className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
        >
          <Icon name="delete" size={18} />
        </button>
      </div>
    </div>
  );
}

function AddEventModal({
  apps,
  onClose,
  onSave,
}: {
  apps: Application[];
  onClose: () => void;
  onSave: (input: EventInput) => Promise<void>;
}) {
  const [type, setType] = useState<EventType>("interview");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(toLocalInput(defaultStart()));
  const [applicationId, setApplicationId] = useState<string>("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const canSave = title.trim().length > 0 && when.length > 0;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        type,
        title: title.trim(),
        startsAt: new Date(when).toISOString(),
        location: location.trim() || null,
        notes: notes.trim() || null,
        applicationId: applicationId || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4 overscroll-none"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-surface rounded-2xl shadow-level-2 w-full max-w-md max-h-[88dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-container-margin border-b border-outline-variant/20 shrink-0">
          <h3 className="text-body-lg font-semibold text-on-surface">New Event</h3>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-container-margin flex flex-col gap-stack-md">
          <label className="flex flex-col gap-2">
            <span className="text-label-md text-on-surface-variant">Type</span>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(TYPE_META) as EventType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-label-sm transition-colors ${
                    type === t
                      ? "border-primary bg-primary-fixed text-primary"
                      : "border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  <Icon name={TYPE_META[t].icon} size={18} />
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </label>

          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Vercel — Technical Interview"
              className={inputCls}
            />
          </Field>

          <Field label="Date & time">
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Application" hint="optional">
            <select
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              className={inputCls}
            >
              <option value="">— None —</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company} · {a.title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Location / link" hint="optional">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Google Meet, office, phone…"
              className={inputCls}
            />
          </Field>

          <Field label="Notes" hint="optional">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Prep notes, round details…"
              rows={3}
              className={textareaCls}
            />
          </Field>
        </div>
        <div className="flex gap-3 p-container-margin border-t border-outline-variant/20 shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !canSave}
            className="flex-1 py-3 rounded-xl text-label-md bg-primary text-on-primary shadow-level-1 hover:bg-on-primary-fixed-variant active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving && <Icon name="sync" size={16} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "bg-surface-container-lowest border border-outline-variant/40 rounded-lg h-11 px-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary";
const textareaCls =
  "bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-label-md text-on-surface-variant flex items-center gap-2">
        {label}
        {hint && <span className="text-label-sm text-outline">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}
