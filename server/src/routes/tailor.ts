import { Router } from "express";
import { z } from "zod";
import { tailorResume } from "../services/resumeTailor.js";

export const tailorRouter = Router();

const bodySchema = z.object({
  title: z.string().default("this role"),
  company: z.string().default(""),
  requirements: z.array(z.string()).default([]),
  description: z.string().default(""),
  resumeText: z.string().min(1, "resumeText is required"),
  profile: z.string().default(""),
});

/**
 * POST /api/tailor-resume
 * Body: { title, company, requirements[], description, resumeText, profile }
 * Returns: ResumeTailorResult — { resume, coverLetter, changelog }.
 * Stateless: the client renders the PDFs and (optionally) saves them to the Vault.
 */
tailorRouter.post("/tailor-resume", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid tailor input (resumeText required)" });
  }
  try {
    const result = await tailorResume(parsed.data);
    return res.json(result);
  } catch (err) {
    console.error("Resume tailor error:", err);
    return res.status(500).json({ error: "Failed to tailor resume" });
  }
});
