# AutoHired — AI Application Tracker (PWA)

A mobile-first Progressive Web App that turns a messy job/internship hunt into a tracked, guided pipeline. Paste a posting URL, and AutoHired scrapes it, parses the requirements with AI, builds a personalized to-do checklist, stores your documents, scores how well you match, runs a spoken AI mock interview, and keeps your deadlines on a calendar — with concrete suggestions to close the gaps.

**Live:** app → [autohired.vercel.app](https://autohired.vercel.app) · API → [autohired-api.vercel.app](https://autohired-api.vercel.app) (use Chrome/Edge for the voice interview).

Design source: Stitch project **AutoHired AI Application Tracker** (exported HTML in `design/stitch/`).
Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) · Roadmap: [`docs/ADDITIONAL_FEATURES.md`](./docs/ADDITIONAL_FEATURES.md).

---

## The problem

Hunting for internships, ambassadorships, and hackathons means juggling dozens of postings across tabs, spreadsheets, and Google Forms. Every listing buries its real requirements in walls of text, deadlines slip through the cracks, and you never quite know whether you're a strong fit or wasting an afternoon on a long shot. The busywork — re-reading postings, copying requirements into a checklist, tailoring a resume — is exactly the part that makes people give up.

## What AutoHired does

AutoHired collapses that whole loop into one paste. Drop in a URL and it does the reading, the organizing, and the honest self-assessment for you, so you spend your time applying instead of administrating.

## Features

- **Paste-a-URL intake** — scrapes the posting (Cheerio + form-field extraction for Google Forms and generic `<form>`s), AI-parses it into a structured job: title, company, location, description, requirements, and deadline. Manual entry fallback when a site can't be scraped.
- **Auto-generated checklist** — turns the parsed requirements + deadline into actionable tasks (AI, with a rule-based fallback). Add, check off, and delete your own items.
- **Document vault** — upload resumes/CVs/cover letters/portfolios (PDF, DOCX, TXT). Text is extracted server-side and stored for matching. Download via short-lived signed URLs; owner-only access.
- **AI match score** — analyzes a document against a posting and returns a 0–100 match score, a verdict, a summary, plus concrete **strengths**, **gaps**, and **resume suggestions**. Match ring shown per application.
- **Profile that feeds the AI** — editable profile (summary, skills, experience, education, location, links) that's folded into every match analysis. Custom avatar upload.
- **AI voice interview** — a spoken mock interview tailored to the role and your profile: the interviewer speaks each question (text-to-speech), you answer out loud (speech-to-text), and you get per-turn feedback plus a final scorecard (communication, relevance, confidence, structure). Browser Web Speech API — no extra keys. A text "practice questions" mode with model answers is also available.
- **Schedule + reminders** — track interviews, calls, meetings, and deadlines; add any event to Google Calendar or download an `.ics` file with a 1-hour reminder alarm. No push infrastructure required.
- **Deadline tracking** — auto-scraped or manually set; days-left badges on the dashboard.
- **PWA** — installable, offline banner, skeleton loading states, reduced-motion support.
- **Demo mode** — runs on mock data with no auth gate when Supabase isn't configured, so you can try it instantly.

## How it works

```
  ┌──────────┐   paste URL    ┌─────────────────────────────┐
  │  Client  │ ─────────────▶ │  Server (stateless API)     │
  │  (PWA)   │                │  scrape · extract · AI       │
  │          │ ◀───────────── │  OpenAI/Gemini/Vertex/…      │
  └────┬─────┘   parsed job   └─────────────────────────────┘
       │  reads/writes (RLS-scoped, owner-only)
       ▼
  ┌──────────────────────────────────────────────┐
  │  Supabase — Postgres · Auth · Storage         │
  └──────────────────────────────────────────────┘
```

The **server is stateless** — it never touches user data. It only scrapes URLs, extracts document text, and runs the AI pipeline. The **client owns all Supabase reads/writes**, every one scoped to the signed-in user by Row-Level Security.

## Stack

- **Client:** React + Vite + TypeScript + Tailwind CSS, PWA via `vite-plugin-pwa`
- **Server:** Node.js + Express + TypeScript — Cheerio scraper (+ form extraction), document text extraction (`unpdf` for PDF, `mammoth` for DOCX), AI pipeline. Runs locally as a long-lived process or on Vercel as a serverless function (`server/api/index.ts` wraps the same Express app).
- **AI:** single gateway (`server/src/services/llm.ts`) with a runtime fallback chain — OpenAI (or any OpenAI-compatible endpoint) → Vertex AI (Gemini) → Gemini API key → Anthropic → offline heuristic. Each provider is tried in order and falls through to the next on error.
- **Data:** Supabase — Postgres (RLS), Auth, Storage (`supabase/migrations/`)

