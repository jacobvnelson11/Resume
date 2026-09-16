CREATE TYPE "public"."application_status" AS ENUM('saved', 'drafted', 'submitted', 'response', 'interview', 'closed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."job_tier" AS ENUM('strong', 'stretch', 'excluded');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"status" "application_status" DEFAULT 'saved' NOT NULL,
	"resume_version_id" integer,
	"cover_letter_version_id" integer,
	"self_identify_disability" boolean DEFAULT true NOT NULL,
	"submitted_at" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "base_resume" (
	"id" serial PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"experience" jsonb NOT NULL,
	"skills" jsonb NOT NULL,
	"certifications" jsonb NOT NULL,
	"education" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cover_letter_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"body_text" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pdf_url" text,
	"docx_url" text
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" varchar(512) NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"source" varchar(64) NOT NULL,
	"url" text NOT NULL,
	"remote" boolean DEFAULT false NOT NULL,
	"description" text NOT NULL,
	"tier" "job_tier" DEFAULT 'excluded' NOT NULL,
	"fit_score" integer DEFAULT 0 NOT NULL,
	"salary_min" integer,
	"posted_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"bullets_json" jsonb NOT NULL,
	"summary" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pdf_url" text,
	"docx_url" text
);
--> statement-breakpoint
CREATE TABLE "status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"from_status" "application_status",
	"to_status" "application_status" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_letter_versions" ADD CONSTRAINT "cover_letter_versions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_source_external_id_idx" ON "jobs" USING btree ("source","external_id");