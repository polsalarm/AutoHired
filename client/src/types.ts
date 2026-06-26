/**
 * Core domain types for AutoHired.
 * Mirrored on the server in server/src/types.ts — keep in sync.
 */

export type ApplicationStatus =
  | "draft"
  | "applying"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected";

export type DocumentType = "resume" | "cv" | "cover_letter" | "portfolio";

export type DocumentStatus = "pending" | "analyzed";

/** Structured result of scraping + AI-parsing a job/program posting URL. */
export interface ScrapedJob {
  url: string;
  title: string;
  company: string;
  location: string | null;
  description: string;
  requirements: string[];
  deadline: string | null; // ISO date
}

export interface Application extends ScrapedJob {
  id: string;
  userId: string;
  status: ApplicationStatus;
  matchScore: number | null; // 0–100, null until analyzed
  createdAt: string;
}

export interface TaskItem {
  id: string;
  applicationId: string;
  label: string;
  dueDate: string | null;
  done: boolean;
  source: "ai" | "manual";
}

export interface VaultDocument {
  id: string;
  userId: string;
  name: string;
  type: DocumentType;
  storagePath: string;
  parsedText: string | null;
  status: DocumentStatus;
  addedAt: string;
}

/** AI feasibility analysis of a document against an application. */
export interface AIAnalysis {
  id: string;
  applicationId: string;
  documentId: string;
  matchScore: number; // 0–100
  verdict: string; // e.g. "Excellent Match"
  summary: string;
  suggestions: string[];
  gaps: string[];
  strengths: string[];
  createdAt: string;
}

export interface ProfileStats {
  applicationsSent: number;
  interviewsSecured: number;
  avgMatchScore: number;
}

/** An AI-generated interview-practice question tailored to a role + applicant. */
export interface InterviewQuestion {
  question: string;
  category: string; // behavioral | technical | role | situational | company
  tip: string;
  sampleAnswer: string;
}

// ---------- Tailored resume + cover letter ----------
// Mirrors server/src/types.ts — keep in sync.

export interface ResumeExperience {
  role: string;
  company: string;
  location: string;
  period: string;
  bullets: string[];
}

export interface ResumeEducation {
  degree: string;
  institution: string;
  period: string;
  detail: string;
}

/** A resume rewritten to target one specific application. */
export interface TailoredResume {
  name: string;
  headline: string;
  contact: {
    email: string;
    phone: string;
    location: string;
    links: string[];
  };
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
}

/** A cover letter written for one specific application. */
export interface CoverLetter {
  greeting: string;
  body: string[];
  closing: string;
  signature: string;
}

/** Result of tailoring a resume + cover letter to an application. */
export interface ResumeTailorResult {
  resume: TailoredResume;
  coverLetter: CoverLetter;
  changelog: string[];
}

export type EventType = "interview" | "meeting" | "call" | "deadline";

/**
 * An event the AI extracted from an interview email (Gmail scan), proposed to
 * the user for review before saving. Mirrors server/src/types.ts.
 */
export interface ProposedEvent {
  type: EventType;
  title: string;
  company: string;
  role: string;
  startsAt: string | null; // ISO 8601; null when no concrete time was stated
  location: string | null;
  notes: string | null;
  sourceSubject: string; // originating email subject, for the user's context
}

/** A scheduled event tied (optionally) to an application — so nothing slips. */
export interface ScheduleEvent {
  id: string;
  userId: string;
  applicationId: string | null;
  type: EventType;
  title: string;
  startsAt: string; // ISO timestamp
  location: string | null;
  notes: string | null;
  done: boolean;
  createdAt: string;
}
