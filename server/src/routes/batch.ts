import { Router } from "express";
import { runDailyBatch } from "../services/dailyBatch.js";

export const batchRouter = Router();

/** Manual trigger for the same job the daily scheduler runs -- lets Jacob run "today's batch" on demand from the UI. */
batchRouter.post("/run-daily", async (_req, res) => {
  try {
    const result = await runDailyBatch();
    res.json(result);
  } catch (err) {
    console.error("[daily-batch] run failed:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Daily batch failed" });
  }
});
