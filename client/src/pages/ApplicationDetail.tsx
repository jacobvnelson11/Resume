import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { ApplicationDetail as ApplicationDetailType, ApplicationStatus } from "../types";

const STATUS_OPTIONS: ApplicationStatus[] = [
  "saved",
  "drafted",
  "submitted",
  "response",
  "interview",
  "closed",
];

export default function ApplicationDetail() {
  const { id } = useParams();
  const applicationId = Number(id);
  const navigate = useNavigate();

  const [application, setApplication] = useState<ApplicationDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverLetterDraft, setCoverLetterDraft] = useState("");
  const [savingCoverLetter, setSavingCoverLetter] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getApplication(applicationId);
      setApplication(data);
      setCoverLetterDraft(data.coverLetterVersion?.bodyText ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load application");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await api.generateApplication(applicationId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleStatusChange(status: ApplicationStatus) {
    const updated = await api.patchApplication(applicationId, { status });
    setApplication((prev) => (prev ? { ...prev, ...updated } : prev));
  }

  async function handleSaveCoverLetter() {
    setSavingCoverLetter(true);
    try {
      await api.updateCoverLetter(applicationId, coverLetterDraft);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cover letter");
    } finally {
      setSavingCoverLetter(false);
    }
  }

  function handleOpenApplyLink() {
    if (!application) return;
    window.open(application.job.url, "_blank", "noreferrer");
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!application) return <p className="text-red-600">{error ?? "Application not found"}</p>;

  const { job } = application;

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:underline mb-4">
        ← Back
      </button>

      <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{job.title}</h1>
            <p className="text-slate-500">{job.company}</p>
          </div>
          <select
            value={application.status}
            onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
            className="border rounded-md px-2 py-1 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-slate-500">
          <span>Fit score: {job.fitScore}</span>
          <span>Tier: {job.tier}</span>
          {job.salaryMin != null && <span>${job.salaryMin.toLocaleString()}+</span>}
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>}

      {!application.resumeVersion ? (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {generating ? "Generating draft…" : "Generate tailored resume + cover letter"}
        </button>
      ) : (
        <div className="space-y-6">
          <section className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900">Tailored Resume</h2>
              <div className="flex gap-3 text-sm">
                {application.resumeVersion.pdfUrl && (
                  <a className="text-brand-600 hover:underline" href={application.resumeVersion.pdfUrl} target="_blank" rel="noreferrer">
                    PDF
                  </a>
                )}
                {application.resumeVersion.docxUrl && (
                  <a className="text-brand-600 hover:underline" href={application.resumeVersion.docxUrl} target="_blank" rel="noreferrer">
                    DOCX
                  </a>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">{application.resumeVersion.summary}</p>
            {application.resumeVersion.bulletsJson.map((role) => (
              <div key={`${role.company}-${role.title}`} className="mb-3">
                <p className="font-medium text-sm text-slate-800">
                  {role.title} — {role.company}
                </p>
                <ul className="list-disc list-inside text-sm text-slate-600">
                  {role.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900">Cover Letter</h2>
              <div className="flex gap-3 text-sm">
                {application.coverLetterVersion?.pdfUrl && (
                  <a className="text-brand-600 hover:underline" href={application.coverLetterVersion.pdfUrl} target="_blank" rel="noreferrer">
                    PDF
                  </a>
                )}
                {application.coverLetterVersion?.docxUrl && (
                  <a className="text-brand-600 hover:underline" href={application.coverLetterVersion.docxUrl} target="_blank" rel="noreferrer">
                    DOCX
                  </a>
                )}
              </div>
            </div>
            <textarea
              value={coverLetterDraft}
              onChange={(e) => setCoverLetterDraft(e.target.value)}
              rows={10}
              className="w-full border rounded-md p-3 text-sm text-slate-700"
            />
            <button
              onClick={handleSaveCoverLetter}
              disabled={savingCoverLetter}
              className="mt-3 px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              {savingCoverLetter ? "Saving…" : "Save edits"}
            </button>
          </section>

          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              {generating ? "Regenerating…" : "Regenerate draft"}
            </button>
            <button
              onClick={handleOpenApplyLink}
              className="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
            >
              Open apply page & submit ↗
            </button>
            <button
              onClick={() => handleStatusChange("submitted")}
              className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Mark submitted
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
