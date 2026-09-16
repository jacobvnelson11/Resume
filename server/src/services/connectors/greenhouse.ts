import type { NormalizedJob } from "../../types.js";

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  updated_at: string;
  location: { name: string };
  content: string;
  metadata?: { name: string; value: unknown }[] | null;
};

type GreenhouseBoardResponse = {
  jobs: GreenhouseJob[];
};

/**
 * Greenhouse exposes a public, unauthenticated JSON endpoint per company board
 * (boards-api.greenhouse.io) that's meant to be read programmatically -- no
 * scraping involved (PRD section 9).
 */
export async function fetchGreenhouseJobs(boardToken: string): Promise<NormalizedJob[]> {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`,
  );
  if (!res.ok) {
    console.warn(`[greenhouse] board "${boardToken}" fetch failed: ${res.status}`);
    return [];
  }
  const data = (await res.json()) as GreenhouseBoardResponse;

  return data.jobs.map((job) => {
    const salaryMin = extractSalaryFromMetadata(job.metadata);
    return {
      externalId: String(job.id),
      title: job.title,
      company: boardToken,
      source: "greenhouse",
      url: job.absolute_url,
      remoteText: job.location?.name ?? null,
      description: stripHtml(job.content ?? ""),
      salaryMin,
      postedAt: job.updated_at ? new Date(job.updated_at) : null,
    } satisfies NormalizedJob;
  });
}

function extractSalaryFromMetadata(metadata: GreenhouseJob["metadata"]): number | null {
  if (!metadata) return null;
  const salaryField = metadata.find((m) => /salary|compensation|pay range/i.test(m.name));
  if (!salaryField || typeof salaryField.value !== "string") return null;
  const match = salaryField.value.match(/\$?([\d,]{4,})/);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ""));
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
