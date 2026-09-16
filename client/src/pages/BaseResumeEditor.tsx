import { useEffect, useState } from "react";
import { api } from "../api";
import type { BaseResume, ExperienceEntry } from "../types";

type EducationEntry = BaseResume["education"][number];

export default function BaseResumeEditor() {
  const [resume, setResume] = useState<BaseResume | null>(null);
  const [skillsText, setSkillsText] = useState("");
  const [certsText, setCertsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    api
      .getBaseResume()
      .then((data) => {
        setResume(data);
        setSkillsText(data.skills.join(", "));
        setCertsText(data.certifications.join(", "));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load base resume"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!resume) return <p className="text-red-600">{error ?? "Base resume not found"}</p>;

  function updateExperience(index: number, patch: Partial<ExperienceEntry>) {
    setResume((prev) => {
      if (!prev) return prev;
      const experience = prev.experience.map((role, i) => (i === index ? { ...role, ...patch } : role));
      return { ...prev, experience };
    });
  }

  function updateBullet(expIndex: number, bulletIndex: number, value: string) {
    setResume((prev) => {
      if (!prev) return prev;
      const experience = prev.experience.map((role, i) => {
        if (i !== expIndex) return role;
        const bullets = role.bullets.map((b, bi) => (bi === bulletIndex ? value : b));
        return { ...role, bullets };
      });
      return { ...prev, experience };
    });
  }

  function addBullet(expIndex: number) {
    setResume((prev) => {
      if (!prev) return prev;
      const experience = prev.experience.map((role, i) =>
        i === expIndex ? { ...role, bullets: [...role.bullets, ""] } : role,
      );
      return { ...prev, experience };
    });
  }

  function removeBullet(expIndex: number, bulletIndex: number) {
    setResume((prev) => {
      if (!prev) return prev;
      const experience = prev.experience.map((role, i) =>
        i === expIndex ? { ...role, bullets: role.bullets.filter((_, bi) => bi !== bulletIndex) } : role,
      );
      return { ...prev, experience };
    });
  }

  function addExperience() {
    setResume((prev) => {
      if (!prev) return prev;
      const newRole: ExperienceEntry = { company: "", title: "", startDate: "", endDate: null, bullets: [""] };
      return { ...prev, experience: [...prev.experience, newRole] };
    });
  }

  function removeExperience(index: number) {
    setResume((prev) => (prev ? { ...prev, experience: prev.experience.filter((_, i) => i !== index) } : prev));
  }

  function updateEducation(index: number, patch: Partial<EducationEntry>) {
    setResume((prev) => {
      if (!prev) return prev;
      const education = prev.education.map((edu, i) => (i === index ? { ...edu, ...patch } : edu));
      return { ...prev, education };
    });
  }

  function addEducation() {
    setResume((prev) =>
      prev ? { ...prev, education: [...prev.education, { school: "", degree: "", gradDate: "" }] } : prev,
    );
  }

  function removeEducation(index: number) {
    setResume((prev) => (prev ? { ...prev, education: prev.education.filter((_, i) => i !== index) } : prev));
  }

  async function handleSave() {
    if (!resume) return;
    setSaving(true);
    setError(null);
    try {
      const skills = skillsText.split(",").map((s) => s.trim()).filter(Boolean);
      const certifications = certsText.split(",").map((s) => s.trim()).filter(Boolean);
      const updated = await api.patchBaseResume({
        summary: resume.summary,
        experience: resume.experience,
        education: resume.education,
        skills,
        certifications,
      });
      setResume(updated);
      setSkillsText(updated.skills.join(", "));
      setCertsText(updated.certifications.join(", "));
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Base Resume</h1>
        <p className="text-sm text-slate-500">
          This is the only source of truth the tailoring engine draws from — it can reorder, drop, or
          lightly reword these bullets per job, but it will never invent a new employer, title, date, or
          accomplishment. Put your real, specific bullets (with metrics where you have them) here.
        </p>
      </div>

      {error && <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>}
      {savedAt && <div className="p-3 rounded-md bg-emerald-50 text-emerald-700 text-sm">Saved.</div>}

      <section className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Summary</h2>
        <textarea
          value={resume.summary}
          onChange={(e) => setResume({ ...resume, summary: e.target.value })}
          rows={3}
          className="w-full border rounded-md p-3 text-sm text-slate-700"
        />
      </section>

      <section className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Experience</h2>
          <button onClick={addExperience} className="text-sm text-brand-600 hover:underline">
            + Add role
          </button>
        </div>
        <div className="space-y-5">
          {resume.experience.map((role, i) => (
            <div key={i} className="border rounded-md p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <input
                    value={role.title}
                    onChange={(e) => updateExperience(i, { title: e.target.value })}
                    placeholder="Title"
                    className="border rounded-md px-2 py-1 text-sm"
                  />
                  <input
                    value={role.company}
                    onChange={(e) => updateExperience(i, { company: e.target.value })}
                    placeholder="Company"
                    className="border rounded-md px-2 py-1 text-sm"
                  />
                  <input
                    value={role.startDate}
                    onChange={(e) => updateExperience(i, { startDate: e.target.value })}
                    placeholder="Start (YYYY-MM)"
                    className="border rounded-md px-2 py-1 text-sm"
                  />
                  <input
                    value={role.endDate ?? ""}
                    onChange={(e) => updateExperience(i, { endDate: e.target.value || null })}
                    placeholder="End (YYYY-MM, blank = present)"
                    className="border rounded-md px-2 py-1 text-sm"
                  />
                </div>
                <button
                  onClick={() => removeExperience(i)}
                  className="text-xs text-red-500 hover:underline whitespace-nowrap"
                >
                  Remove role
                </button>
              </div>

              <div className="space-y-1">
                {role.bullets.map((bullet, bi) => (
                  <div key={bi} className="flex gap-2 items-start">
                    <textarea
                      value={bullet}
                      onChange={(e) => updateBullet(i, bi, e.target.value)}
                      rows={2}
                      className="flex-1 border rounded-md px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => removeBullet(i, bi)}
                      className="text-xs text-red-500 hover:underline mt-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button onClick={() => addBullet(i)} className="text-xs text-brand-600 hover:underline">
                  + Add bullet
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Skills</h2>
        <input
          value={skillsText}
          onChange={(e) => setSkillsText(e.target.value)}
          placeholder="Comma-separated, e.g. HubSpot, Salesforce, GA4"
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      </section>

      <section className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Certifications</h2>
        <input
          value={certsText}
          onChange={(e) => setCertsText(e.target.value)}
          placeholder="Comma-separated"
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      </section>

      <section className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Education</h2>
          <button onClick={addEducation} className="text-sm text-brand-600 hover:underline">
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {resume.education.map((edu, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={edu.degree}
                onChange={(e) => updateEducation(i, { degree: e.target.value })}
                placeholder="Degree"
                className="flex-1 border rounded-md px-2 py-1 text-sm"
              />
              <input
                value={edu.school}
                onChange={(e) => updateEducation(i, { school: e.target.value })}
                placeholder="School"
                className="flex-1 border rounded-md px-2 py-1 text-sm"
              />
              <input
                value={edu.gradDate}
                onChange={(e) => updateEducation(i, { gradDate: e.target.value })}
                placeholder="Year"
                className="w-24 border rounded-md px-2 py-1 text-sm"
              />
              <button onClick={() => removeEducation(i)} className="text-xs text-red-500 hover:underline">
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save resume"}
      </button>
    </div>
  );
}
