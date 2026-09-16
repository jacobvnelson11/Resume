import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Local disk storage under /storage/generated for MVP (PRD section 8 notes an
 * S3-compatible bucket for later phases -- swap this module out when that's
 * needed, callers only depend on the returned relative URL).
 */
const STORAGE_ROOT = path.resolve(__dirname, "../../../storage/generated");

export async function saveGeneratedFile(filename: string, data: Uint8Array | Buffer): Promise<string> {
  await mkdir(STORAGE_ROOT, { recursive: true });
  const filePath = path.join(STORAGE_ROOT, filename);
  await writeFile(filePath, data);
  return `/generated/${filename}`;
}

export { STORAGE_ROOT };
