import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import type { TailoredResponse } from "./claudeTailoring.js";
import type { EducationEntry } from "../db/schema.js";

const CONTACT_LINE = "Jacob V. Nelson · Richmond, VA (Remote) · jacob.v.nelson11@gmail.com";
const FONT = "Calibri";

/** Single column, standard headings, no tables/text boxes -- ATS-safe (PRD section 6). */
export async function renderResumeDocx(
  tailored: TailoredResponse,
  skills: string[],
  certifications: string[],
  education: EducationEntry[],
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: "Jacob V. Nelson",
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [new TextRun({ text: CONTACT_LINE, size: 20, font: FONT })],
      spacing: { after: 200 },
    }),
    sectionHeading("Summary"),
    bodyParagraph(tailored.summary),
  ];

  children.push(sectionHeading("Experience"));
  for (const role of tailored.experience) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${role.title} — ${role.company}`, bold: true, size: 22, font: FONT })],
        spacing: { before: 120, after: 60 },
      }),
    );
    for (const bullet of role.bullets) {
      children.push(
        new Paragraph({
          text: bullet,
          bullet: { level: 0 },
          spacing: { after: 40 },
        }),
      );
    }
  }

  children.push(sectionHeading("Skills"));
  children.push(bodyParagraph(skills.join(", ")));

  children.push(sectionHeading("Certifications"));
  children.push(bodyParagraph(certifications.join(", ")));

  children.push(sectionHeading("Education"));
  for (const edu of education) {
    children.push(bodyParagraph(`${edu.degree}, ${edu.school} (${edu.gradDate})`));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

export async function renderCoverLetterDocx(
  coverLetter: string,
  jobTitle: string,
  company: string,
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "Jacob V. Nelson", bold: true, size: 26, font: FONT })],
    }),
    new Paragraph({
      children: [new TextRun({ text: CONTACT_LINE, size: 20, font: FONT })],
      spacing: { after: 300 },
    }),
    bodyParagraph(
      new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    ),
    new Paragraph({
      children: [new TextRun({ text: `Re: ${jobTitle} at ${company}`, bold: true, size: 22, font: FONT })],
      spacing: { before: 200, after: 200 },
    }),
    ...coverLetter
      .split(/\n+/)
      .filter(Boolean)
      .map((p) => bodyParagraph(p, 200)),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    text: text.toUpperCase(),
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 100 },
    alignment: AlignmentType.LEFT,
  });
}

function bodyParagraph(text: string, spacingAfter = 100): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: FONT })],
    spacing: { after: spacingAfter },
  });
}
