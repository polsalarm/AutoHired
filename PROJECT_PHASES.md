# AutoHired — Project Phasing Plan

AI-powered PWA for tracking internship / ambassadorship / hackathon applications.
Source prompt: `AutoHired_Claude_Prompt.md` · Design: Stitch project **AutoHired AI Application Tracker** (`design/stitch/*.html`) · Architecture reference: [kloowi/cwbproj (CareerHive)](https://github.com/kloowi/cwbproj.git)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS (PWA via `vite-plugin-pwa`) |
| Backend | Node.js + Express + TypeScript |
| Scraping | Cheerio (static HTML) — Puppeteer optional later for JS-heavy pages |
| Doc parsing | `pdf-parse` (PDF), `mammoth` (DOCX) |
| AI | Anthropic Claude API (structured JSON output) + keyword/regex fallback provider (offline mode, per CareerHive pattern) |
| DB / Auth / Storage | Supabase (Postgres + Auth + Storage buckets) |

## Design System (from Stitch)

- **Palette:** Material-3 style. Primary `#3525cd` (indigo), primary-container `#4f46e5`, background `#f9f9ff`, surface tokens (`surface-container-*`), error `#ba1a1a`. Full token set in `design/stitch/home-dashboard.html`.
- **Type:** Inter (400–800). Scale: `display-lg 48px`, `headline-lg 32px`, `headline-md 24px`, `body-lg 18px`, `body-md 16px`, `label-md 14px`, `label-sm 12px`.
- **Icons:** Material Symbols Outlined (FILL variation for active states).
- **Layout:** Mobile-first; sticky TopAppBar (h-16), fixed BottomNavBar (h-16, 4 tabs: Home / Tasks / Vault / Profile, active = primary + top indicator bar), `rounded-xl` cards with `shadow-level-1`, safe-area padding.
- **Screens (5):** Home Dashboard · Dynamic Checklist (Tasks) · Document Vault · Application Detail · User Profile.

---

## Phase 0 — Scaffolding & Design System ✦ foundation

**Goal:** Monorepo running locally; design tokens encoded; PWA installable shell.

- [ ] Repo init (git), workspace layout: `client/` (Vite React TS) + `server/` (Express TS) + `supabase/` (SQL migrations)
- [ ] Tailwind config with full Stitch token set (colors, fontSize, spacing, borderRadius)
- [ ] Inter + Material Symbols fonts wired
- [ ] Shared layout components: `TopAppBar`, `BottomNavBar`, `Card`, `ProgressRing`, `StatusChip`
- [ ] React Router with 5 routes matching Stitch screens
- [ ] PWA: `vite-plugin-pwa` manifest (name, theme `#3525cd`, icons) + service worker (app-shell precache)
- [ ] Server: Express skeleton, `/health` route, CORS, env config (zod-validated)
- [ ] Shared TS types package/folder: `Application`, `ScrapedJob`, `Task`, `Document`, `AIAnalysis`

**Exit:** `npm run dev` boots both apps; Lighthouse PWA installable; all 5 screens render with static mock data matching Stitch design.

## Phase 1 — Supabase: Schema, Auth, Storage ✅ DONE

**Goal:** Real persistence + login.

- [x] SQL migration (`supabase/migrations/0001_init.sql`) for tables:
  - `profiles` (extends auth.users: name, headline, avatar) + signup trigger
  - `applications` (url, title, company, location, description, requirements jsonb, deadline, status enum: draft/applying/applied/interviewing/offer/rejected, match_score)
  - `documents` (storage_path, type enum, parsed_text, status: pending/analyzed)
  - `tasks` (application_id FK, label, due_date, done, source: ai/manual)
  - `analyses` (application_id FK, document_id FK, match_score, summary, suggestions/gaps/strengths jsonb)
- [x] Row Level Security on all tables (owner-only) + storage `documents` bucket policies
- [x] Client: Supabase client (`lib/supabase.ts`), `AuthContext` (session, signIn/signUp/signOut), `LoginPage`, auth gate in `App.tsx`
- [x] Data layer: `api.ts` (typed queries) + `lib/mappers.ts` (snake→camel) + `hooks/useData.ts`
- [x] All 5 screens wired to live queries with loading/error/empty states
- [x] **Demo mode:** runs on mock data with a banner when Supabase env is absent (UI explorable without backend)
- [x] Profile screen: real stats computed from applications; sign-out wired

**Note:** Requires a Supabase project — set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `client/.env` and run the migration. Without them the app falls back to demo mode.

**Exit:** ✅ Sign up → log in → empty dashboard from DB; RLS owner-scoped; demo fallback verified by build.

## Phase 2 — Link Scraper & Application Parser ✅ DONE

**Goal:** Paste URL → structured application record.

- [x] `POST /api/scrape` — fetch URL, Cheerio strip (nav/script/footer), extract main text (10s timeout) + SSRF guard
- [x] AI parse step: text → `ScrapedJob` (Claude structured output; regex/keyword fallback when no API key)
- [x] Quick-Add bar on Home wired (paste → scrape → save → navigate to detail)
- [x] Application Detail: real data, Description/Requirements accordions, status selector (draft→…→offer/rejected), delete
- [x] Dashboard cards list real applications with status + deadline badges
- [x] Error states: scrape failure surfaces "Enter manually" link; `NewApplicationPage` manual-entry form (pre-fills URL from failed scrape)

**Exit:** ✅ Paste URL → application created with parsed fields → dashboard + detail; manual fallback when scrape blocked.

**Later (escalation tiers):** current scraper is Tier 0 (Cheerio). Add curl_cffi / Patchright / API tiers per `docs/SCRAPER_STRATEGY.md` when targets block.

## Phase 3 — Dynamic Checklist Generator ✅ DONE

**Goal:** Auto To-Do list per application.

- [x] `POST /api/tasks/generate` — Claude converts requirements + deadline into actionable tasks with due dates (spread before deadline); rule-based fallback (one task per requirement + "Tailor resume" + "Submit application", verb-dedup). Server stateless; client persists to Supabase.
- [x] `generateAndSaveTasks` — calls server then bulk-inserts `tasks` rows (source: ai)
- [x] Auto-generation on application create (scrape + manual), non-blocking
- [x] `Checklist` component on Application Detail: generate / regenerate / add manual / check (optimistic) / delete, with done count + due dates
- [x] Tasks API: `listTasksForApplication`, `addTask`, `deleteTask`, `setTaskDone`
- [x] Tasks screen (existing) lists + toggles grouped Today/Upcoming, bento cards per company

**Exit:** ✅ New application → checklist auto-generated → check/add/delete tasks → persists.

**Note:** Tasks screen FAB (global manual add) still a stub — manual add lives on the detail Checklist for now.

## Phase 4 — Document Vault ✅ DONE

**Goal:** Secure document storage + text extraction.

- [x] Vault screen: drag-drop dropzone + file browse (PDF/DOCX/TXT), per Stitch vault design
- [x] Upload → Supabase Storage (`documents/{userId}/...`); row in `documents`
- [x] Server extraction `POST /api/extract` (multipart): pdf-parse v2 (`new PDFParse({data}).getText()`), mammoth (DOCX), UTF-8 (TXT) → `parsed_text`; non-fatal if a scanned PDF yields no text
- [x] `uploadAndExtract` — extract text, upload file, insert row (status `analyzed` when text recovered, else `pending`)
- [x] Doc cards: type icon, added date, status dot ("Text ready"/"No text"), more-menu (download via signed URL, delete removes storage object + row)
- [x] Signed URLs (60s) for download; client size (10 MB) + type validation; server 413/415 handling

**Exit:** ✅ Upload resume PDF/DOCX → text extracted → `parsed_text` saved → card shows text-ready. (Verified extraction TXT/DOCX/unsupported; PDF via pdf-parse v2 API.)

## Phase 5 — AI Matcher: Feasibility Score & Suggestions ✅ DONE

**Goal:** Core differentiator — resume × job analysis.

- [x] `POST /api/analyze` (`jobMatcher.ts`) — input: document `parsed_text` + application requirements/description → Claude returns `{ matchScore 0-100, verdict, summary, suggestions[], gaps[], strengths[] }`; zod-validated route requires `resumeText`
- [x] Fallback provider: keyword-overlap scoring (stopword-filtered tokens, ≥50% requirement coverage = strength else gap), verdict bands; CareerHive pattern
- [x] Result persisted in `analyses` via `analyzeAndSave` (upsert on `application_id,document_id`) + stamps `applications.match_score`
- [x] Application Detail: feasibility hero card (progress ring + % + verdict + summary), AI Resume Suggestions list + Strengths/Gaps grid
- [x] "Analyze" button on Vault doc cards (gated to text-ready docs) → application-picker modal → run match → navigate to detail
- [ ] Dashboard: match-score ring on each card; Profile: avg match score stat (Profile avg already computed in Phase 1; dashboard ring still pending)

**Exit:** ✅ Select resume + application → score in seconds → suggestions/gaps/strengths rendered. (Verified fallback: 3/4 reqs → 75% Strong Match; empty resumeText → 400.)

## Phase 6 — PWA Polish & Offline ✅ DONE (mostly)

**Goal:** Feels native on mobile.

- [x] Runtime caching: fonts CacheFirst, `/api` NetworkFirst (vite-plugin-pwa workbox)
- [x] Install prompt UX (`PWAStatus.tsx` — `beforeinstallprompt`), iOS meta tags, maskable icons
- [x] Skeleton loaders (`SkeletonCard`/`SkeletonList` on Home), optimistic task toggles (Checklist)
- [x] Offline banner (`navigator.onLine` in `PWAStatus`)
- [x] A11y: `prefers-reduced-motion`, `role=meter` on rings, aria labels on icon buttons
- [ ] Deadline notifications (Push API) — deferred (in-app deadline badges already on cards)
- [ ] Pull-to-refresh / Lighthouse ≥90 verification — deferred to deploy

## Phase 7 — Deploy & Hardening ✅ code-ready (deploy pending)

- [x] Rate limiting (express-rate-limit: 60/min general, 15/min AI routes) + zod on all routes + SSRF guard
- [x] CORS allowlist (comma-separated `CLIENT_ORIGIN`); `trust proxy` for real IP behind host
- [x] Prod AI auth: `GOOGLE_SERVICE_ACCOUNT_KEY` path in `llm.ts` (Vertex without gcloud)
- [x] Client API base URL (`lib/apiBase.ts` + `VITE_API_URL`) so prod points at deployed server
- [x] README + `docs/ARCHITECTURE.md`
- [ ] Client → Vercel; Server → Render/Railway; Supabase prod project — **pending (do together later)**
- [ ] Basic e2e smoke (Playwright): login → scrape → analyze — deferred

---

## ⚠️ AI provider key (optional)

AI parse/checklist/match run through an LLM **only when a key is set** in `server/.env`. Single gateway `server/src/services/llm.ts` picks the provider — **`GEMINI_API_KEY` first, then `ANTHROPIC_API_KEY`** — else the offline heuristic fallback.

- **Gemini (free tier):** get a key at aistudio.google.com/apikey → set `GEMINI_API_KEY`, model `gemini-2.0-flash` (free, ~15 req/min + daily cap). **Recommended for dev.**
- **Anthropic Claude (paid):** prepaid credits at console.anthropic.com, ~$0.01–0.04/scrape on `claude-sonnet-4-6`. Set `ANTHROPIC_API_KEY`.

**With no key the app uses the free heuristic fallback** (regex/keyword parse + rule-based tasks + keyword-overlap match). Works end-to-end, just rougher output. Affects Phase 2 (parse), Phase 3 (checklist), Phase 5 (match score). No code change to switch — providers auto-select from env.

## Build Order Rationale

Schema before scraper (Phase 1→2) so scraped data lands somewhere real. Scraper before checklist (2→3) because tasks derive from scraped requirements. Vault before matcher (4→5) because matcher needs `parsed_text`. Matches CareerHive's pipeline: extract → scrape → analyze → suggest.

## Risks

- **Scrape blocking:** big job boards (LinkedIn, Workday) block bots → manual-entry fallback is mandatory, Puppeteer later.
- **AI cost/latency:** cache analyses per (doc, application) pair; fallback provider keeps app usable offline.
- **PDF extraction quality:** scanned PDFs yield no text → detect and warn user.