## Layout

```
client/    Vite React PWA (Home, Tasks, Vault, Application Detail, Profile, Schedule; voice-interview UI)
server/    Express API (scrape, tasks/generate, extract, analyze, interview, health) + Vercel serverless entry
supabase/  SQL migrations (profiles+details, applications, documents, tasks, analyses, events, avatars bucket + RLS)
docs/      Architecture + scraper strategy + additional-features plan
design/    Stitch design exports (reference)
```

## Run

```bash
npm install
npm run dev        # client http://localhost:5173 + server http://localhost:3001
```

### Config

- **Client (Supabase):** copy `client/.env.example` → `client/.env`, set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, then run the migrations in `supabase/migrations/` (`0001`→`0004`) in the Supabase SQL editor — or paste `supabase/migrations/provision_all.sql` once on a fresh project. Without these the client runs in **demo mode** (mock data, no auth gate). Leave `VITE_API_URL` empty for local dev (Vite proxies `/api` → `localhost:3001`); set it to the deployed API origin in production.
- **Server (AI):** copy `server/.env.example` → `server/.env`. Set any/all providers — they're tried in priority order and fall through on error; set nothing to use the free offline heuristic fallback:
  - **OpenAI** (highest priority): set `OPENAI_API_KEY` + `OPENAI_MODEL`. Point `OPENAI_BASE_URL` at any OpenAI-compatible endpoint (e.g. Featherless, Groq) to run the same code path for free; leave empty for real OpenAI.
  - **Vertex AI** (uses GCP credits, `gemini-2.5-pro`): set `VERTEX_PROJECT`; auth locally via `gcloud auth application-default login`, in prod via `GOOGLE_SERVICE_ACCOUNT_KEY`.
  - **Gemini API key** (AI Studio free tier): set `GEMINI_API_KEY`.
  - **Anthropic** (paid): set `ANTHROPIC_API_KEY`.

## API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/scrape` | URL → scraped + AI-parsed `ScrapedJob` (Cheerio + form extraction, SSRF-guarded) |
| POST | `/api/tasks/generate` | requirements + deadline → checklist tasks |
| POST | `/api/extract` | multipart file → extracted text (PDF/DOCX/TXT) |
| POST | `/api/analyze` | resume text × application × profile → match score + suggestions/gaps/strengths |
| POST | `/api/interview/questions` | role + profile → tailored practice questions with tips + model answers |
| POST | `/api/interview/turn` | turn-based voice mock interview → per-turn feedback + next question, then a scorecard |
| GET | `/health` | liveness |

## Hardening

- SSRF guard blocks private/loopback IPs on scrape (`server/src/lib/ssrfGuard.ts`)
- Rate limiting: 60 req/min general, 15 req/min on AI/scrape/extract routes
- zod validation on every route; CORS allowlist via `CLIENT_ORIGIN` (comma-separated)
- Supabase RLS owner-only on all tables + Storage bucket policies

## Deployment

Both halves run on Vercel:

- **Client** → Vercel project rooted at `client/` (`client/vercel.json`: Vite build, SPA rewrites). Build-time env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (= the API origin).
- **Server** → Vercel project rooted at `server/` (`server/vercel.json` + `server/api/index.ts` wrap the Express app as one serverless function; all paths rewrite to it). Env: `OPENAI_*`, `CLIENT_ORIGIN` (the client origin, for CORS), plus any other AI providers.

```bash
# from each app dir, once linked + env set:
npx vercel --prod
```

> **Serverless note:** functions cap at 60s on Vercel's Hobby plan, so the AI gateway enforces a hard per-provider timeout (`LLM_TIMEOUT_MS`, default 45s) and falls back gracefully rather than 504-ing. A reasoning-heavy free model (e.g. Featherless `gpt-oss-120b`) may be too slow for the largest payloads (the multi-question text generator) and will fall back to templates; a faster provider (Groq, real OpenAI) removes that limit. Set `OPENAI_REASONING_EFFORT=low` for reasoning models.

## Status

Live on Vercel (client + serverless API). Complete: scaffold, Supabase auth/schema, scraper, checklist, vault (PDF/DOCX/TXT via `unpdf`/`mammoth`), AI matcher, editable AI-matching profile + avatar, AI voice interview + scorecard, schedule with calendar reminders, PWA polish + hardening. Next on the roadmap (`docs/ADDITIONAL_FEATURES.md`): Gmail interview-email fetch and a job-tailored resume builder.
