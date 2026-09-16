import type { NormalizedJob } from "../../types.js";

type RemoteOkJob = {
  id?: string;
  slug?: string;
  position?: string;
  company?: string;
  url?: string;
  description?: string;
  tags?: string[];
  salary_min?: number;
  salary_max?: number;
  date?: string;
  legal?: string;
};

/**
 * RemoteOK's public API (https://remoteok.com/api) is a free, documented feed
 * intended for programmatic consumption. Every listing on it is remote by
 * definition (PRD section 9).
 */
export async function fetchRemoteOkJobs(): Promise<NormalizedJob[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "auto-job-application-assistant (personal use)" },
  });
  if (!res.ok) {
    console.warn(`[remoteok] fetch failed: ${res.status}`);
    return [];
  }
  const data = (await res.json()) as RemoteOkJob[];

  return data
    .filter((job) => job.id && job.position && !job.legal)
    .map((job) => ({
      externalId: String(job.id),
      title: job.position!,
      company: job.company ?? "Unknown",
      source: "remoteok",
      url: job.url ? `https://remoteok.com${job.url}` : `https://remoteok.com/remote-jobs/${job.id}`,
      remoteText: "remote",
      description: `${job.description ?? ""} ${(job.tags ?? []).join(", ")}`.trim(),
      salaryMin: job.salary_min ?? null,
      postedAt: job.date ? new Date(job.date) : null,
    } satisfies NormalizedJob));
}
