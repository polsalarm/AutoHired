# Scraper Escalation Strategy

Fallback ladder for `POST /api/scrape` when a target blocks the current method. Climb tiers only on detection/block — each step costs more latency + resources. Current code (Phase 2) is **Tier 0** only; higher tiers added on demand.

## Tiers (cheap → expensive)

| Tier | Tool | When | Notes |
|---|---|---|---|
| 0 | **Cheerio** (fetch + HTML strip + form extract) | default | Static HTML. Fast, no browser. `jobScraper.ts` + `formExtractor.ts`. Also extracts **application form fields** → requirements: Google Forms (parses `FB_PUBLIC_LOAD_DATA_` script var, no JS needed) and generic `<form>` inputs (labels + `required`, radio/checkbox groups collapsed via `<legend>`, nav/search/auth noise filtered). Fails on JS-rendered pages + bot walls. |
| 1 | **curl_cffi** | static page but TLS/JA3 fingerprint blocked | Impersonates real browser TLS fingerprint (Chrome/Safari). Less detectable than plain fetch. No JS execution. Python — run as sidecar service or subprocess. |
| 2 | **Patchright (headless)** | page needs JS render OR Tier 0/1 blocked | Patched Playwright, undetectable patches built in. Headless. Heavier (spawns Chromium). |
| 3 | **Patchright + xvfb (headed)** | still detected headless (`nadedetect`) | Headed browser is harder to detect than headless. `xvfb` = virtual framebuffer so headed Chromium runs on a Linux server with no display. Heaviest. |
| 4 | **Official API scraping** | site exposes an API (job boards, ATS) | Most reliable + least detectable. Bypasses scraping entirely. Prefer when available — e.g. The Muse API (CareerHive used this), Greenhouse/Lever/Workday public endpoints. |

## Decision flow

```
fetch + Cheerio (Tier 0)
   └─ blocked / TLS fingerprint flagged → curl_cffi (Tier 1)
        └─ JS-rendered or still blocked → Patchright headless (Tier 2)
             └─ detected as bot (nadedetect) → Patchright + xvfb headed (Tier 3)
   └─ site has known API → skip ladder, use API (Tier 4, preferred)
```

Always offer **manual-entry fallback** in the UI if all tiers fail (LinkedIn/Workday often defeat everything).

## Tooling notes

- **curl_cffi** (Python): `pip install curl_cffi`. `requests.get(url, impersonate="chrome124")`. Rotates TLS/JA3 to match a real browser. Run as small FastAPI sidecar (mirrors CareerHive's MAF service split) or `child_process` spawn from Node.
- **Patchright** (`patchright` npm / pip): drop-in Playwright replacement with anti-detection patches (no `navigator.webdriver`, patched CDP, etc.). `npm i patchright` then use like `playwright`. Headless first; flip to `headless: false` for Tier 3.
- **xvfb** (Linux only): `xvfb-run -a node scraper.js` or `Xvfb :99 & export DISPLAY=:99`. Needed because headed Chromium requires a display on headless servers. Docker: install `xvfb` + Chromium deps in image.
- **APIs to check first:** The Muse (`themuse.com/api/public/jobs`), Greenhouse (`boards-api.greenhouse.io`), Lever (`api.lever.co`), Ashby, Workable. Many ATS boards expose JSON behind the rendered page.

## Architecture fit

Keep tiers behind a provider-factory interface (CareerHive `providerFactory.js` pattern) so `jobScraper.ts` picks the tier by env flag / per-domain config and degrades gracefully. Browser tiers (2/3) and curl_cffi (1) live in a **Python/Node sidecar** — don't bloat the main Express process with Chromium.

## Anti-detection hygiene (all browser tiers)

- Realistic User-Agent + viewport + locale + timezone.
- Random human-like delays; avoid burst requests.
- Residential/rotating proxies for high-volume targets.
- Reuse sessions/cookies where allowed.
- Respect robots.txt + ToS where legally required; this is for the user's own application tracking, not mass scraping.
