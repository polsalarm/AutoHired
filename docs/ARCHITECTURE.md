# AutoHired — Architecture

## Principle: stateless server, client owns data

The browser talks to **Supabase directly** for all of the user's data (applications, tasks, documents, analyses). Row-Level Security scopes every row to `auth.uid()`, so the client can hold the anon key safely.

The **Express server never touches user data or the database.** It only does work the browser can't or shouldn't:

- fetch + scrape a posting URL (CORS, SSRF risk)
- parse documents to text (native libs)
- call the LLM (keeps provider keys server-side)

```
┌────────────┐   Supabase JS (RLS)    ┌─────────────┐
│  Browser   │ ─────────────────────▶ │  Supabase   │  Postgres + Auth + Storage
│  (React    │                        └─────────────┘
│   PWA)     │   fetch /api/*         ┌─────────────┐   LLM (Vertex/Gemini/Anthropic)
│            │ ─────────────────────▶ │  Express    │ ─────────────▶ provider
└────────────┘   scrape/extract/ai    │  (stateless)│
                                      └─────────────┘
```

## Client (`client/`)

- **Routing/shell:** `App.tsx` → `AuthProvider` → `BrowserRouter` → `Gate` (loading / login / `Shell`). `Shell` mounts `PWAStatus` (offline + install banner), optional `DemoBanner`, `TopAppBar`, routed page, `BottomNavBar`.
- **Auth:** `auth/AuthContext.tsx` — session, sign-in/up/out, `demoMode` (true when Supabase env absent → mock data, no gate).
- **Data layer:** `api.ts` (typed Supabase queries + server `fetch` calls) → `lib/mappers.ts` (snake_case → camelCase). Server calls go through `lib/apiBase.ts` (`apiUrl()` prepends `VITE_API_URL` in prod).
- **Hooks:** `hooks/useData.ts` — `useAsync` + per-entity hooks that branch demo (mock) vs live (api).
- **PWA:** `vite-plugin-pwa` (manifest, service worker, runtime caching for fonts + `/api`). Skeleton loaders, `prefers-reduced-motion`, install prompt.

## Server (`server/`)

- `index.ts` — Express: CORS allowlist, JSON limit, rate limiters, routers, `/health`.
- **Routes** (all zod-validated): `scrape`, `tasks` (generate), `extract`, `analyze`.
- **Services:**
  - `jobScraper.ts` — fetch + Cheerio strip, 10s timeout, SSRF guard; extracts `<form>` fields before stripping.
  - `formExtractor.ts` — Google Forms (`FB_PUBLIC_LOAD_DATA_`) + generic `<form>` inputs → requirements.
  - `aiParser.ts` — scraped text + form fields → structured `ScrapedJob`.
  - `taskGenerator.ts` — requirements + deadline → checklist.
  - `docExtractor.ts` — PDF (`pdf-parse`), DOCX (`mammoth`), TXT → text.
  - `jobMatcher.ts` — resume × application → match score + suggestions/gaps/strengths.
  - `llm.ts` — **single AI gateway** (see below).
- **Lib:** `ssrfGuard.ts` (DNS lookup, blocks private/loopback/link-local).

## AI gateway (`server/src/services/llm.ts`)

`callLLM(prompt)` / `hasLLM()` pick the provider from env (first match wins):

| Provider | Trigger env | Notes |
|---|---|---|
| Vertex AI | `VERTEX_PROJECT` | `@google/genai` vertex mode; auth via ADC (local) or `GOOGLE_SERVICE_ACCOUNT_KEY` (prod) |
| Gemini API | `GEMINI_API_KEY` | AI Studio, free tier |
| Anthropic | `ANTHROPIC_API_KEY` | Claude, paid |
| none | — | each service uses its own heuristic fallback (regex parse, rule tasks, keyword-overlap match) |

`aiParser`, `taskGenerator`, `jobMatcher` all call the gateway and degrade to heuristics when `hasLLM()` is false, so the app works end-to-end with zero keys.

## Data model (`supabase/migrations/0001_init.sql`)

`profiles` · `applications` · `documents` · `tasks` · `analyses`, all RLS owner-only, plus a private `documents` Storage bucket with per-user folder policies. `analyses` is unique per `(application_id, document_id)` — re-analysis upserts.

## Deployment shape (Phase 7)

- **Client → Vercel** (static + PWA). Set `VITE_API_URL` to the server origin; `/api` rewrite optional.
- **Server → Render/Railway/Fly** (Express runs as-is). Set `GOOGLE_SERVICE_ACCOUNT_KEY` (Vertex auth without gcloud), `CLIENT_ORIGIN` (the Vercel URL).
- **Supabase** — already managed; production project + migration workflow.
