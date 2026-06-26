import type { ProposedEvent, ScheduleEventType } from "../types.js";
import { callLLM, hasLLM, parseJson } from "./llm.js";

/**
 * Gmail → proposed schedule events.
 *
 * Given a short-lived OAuth access token (scope gmail.readonly, obtained client-
 * side via Google Identity Services), this fetches recent interview/scheduling
 * emails, extracts the meeting details with the LLM, and returns proposed events
 * for the user to review. Stateless and **parse-and-discard**: raw message
 * bodies never leave this function — only the extracted fields are returned.
 */

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// Surface interview/scheduling mail: keyword hits plus common ATS senders.
const SEARCH_QUERY =
  'newer_than:45d (interview OR "phone screen" OR "schedule a call" OR ' +
  '"next steps" OR "set up a time" OR "book a slot" OR "meeting invite" OR ' +
  "from:greenhouse.io OR from:lever.co OR from:hire.lever.co OR " +
  "from:myworkday.com OR from:ashbyhq.com OR from:gem.com)";

const VALID_TYPES = new Set<ScheduleEventType>(["interview", "meeting", "call", "deadline"]);

interface ScanInput {
  accessToken: string;
  maxMessages?: number;
  profile?: string;
}

interface GmailListResponse {
  messages?: { id: string }[];
}

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
  headers?: { name: string; value: string }[];
}

interface GmailMessage {
  id: string;
  payload?: GmailMessagePart;
}

/** A single email reduced to the bits the extractor needs. */
interface EmailDigest {
  subject: string;
  from: string;
  date: string;
  body: string;
}

export async function scanGmail(input: ScanInput): Promise<ProposedEvent[]> {
  const max = Math.min(Math.max(input.maxMessages ?? 8, 1), 15);
  const digests = await fetchEmailDigests(input.accessToken, max);
  if (digests.length === 0) return [];

  if (hasLLM()) {
    try {
      return await extractWithLLM(digests, input.profile);
    } catch (err) {
      console.warn("AI email parse failed, using heuristic:", (err as Error).message);
    }
  }
  return digests.map(heuristicEvent).filter((e): e is ProposedEvent => e !== null);
}

// ---------- Gmail REST (no extra SDK — plain fetch with the bearer token) ----------

async function gmailFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = res.status === 401 || res.status === 403 ? " (token expired or scope not granted)" : "";
    throw new Error(`Gmail API ${res.status}${detail}`);
  }
  return (await res.json()) as T;
}

async function fetchEmailDigests(token: string, max: number): Promise<EmailDigest[]> {
  const list = await gmailFetch<GmailListResponse>(
    token,
    `/messages?maxResults=${max}&q=${encodeURIComponent(SEARCH_QUERY)}`,
  );
  const ids = (list.messages ?? []).map((m) => m.id);
  // Pull bodies in parallel; drop any that fail rather than failing the whole scan.
  const settled = await Promise.allSettled(
    ids.map((id) => gmailFetch<GmailMessage>(token, `/messages/${id}?format=full`)),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<GmailMessage> => r.status === "fulfilled")
    .map((r) => digestMessage(r.value));
}

function digestMessage(msg: GmailMessage): EmailDigest {
  const headers = msg.payload?.headers ?? [];
  const header = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  return {
    subject: header("subject"),
    from: header("from"),
    date: header("date"),
    // Cap body length so a few long threads still fit one LLM call under the timeout.
    body: extractBody(msg.payload).slice(0, 1_800),
  };
}

/** Walk the MIME tree for the best text body; prefer text/plain, fall back to stripped HTML. */
function extractBody(part?: GmailMessagePart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts?.length) {
    const plain = part.parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
    if (plain?.body?.data) return decodeBase64Url(plain.body.data);
    // Recurse into multipart/* containers.
    for (const child of part.parts) {
      const found = extractBody(child);
      if (found) return found;
    }
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return stripHtml(decodeBase64Url(part.body.data));
  }
  return "";
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- LLM extraction (one call for the whole batch — keeps under the timeout) ----------

