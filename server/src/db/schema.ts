import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const jobTierEnum = pgEnum("job_tier", ["strong", "stretch", "excluded"]);

export const applicationStatusEnum = pgEnum("application_status", [
  "saved",
  "drafted",
  "submitted",
  "response",
  "interview",
  "closed",
  "skipped",
]);

/** Single row: Jacob's resume as structured data, not a flat PDF (PRD section 6). */
export const baseResume = pgTable("base_resume", {
  id: serial("id").primaryKey(),
  summary: text("summary").notNull(),
  experience: jsonb("experience").$type<ExperienceEntry[]>().notNull(),
  skills: jsonb("skills").$type<string[]>().notNull(),
  certifications: jsonb("certifications").$type<string[]>().notNull(),
  education: jsonb("education").$type<EducationEntry[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExperienceEntry = {
  company: string;
  title: string;
  startDate: string;
  endDate: string | null;
  bullets: string[];
};

export type EducationEntry = {
  school: string;
  degree: string;
  gradDate: string;
};

/** Shape returned by the Claude tailoring pass: same roles as ExperienceEntry, dates omitted since they're never touched. */
export type TailoredExperienceEntry = {
  company: string;
  title: string;
  bullets: string[];
};

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    externalId: varchar("external_id", { length: 512 }).notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    url: text("url").notNull(),
    remote: boolean("remote").notNull().default(false),
    description: text("description").notNull(),
    tier: jobTierEnum("tier").notNull().default("excluded"),
    fitScore: integer("fit_score").notNull().default(0),
    salaryMin: integer("salary_min"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sourceExternalIdIdx: uniqueIndex("jobs_source_external_id_idx").on(
      table.source,
      table.externalId,
    ),
  }),
);

export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  status: applicationStatusEnum("status").notNull().default("saved"),
  resumeVersionId: integer("resume_version_id"),
  coverLetterVersionId: integer("cover_letter_version_id"),
  selfIdentifyDisability: boolean("self_identify_disability").notNull().default(true),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resumeVersions = pgTable("resume_versions", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  bulletsJson: jsonb("bullets_json").$type<TailoredExperienceEntry[]>().notNull(),
  summary: text("summary").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  pdfUrl: text("pdf_url"),
  docxUrl: text("docx_url"),
});

export const coverLetterVersions = pgTable("cover_letter_versions", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  bodyText: text("body_text").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  pdfUrl: text("pdf_url"),
  docxUrl: text("docx_url"),
});

export const statusHistory = pgTable("status_history", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  fromStatus: applicationStatusEnum("from_status"),
  toStatus: applicationStatusEnum("to_status").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});
