import { Router } from "express";
import { z } from "zod";
import { generateTasks } from "../services/taskGenerator.js";

export const tasksRouter = Router();

const bodySchema = z.object({
  title: z.string().default("this role"),
  company: z.string().default(""),
  requirements: z.array(z.string()).default([]),
  deadline: z.string().nullable().default(null),
});

/**
 * POST /api/tasks/generate
 * Body: { title, company, requirements[], deadline }
 * Returns: GeneratedTask[] — { label, dueDate }. The client persists these
 * to Supabase (server is stateless re: the user's data).
 */
tasksRouter.post("/tasks/generate", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid task generation input" });
  }
  try {
    const tasks = await generateTasks(parsed.data);
    return res.json({ tasks });
  } catch (err) {
    console.error("Task generation error:", err);
    return res.status(500).json({ error: "Failed to generate tasks" });
  }
});
