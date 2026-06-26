/**
 * Google Identity Services (GIS) OAuth — client-side, token-only.
 *
 * Requests a short-lived `gmail.readonly` access token in the browser and hands
 * it to the server for a single scan. No refresh token is ever stored, which
 * keeps the server stateless and minimises the security surface (matches the
 * MVP in docs/ADDITIONAL_FEATURES.md → Feature C).
 *
 * Requires VITE_GOOGLE_CLIENT_ID (a Google Cloud OAuth 2.0 Web client). While
 * the gmail.readonly scope is unverified, add testers under the OAuth consent
 * screen's "Testing" mode so it works without Google's security review.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();

/** Whether Gmail sync is configured (a client id is present). */
export function gmailConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0;
}

// Minimal shape of the GIS token client we use — avoids pulling in @types/google.accounts.
interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
  callback: (resp: TokenResponse) => void;
}
interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (resp: TokenResponse) => void;
  }) => TokenClient;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

let scriptPromise: Promise<void> | null = null;

/** Lazily inject the GIS script once; resolves when `window.google` is ready. */
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = GIS_SRC;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Google sign-in"));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

/**
 * Opens the Google consent popup and resolves with a short-lived access token.
 * Rejects if not configured, the script fails, or the user cancels/denies.
 */
export async function requestGmailToken(): Promise<string> {
  if (!gmailConfigured()) {
    throw new Error("Gmail sync isn't configured (set VITE_GOOGLE_CLIENT_ID).");
  }
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google sign-in unavailable");

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GMAIL_SCOPE,
      callback: (resp) => {
        if (resp.access_token) resolve(resp.access_token);
        else reject(new Error(resp.error_description || resp.error || "Gmail access was cancelled"));
      },
    });
    // `consent` so the user can confirm the read-only scope each time (no stored grant).
    client.requestAccessToken({ prompt: "consent" });
  });
}
