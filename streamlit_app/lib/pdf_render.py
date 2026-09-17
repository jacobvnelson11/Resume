"""ATS-safe PDF rendering: single column, standard fonts, no tables/text boxes
(PRD section 6)."""
import datetime

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

MARGIN = 54
PAGE_W, PAGE_H = LETTER
CONTENT_W = PAGE_W - 2 * MARGIN
CONTACT_LINE = "Jacob V. Nelson | Richmond, VA (Remote) | jacob.v.nelson11@gmail.com"


def _wrap(text: str, font: str, size: float, max_width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for w in words:
        candidate = f"{current} {w}".strip()
        if stringWidth(candidate, font, size) > max_width and current:
            lines.append(current)
            current = w
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


class _Flow:
    def __init__(self, path: str):
        self.c = canvas.Canvas(path, pagesize=LETTER)
        self.y = PAGE_H - MARGIN

    def _ensure_space(self, h: float) -> None:
        if self.y - h < MARGIN:
            self.c.showPage()
            self.y = PAGE_H - MARGIN

    def heading(self, text: str) -> None:
        self._ensure_space(20)
        self.y -= 4
        self.c.setFont("Helvetica-Bold", 12)
        self.c.drawString(MARGIN, self.y, text.upper())
        self.y -= 6
        self.c.setLineWidth(0.75)
        self.c.line(MARGIN, self.y, PAGE_W - MARGIN, self.y)
        self.y -= 14

    def title(self, text: str, size: float = 16) -> None:
        self._ensure_space(size + 6)
        self.c.setFont("Helvetica-Bold", size)
        self.c.drawString(MARGIN, self.y, text)
        self.y -= size + 6

    def paragraph(self, text: str, size: float = 10.5, bold: bool = False) -> None:
        font = "Helvetica-Bold" if bold else "Helvetica"
        for line in _wrap(text, font, size, CONTENT_W):
            self._ensure_space(size + 3)
            self.c.setFont(font, size)
            self.c.drawString(MARGIN, self.y, line)
            self.y -= size + 3

    def bullet(self, text: str) -> None:
        size, indent = 10.5, 14
        for line in _wrap(f"-  {text}", "Helvetica", size, CONTENT_W - indent):
            self._ensure_space(size + 3)
            self.c.setFont("Helvetica", size)
            self.c.drawString(MARGIN + indent, self.y, line)
            self.y -= size + 3

    def spacer(self, amount: float = 8) -> None:
        self.y -= amount

    def save(self) -> None:
        self.c.save()


def render_resume_pdf(path: str, tailored: dict, skills: list[str], certifications: list[str], education: list[dict]) -> None:
    f = _Flow(path)
    f.title("Jacob V. Nelson")
    f.paragraph(CONTACT_LINE, size=9.5)
    f.spacer(10)

    f.heading("Summary")
    f.paragraph(tailored["summary"])
    f.spacer(6)

    f.heading("Experience")
    for role in tailored["experience"]:
        f.paragraph(f"{role['title']} - {role['company']}", bold=True)
        for bullet in role["bullets"]:
            f.bullet(bullet)
        f.spacer(6)

    f.heading("Skills")
    f.paragraph(", ".join(skills))
    f.spacer(6)

    f.heading("Certifications")
    f.paragraph(", ".join(certifications))
    f.spacer(6)

    f.heading("Education")
    for edu in education:
        f.paragraph(f"{edu['degree']}, {edu['school']} ({edu['gradDate']})")

    f.save()


def render_cover_letter_pdf(path: str, cover_letter: str, job_title: str, company: str) -> None:
    f = _Flow(path)
    f.title("Jacob V. Nelson", size=14)
    f.paragraph(CONTACT_LINE, size=9.5)
    f.spacer(16)

    f.paragraph(datetime.date.today().strftime("%B %d, %Y"))
    f.spacer(10)
    f.paragraph(f"Re: {job_title} at {company}", bold=True)
    f.spacer(10)

    for para in [p for p in cover_letter.split("\n") if p.strip()]:
        f.paragraph(para)
        f.spacer(8)

    f.save()
