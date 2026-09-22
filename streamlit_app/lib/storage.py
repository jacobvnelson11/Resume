"""Local, file-based storage -- no database. Tracks which jobs have already
been suggested (so re-running only surfaces new ones) and holds the base
resume as structured JSON."""
import json
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = APP_DIR / "data"
SEEN_JOBS_PATH = DATA_DIR / "seen_jobs.json"
BASE_RESUME_PATH = DATA_DIR / "base_resume.json"
CURRENT_BATCH_PATH = DATA_DIR / "current_batch.json"


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


def _job_key_str(key: tuple[str, str]) -> str:
    return f"{key[0]}|||{key[1]}"


def save_current_batch(job_results: list[dict], generated: dict[tuple[str, str], dict]) -> None:
    """Persists the currently-visible job list + whatever's been generated so far
    to disk, so it survives closing/reopening the app -- not just in-memory
    session state, which a restart wipes even though the jobs stay marked "seen"."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "job_results": job_results,
        "generated": {_job_key_str(k): v for k, v in generated.items()},
    }
    with open(CURRENT_BATCH_PATH, "w") as f:
        json.dump(payload, f, indent=2)


def load_current_batch() -> tuple[list[dict], dict[tuple[str, str], dict]]:
    if not CURRENT_BATCH_PATH.exists():
        return [], {}
    with open(CURRENT_BATCH_PATH) as f:
        payload = json.load(f)
    generated = {tuple(k.split("|||", 1)): v for k, v in payload.get("generated", {}).items()}
    return payload.get("job_results", []), generated


def clear_current_batch() -> None:
    if CURRENT_BATCH_PATH.exists():
        CURRENT_BATCH_PATH.unlink()


def load_base_resume() -> dict:
    with open(BASE_RESUME_PATH) as f:
        return json.load(f)


def save_base_resume(data: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(BASE_RESUME_PATH, "w") as f:
        json.dump(data, f, indent=2)
