import { Router } from "express";
import { db } from "../db/client.js";
import { applications, jobs } from "../db/schema.js";
import { and, desc, eq, notInArray, sql } from "drizzle-orm";

export const jobsRouter = Router();

/**
 * GET /api/jobs -- the review queue feed (PRD section 5).
 * ?tier=strong|stretch  ?excludeApplied=true (default true) hides jobs that
 * already have an application record so the queue only shows fresh matches.
 */
jobsRouter.get("/", async (req, res) => {
  const tier = typeof req.query.tier === "string" ? req.query.tier : undefined;
  const excludeApplied = req.query.excludeApplied !== "false";

  const conditions = [];
  if (tier) conditions.push(eq(jobs.tier, tier as "strong" | "stretch"));

  if (excludeApplied) {
    const appliedJobIds = db.select({ jobId: applications.jobId }).from(applications);
    conditions.push(notInArray(jobs.id, appliedJobIds));
  }

  const rows = await db
    .select()
    .from(jobs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(jobs.fitScore), desc(jobs.postedAt));

  res.json(rows);
});

jobsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

jobsRouter.get("/stats/daily", async (_req, res) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(sql`${jobs.fetchedAt} >= now() - interval '1 day'`);
  res.json({ newToday: Number(row?.count ?? 0) });
});
