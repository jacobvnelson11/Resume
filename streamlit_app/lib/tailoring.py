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
3. Write a 150-250 word cover letter in a direct, professional, first-person voice, referencing only accomplishments and skills present in the base resume data and this job's specifics (company name, role title) pulled from the job description.
4. Do not fabricate anything: no new employers, titles, dates, numbers/metrics, or certifications beyond what's given.

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
