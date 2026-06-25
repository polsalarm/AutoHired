import mammoth from "mammoth";

export interface ExtractResult {
  text: string;
  chars: number;
  /** True when almost no text was recovered (e.g. a scanned/image-only PDF). */
  empty: boolean;
}

/**
 * Extracts plain text from an uploaded document buffer.
 * Supports PDF (pdf-parse v2), DOCX (mammoth), and UTF-8 text.
 */
export async function extractDocumentText(
  buffer: Buffer,
  filename: string,
  mimetype: string,
): Promise<ExtractResult> {
  const name = filename.toLowerCase();
  let text = "";

  if (mimetype === "application/pdf" || name.endsWith(".pdf")) {
    // Lazy import: pdf-parse → pdfjs-dist touches browser globals (DOMMatrix)
    // at load time, which crashes serverless cold-start if imported eagerly.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      await parser.destroy();
    }
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
