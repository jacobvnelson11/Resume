import { Router } from "express";
import { db } from "../db/client.js";
import {
  applications,
  baseResume,
  coverLetterVersions,
  jobs,
  resumeVersions,
  statusHistory,
} from "../db/schema.js";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { transitionStatus } from "../services/statusHistory.js";
import { generateTailoredApplication } from "../services/claudeTailoring.js";
import { renderResumePdf, renderCoverLetterPdf } from "../services/pdfRenderer.js";
import { renderResumeDocx, renderCoverLetterDocx } from "../services/docxRenderer.js";
import { saveGeneratedFile } from "../services/fileStorage.js";

export const applicationsRouter = Router();

const DAILY_TARGET = Number(process.env.DAILY_APPLICATION_TARGET ?? 40);

applicationsRouter.get("/", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const rows = await db
    .select({
      application: applications,
      job: jobs,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(status ? eq(applications.status, status as (typeof applications.$inferSelect)["status"]) : undefined)
    .orderBy(desc(applications.updatedAt));

  res.json(rows.map(({ application, job }) => ({ ...application, job })));
});

/** Daily quality-reviewed-application counter (PRD goal #3: 40/day target, not a hard cap). */
applicationsRouter.get("/stats/daily", async (_req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(applications)
    .where(and(gte(applications.updatedAt, startOfDay), sql`${applications.status} != 'saved'`));

  res.json({ reviewedToday: Number(row?.count ?? 0), target: DAILY_TARGET });
});

applicationsRouter.post("/", async (req, res) => {
  const { jobId } = req.body ?? {};
  if (!jobId) return res.status(400).json({ error: "jobId is required" });

  const [job] = await db.select().from(jobs).where(eq(jobs.id, Number(jobId)));
  if (!job) return res.status(404).json({ error: "Job not found" });

  const [application] = await db
    .insert(applications)
    .values({ jobId: job.id, status: "saved" })
    .returning();

  await db.insert(statusHistory).values({
    applicationId: application.id,
    fromStatus: null,
    toStatus: "saved",
  });

  res.status(201).json(application);
});

applicationsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({ application: applications, job: jobs })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.id, id));

  if (!row) return res.status(404).json({ error: "Application not found" });

  const [resumeVersion] = row.application.resumeVersionId
    ? await db.select().from(resumeVersions).where(eq(resumeVersions.id, row.application.resumeVersionId))
    : [undefined];

  const [coverLetterVersion] = row.application.coverLetterVersionId
    ? await db
        .select()
        .from(coverLetterVersions)
        .where(eq(coverLetterVersions.id, row.application.coverLetterVersionId))
    : [undefined];

  res.json({ ...row.application, job: row.job, resumeVersion, coverLetterVersion });
});

applicationsRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status, notes, nextFollowUpAt, selfIdentifyDisability } = req.body ?? {};

  const [existing] = await db.select().from(applications).where(eq(applications.id, id));
  if (!existing) return res.status(404).json({ error: "Application not found" });

  if (status && status !== existing.status) {
    await transitionStatus(id, status);
  }

  const update: Partial<typeof applications.$inferInsert> = { updatedAt: new Date() };
  if (notes !== undefined) update.notes = notes;
  if (nextFollowUpAt !== undefined) update.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
  if (selfIdentifyDisability !== undefined) update.selfIdentifyDisability = selfIdentifyDisability;
  if (status === "submitted" && !existing.submittedAt) update.submittedAt = new Date();

  const [updated] = await db.update(applications).set(update).where(eq(applications.id, id)).returning();
  res.json(updated);
});

/**
 * POST /api/applications/:id/generate -- the draft generator (PRD section 6):
 * calls Claude with the job + base resume, validates the result, renders
 * PDF + DOCX, and links the new versions to this application.
 */
