import { Router } from "express";
import { db } from "../db/client.js";
import { baseResume } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const baseResumeRouter = Router();

baseResumeRouter.get("/", async (_req, res) => {
  const [row] = await db.select().from(baseResume).limit(1);
  if (!row) return res.status(404).json({ error: "Base resume not seeded yet. Run `npm run db:seed -w server`." });
  res.json(row);
});

baseResumeRouter.patch("/", async (req, res) => {
  const [existing] = await db.select().from(baseResume).limit(1);
  if (!existing) {
    return res.status(404).json({ error: "Base resume not seeded yet. Run `npm run db:seed -w server`." });
  }

  const { summary, experience, skills, certifications, education } = req.body ?? {};
  const update: Partial<typeof baseResume.$inferInsert> = { updatedAt: new Date() };
  if (summary !== undefined) update.summary = summary;
  if (experience !== undefined) update.experience = experience;
  if (skills !== undefined) update.skills = skills;
  if (certifications !== undefined) update.certifications = certifications;
  if (education !== undefined) update.education = education;

  const [updated] = await db
    .update(baseResume)
    .set(update)
    .where(eq(baseResume.id, existing.id))
    .returning();

  res.json(updated);
});
