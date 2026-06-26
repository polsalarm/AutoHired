import { Router } from "express";
import { z } from "zod";
import { scanGmail } from "../services/emailParser.js";

export const gmailRouter = Router();

const scanSchema = z.object({
  accessToken: z.string().min(1),
  maxMessages: z.number().int().min(1).max(15).optional(),
  profile: z.string().default(""),
});

/**
 * POST /api/gmail/scan
 * Body: { accessToken (gmail.readonly), maxMessages?, profile? }
 * Returns: { events: ProposedEvent[] } extracted from recent interview emails.
 *
 * Stateless and parse-and-discard: the token is used for this one request only
 * (never stored), and raw email bodies are dropped — only the extracted event
 * fields are returned for the user to review before saving.
 */
gmailRouter.post("/gmail/scan", async (req, res) => {
  const parsed = scanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid Gmail scan input" });
  }
  try {
    const events = await scanGmail(parsed.data);
    return res.json({ events });
  } catch (err) {
    const msg = (err as Error).message;
    // A bad/expired token is a client problem (re-consent), not a 500.
    if (/Gmail API 40[13]/.test(msg)) {
      return res.status(401).json({ error: "Gmail access denied — reconnect your account." });
    }
    console.error("Gmail scan error:", err);
    return res.status(500).json({ error: "Failed to scan Gmail" });
  }
});
