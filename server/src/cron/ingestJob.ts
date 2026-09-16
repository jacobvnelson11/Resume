import "dotenv/config";
import cron from "node-cron";
import { runIngestion } from "../services/ingestion.js";

const intervalMinutes = Number(process.env.INGEST_INTERVAL_MINUTES ?? 180);

async function run() {
  const start = Date.now();
  try {
    const result = await runIngestion();
    console.log(
      `[ingest] fetched ${result.fetched} raw listings, kept ${result.kept} after filters (${Date.now() - start}ms)`,
    );
  } catch (err) {
    console.error("[ingest] scheduled run failed:", err);
  }
}

const runOnce = process.argv.includes("--once");

if (runOnce) {
  run().then(() => process.exit(0));
} else {
  console.log(`[ingest] scheduling job ingestion every ${intervalMinutes} minutes`);
  run();
  cron.schedule(`*/${intervalMinutes} * * * *`, run);
}
