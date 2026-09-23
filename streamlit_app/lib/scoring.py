"""Fit tiering and scoring, ported from the PRD's section 4 keyword sets."""
import re
from datetime import datetime, timezone

from dateutil import parser as date_parser

STRONG_MARKETING_TITLE_KEYWORDS = [
    "digital marketing specialist",
    "digital marketing coordinator",
    "marketing automation specialist",
    "social media marketing manager",
    "social media manager",
    "e-commerce marketing specialist",
    "ecommerce marketing specialist",
    "crm marketing specialist",
]

STRONG_SALES_TITLE_KEYWORDS = [
    "business development representative",
    "bdr",
    "inside sales representative",
    "inside sales",
    "account executive",
    "sales development representative",
    "sdr",
]

STRETCH_TITLE_KEYWORDS = [
    "marketing coordinator",
    "marketing associate",
    "customer success",
    "account manager",
    "junior product marketing manager",
    "product marketing manager",
    "sales operations",
    "marketing operations",
    "sales & marketing operations",
]

SENIORITY_EXCLUDE_RE = re.compile(
    r"\b(senior|sr\.?|director|vp\b|vice president|principal|staff|head of|chief|lead\b)\b", re.I
)
CREDENTIAL_EXCLUDE_RE = re.compile(
    r"\b(cpa\b|registered nurse|rn license|professional engineer|p\.?e\.? license)\b", re.I
)

# Roles explicitly scoped to a non-US region -- these want candidates already
# authorized to work there, so a US-based applicant isn't a realistic fit even
# though the listing itself says "remote."
REGION_RESTRICTED_RE = re.compile(
    r"\b(DACH|Nordics?|EMEA|APAC|LATAM|ANZ|Benelux|"
    r"UK[\s/-]?(?:based|only|ireland)?|United Kingdom|Ireland|"
    r"Japan|Germany|France|Spain|Italy|Australia|"
    r"Central\s*&?\s*East(?:ern)?\s*Europe)\b",
    re.I,
)


def is_region_restricted(title: str) -> bool:
    return bool(REGION_RESTRICTED_RE.search(title or ""))


# Common English function words. A real English job posting will use several
# of these many times over; non-English text (Portuguese, Spanish, German,
# etc.) essentially never will. No language-detection library needed -- this
# catches non-English listings from global boards like Himalayas regardless
# of which language, not just the ones we happened to think to name.
ENGLISH_STOPWORDS = {
    "the", "and", "for", "with", "you", "our", "are", "this", "that", "will",
    "have", "your", "from", "team", "work", "role", "about", "experience",
    "we", "to", "of", "in", "on", "a", "is", "as", "be", "or", "an",
}


def is_english(text: str) -> bool:
    words = re.findall(r"[a-zA-Z']+", (text or "").lower())
    if len(words) < 15:
        return True  # too little text to judge reliably -- don't exclude on a guess
    stopword_hits = sum(1 for w in words if w in ENGLISH_STOPWORDS)
    return (stopword_hits / len(words)) >= 0.08


# Matches phrases like "5+ years of experience", "3-5 years experience", "7 years exp."
MIN_YEARS_RE = re.compile(
    r"(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?\+?\s*years?\s*(?:of\s+)?(?:relevant\s+|professional\s+)?(?:experience|exp\.?)\b",
    re.I,
)


def required_years_experience(description: str):
    """Highest stated minimum-years-of-experience requirement found in a posting, or None."""
    matches = MIN_YEARS_RE.findall(description or "")
    if not matches:
        return None
    return max(int(m) for m in matches)


def exceeds_experience_requirement(description: str, max_years: int) -> bool:
    """Screens out postings that explicitly ask for more experience than Jacob has --
    title wording alone (e.g. no "Senior" in the title) often doesn't catch this."""
    required = required_years_experience(description)
    return required is not None and required > max_years


def classify_tier(title: str) -> str:
    t = title.lower()
    if SENIORITY_EXCLUDE_RE.search(t) or CREDENTIAL_EXCLUDE_RE.search(t):
        return "excluded"
    if any(k in t for k in STRONG_MARKETING_TITLE_KEYWORDS) or any(k in t for k in STRONG_SALES_TITLE_KEYWORDS):
        return "strong"
    if any(k in t for k in STRETCH_TITLE_KEYWORDS):
        return "stretch"
    return "excluded"


def is_remote(remote_text: str, description: str) -> bool:
    hay = f"{remote_text or ''} {description}".lower()
    return bool(re.search(r"\bremote\b|work from anywhere|work from home", hay))


def meets_salary_floor(salary_min, title: str, tier: str, floor: int) -> bool:
    """Hard salary filter: keep stated salaries >= floor, or missing-salary listings
    that aren't an internship/volunteer/part-time role. Entry-level full-time roles
    are fine -- Jacob's explicitly okay with those as long as pay clears the floor."""
    if salary_min is not None:
        return salary_min >= floor
    t = title.lower()
    looks_sub_floor = bool(re.search(r"\bintern(ship)?\b|\bpart[- ]time\b|\bvolunteer\b", t))
    return tier != "excluded" and not looks_sub_floor


BENEFITS_RE = re.compile(
    r"health insurance|medical,? dental|dental,? vision|401\(?k\)?|paid time off|\bpto\b|"
    r"unlimited pto|equity|stock options|parental leave|life insurance|benefits package|"
    r"\bbenefits\b",
    re.I,
)


def mentions_benefits(description: str) -> bool:
    """Informational only, not a hard filter -- shown per job so Jacob can judge for himself."""
    return bool(BENEFITS_RE.search(description or ""))


def compute_fit_score(description: str, tier: str, base_skills, salary_min, salary_floor: int) -> int:
    """0-100: title-tier match (0-60) + skill overlap (0-30) + salary bonus (0-10)."""
    score = 0
    if tier == "strong":
        score += 60
    elif tier == "stretch":
        score += 35

    desc_lower = description.lower()
    matched = [s for s in base_skills if s.lower() in desc_lower]
    score += min(30, len(matched) * 6)

    if salary_min is not None and salary_min >= salary_floor * 1.25:
        score += 10
    elif salary_min is not None and salary_min >= salary_floor:
        score += 5

    return max(0, min(100, score))


def is_recent(posted_at, max_age_hours: int) -> bool:
    """True if posted_at parses to within the last max_age_hours. A posting
    with no usable date is kept rather than dropped -- excluding it would
    otherwise wipe out any source that just doesn't report a clean date,
    which isn't the same thing as the posting being stale."""
    if not posted_at:
        return True
    try:
        dt = date_parser.parse(str(posted_at))
    except (ValueError, OverflowError, TypeError):
        return True
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - dt
    return age.total_seconds() <= max_age_hours * 3600
