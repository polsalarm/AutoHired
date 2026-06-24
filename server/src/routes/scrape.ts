import { Router } from "express";
import { z } from "zod";
import { scrapeJobPage, ScrapeError } from "../services/jobScraper.js";
import { parseJobText } from "../services/aiParser.js";

export const scrapeRouter = Router();

const bodySchema = z.object({
  url: z.string().url(),
});

/**
 * POST /api/scrape
 * Body: { url: string }
 * Returns: ScrapedJob — structured posting data ready to save as an Application.
 */
scrapeRouter.post("/scrape", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Body must include a valid url" });
  }

  try {
    const { pageTitle, text, formFields } = await scrapeJobPage(
      parsed.data.url,
    );
    const job = await parseJobText({
      url: parsed.data.url,
      pageTitle,
      text,
      formFields,
    });
    return res.json(job);
  } catch (err) {
    if (err instanceof ScrapeError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Unexpected scrape error:", err);
    return res.status(500).json({ error: "Internal error while scraping" });
  }
});
