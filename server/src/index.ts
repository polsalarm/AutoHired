import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { scrapeRouter } from "./routes/scrape.js";
import { tasksRouter } from "./routes/tasks.js";
import { extractRouter } from "./routes/extract.js";
import { analyzeRouter } from "./routes/analyze.js";
import { interviewRouter } from "./routes/interview.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// Behind a proxy (Vercel/Render/Fly) so rate-limit sees the real client IP.
app.set("trust proxy", 1);

// CORS: comma-separated allowlist in CLIENT_ORIGIN, or localhost in dev.
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowedOrigins.includes(origin)
        ? cb(null, true)
        : cb(new Error("Not allowed by CORS")),
  }),
);
app.use(express.json({ limit: "1mb" }));

// General API throttle + a tighter one for expensive AI/scrape/extract work.
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
const heavyLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests — wait a minute and retry." },
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "autohired-api" });
});

app.use("/api", apiLimiter);
app.use(
  [
    "/api/scrape",
    "/api/analyze",
    "/api/extract",
    "/api/tasks/generate",
    "/api/interview/questions",
    "/api/interview/turn",
  ],
  heavyLimiter,
);

app.use("/api", scrapeRouter);
app.use("/api", tasksRouter);
app.use("/api", extractRouter);
app.use("/api", analyzeRouter);
app.use("/api", interviewRouter);

app.listen(PORT, () => {
  console.log(`AutoHired API listening on http://localhost:${PORT}`);
});
