import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TailoredResponse } from "./claudeTailoring.js";
import type { EducationEntry } from "../db/schema.js";

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const CONTACT_LINE = "Jacob V. Nelson · Richmond, VA (Remote) · jacob.v.nelson11@gmail.com";

/**
 * ATS-safe by construction (PRD section 6): single column, no tables, no text
 * boxes, no headers/footers, standard fonts (Helvetica), plain text flow with
 * conventional section headings.
 */
class TextFlow {
  private doc: PDFDocument;
  private font: PDFFont;
  private boldFont: PDFFont;
  private page: PDFPage;
  private y: number;

  private constructor(doc: PDFDocument, font: PDFFont, boldFont: PDFFont, page: PDFPage) {
    this.doc = doc;
    this.font = font;
    this.boldFont = boldFont;
    this.page = page;
    this.y = PAGE_HEIGHT - MARGIN;
  }

  static async create(): Promise<TextFlow> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return new TextFlow(doc, font, boldFont, page);
  }

  private ensureSpace(lineHeight: number) {
    if (this.y - lineHeight < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  heading(text: string) {
    this.ensureSpace(20);
    this.y -= 4;
    this.page.drawText(text.toUpperCase(), {
      x: MARGIN,
      y: this.y,
      size: 12,
      font: this.boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.75,
      color: rgb(0.6, 0.6, 0.6),
    });
    this.y -= 14;
  }

  title(text: string, size = 16) {
    this.ensureSpace(size + 6);
    this.page.drawText(text, { x: MARGIN, y: this.y, size, font: this.boldFont });
    this.y -= size + 6;
  }

  paragraph(text: string, opts: { size?: number; bold?: boolean; indent?: number } = {}) {
    const size = opts.size ?? 10.5;
    const font = opts.bold ? this.boldFont : this.font;
    const indent = opts.indent ?? 0;
    const lines = wrapText(text, font, size, CONTENT_WIDTH - indent);
    for (const line of lines) {
      this.ensureSpace(size + 3);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font });
      this.y -= size + 3;
    }
  }

  bullet(text: string) {
    const size = 10.5;
    const indent = 14;
    const lines = wrapText(`•  ${text}`, this.font, size, CONTENT_WIDTH - indent);
    for (const line of lines) {
      this.ensureSpace(size + 3);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font: this.font });
      this.y -= size + 3;
    }
  }

  spacer(amount = 8) {
    this.y -= amount;
  }

  async toBytes(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderResumePdf(
  tailored: TailoredResponse,
  skills: string[],
  certifications: string[],
  education: EducationEntry[],
): Promise<Uint8Array> {
  const flow = await TextFlow.create();

  flow.title("Jacob V. Nelson");
  flow.paragraph(CONTACT_LINE, { size: 9.5 });
  flow.spacer(10);

  flow.heading("Summary");
  flow.paragraph(tailored.summary);
  flow.spacer(6);

  flow.heading("Experience");
  for (const role of tailored.experience) {
    flow.paragraph(`${role.title} — ${role.company}`, { bold: true });
    for (const bullet of role.bullets) {
      flow.bullet(bullet);
    }
    flow.spacer(6);
  }

  flow.heading("Skills");
  flow.paragraph(skills.join(", "));
  flow.spacer(6);

  flow.heading("Certifications");
  flow.paragraph(certifications.join(", "));
  flow.spacer(6);

  flow.heading("Education");
  for (const edu of education) {
    flow.paragraph(`${edu.degree}, ${edu.school} (${edu.gradDate})`);
  }

  return flow.toBytes();
}

export async function renderCoverLetterPdf(
  coverLetter: string,
  jobTitle: string,
  company: string,
): Promise<Uint8Array> {
  const flow = await TextFlow.create();

  flow.title("Jacob V. Nelson", 14);
  flow.paragraph(CONTACT_LINE, { size: 9.5 });
  flow.spacer(16);

  flow.paragraph(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
  flow.spacer(10);
  flow.paragraph(`Re: ${jobTitle} at ${company}`, { bold: true });
  flow.spacer(10);

  for (const paragraph of coverLetter.split(/\n+/).filter(Boolean)) {
    flow.paragraph(paragraph);
    flow.spacer(8);
  }

  return flow.toBytes();
}
