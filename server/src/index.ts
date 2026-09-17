import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import cron from "node-cron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

import { baseResumeRouter } from "./routes/baseResume.js";
import { jobsRouter } from "./routes/jobs.js";
import { applicationsRouter } from "./routes/applications.js";
import { ingestRouter } from "./routes/ingest.js";
import { batchRouter } from "./routes/batch.js";
import { requireAuth } from "./middleware/auth.js";
import { runIngestion } from "./services/ingestion.js";
import { runDailyBatch } from "./services/dailyBatch.js";
import { STORAGE_ROOT } from "./services/fileStorage.js";
import { LABELED_RESUME_DIR } from "./services/labeledResumeStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT ?? 8787);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(
  cookieSession({
    name: "session",
    secret: process.env.SESSION_SECRET ?? "change-me-in-prod",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  }),
);

app.use("/generated", express.static(STORAGE_ROOT));
app.use("/resumes-by-job", express.static(LABELED_RESUME_DIR));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/login", (req, res) => {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return res.json({ ok: true });

  const { password } = req.body ?? {};
  if (password !== appPassword) return res.status(401).json({ error: "Incorrect password" });

  req.session!.authenticated = true;
  res.json({ ok: true });
});

app.use("/api/base-resume", requireAuth, baseResumeRouter);
app.use("/api/jobs", requireAuth, jobsRouter);
app.use("/api/applications", requireAuth, applicationsRouter);
app.use("/api/ingest", requireAuth, ingestRouter);
app.use("/api/batch", requireAuth, batchRouter);

// Serve the built client (production) if present.
const clientDist = path.resolve(__dirname, "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

const intervalMinutes = Number(process.env.INGEST_INTERVAL_MINUTES ?? 180);
const dailyBatchHour = Number(process.env.DAILY_BATCH_HOUR ?? 7);

if (process.env.DISABLE_CRON !== "true") {
  console.log(`[ingest] scheduling job ingestion every ${intervalMinutes} minutes`);
  cron.schedule(`*/${intervalMinutes} * * * *`, () => {
    runIngestion()
      .then((result) => console.log(`[ingest] fetched ${result.fetched}, kept ${result.kept}`))
      .catch((err) => console.error("[ingest] scheduled run failed:", err));
  });

  // The hands-off daily agent: find today's best new matches and generate a
  // resume + cover letter for each one automatically, no swiping required.
  console.log(`[daily-batch] scheduling once a day at ${dailyBatchHour}:00 server time`);
  cron.schedule(`0 ${dailyBatchHour} * * *`, () => {
    runDailyBatch()
      .then((result) =>
        console.log(
          `[daily-batch] processed ${result.processed}, generated ${result.succeeded} resumes, ${result.failed.length} failed`,
        ),
      )
      .catch((err) => console.error("[daily-batch] scheduled run failed:", err));
  });
}
