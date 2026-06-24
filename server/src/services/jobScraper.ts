import * as cheerio from "cheerio";
import { isPrivateHost } from "../lib/ssrfGuard.js";
import {
  extractGenericForm,
  isGoogleForm,
  parseGoogleForm,
  type FormField,
} from "./formExtractor.js";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEXT_LENGTH = 20_000;

export interface ScrapeResult {
  /** Page <title>, used as a title fallback. */
  pageTitle: string;
  /** Cleaned main body text. */
  text: string;
  /** Form questions / application fields, if the page is a form. */
  formFields: FormField[];
}

/**
 * Fetches a job/program/form posting URL and returns cleaned text plus any
 * application form fields. Forms are extracted BEFORE the text strip so
 * Google Forms and ATS forms reveal what the applicant must provide.
 */
export async function scrapeJobPage(url: string): Promise<ScrapeResult> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ScrapeError("Only http/https URLs are supported", 400);
  }
  if (await isPrivateHost(parsed.hostname)) {
    throw new ScrapeError("URL resolves to a private address", 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      throw new ScrapeError(`Target returned ${res.status}`, 502);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new ScrapeError("URL did not return an HTML page", 422);
    }
    html = await res.text();
  } catch (err) {
    if (err instanceof ScrapeError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ScrapeError("Scrape timed out after 10s", 504);
    }
    throw new ScrapeError(`Failed to fetch URL: ${(err as Error).message}`, 502);
  } finally {
    clearTimeout(timer);
  }

  const $ = cheerio.load(html);
  const pageTitle = $("title").first().text().replace(/\s+/g, " ").trim();

  // Extract form fields BEFORE stripping <form>.
  // Google Forms embed questions in a script var (no rendered DOM); generic
  // forms expose <input>/<select>/<textarea>.
  let formFields: FormField[] = [];
  if (isGoogleForm(url)) {
    formFields = parseGoogleForm(html);
  }
  if (formFields.length === 0) {
    formFields = extractGenericForm($);
  }

  $("script, style, noscript, nav, header, footer, iframe, svg, form").remove();
  const main =
    $("main").text() || $("article").text() || $("body").text() || "";
  const text = main.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);

  // OK if body text is thin as long as we recovered form questions.
  if (text.length < 100 && formFields.length === 0) {
    throw new ScrapeError(
      "Page contains too little text — it may require JavaScript or block scrapers. Try manual entry.",
      422,
    );
  }
  return { pageTitle, text, formFields };
}

export class ScrapeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ScrapeError";
  }
}
