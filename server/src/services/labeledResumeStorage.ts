import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * A single flat folder of resumes named "<Company> - <Role>.<ext>" so Jacob
 * can browse them directly on disk without going through the app, per his
 * request. This is in addition to the versioned copies under
 * /storage/generated that the app itself links to (those are keyed by
 * application id, not human-readable).
 */
export const LABELED_RESUME_DIR = path.resolve(__dirname, "../../../storage/resumes-by-job");

function sanitize(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export async function saveLabeledResume(
  company: string,
  title: string,
  data: Uint8Array | Buffer,
  ext: "pdf" | "docx",
): Promise<string> {
  await mkdir(LABELED_RESUME_DIR, { recursive: true });
  const filename = `${sanitize(company)} - ${sanitize(title)}.${ext}`;
  await writeFile(path.join(LABELED_RESUME_DIR, filename), data);
  return `/resumes-by-job/${filename}`;
}
