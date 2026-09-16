import type { Job } from "../types";

const TIER_STYLES: Record<string, string> = {
  strong: "bg-emerald-100 text-emerald-800",
  stretch: "bg-amber-100 text-amber-800",
  excluded: "bg-slate-100 text-slate-600",
};

export default function JobCard({
  job,
  onApprove,
  onSkip,
}: {
  job: Job;
  onApprove: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{job.title}</h3>
          <p className="text-sm text-slate-500">{job.company}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${TIER_STYLES[job.tier]}`}>
          {job.tier === "strong" ? "Strong fit" : job.tier === "stretch" ? "Stretch fit" : job.tier}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span>Fit score: {job.fitScore}</span>
        <span>Source: {job.source}</span>
        {job.salaryMin != null && <span>${job.salaryMin.toLocaleString()}+</span>}
        {job.postedAt && <span>Posted {new Date(job.postedAt).toLocaleDateString()}</span>}
      </div>

      <p className="text-sm text-slate-600 line-clamp-4">{job.description}</p>

      <div className="flex items-center justify-between pt-2">
        <a href={job.url} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">
          View posting ↗
        </a>
        <div className="flex gap-2">
          <button
            onClick={onSkip}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Skip
          </button>
          <button
            onClick={onApprove}
            className="px-3 py-1.5 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700"
          >
            Approve → Draft
          </button>
        </div>
      </div>
    </div>
  );
}
