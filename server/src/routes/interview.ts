import { Router } from "express";
import { z } from "zod";
import { generateInterviewQuestions } from "../services/interviewCoach.js";

export const interviewRouter = Router();

const bodySchema = z.object({
  title: z.string().default("this role"),
  company: z.string().default(""),
  requirements: z.array(z.string()).default([]),
  description: z.string().default(""),
  profile: z.string().default(""),
});

/**
 * POST /api/interview/questions
 * Body: { title, company, requirements[], description, profile }
 * Returns: { questions: InterviewQuestion[] } tailored to the role + applicant.
 * Stateless — the client decides whether to persist.
 */
interviewRouter.post("/interview/questions", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid interview prep input" });
  }
  try {
    const result = await generateInterviewQuestions(parsed.data);
    return res.json(result);
  } catch (err) {
    console.error("Interview prep error:", err);
    return res.status(500).json({ error: "Failed to generate interview questions" });
  }
});
