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

export type EventType = "interview" | "meeting" | "call" | "deadline";

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
