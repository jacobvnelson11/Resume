import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ExperienceEntry } from "../db/schema.js";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env before generating drafts.");
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const tailoredResponseSchema = z.object({
  summary: z.string().min(1),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  coverLetter: z.string().min(1),
});

export type TailoredResponse = z.infer<typeof tailoredResponseSchema>;

export type BaseResumeInput = {
  summary: string;
  experience: ExperienceEntry[];
  skills: string[];
  certifications: string[];
};

const SYSTEM_PROMPT = `You are a resume/cover-letter tailoring assistant for a single job seeker.

You will be given the seeker's BASE RESUME DATA (structured, factual) and a JOB DESCRIPTION.

Your job:
1. Re-order and, where helpful, lightly reword the bullets within each existing role to emphasize the skills/tools most relevant to this specific job posting.
2. You may DROP a bullet that's clearly irrelevant to this job, but you may NEVER add a bullet, employer, title, date range, metric, or credential that is not already present in the base resume data.
3. Write a 150-250 word cover letter in a direct, professional, first-person voice, referencing only accomplishments and skills present in the base resume data and this job's specifics (company name, role title) pulled from the job description.
4. Do not fabricate anything: no new employers, titles, dates, numbers/metrics, or certifications beyond what's given.

Respond with ONLY a single JSON object matching this exact shape, no prose before or after:
{
  "summary": string,
  "experience": [ { "company": string, "title": string, "bullets": string[] } ],
  "coverLetter": string
}

The "company" and "title" fields in your response must exactly match the company and title strings from the base resume data, in the same set of roles (you may reorder roles, but must not add or remove a role).`;

export async function generateTailoredApplication(
  jobTitle: string,
  jobCompany: string,
  jobDescription: string,
  baseResume: BaseResumeInput,
): Promise<TailoredResponse> {
  const userMessage = `BASE RESUME DATA:\n${JSON.stringify(
    {
      summary: baseResume.summary,
      experience: baseResume.experience,
      skills: baseResume.skills,
      certifications: baseResume.certifications,
    },
    null,
    2,
  )}\n\nJOB POSTING:\nCompany: ${jobCompany}\nTitle: ${jobTitle}\nDescription:\n${jobDescription}`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude response contained no text content.");
  }

  const jsonText = extractJson(textBlock.text);
  const parsed = tailoredResponseSchema.parse(JSON.parse(jsonText));
  validateAgainstBaseResume(parsed, baseResume);
  return parsed;
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Could not locate a JSON object in Claude's response.");
  }
  return text.slice(start, end + 1);
}

/**
 * Structural guardrail (PRD section 6): the model may reorder/drop/reword
 * bullets but must never introduce a role, employer, or bullet that didn't
 * exist in the base resume. This can't catch subtly-fabricated wording inside
 * a kept bullet, so treat this as a floor, not a full fact-check -- review
 * every draft before approving it.
 */
function validateAgainstBaseResume(generated: TailoredResponse, base: BaseResumeInput): void {
  const baseRoleKeys = new Set(base.experience.map((e) => roleKey(e.company, e.title)));
  const baseBulletsByRole = new Map(
    base.experience.map((e) => [roleKey(e.company, e.title), new Set(e.bullets)]),
  );

  if (generated.experience.length > base.experience.length) {
    throw new Error("Generated resume has more roles than the base resume -- rejecting.");
  }

  for (const role of generated.experience) {
    const key = roleKey(role.company, role.title);
    if (!baseRoleKeys.has(key)) {
      throw new Error(
        `Generated resume references an unknown role "${role.title} @ ${role.company}" not present in base resume -- rejecting to prevent fabrication.`,
      );
    }
    const originalBullets = baseBulletsByRole.get(key)!;
    if (role.bullets.length > originalBullets.size) {
      throw new Error(
        `Generated resume added more bullets than exist for "${role.title} @ ${role.company}" -- rejecting to prevent fabrication.`,
      );
    }
  }
}

function roleKey(company: string, title: string): string {
  return `${company.trim().toLowerCase()}::${title.trim().toLowerCase()}`;
}
