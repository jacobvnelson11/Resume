"""Local, file-based storage -- no database. Tracks which jobs have already
been suggested (so re-running only surfaces new ones) and holds the base
resume as structured JSON."""
import json
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = APP_DIR / "data"
SEEN_JOBS_PATH = DATA_DIR / "seen_jobs.json"
BASE_RESUME_PATH = DATA_DIR / "base_resume.json"


def load_seen_jobs() -> set[tuple[str, str]]:
    if not SEEN_JOBS_PATH.exists():
        return set()
    with open(SEEN_JOBS_PATH) as f:
        data = json.load(f)
    return {tuple(x) for x in data}


def save_seen_jobs(seen: set[tuple[str, str]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(SEEN_JOBS_PATH, "w") as f:
        json.dump([list(x) for x in sorted(seen)], f, indent=2)


def reset_seen_jobs() -> None:
    if SEEN_JOBS_PATH.exists():
        SEEN_JOBS_PATH.unlink()


def load_base_resume() -> dict:
    with open(BASE_RESUME_PATH) as f:
        return json.load(f)


def save_base_resume(data: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(BASE_RESUME_PATH, "w") as f:
        json.dump(data, f, indent=2)
