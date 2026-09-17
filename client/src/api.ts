import type { Application, ApplicationDetail, BaseResume, Job } from "./types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request to ${path} failed with ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (password: string) => request<{ ok: boolean }>("/api/login", { method: "POST", body: JSON.stringify({ password }) }),

  getJobs: (tier?: string) => request<Job[]>(`/api/jobs${tier ? `?tier=${tier}` : ""}`),
  getJob: (id: number) => request<Job>(`/api/jobs/${id}`),
  getJobsDailyStats: () => request<{ newToday: number }>("/api/jobs/stats/daily"),

  getApplications: (status?: string) =>
    request<Application[]>(`/api/applications${status ? `?status=${status}` : ""}`),
  getApplication: (id: number) => request<ApplicationDetail>(`/api/applications/${id}`),
  createApplication: (jobId: number) =>
    request<Application>("/api/applications", { method: "POST", body: JSON.stringify({ jobId }) }),
  patchApplication: (id: number, data: Partial<Application>) =>
    request<Application>(`/api/applications/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  generateApplication: (id: number) =>
    request<{ resumeVersion: unknown; coverLetterVersion: unknown }>(`/api/applications/${id}/generate`, {
      method: "POST",
    }),
  updateCoverLetter: (id: number, bodyText: string) =>
    request(`/api/applications/${id}/cover-letter`, { method: "PATCH", body: JSON.stringify({ bodyText }) }),
  getApplicationsDailyStats: () =>
    request<{ reviewedToday: number; target: number }>("/api/applications/stats/daily"),

  getBaseResume: () => request<BaseResume>("/api/base-resume"),
  patchBaseResume: (data: Partial<BaseResume>) =>
    request<BaseResume>("/api/base-resume", { method: "PATCH", body: JSON.stringify(data) }),

  runIngest: () => request<{ fetched: number; kept: number }>("/api/ingest/run", { method: "POST" }),

  runDailyBatch: () =>
    request<{
      fetched: number;
      kept: number;
      processed: number;
      succeeded: number;
      failed: { job: string; error: string }[];
    }>("/api/batch/run-daily", { method: "POST" }),
};
