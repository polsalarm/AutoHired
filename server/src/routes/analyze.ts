import { Router } from "express";
import { z } from "zod";
import { matchResume } from "../services/jobMatcher.js";

export const analyzeRouter = Router();

const bodySchema = z.object({
  title: z.string().default("this role"),
  company: z.string().default(""),
  requirements: z.array(z.string()).default([]),
  description: z.string().default(""),
  resumeText: z.string().min(1, "resumeText is required"),
  profile: z.string().default(""),
});

/**
 * POST /api/analyze
 * Body: { title, company, requirements[], description, resumeText }
 * Returns: AIAnalysisResult — { matchScore, verdict, summary, suggestions[], gaps[], strengths[] }.
 * Stateless: the client persists the result to Supabase.
 */
analyzeRouter.post("/analyze", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid analysis input (resumeText required)" });
  }
  try {
    const analysis = await matchResume(parsed.data);
    return res.json(analysis);
  } catch (err) {
    console.error("Analysis error:", err);
    return res.status(500).json({ error: "Failed to analyze resume" });
  }
});
