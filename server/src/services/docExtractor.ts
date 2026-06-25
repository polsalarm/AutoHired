import mammoth from "mammoth";

export interface ExtractResult {
  text: string;
  chars: number;
  /** True when almost no text was recovered (e.g. a scanned/image-only PDF). */
  empty: boolean;
}

/**
 * Extracts plain text from an uploaded document buffer.
 * Supports PDF (unpdf — serverless-safe, no DOM/canvas deps), DOCX (mammoth),
 * and UTF-8 text.
 */
export async function extractDocumentText(
  buffer: Buffer,
  filename: string,
  mimetype: string,
): Promise<ExtractResult> {
  const name = filename.toLowerCase();
  let text = "";

  if (mimetype === "application/pdf" || name.endsWith(".pdf")) {
    // unpdf ships a serverless build of pdfjs with no DOMMatrix/canvas needs,
    // so PDF text extraction works on Vercel functions. Lazy-imported to keep
    // cold start lean.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
  } else if (
    name.endsWith(".docx") ||
    mimetype.includes("wordprocessingml")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (name.endsWith(".txt") || mimetype.startsWith("text/")) {
    text = buffer.toString("utf8");
  } else {
    throw new UnsupportedTypeError(filename);
  }

  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, chars: text.length, empty: text.length < 20 };
}

export class UnsupportedTypeError extends Error {
  constructor(filename: string) {
    super(`Unsupported file type: ${filename}. Use PDF, DOCX, or TXT.`);
    this.name = "UnsupportedTypeError";
  }
}
