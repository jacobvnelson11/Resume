import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Job } from "../types";
import JobCard from "../components/JobCard";

export default function ReviewQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setJobs(await api.getJobs());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(job: Job) {
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    const application = await api.createApplication(job.id);
    navigate(`/applications/${application.id}`);
  }

  async function handleSkip(job: Job) {
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    const application = await api.createApplication(job.id);
    await api.patchApplication(application.id, { status: "skipped" });
  }

  async function handleFetchMore() {
    setIngesting(true);
    try {
      await api.runIngest();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingestion failed");
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Review Queue</h1>
          <p className="text-sm text-slate-500">{jobs.length} unreviewed matches</p>
        </div>
        <button
          onClick={handleFetchMore}
          disabled={ingesting}
          className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          {ingesting ? "Fetching…" : "Fetch new matches"}
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p>No jobs in the queue right now.</p>
          <p className="text-sm mt-1">Click "Fetch new matches" to pull fresh listings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onApprove={() => handleApprove(job)}
              onSkip={() => handleSkip(job)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
