/**
 * Base URL for the AutoHired API server.
 * - Dev: VITE_API_URL unset → "" → "/api/..." hits the Vite proxy (→ localhost:3001).
 * - Prod: set VITE_API_URL to the deployed server origin (e.g. https://api.autohired.app).
 */
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}
