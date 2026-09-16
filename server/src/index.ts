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
import { requireAuth } from "./middleware/auth.js";
import { runIngestion } from "./services/ingestion.js";
import { STORAGE_ROOT } from "./services/fileStorage.js";

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
if (process.env.DISABLE_CRON !== "true") {
  console.log(`[ingest] scheduling job ingestion every ${intervalMinutes} minutes`);
  cron.schedule(`*/${intervalMinutes} * * * *`, () => {
    runIngestion()
      .then((result) => console.log(`[ingest] fetched ${result.fetched}, kept ${result.kept}`))
      .catch((err) => console.error("[ingest] scheduled run failed:", err));
  });
}
