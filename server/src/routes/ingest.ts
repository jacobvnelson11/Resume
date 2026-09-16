import { Router } from "express";
import { runIngestion } from "../services/ingestion.js";

export const ingestRouter = Router();

ingestRouter.post("/run", async (_req, res) => {
  try {
    const result = await runIngestion();
    res.json(result);
  } catch (err) {
    console.error("[ingest] run failed:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Ingestion failed" });
  }
});
