"""Fit tiering and scoring, ported from the PRD's section 4 keyword sets."""
import re

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
    r"\b(senior|sr\.?|director|vp\b|vice president|principal|staff|head of|chief)\b", re.I
)
CREDENTIAL_EXCLUDE_RE = re.compile(
    r"\b(cpa\b|registered nurse|rn license|professional engineer|p\.?e\.? license)\b", re.I
)

SEED_KEYWORDS = [
    "digital marketing",
    "marketing automation",
    "social media marketing",
    "social media manager",
    "e-commerce marketing",
    "ecommerce marketing",
    "crm marketing",
    "business development representative",
    "inside sales",
    "account executive",
    "sales development representative",
    "marketing coordinator",
]


def matches_seed_keywords(title: str) -> bool:
    t = title.lower()
    return any(k in t for k in SEED_KEYWORDS)


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
    """Hard salary filter (PRD section 4): keep stated salaries >= floor, or
    missing-salary listings whose title doesn't look like it's below the floor."""
    if salary_min is not None:
        return salary_min >= floor
    t = title.lower()
    looks_sub_floor = bool(re.search(r"\bintern(ship)?\b|\bentry[- ]level\b|\bpart[- ]time\b|\bvolunteer\b", t))
    return tier != "excluded" and not looks_sub_floor


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
