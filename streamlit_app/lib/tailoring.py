"""Claude-powered resume/cover-letter tailoring, with a structural guardrail
against fabricated content (PRD section 6)."""
import json
import os

from anthropic import Anthropic

SYSTEM_PROMPT = """You are a resume/cover-letter tailoring assistant for a single job seeker.

You will be given the seeker's BASE RESUME DATA (structured, factual) and a JOB DESCRIPTION.

Your job:
1. Re-order and, where helpful, lightly reword the bullets within each existing role to emphasize the skills/tools most relevant to this specific job posting.
2. You may DROP a bullet that's clearly irrelevant to this job, but you may NEVER add a bullet, employer, title, date range, metric, or credential that is not already present in the base resume data.
3. Write a 150-250 word cover letter, referencing only accomplishments and skills present in the base resume data and this job's specifics (company name, role title) pulled from the job description.
4. Do not fabricate anything: no new employers, titles, dates, numbers/metrics, or certifications beyond what's given.

The cover letter must read like a real person wrote it in one sitting, not like an AI wrote it. Specifically:
- No stock opener/closer phrases: never "I am excited/thrilled to apply," "I am writing to express my interest," "I believe I would be a valuable asset," "I look forward to the opportunity to discuss," "perfect fit," "passionate about," or "leverage my skills."
- No hedge-free superlative stacking ("proven track record of driving significant results") -- state what was done plainly instead.
- Vary sentence length. Don't make every sentence the same shape or every paragraph start the same way ("I have," "I am," "I bring").
- Reference something specific and concrete from the job posting (the actual product, team, problem, or a phrase from the listing), not generic praise of the company.
- Plain, direct word choices over corporate-speak ("helped" not "spearheaded," "worked on" not "orchestrated," unless the base resume itself already uses stronger verbs -- match its register, don't inflate it).
- Contractions are fine where a person would naturally use them.
- End on a simple, low-key note, not a grand promise.

Respond with ONLY a single JSON object matching this exact shape, no prose before or after:
{
  "summary": string,
  "experience": [ { "company": string, "title": string, "bullets": string[] } ],
  "coverLetter": string
}

The "company" and "title" fields in your response must exactly match the company and title strings from the base resume data, in the same set of roles (you may reorder roles, but must not add or remove a role)."""


def _client() -> Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set. Add it in the sidebar first.")
    return Anthropic(api_key=api_key)


def _role_key(company: str, title: str) -> str:
    return f"{company.strip().lower()}::{title.strip().lower()}"


def _validate_against_base_resume(generated: dict, base: dict) -> None:
    base_roles = {_role_key(e["company"], e["title"]) for e in base["experience"]}
    base_bullets = {_role_key(e["company"], e["title"]): set(e["bullets"]) for e in base["experience"]}

    if len(generated["experience"]) > len(base["experience"]):
        raise RuntimeError("Generated resume has more roles than the base resume -- rejecting.")

    for role in generated["experience"]:
        key = _role_key(role["company"], role["title"])
        if key not in base_roles:
            raise RuntimeError(
                f'Generated resume references an unknown role "{role["title"]} @ {role["company"]}" '
                "not present in base resume -- rejecting to prevent fabrication."
            )
        if len(role["bullets"]) > len(base_bullets[key]):
            raise RuntimeError(
                f'Generated resume added more bullets than exist for "{role["title"]} @ {role["company"]}" '
                "-- rejecting to prevent fabrication."
            )


def _extract_json(text: str) -> str:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise RuntimeError("Could not locate a JSON object in Claude's response.")
    return text[start : end + 1]


def generate_tailored_application(
    job_title: str,
    job_company: str,
    job_description: str,
    base_resume: dict,
    model: str = "claude-sonnet-5",
) -> dict:
    user_message = (
        "BASE RESUME DATA:\n"
        + json.dumps(
            {
                "summary": base_resume["summary"],
                "experience": base_resume["experience"],
                "skills": base_resume["skills"],
                "certifications": base_resume["certifications"],
            },
            indent=2,
        )
        + f"\n\nJOB POSTING:\nCompany: {job_company}\nTitle: {job_title}\nDescription:\n{job_description}"
    )

    response = _client().messages.create(
        model=model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        raise RuntimeError("Claude response contained no text content.")

    parsed = json.loads(_extract_json(text))
    _validate_against_base_resume(parsed, base_resume)
    return parsed


def generate_template_application(
    job_title: str,
    job_company: str,
    job_description: str,
    base_resume: dict,
) -> dict:
    """No-API-key fallback: your resume as-is (no per-job bullet reordering),
    plus a short, deterministic cover letter that calls out whichever of your
    skills the posting itself mentions. Not AI-tailored -- add an Anthropic
    API key in the sidebar for a version written specifically for each job."""
    desc_lower = (job_description or "").lower()
    matched_skills = [s for s in base_resume["skills"] if s.lower() in desc_lower][:3]
    skills_phrase = ", ".join(matched_skills) if matched_skills else ", ".join(base_resume["skills"][:3])

    experience = [
        {"company": e["company"], "title": e["title"], "bullets": list(e["bullets"])}
        for e in base_resume["experience"]
    ]

    cover_letter = (
        f"Hi,\n\n"
        f"I'm applying for the {job_title} role at {job_company}. {base_resume['summary']}\n\n"
        f"Relevant experience includes {skills_phrase}.\n\n"
        f"Happy to share more or answer any questions -- you can reach me at jacob.v.nelson11@gmail.com.\n\n"
        f"Thanks for your time,\nJacob V. Nelson"
    )

    return {"summary": base_resume["summary"], "experience": experience, "coverLetter": cover_letter}
