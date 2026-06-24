import { Router } from "express";
import { z } from "zod";
import {
  generateInterviewQuestions,
  interviewTurn,
} from "../services/interviewCoach.js";

export const interviewRouter = Router();

const bodySchema = z.object({
  title: z.string().default("this role"),
  company: z.string().default(""),
  requirements: z.array(z.string()).default([]),
  description: z.string().default(""),
  profile: z.string().default(""),
});

const turnSchema = bodySchema.extend({
  history: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .default([]),
  maxQuestions: z.number().int().min(1).max(10).optional(),
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

/**
 * POST /api/interview/turn
 * Body: { ...role, profile, history: [{question, answer}], maxQuestions? }
 * Returns: { feedback, nextQuestion, done, scorecard } — one turn of a live
 * (voice) mock interview. Stateless; the client passes the full history each turn.
 */
interviewRouter.post("/interview/turn", async (req, res) => {
  const parsed = turnSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid interview turn input" });
  }
  try {
    const result = await interviewTurn(parsed.data);
    return res.json(result);
  } catch (err) {
    console.error("Interview turn error:", err);
    return res.status(500).json({ error: "Failed to run interview turn" });
  }
});
