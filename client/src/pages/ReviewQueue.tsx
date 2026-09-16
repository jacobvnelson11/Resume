import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Job } from "../types";
import JobCard from "../components/JobCard";

type ExitState = { id: number; dir: "left" | "right" } | null;

export default function ReviewQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [exit, setExit] = useState<ExitState>(null);
  const [preparingCount, setPreparingCount] = useState(0);
  const [draftWarning, setDraftWarning] = useState<string | null>(null);
  const warnedOnce = useRef(false);

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

  function triggerExit(job: Job, dir: "left" | "right") {
    if (exit) return; // one swipe animation at a time
    setExit({ id: job.id, dir });
    setTimeout(() => finishExit(job, dir), 320);
  }

  async function finishExit(job: Job, dir: "left" | "right") {
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    setExit(null);

    if (dir === "right") {
      // "Approve → apply for me": save it and kick off drafting in the background
      // right away, so there's nothing extra for a non-technical user to trigger.
      setPreparingCount((c) => c + 1);
      try {
        const application = await api.createApplication(job.id);
        await api.generateApplication(application.id);
      } catch (err) {
        if (!warnedOnce.current) {
          warnedOnce.current = true;
          setDraftWarning(
            err instanceof Error
              ? `One of your applications is saved, but I couldn't prepare the resume/cover letter yet: ${err.message}. Check "My Applications" to finish it once that's fixed.`
              : "One of your applications is saved, but I couldn't prepare the resume/cover letter yet.",
          );
        }
      } finally {
        setPreparingCount((c) => Math.max(0, c - 1));
      }
    } else {
      try {
        const application = await api.createApplication(job.id);
        await api.patchApplication(application.id, { status: "skipped" });
      } catch {
        // best-effort; if this fails the job may just reappear next fetch, which is harmless
      }
    }
  }

  async function handleFetchMore() {
    setIngesting(true);
    try {
      await api.runIngest();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't fetch new jobs");
    } finally {
      setIngesting(false);
    }
  }

  const visibleStack = jobs.slice(0, 3);

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Find Jobs</h1>
          <p className="text-sm text-slate-500">
            {jobs.length > 0 ? `${jobs.length} jobs to look at` : "No jobs waiting right now"}
          </p>
        </div>
        <button
          onClick={handleFetchMore}
          disabled={ingesting}
          className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          {ingesting ? "Looking…" : "Find new jobs"}
        </button>
      </div>

      <p className="text-center text-sm text-slate-400 mb-4">
        Swipe a card right (or tap ✓) to apply. Swipe left (or tap ✕) to skip.
      </p>

      {preparingCount > 0 && (
        <div className="mb-3 p-3 rounded-md bg-brand-50 text-brand-700 text-sm text-center">
          Preparing {preparingCount} application{preparingCount > 1 ? "s" : ""} in the background… find them
          under "My Applications" in a moment.
        </div>
      )}
      {draftWarning && (
        <div className="mb-3 p-3 rounded-md bg-amber-50 text-amber-800 text-sm">{draftWarning}</div>
      )}
      {error && <div className="mb-3 p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <p className="text-slate-500 text-center">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p>You're all caught up!</p>
          <p className="text-sm mt-1">Tap "Find new jobs" above to pull in fresh matches.</p>
        </div>
      ) : (
        <>
          <div className="relative mx-auto" style={{ height: 480 }}>
            {visibleStack
              .map((job, i) => (
                <JobCard
                  key={job.id}
                  job={job}
                  active={i === 0}
                  stackOffset={i}
                  forceExit={exit?.id === job.id ? exit.dir : null}
                  onSwipeLeft={() => triggerExit(job, "left")}
                  onSwipeRight={() => triggerExit(job, "right")}
                />
              ))
              .reverse()}
          </div>

          <div className="flex items-center justify-center gap-6 mt-6">
            <button
              onClick={() => triggerExit(jobs[0], "left")}
              aria-label="Skip this job"
              className="w-16 h-16 rounded-full border-2 border-rose-300 text-rose-500 text-2xl flex items-center justify-center hover:bg-rose-50 shadow-sm"
            >
              ✕
            </button>
            <button
              onClick={() => triggerExit(jobs[0], "right")}
              aria-label="Apply for this job"
              className="w-16 h-16 rounded-full border-2 border-emerald-300 text-emerald-500 text-2xl flex items-center justify-center hover:bg-emerald-50 shadow-sm"
            >
              ✓
            </button>
          </div>
        </>
      )}
    </div>
  );
}
