# AutoHired — AI Application Tracker (PWA)

A mobile-first Progressive Web App that turns a messy job/internship hunt into a tracked, guided pipeline. Paste a posting URL, and AutoHired scrapes it, parses the requirements with AI, builds a personalized to-do checklist, stores your documents, and scores how well you match — with concrete suggestions to close the gaps.

Design source: Stitch project **AutoHired AI Application Tracker** (exported HTML in `design/stitch/`).
Roadmap: [`PROJECT_PHASES.md`](./PROJECT_PHASES.md) · Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

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
- **Deadline tracking** — auto-scraped or manually set; days-left badges on the dashboard.
- **PWA** — installable, offline banner, skeleton loading states, reduced-motion support.
- **Demo mode** — runs on mock data with no auth gate when Supabase isn't configured, so you can try it instantly.

## How it works

```
  ┌──────────┐   paste URL    ┌─────────────────────────────┐
  │  Client  │ ─────────────▶ │  Server (stateless API)     │
  │  (PWA)   │                │  scrape · extract · AI       │
  │          │ ◀───────────── │  Vertex/Gemini/Anthropic     │
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
- **Server:** Node.js + Express + TypeScript — Cheerio scraper (+ form extraction), document text extraction (`pdf-parse`, `mammoth`), AI pipeline
- **AI:** single gateway (`server/src/services/llm.ts`) — Vertex AI (Gemini) → Gemini API key → Anthropic → offline heuristic fallback
- **Data:** Supabase — Postgres (RLS), Auth, Storage (`supabase/migrations/`)

## Layout

```
client/    Vite React PWA (Home, Tasks, Vault, Application Detail, Profile)
server/    Express API (scrape, tasks/generate, extract, analyze, health)
supabase/  SQL migrations (profiles+details, applications, documents, tasks, analyses, avatars bucket + RLS)
docs/      Architecture + scraper strategy
design/    Stitch design exports (reference)
```

## Run

```bash
npm install
npm run dev        # client http://localhost:5173 + server http://localhost:3001
```

### Config

- **Client (Supabase):** copy `client/.env.example` → `client/.env`, set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, then run the migrations in `supabase/migrations/` (`0001`→`0002`→`0003`) in the Supabase SQL editor — or paste `supabase/migrations/provision_all.sql` once on a fresh project. Without these the client runs in **demo mode** (mock data, no auth gate). Leave `VITE_API_URL` empty for local dev (Vite proxies `/api` → `localhost:3001`).
- **Server (AI):** copy `server/.env.example` → `server/.env`. Pick one provider — set nothing to use the free offline heuristic fallback:
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
| GET | `/health` | liveness |

## Hardening

- SSRF guard blocks private/loopback IPs on scrape (`server/src/lib/ssrfGuard.ts`)
- Rate limiting: 60 req/min general, 15 req/min on AI/scrape/extract routes
- zod validation on every route; CORS allowlist via `CLIENT_ORIGIN` (comma-separated)
- Supabase RLS owner-only on all tables + Storage bucket policies

## Status

Phases 0–6 ✅ (scaffold, Supabase auth/schema, scraper, checklist, vault, AI matcher, PWA polish + hardening) and Phase 8 ✅ (editable profile with AI-matching personal info + avatar upload). Phase 7 deploy: code-ready; Vercel/Render deploy pending. See [`PROJECT_PHASES.md`](./PROJECT_PHASES.md).
