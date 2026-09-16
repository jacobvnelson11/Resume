import "dotenv/config";
import { db, pool } from "./client.js";
import { baseResume, type ExperienceEntry, type EducationEntry } from "./schema.js";

/**
 * Structured seed of Jacob's resume per PRD section 3. Placeholder bullets below
 * are intentionally generic starting points — edit via PATCH /api/base-resume
 * (or directly in this table) with real, specific accomplishments/metrics before
 * relying on the tailoring engine, since it only reorders/rewords what's here and
 * never invents content.
 */
const experience: ExperienceEntry[] = [
  {
    company: "HERC Rentals",
    title: "Sales Representative",
    startDate: "2024-06",
    endDate: null,
    bullets: [
      "Manage a B2B sales pipeline for construction and industrial equipment rentals, from prospecting through close, using Salesforce CRM to track opportunities and forecast revenue.",
      "Run consultative sales conversations with facilities, construction, and operations buyers to match equipment solutions to project requirements.",
      "Build and maintain relationships with repeat commercial accounts to drive renewal and expansion revenue.",
      "Coordinate with fleet and operations teams to ensure on-time equipment delivery and resolve customer issues.",
    ],
  },
  {
    company: "Northeast Alliance",
    title: "Product Marketing Manager",
    startDate: "2023-01",
    endDate: "2024-05",
    bullets: [
      "Led product marketing strategy and go-to-market messaging, coordinating cross-functional input from sales and leadership.",
      "Coached and led a team on sales enablement content and positioning, improving team-wide messaging consistency.",
      "Partnered with sales leadership to translate product positioning into sales coaching materials and talk tracks.",
    ],
  },
  {
    company: "Enso Media",
    title: "Social Media Marketing & Sales",
    startDate: "2021-06",
    endDate: "2022-12",
    bullets: [
      "Planned and executed paid and organic social campaigns using Meta Ads Manager, tracking performance in Google Analytics 4.",
      "Produced content and campaign creative using Canva, Adobe Photoshop, and CapCut for client social channels.",
      "Managed client-facing sales conversations for social media marketing packages, from pitch to close.",
    ],
  },
  {
    company: "Virginia Commonwealth University",
    title: "Marketing Intern",
    startDate: "2020-09",
    endDate: "2021-05",
    bullets: [
      "Supported campus marketing campaigns across email (Mailchimp) and web (WordPress) channels.",
      "Assisted with content creation and campaign coordination for university marketing initiatives.",
    ],
  },
];

const education: EducationEntry[] = [
  {
    school: "Virginia Commonwealth University",
    degree: "B.S. Business Management",
    gradDate: "2024",
  },
];

const skills = [
  "HubSpot",
  "Salesforce",
  "Google Analytics 4",
  "Google Ads",
  "Meta Ads Manager",
  "Mailchimp",
  "WordPress",
  "Canva",
  "Adobe Photoshop",
  "CapCut",
];

const certifications = [
  "Google Digital Marketing & E-commerce Professional Certificate",
  "Adobe Digital Marketing",
  "Salesforce Marketing Cloud Integration Essentials",
  "HubSpot/Coursera Marketing Automation",
];

const summary =
  "Marketing and sales professional with experience across digital marketing, marketing automation, social media, and B2B sales. Combines hands-on campaign execution (HubSpot, Salesforce, GA4, Meta Ads, Mailchimp) with consultative B2B selling and team coaching experience. Seeking remote roles in digital marketing, marketing automation, or B2B/inside sales.";

async function main() {
  const existing = await db.select().from(baseResume).limit(1);
  if (existing.length > 0) {
    console.log("base_resume already has a row; skipping seed. Delete it first to reseed.");
    await pool.end();
    return;
  }

  await db.insert(baseResume).values({
    summary,
    experience,
    skills,
    certifications,
    education,
  });

  console.log("Seeded base_resume with Jacob's structured resume data.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
