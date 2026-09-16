import type { NormalizedJob } from "../types.js";

/** Seed keyword sets from PRD section 4. */
export const STRONG_MARKETING_TITLE_KEYWORDS = [
  "digital marketing specialist",
  "digital marketing coordinator",
  "marketing automation specialist",
  "social media marketing manager",
  "social media manager",
  "e-commerce marketing specialist",
  "ecommerce marketing specialist",
  "crm marketing specialist",
];

export const STRONG_SALES_TITLE_KEYWORDS = [
  "business development representative",
  "bdr",
  "inside sales representative",
  "inside sales",
  "account executive",
  "sales development representative",
  "sdr",
];

export const STRETCH_TITLE_KEYWORDS = [
  "marketing coordinator",
  "marketing associate",
  "customer success",
  "account manager",
  "junior product marketing manager",
  "product marketing manager",
  "sales operations",
  "marketing operations",
  "sales & marketing operations",
];

/** Titles with this seniority scope are out of reach per PRD section 4 exclusions. */
const SENIORITY_EXCLUDE_RE = /\b(senior|sr\.?|director|vp\b|vice president|principal|staff|head of|chief)\b/i;

/** Degrees/licenses Jacob doesn't hold -- exclude outright. */
const CREDENTIAL_EXCLUDE_RE = /\b(cpa\b|registered nurse|\brn license\b|professional engineer|\bp\.?e\.? license\b)\b/i;

export type Tier = "strong" | "stretch" | "excluded";

export function classifyTier(title: string): Tier {
  const normalized = title.toLowerCase();

  if (SENIORITY_EXCLUDE_RE.test(normalized) || CREDENTIAL_EXCLUDE_RE.test(normalized)) {
    return "excluded";
  }
  if (
    STRONG_MARKETING_TITLE_KEYWORDS.some((k) => normalized.includes(k)) ||
    STRONG_SALES_TITLE_KEYWORDS.some((k) => normalized.includes(k))
  ) {
    return "strong";
  }
  if (STRETCH_TITLE_KEYWORDS.some((k) => normalized.includes(k))) {
    return "stretch";
  }
  return "excluded";
}

export function isRemote(job: NormalizedJob): boolean {
  const haystack = `${job.remoteText ?? ""} ${job.description}`.toLowerCase();
  return /\bremote\b|work from anywhere|work from home/.test(haystack);
}

/**
 * Salary is a hard filter (PRD section 4): keep only roles with a stated
 * minimum >= floor, OR roles with no salary data whose title/tier clearly
 * implies pay above the floor (i.e. not an internship/entry-level listing).
 */
export function meetsSalaryFloor(job: NormalizedJob, tier: Tier, floor: number): boolean {
  if (job.salaryMin != null) {
    return job.salaryMin >= floor;
  }
  const normalized = job.title.toLowerCase();
  const looksSubFloor = /\bintern(ship)?\b|\bentry[- ]level\b|\bpart[- ]time\b|\bvolunteer\b/.test(
    normalized,
  );
  return tier !== "excluded" && !looksSubFloor;
}

/**
 * 0-100 fit score: title-tier match (0-60) + skills overlap with base resume
 * (0-30) + a small bonus for an explicit, well-above-floor stated salary (0-10).
 */
export function computeFitScore(
  job: NormalizedJob,
  tier: Tier,
  baseSkills: string[],
  salaryFloor: number,
): number {
  let score = 0;

  if (tier === "strong") score += 60;
  else if (tier === "stretch") score += 35;

  const descLower = job.description.toLowerCase();
  const matchedSkills = baseSkills.filter((skill) => descLower.includes(skill.toLowerCase()));
  score += Math.min(30, matchedSkills.length * 6);

  if (job.salaryMin != null && job.salaryMin >= salaryFloor * 1.25) {
    score += 10;
  } else if (job.salaryMin != null && job.salaryMin >= salaryFloor) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}
