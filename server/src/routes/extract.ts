import { Router } from "express";
import multer from "multer";
import {
  extractDocumentText,
  UnsupportedTypeError,
} from "../services/docExtractor.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

export const extractRouter = Router();

/**
 * POST /api/extract  (multipart/form-data, field "file")
 * Returns: { text, chars, empty }
 * The client uploads the file to Supabase Storage itself; this endpoint only
 * turns the bytes into text for `documents.parsed_text`.
 */
extractRouter.post("/extract", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded (field 'file')" });
  }
  try {
    const result = await extractDocumentText(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    return res.json(result);
  } catch (err) {
    if (err instanceof UnsupportedTypeError) {
      return res.status(415).json({ error: err.message });
    }
    console.error("Extraction error:", err);
    return res
      .status(500)
      .json({ error: "Failed to extract text from document" });
  }
});

// Multer-specific error handling (e.g. file too large)
extractRouter.use(
  (
    err: unknown,
    _req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) => {
    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({ error: err.message });
    }
    next(err);
  },
);
