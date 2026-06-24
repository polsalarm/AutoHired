/**
 * Core domain types — mirrored in client/src/types.ts. Keep in sync.
 */

export interface ScrapedJob {
  url: string;
  title: string;
  company: string;
  location: string | null;
  description: string;
  requirements: string[];
  deadline: string | null; // ISO date
}

export interface AIAnalysisResult {
  matchScore: number; // 0–100
  verdict: string;
  summary: string;
  suggestions: string[];
  gaps: string[];
  strengths: string[];
}
