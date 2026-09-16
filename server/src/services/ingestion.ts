import { db } from "../db/client.js";
import { baseResume, jobs } from "../db/schema.js";
import { fetchGreenhouseJobs } from "./connectors/greenhouse.js";
import { fetchRemoteOkJobs } from "./connectors/remoteok.js";
import { fetchWeWorkRemotelyJobs } from "./connectors/weworkremotely.js";
import { classifyTier, computeFitScore, isRemote, meetsSalaryFloor } from "./fitScoring.js";
import type { NormalizedJob } from "../types.js";
import { sql } from "drizzle-orm";

const SALARY_MIN = Number(process.env.SALARY_MIN ?? 60000);

/** Keyword sets from PRD section 4, used as a coarse pre-filter on raw feeds. */
const SEED_KEYWORDS = [
  "digital marketing",
  "marketing automation",
  "social media marketing",
  "social media manager",
  "e-commerce marketing",
  "ecommerce marketing",
  "crm marketing",
  "business development representative",
  "inside sales",
  "account executive",
  "sales development representative",
  "marketing coordinator",
];

function matchesSeedKeywords(job: NormalizedJob): boolean {
  const haystack = job.title.toLowerCase();
  return SEED_KEYWORDS.some((k) => haystack.includes(k));
}

export async function runIngestion(): Promise<{ fetched: number; kept: number }> {
  const boardTokens = (process.env.GREENHOUSE_BOARD_TOKENS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const [greenhouseResults, remoteOk, wwr] = await Promise.all([
    Promise.all(boardTokens.map((token) => fetchGreenhouseJobs(token))),
    fetchRemoteOkJobs(),
    fetchWeWorkRemotelyJobs(),
  ]);

  const allJobs: NormalizedJob[] = [...greenhouseResults.flat(), ...remoteOk, ...wwr];

  const resumeRow = await db.select().from(baseResume).limit(1);
  const baseSkills = resumeRow[0]?.skills ?? [];

  let kept = 0;

  for (const job of allJobs) {
    if (!matchesSeedKeywords(job)) continue;
    if (!isRemote(job)) continue;

    const tier = classifyTier(job.title);
    if (tier === "excluded") continue;
    if (!meetsSalaryFloor(job, tier, SALARY_MIN)) continue;

    const fitScore = computeFitScore(job, tier, baseSkills, SALARY_MIN);

    await db
      .insert(jobs)
      .values({
        externalId: job.externalId,
        title: job.title,
        company: job.company,
        source: job.source,
        url: job.url,
        remote: true,
        description: job.description,
        tier,
        fitScore,
        salaryMin: job.salaryMin,
        postedAt: job.postedAt,
      })
      .onConflictDoUpdate({
        target: [jobs.source, jobs.externalId],
        set: {
          title: job.title,
          company: job.company,
          url: job.url,
          description: job.description,
          tier,
          fitScore,
          salaryMin: job.salaryMin,
          fetchedAt: sql`now()`,
        },
      });

    kept += 1;
  }

  return { fetched: allJobs.length, kept };
}