async function extractWithLLM(digests: EmailDigest[], profile?: string): Promise<ProposedEvent[]> {
  const profileBlock = profile?.trim()
    ? `\n\nApplicant (to disambiguate which side is the candidate):\n${profile.slice(0, 800)}`
    : "";
  const emailsBlock = digests
    .map(
      (d, i) =>
        `--- EMAIL ${i + 1} ---\nSubject: ${d.subject}\nFrom: ${d.from}\nReceived: ${d.date}\nBody: ${d.body}`,
    )
    .join("\n\n");

  const raw = await callLLM(
    `You extract interview/meeting scheduling details from a candidate's job-search emails. For EACH email that proposes or confirms a CONCRETE interview, call, or meeting, output one event. SKIP emails with no scheduling intent (newsletters, rejections, generic "we received your application"). Resolve relative dates ("next Tuesday at 2pm") against the email's Received date and output an ISO 8601 timestamp; if no specific time is stated, set startsAt to null. Never invent a company, role, or time that isn't supported by the email. Respond with ONLY JSON, no markdown fences:

{ "events": [ { "type": "interview" | "call" | "meeting" | "deadline", "company": string, "role": string (job title if known, else ""), "startsAt": string|null (ISO 8601 with timezone offset if derivable), "location": string|null (video link, address, or phone), "notes": string|null (1 sentence of useful context), "sourceEmail": number (the EMAIL n it came from) } ] }
${profileBlock}

${emailsBlock}`,
    { maxTokens: 4_000 },
  );

  const parsed = parseJson<{ events?: RawEvent[] }>(raw);
  const events = (parsed.events ?? [])
    .map((e) => normalizeEvent(e, digests))
    .filter((e): e is ProposedEvent => e !== null);
  return events;
}

interface RawEvent {
  type?: unknown;
  company?: unknown;
  role?: unknown;
  startsAt?: unknown;
  location?: unknown;
  notes?: unknown;
  sourceEmail?: unknown;
}

function normalizeEvent(e: RawEvent, digests: EmailDigest[]): ProposedEvent | null {
  const company = str(e.company);
  const role = str(e.role);
  const type = normalizeType(e.type);
  // Need at least a company or a concrete time to be worth proposing.
  const startsAt = normalizeDate(e.startsAt);
  if (!company && !startsAt) return null;

  const idx = Number(e.sourceEmail);
  const subject =
    Number.isInteger(idx) && idx >= 1 && idx <= digests.length ? digests[idx - 1].subject : "";

  return {
    type,
    title: buildTitle(type, company, role),
    company,
    role,
    startsAt,
    location: strOrNull(e.location),
    notes: strOrNull(e.notes),
    sourceSubject: subject,
  };
}

function buildTitle(type: ScheduleEventType, company: string, role: string): string {
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  const who = company || "Interview";
  return role ? `${label} — ${who} (${role})` : `${label} — ${who}`;
}

function normalizeType(v: unknown): ScheduleEventType {
  const s = str(v).toLowerCase();
  return VALID_TYPES.has(s as ScheduleEventType) ? (s as ScheduleEventType) : "interview";
}

/** Accept only a parseable date; return ISO or null. */
function normalizeDate(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s ? s : null;
}

// ---------- Heuristic fallback (no LLM configured) ----------

// Loose date grabs like "Jan 5, 2026 at 2:00 PM" or "2026-01-05 14:00".
const DATE_RE =
  /\b(?:\d{4}-\d{2}-\d{2}(?:[ T]\d{1,2}:\d{2})?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?(?:\s+(?:at\s+)?\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)?)\b/;

/** No-LLM path: pull a date with a regex and use the subject as the title. */
function heuristicEvent(d: EmailDigest): ProposedEvent | null {
  const hit = d.body.match(DATE_RE) ?? d.subject.match(DATE_RE);
  const startsAt = hit ? normalizeDate(hit[0]) : null;
  if (!startsAt) return null; // without a time it's not actionable offline
  const company = companyFromSender(d.from);
  return {
    type: /call|phone/i.test(d.subject) ? "call" : "interview",
    title: d.subject.trim() || buildTitle("interview", company, ""),
    company,
    role: "",
    startsAt,
    location: null,
    notes: "Extracted offline (no AI provider) — please verify the time.",
    sourceSubject: d.subject,
  };
}

function companyFromSender(from: string): string {
  const domain = from.match(/@([\w.-]+)/)?.[1] ?? "";
  const name = domain.split(".").slice(-2, -1)[0] ?? "";
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}
