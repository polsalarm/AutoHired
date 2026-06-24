import type { CheerioAPI } from "cheerio";

export interface FormField {
  label: string;
  type: string;
  required: boolean;
}

/** Google Forms item type codes → human label. */
const GFORM_TYPES: Record<number, string> = {
  0: "Short answer",
  1: "Paragraph",
  2: "Multiple choice",
  3: "Dropdown",
  4: "Checkboxes",
  5: "Linear scale",
  7: "Grid",
  9: "Date",
  10: "Time",
  13: "File upload",
};

// Item types that are layout/media, not questions
const GFORM_NON_QUESTION = new Set([6, 8, 11, 12]);

export function isGoogleForm(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("docs.google.com") && u.pathname.includes("/forms/")
    );
  } catch {
    return false;
  }
}

/**
 * Parses a public Google Form. Question data is embedded in the page HTML
 * as `var FB_PUBLIC_LOAD_DATA_ = [...]` — a nested JSON array — so we can
 * extract it without executing JavaScript.
 *
 * Structure: data[1][1] = items[]. Each item: [id, title, desc, typeCode, questionMeta[]].
 * Required flag lives at item[4][0][2] === 1.
 */
export function parseGoogleForm(html: string): FormField[] {
  const m = html.match(/FB_PUBLIC_LOAD_DATA_ = (.+?);<\/script>/s);
  if (!m) return [];
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data as any)?.[1]?.[1];
  if (!Array.isArray(items)) return [];

  const fields: FormField[] = [];
  for (const item of items) {
    const label = item?.[1];
    const typeCode = item?.[3];
    if (typeof label !== "string" || !label.trim()) continue;
    if (GFORM_NON_QUESTION.has(typeCode)) continue;

    const qmeta = item?.[4];
    const required =
      Array.isArray(qmeta) && qmeta[0] ? qmeta[0][2] === 1 : false;
    fields.push({
      label: label.replace(/\s+/g, " ").trim().slice(0, 200),
      type: GFORM_TYPES[typeCode] ?? "Field",
      required,
    });
  }
  return fields;
}

const SKIP_INPUT_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "search",
]);

// Site chrome that isn't part of an application form
const NOISE =
  /\b(search|sign[\s-]?in|log[\s-]?in|sign[\s-]?up|register|newsletter|subscribe|cookie|consent|menu|toggle|language|appearance|theme|navigation|csrf|captcha)\b/i;

/**
 * Extracts fields from real HTML <form>s only (Workday, Greenhouse, custom),
 * skipping site chrome (search/nav/auth). Radio/checkbox groups collapse to a
 * single question via their <fieldset><legend> or shared name.
 * Must run BEFORE the scraper strips <form> elements.
 */
export function extractGenericForm($: CheerioAPI): FormField[] {
  const fields: FormField[] = [];
  const seenGroups = new Set<string>();

  $("form input, form select, form textarea").each((_i, el) => {
    const $el = $(el);
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
    const inputType = ($el.attr("type") ?? "").toLowerCase();
    if (tag === "input" && SKIP_INPUT_TYPES.has(inputType)) return;

    const name = $el.attr("name") ?? "";
    const isGroup = inputType === "radio" || inputType === "checkbox";

    let label = "";
    if (isGroup) {
      // Collapse the whole group to one question
      const groupKey = name || $el.closest("fieldset").attr("id") || "";
      if (groupKey && seenGroups.has(groupKey)) return;
      if (groupKey) seenGroups.add(groupKey);
      label =
        $el.closest("fieldset").children("legend").first().text().trim() ||
        name;
    } else {
      const id = $el.attr("id");
      if (id) label = $(`label[for="${id}"]`).first().text().trim();
      if (!label) label = $el.closest("label").text().trim();
      if (!label)
        label = (
          $el.attr("aria-label") ??
          $el.attr("placeholder") ??
          name
        ).trim();
    }

    label = label.replace(/\s+/g, " ").slice(0, 120);
    if (!label) return;
    if (NOISE.test(label) || NOISE.test(name)) return;

    const required =
      $el.attr("required") !== undefined ||
      $el.attr("aria-required") === "true";
    fields.push({
      label,
      type: tag === "input" ? inputType || "text" : tag,
      required,
    });
  });

  // Dedupe by label
  const seen = new Set<string>();
  return fields
    .filter((f) => {
      const k = f.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 30);
}
