import { db } from "../db/client.js";
import { applications, statusHistory } from "../db/schema.js";
import { eq } from "drizzle-orm";

type ApplicationStatus = (typeof applications.$inferSelect)["status"];

export async function transitionStatus(
  applicationId: number,
  toStatus: ApplicationStatus,
): Promise<void> {
  const [current] = await db
    .select({ status: applications.status })
    .from(applications)
    .where(eq(applications.id, applicationId));

  if (!current) {
    throw new Error(`Application ${applicationId} not found`);
  }

  await db
    .update(applications)
    .set({ status: toStatus, updatedAt: new Date() })
    .where(eq(applications.id, applicationId));

  await db.insert(statusHistory).values({
    applicationId,
    fromStatus: current.status,
    toStatus,
  });
}