applicationsRouter.post("/:id/generate", async (req, res) => {
  const id = Number(req.params.id);

  const [row] = await db
    .select({ application: applications, job: jobs })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.id, id));

  if (!row) return res.status(404).json({ error: "Application not found" });

  const [base] = await db.select().from(baseResume).limit(1);
  if (!base) return res.status(400).json({ error: "Base resume not seeded yet." });

  let tailored;
  try {
    tailored = await generateTailoredApplication(row.job.title, row.job.company, row.job.description, base);
  } catch (err) {
    console.error("[generate] Claude tailoring failed:", err);
    return res.status(502).json({ error: err instanceof Error ? err.message : "Tailoring generation failed" });
  }

  const slug = `${id}-${Date.now()}`;
  const [resumePdf, resumeDocx, coverPdf, coverDocx] = await Promise.all([
    renderResumePdf(tailored, base.skills, base.certifications, base.education),
    renderResumeDocx(tailored, base.skills, base.certifications, base.education),
    renderCoverLetterPdf(tailored.coverLetter, row.job.title, row.job.company),
    renderCoverLetterDocx(tailored.coverLetter, row.job.title, row.job.company),
  ]);

  const [resumePdfUrl, resumeDocxUrl, coverPdfUrl, coverDocxUrl] = await Promise.all([
    saveGeneratedFile(`resume-${slug}.pdf`, resumePdf),
    saveGeneratedFile(`resume-${slug}.docx`, resumeDocx),
    saveGeneratedFile(`cover-letter-${slug}.pdf`, coverPdf),
    saveGeneratedFile(`cover-letter-${slug}.docx`, coverDocx),
  ]);

  const [resumeVersion] = await db
    .insert(resumeVersions)
    .values({
      jobId: row.job.id,
      bulletsJson: tailored.experience,
      summary: tailored.summary,
      pdfUrl: resumePdfUrl,
      docxUrl: resumeDocxUrl,
    })
    .returning();

  const [coverLetterVersion] = await db
    .insert(coverLetterVersions)
    .values({
      jobId: row.job.id,
      bodyText: tailored.coverLetter,
      pdfUrl: coverPdfUrl,
      docxUrl: coverDocxUrl,
    })
    .returning();

  await db
    .update(applications)
    .set({
      resumeVersionId: resumeVersion.id,
      coverLetterVersionId: coverLetterVersion.id,
      updatedAt: new Date(),
    })
    .where(eq(applications.id, id));

  if (row.application.status === "saved") {
    await transitionStatus(id, "drafted");
  }

  res.json({ resumeVersion, coverLetterVersion });
});

/**
 * PATCH /api/applications/:id/cover-letter -- lets Jacob hand-edit the drafted
 * cover letter text before approving (PRD flow step "Jacob reviews/edits"),
 * then re-renders the PDF/DOCX for that same version in place.
 */
applicationsRouter.patch("/:id/cover-letter", async (req, res) => {
  const id = Number(req.params.id);
  const { bodyText } = req.body ?? {};
  if (!bodyText || typeof bodyText !== "string") {
    return res.status(400).json({ error: "bodyText is required" });
  }

  const [row] = await db
    .select({ application: applications, job: jobs })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.id, id));

  if (!row) return res.status(404).json({ error: "Application not found" });
  if (!row.application.coverLetterVersionId) {
    return res.status(400).json({ error: "No cover letter has been generated yet" });
  }

  const [pdf, docx] = await Promise.all([
    renderCoverLetterPdf(bodyText, row.job.title, row.job.company),
    renderCoverLetterDocx(bodyText, row.job.title, row.job.company),
  ]);
  const slug = `${id}-${Date.now()}`;
  const [pdfUrl, docxUrl] = await Promise.all([
    saveGeneratedFile(`cover-letter-${slug}.pdf`, pdf),
    saveGeneratedFile(`cover-letter-${slug}.docx`, docx),
  ]);

  const [updated] = await db
    .update(coverLetterVersions)
    .set({ bodyText, pdfUrl, docxUrl })
    .where(eq(coverLetterVersions.id, row.application.coverLetterVersionId))
    .returning();

  res.json(updated);
});
