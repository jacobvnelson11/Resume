import { desc, eq, notInArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { applications, baseResume, coverLetterVersions, jobs, resumeVersions, statusHistory } from "../db/schema.js";
import { runIngestion } from "./ingestion.js";
import { generateTailoredApplication } from "./claudeTailoring.js";
import { renderResumePdf, renderCoverLetterPdf } from "./pdfRenderer.js";
import { renderResumeDocx, renderCoverLetterDocx } from "./docxRenderer.js";
import { saveGeneratedFile } from "./fileStorage.js";
import { saveLabeledResume } from "./labeledResumeStorage.js";
import { transitionStatus } from "./statusHistory.js";

const DAILY_BATCH_SIZE = Number(process.env.DAILY_BATCH_SIZE ?? 40);

export type DailyBatchResult = {
  fetched: number;
  kept: number;
  processed: number;
  succeeded: number;
  failed: { job: string; error: string }[];
};

/**
 * The fully hands-off daily agent: fetch new listings, score them, and
 * generate + save a tailored resume/cover letter for each of the best
 * DAILY_BATCH_SIZE that Jacob hasn't already been shown. No swiping required
 * -- this is the "just do it for me every day" path. Submission still
 * requires Jacob's own click on the source site (PRD section 10).
 */
export async function runDailyBatch(): Promise<DailyBatchResult> {
  const { fetched, kept } = await runIngestion();

  const [base] = await db.select().from(baseResume).limit(1);
  if (!base) {
    throw new Error("Base resume not seeded yet -- can't generate drafts. Fill in \"My Resume\" first.");
  }

  const appliedJobIds = db.select({ jobId: applications.jobId }).from(applications);
  const candidates = await db
    .select()
    .from(jobs)
    .where(notInArray(jobs.id, appliedJobIds))
    .orderBy(desc(jobs.fitScore), desc(jobs.postedAt))
    .limit(DAILY_BATCH_SIZE);

  let succeeded = 0;
  const failed: { job: string; error: string }[] = [];

  for (const job of candidates) {
    const label = `${job.company} - ${job.title}`;
    try {
      const [application] = await db.insert(applications).values({ jobId: job.id, status: "saved" }).returning();
      await db.insert(statusHistory).values({ applicationId: application.id, fromStatus: null, toStatus: "saved" });

      const tailored = await generateTailoredApplication(job.title, job.company, job.description, base);

      const slug = `${application.id}-${Date.now()}`;
      const [resumePdf, resumeDocx, coverPdf, coverDocx] = await Promise.all([
        renderResumePdf(tailored, base.skills, base.certifications, base.education),
        renderResumeDocx(tailored, base.skills, base.certifications, base.education),
        renderCoverLetterPdf(tailored.coverLetter, job.title, job.company),
        renderCoverLetterDocx(tailored.coverLetter, job.title, job.company),
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
          jobId: job.id,
          bulletsJson: tailored.experience,
          summary: tailored.summary,
          pdfUrl: resumePdfUrl,
          docxUrl: resumeDocxUrl,
        })
        .returning();

      const [coverLetterVersion] = await db
        .insert(coverLetterVersions)
        .values({ jobId: job.id, bodyText: tailored.coverLetter, pdfUrl: coverPdfUrl, docxUrl: coverDocxUrl })
        .returning();

      await db
        .update(applications)
        .set({ resumeVersionId: resumeVersion.id, coverLetterVersionId: coverLetterVersion.id, updatedAt: new Date() })
        .where(eq(applications.id, application.id));

      await transitionStatus(application.id, "drafted");

      // Human-readable copy, per Jacob's request: one folder, named by company + role.
      await saveLabeledResume(job.company, job.title, resumePdf, "pdf");
      await saveLabeledResume(job.company, job.title, resumeDocx, "docx");

      succeeded += 1;
    } catch (err) {
      failed.push({ job: label, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { fetched, kept, processed: candidates.length, succeeded, failed };
}
