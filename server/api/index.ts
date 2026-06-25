// Vercel serverless entry. Wraps the Express app (compiled to dist/ by the
// build step) as a single function; vercel.json rewrites all paths here so
// Express handles its own routing (/health, /api/*).
// @ts-expect-error — dist is produced by `npm run build` before functions bundle.
import { app } from "../dist/app.js";

export default app;
