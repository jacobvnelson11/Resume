export type NormalizedJob = {
  externalId: string;
  title: string;
  company: string;
  source: "greenhouse" | "remoteok" | "weworkremotely";
  url: string;
  remoteText: string | null;
  description: string;
  salaryMin: number | null;
  postedAt: Date | null;
};
