# AutoHired — Additional Features (Plan)

Planned features beyond the core tracker. Each phase ships standalone and useful.
Nothing here is built yet — this is the design/roadmap doc.

Theme: **"so he won't forget."** Turn AutoHired from a passive tracker into an
active assistant that prepares the user for interviews and makes sure scheduled
events never slip.

---

## Feature A — Interview Practice

AI-generated, role-specific interview prep. Reuses the existing LLM gateway
(`server/src/services/llm.ts`) and the user's profile.

- **Server:** `POST /api/interview/questions` — body `{ application, profile }`
  → `callLLM` → tailored questions (behavioral + role-specific + technical),
  each with a short tip / "what they're looking for." zod-validated, with a
  heuristic fallback like the other AI routes.
- **(v2)** `POST /api/interview/feedback` — `{ question, answer }` → LLM critique
  + score, so the user can rehearse answers and improve.
- **Client:** a "Practice" section on `ApplicationDetailPage` — Generate button →
  expandable question cards. Optionally persist the last generated set.
- **Files:** `server/src/routes/interview.ts`,
  `server/src/services/interviewCoach.ts`, register in `index.ts`; client
  `api.ts` + `InterviewPractice.tsx`.

---

## Feature B — Schedule / Meetings / Reminders

So interviews and meetings never get forgotten.

- **DB:** migration `0004_events.sql` — table
  `events(id, user_id, application_id?, type[interview|meeting|call|deadline],
  title, starts_at timestamptz, location/notes, done)` + owner-only RLS.
  Also update `supabase/migrations/provision_all.sql`.
- **Client:** a new **Schedule** view (own tab or under Tasks) — upcoming list
  sorted by `starts_at`, an "Add event" modal, tie an event to an application.
  Home surfaces the next event with a days-left badge (reuse the deadline badge).
- **Reminders (MVP):** per event, an **"Add to Google Calendar" link** +
  **`.ics` download** (pure client, no infra) + an in-app "upcoming" banner.
  This offloads the actual reminder to the calendar the user already checks.
- **Reminders (v2):** web-push — VAPID keypair, `POST /api/push/subscribe`,
  store subscriptions, a service-worker `push` handler, and a trigger to fire
  reminders even when the app is closed.
- **Files:** `supabase/migrations/0004_events.sql`, client `SchedulePage.tsx` +
  additions to `api.ts` / `mappers.ts` / `hooks/useData.ts`, nav entry.

---

## Feature C — Gmail → auto-fetch interview emails

Closes the loop: an interview email arrives → AutoHired proposes the event so the
user can't miss it. Heaviest feature — do last.

### Constraints (read first)
- **OAuth + scope.** Needs a Google Cloud OAuth 2.0 Client + consent screen,
  scope `gmail.readonly`. That scope is **restricted** — public launch requires a
  Google security review. **For the demo: "Testing" mode**, add the user's email
  as a test user → works immediately, no verification.
- **Token handling.**
  - **MVP (recommended):** client-side Google OAuth (Google Identity Services)
    → browser gets a short-lived `access_token` → POST to server for a one-shot
    fetch. No refresh token stored → fits the stateless-server design, minimal
    security surface, fine for the demo. Trade-off: a manual "Sync Gmail" button,
    no background sync.
  - **v2:** store an encrypted refresh token in Supabase + Gmail `watch`/poll →
    true background auto-sync.

### Flow (MVP)
1. "Connect Gmail" → GIS consent → access token.
2. `POST /api/gmail/scan` `{ accessToken }` → server calls Gmail API
   `messages.list` with a query (`interview OR "schedule a call" OR` known ATS
   sender domains: greenhouse, lever, workday…), pulls recent message bodies.
3. Each body → `callLLM` extracts
   `{ company, role, datetime, location/link, type }`.
4. Return **proposed events** → user confirms → save to the `events` table
   (Feature B) and link to the matching application.

### Privacy
Read-only, parse-and-discard. Do **not** persist raw email bodies — only the
extracted event fields.

### Files
Google Cloud OAuth client (one-time manual), `server/src/routes/gmail.ts`,
`server/src/services/emailParser.ts`, client "Connect Gmail" button +
review-and-confirm modal.

---

## Suggested build order

1. **Feature B** — Schedule + `.ics`/Google-Calendar reminders. Foundation, no
   AI or OAuth risk; highest "won't forget" value.
2. **Feature A** — Interview Practice. Pure LLM, reuses what's built.
3. **Feature C** — Gmail scan. Feeds interviews into the schedule from #1.
   Heaviest, last.

Later/v2: web-push reminders, interview-answer feedback, Gmail background sync.
