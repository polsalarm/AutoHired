<div align="center">

<img src="client/public/pwa-512x512.png" alt="AutoHired logo" width="120" height="120" />

# AutoHired — AI Application Tracker

**Turn a messy job/internship hunt into a tracked, guided pipeline — from one pasted URL.**

[![Live App](https://img.shields.io/badge/Live-autohired.vercel.app-3525cd?style=for-the-badge&logo=vercel&logoColor=white)](https://autohired.vercel.app)
[![API](https://img.shields.io/badge/API-autohired--api-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://autohired-api.vercel.app/health)

<br/>

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%C2%B7%20Auth%20%C2%B7%20Storage-3FCF8E?logo=supabase&logoColor=white)
![gpt-oss](https://img.shields.io/badge/AI-gpt--oss--20b%20via%20Featherless-412991?logo=openai&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable%20%C2%B7%20offline-5A0FC8?logo=pwa&logoColor=white)

</div>

---

Paste a posting URL, and AutoHired scrapes it, parses the requirements with AI, builds a personalized to-do checklist, stores your documents, scores how well you match, **tailors a résumé + cover letter to the role**, runs a spoken AI mock interview, and keeps your deadlines on a calendar — with concrete suggestions to close the gaps.

> Use Chrome/Edge for the voice interview (Web Speech API).
>
> Design source: Stitch project **AutoHired AI Application Tracker** (exported HTML in `design/stitch/`).
> Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) · Roadmap: [`docs/ADDITIONAL_FEATURES.md`](./docs/ADDITIONAL_FEATURES.md).

---

## 🎯 The problem

Hunting for internships, ambassadorships, and hackathons means juggling dozens of postings across tabs, spreadsheets, and Google Forms. Every listing buries its real requirements in walls of text, deadlines slip, and you never quite know whether you're a strong fit or wasting an afternoon on a long shot. The busywork — re-reading postings, copying requirements into a checklist, tailoring a résumé — is exactly the part that makes people give up.

AutoHired collapses that whole loop into one paste. Drop in a URL and it does the reading, the organizing, the honest self-assessment, and the résumé tailoring for you — so you spend your time applying instead of administrating.

## ✨ Features

- **📋 Paste-a-URL intake** — scrapes the posting (Cheerio + form-field extraction for Google Forms and generic `<form>`s), AI-parses it into a structured job: title, company, location, description, requirements, deadline. Manual-entry fallback when a site can't be scraped.
- **✅ Auto-generated checklist** — turns parsed requirements + deadline into actionable tasks (AI, with a rule-based fallback). Add, check off, delete your own.
- **🗂️ Document vault** — upload résumés/CVs/cover letters/portfolios (PDF, DOCX, TXT). Text extracted server-side and stored for matching. View / rename / download / delete via a details modal; short-lived signed URLs; owner-only.
- **📊 AI match score** — analyzes a document against a posting → 0–100 match score, verdict, summary, plus concrete **strengths**, **gaps**, and **résumé suggestions**. Match ring per application.
- **🪄 AI résumé + cover-letter tailoring** — *(new)* generate a role-targeted résumé **and** a matching one-page cover letter from your uploaded résumé + profile + the posting. Returns structured content plus a **changelog of exactly what changed and why**. Tweak everything in a **full structural editor** (reorder / add / remove experience, bullets, skills, education, cover-letter paragraphs), then export clean single-column **PDFs rendered fully in the browser**, or **save them straight back to your Vault**. Never invents employers or dates — unknown fields stay blank.
- **🧑‍💼 Profile that feeds the AI** — editable profile (summary, skills, experience, education, location, links) folded into every match + tailoring call. Custom avatar upload.
- **🎙️ AI voice interview** — a spoken mock interview tailored to the role and your profile: the interviewer speaks each question (TTS), you answer out loud (STT), with per-turn feedback and a final scorecard (communication, relevance, confidence, structure). Browser Web Speech API — no extra keys. Text "practice questions" mode with model answers too.
- **📅 Schedule + reminders** — track interviews, calls, meetings, deadlines; add any event to Google Calendar or download an `.ics` with a 1-hour reminder alarm. No push infra.
- **⏰ Deadline tracking** — auto-scraped or manual; days-left badges on the dashboard.
- **📱 PWA** — installable, offline banner, skeleton loading states, reduced-motion support.
- **🧪 Demo mode** — runs on mock data with no auth gate when Supabase isn't configured, so you can try it instantly.

## 🏗️ How it works

```
  ┌──────────┐   paste URL    ┌─────────────────────────────┐
  │  Client  │ ─────────────▶ │  Server (stateless API)     │
  │  (PWA)   │                │  scrape · extract · AI       │
  │          │ ◀───────────── │  gpt-oss → Vertex → …        │
  └────┬─────┘  parsed job /  └─────────────────────────────┘
       │        tailored JSON
       │  reads/writes (RLS-scoped, owner-only)
       ▼
  ┌──────────────────────────────────────────────┐
  │  Supabase — Postgres · Auth · Storage         │
  └──────────────────────────────────────────────┘

  PDF generation happens entirely client-side (@react-pdf/renderer) —
  the server only returns structured JSON.
```

The **server is stateless** — it never touches user data. It scrapes URLs, extracts document text, and runs the AI pipeline. The **client owns all Supabase reads/writes**, each scoped to the signed-in user by Row-Level Security.

## 🧠 Design decisions — *why this, not that*

| Area | Chosen | Instead of | Why |
|---|---|---|---|
| **AI model** | Featherless **`gpt-oss-20b`** (OpenAI-compatible) | `gpt-oss-120b` / paid OpenAI | 20b finishes ~30–45s, under Vercel's 60s function cap; 120b ran ~65s → 504. Free, open-source, hackathon-aligned. |
| **Reasoning effort** | `OPENAI_REASONING_EFFORT=low` | model default | Reasoning models over-think and blow the timeout → silent fallback to the heuristic. `low` keeps latency in budget. |
| **PDF rendering** | **Client-side** `@react-pdf/renderer`, lazy-loaded | Server-side Puppeteer/Chromium | No serverless cap or cold-start, no headless Chrome in a function, instant download. Dynamic import keeps the ~1.5 MB renderer out of the main bundle (**1.96 MB → 504 KB**). |
| **Tailored résumé shape** | **Structured JSON** | Freeform text / HTML blob | Edit field-by-field and re-render the PDF with **zero extra LLM calls**; edits are deterministic and instant. |
| **Server data model** | **Stateless** server, client owns all DB I/O | Server-side DB writes | Every read/write is RLS-scoped to the user; the API never holds user data → smaller trust surface. |
| **AI resilience** | Ordered **fallback chain** → offline heuristic | Single provider | Any provider erroring falls through to the next, then to a template — the app never hard-fails on AI. |
| **Voice interview** | Browser **Web Speech API** | Paid STT/TTS (Whisper, ElevenLabs) | Zero extra keys/cost; runs entirely client-side. |
| **Reminders** | `.ics` + Google Calendar link | Push-notification infrastructure | No backend scheduler or push service to operate. |
| **Scraping** | Cheerio + form extraction, SSRF-guarded | Headless browser on every URL | Fast and cheap for the common case; manual-entry fallback covers the rest. |

## 🧰 Stack

- **Client:** React + Vite + TypeScript + Tailwind CSS, PWA via `vite-plugin-pwa`
- **PDF:** `@react-pdf/renderer` — single-column résumé + cover-letter templates, rendered in-browser and code-split (lazy `import()`) so the heavy renderer never bloats first load
- **Server:** Node.js + Express + TypeScript — Cheerio scraper (+ form extraction), document text extraction (`unpdf` for PDF, `mammoth` for DOCX), AI pipeline. Runs locally as a long-lived process or on Vercel as one serverless function (`server/api/index.ts` wraps the same Express app)
- **AI:** single gateway (`server/src/services/llm.ts`) with a runtime fallback chain — **OpenAI-compatible (Featherless gpt-oss)** → Vertex AI (Gemini) → Gemini API key → Anthropic → offline heuristic. Each provider is tried in order and falls through on error
- **Data:** Supabase — Postgres (RLS), Auth, Storage (`supabase/migrations/`)

## 📁 Layout

```
client/    Vite React PWA (Home, Tasks, Vault, Application Detail, Profile, Schedule)
           components/ResumeBuilder + ResumeEditor + pdf/ (résumé/cover-letter PDF), voice-interview UI
server/    Express API (scrape, tasks/generate, extract, analyze, tailor-resume, interview, health)
           + Vercel serverless entry
supabase/  SQL migrations (profiles, applications, documents, tasks, analyses, events, buckets + RLS)
docs/      Architecture + scraper strategy + additional-features plan
design/    Stitch design exports (reference)
```

## ▶️ Run

```bash
npm install
npm run dev        # client http://localhost:5173 + server http://localhost:3001
```

### Config

- **Client (Supabase):** copy `client/.env.example` → `client/.env`, set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, then run the migrations in `supabase/migrations/` (`0001`→`0004`) in the Supabase SQL editor — or paste `supabase/migrations/provision_all.sql` once on a fresh project. Without these the client runs in **demo mode** (mock data, no auth gate). Leave `VITE_API_URL` empty for local dev (Vite proxies `/api` → `localhost:3001`); set it to the deployed API origin in production.
- **Server (AI):** copy `server/.env.example` → `server/.env`. Set any/all providers — tried in priority order, falling through on error; set nothing to use the free offline heuristic:
  - **OpenAI-compatible (recommended — free OSS):** `OPENAI_API_KEY` + `OPENAI_MODEL=openai/gpt-oss-20b` + `OPENAI_BASE_URL=https://api.featherless.ai/v1` (the **`/v1`** matters — the SDK appends `/chat/completions`). Set `OPENAI_REASONING_EFFORT=low` for gpt-oss/reasoning models or they time out. Works the same for Groq / real OpenAI — just change key + base URL.
  - **Vertex AI** (GCP credits, `gemini-2.5-flash`): set `VERTEX_PROJECT`; auth locally via `gcloud auth application-default login`, in prod via `GOOGLE_SERVICE_ACCOUNT_KEY`.
  - **Gemini API key** (AI Studio free tier): `GEMINI_API_KEY`.
  - **Anthropic** (paid): `ANTHROPIC_API_KEY`.
  - `LLM_TIMEOUT_MS` — per-provider hard timeout (default 45 000; keep under your function cap).

## 🔌 API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/scrape` | URL → scraped + AI-parsed `ScrapedJob` (Cheerio + form extraction, SSRF-guarded) |
| POST | `/api/tasks/generate` | requirements + deadline → checklist tasks |
| POST | `/api/extract` | multipart file → extracted text (PDF/DOCX/TXT) |
| POST | `/api/analyze` | résumé text × application × profile → match score + suggestions/gaps/strengths |
| POST | `/api/tailor-resume` | résumé + profile + posting → **tailored résumé + cover letter (structured JSON) + changelog** |
| POST | `/api/interview/questions` | role + profile → tailored practice questions with tips + model answers |
| POST | `/api/interview/turn` | turn-based voice mock interview → per-turn feedback + next question, then a scorecard |
| GET | `/health` | liveness |

## 🛡️ Hardening

- SSRF guard blocks private/loopback IPs on scrape (`server/src/lib/ssrfGuard.ts`)
- Rate limiting: 60 req/min general, 15 req/min on AI/scrape/extract routes
- zod validation on every route; CORS allowlist via `CLIENT_ORIGIN` (comma-separated; include every origin you browse from, e.g. both `localhost` and `127.0.0.1`)
- Supabase RLS owner-only on all tables + Storage bucket policies

## 🚀 Deployment

Both halves run on Vercel as **separate projects**:

- **Client** → project rooted at `client/` (`client/vercel.json`: Vite build, SPA rewrites). Build-time env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (= the API origin).
- **Server** → project rooted at `server/` (`server/vercel.json` + `server/api/index.ts` wrap the Express app as one serverless function; all paths rewrite to it). Env: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` (**with `/v1`**), `OPENAI_REASONING_EFFORT=low`, `LLM_TIMEOUT_MS`, `CLIENT_ORIGIN` (the client origin, for CORS), plus any other AI providers.

```bash
# from each app dir, once linked + env set:
npx vercel --prod
```

> **Serverless note:** functions cap at 60s on Vercel's Hobby plan, so the AI gateway enforces a hard per-provider timeout (`LLM_TIMEOUT_MS`) and falls back gracefully rather than 504-ing. Reasoning-heavy models (e.g. `gpt-oss-120b`) can exceed that on large payloads and fall back to the offline heuristic — hence the project ships **`gpt-oss-20b` + `OPENAI_REASONING_EFFORT=low`**, which finishes comfortably under the cap. First call after idle may **cold-load the model** on the provider side (~1 min); subsequent calls are fast — warm it once before a demo.

## 📌 Status

Live on Vercel (client + serverless API). **Complete:** scaffold, Supabase auth/schema, scraper, checklist, vault (PDF/DOCX/TXT via `unpdf`/`mammoth`) with view/rename/download/delete, AI matcher, editable AI-matching profile + avatar, **AI résumé + cover-letter tailoring with in-browser PDF export and Vault save**, full structural résumé editor, AI voice interview + scorecard, schedule with calendar reminders, PWA polish + hardening. Next on the roadmap (`docs/ADDITIONAL_FEATURES.md`): Gmail interview-email fetch.
