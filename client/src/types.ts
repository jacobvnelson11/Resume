export type Tier = "strong" | "stretch" | "excluded";

export type ApplicationStatus =
  | "saved"
  | "drafted"
  | "submitted"
  | "response"
  | "interview"
  | "closed"
  | "skipped";

export type Job = {
  id: number;
  externalId: string;
  title: string;
  company: string;
  source: string;
  url: string;
  remote: boolean;
  description: string;
  tier: Tier;
  fitScore: number;
  salaryMin: number | null;
  postedAt: string | null;
  fetchedAt: string;
};

export type Application = {
  id: number;
  jobId: number;
  status: ApplicationStatus;
  resumeVersionId: number | null;
  coverLetterVersionId: number | null;
  selfIdentifyDisability: boolean;
  submittedAt: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  job: Job;
};

export type ExperienceEntry = {
  company: string;
  title: string;
  startDate: string;
  endDate: string | null;
  bullets: string[];
};

export type TailoredExperienceEntry = {
  company: string;
  title: string;
  bullets: string[];
};

export type ResumeVersion = {
  id: number;
  jobId: number;
  bulletsJson: TailoredExperienceEntry[];
  summary: string;
  generatedAt: string;
  pdfUrl: string | null;
  docxUrl: string | null;
};

export type CoverLetterVersion = {
  id: number;
  jobId: number;
  bodyText: string;
  generatedAt: string;
  pdfUrl: string | null;
  docxUrl: string | null;
};

export type ApplicationDetail = Application & {
  resumeVersion?: ResumeVersion;
  coverLetterVersion?: CoverLetterVersion;
};

export type BaseResume = {
  id: number;
  summary: string;
  experience: ExperienceEntry[];
  skills: string[];
  certifications: string[];
  education: { school: string; degree: string; gradDate: string }[];
  updatedAt: string;
};
