"""Job connectors -- official, documented APIs/feeds only (PRD section 9), no scraping."""
import re

import feedparser
import requests


def strip_html(html: str) -> str:
    text = re.sub(r"<[^>]*>", " ", html or "")
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", text).strip()


def fetch_greenhouse_jobs(board_token: str) -> list[dict]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"[greenhouse] board '{board_token}' fetch failed: {e}")
        return []

    data = resp.json()
    jobs = []
    for job in data.get("jobs", []):
        jobs.append(
            {
                "external_id": str(job["id"]),
                "title": job["title"],
                "company": board_token,
                "source": "greenhouse",
                "url": job["absolute_url"],
                "remote_text": (job.get("location") or {}).get("name"),
                "description": strip_html(job.get("content", "")),
                "salary_min": None,
                "posted_at": job.get("updated_at"),
            }
        )
    return jobs


def fetch_remoteok_jobs() -> list[dict]:
    try:
        resp = requests.get(
            "https://remoteok.com/api",
            headers={"User-Agent": "job-search-assistant (personal use)"},
            timeout=15,
        )
        resp.raise_for_status()
    except Exception as e:
        print(f"[remoteok] fetch failed: {e}")
        return []

    data = resp.json()
    jobs = []
    for job in data:
        if not job.get("id") or not job.get("position") or job.get("legal"):
            continue
        jobs.append(
            {
                "external_id": str(job["id"]),
                "title": job["position"],
                "company": job.get("company", "Unknown"),
                "source": "remoteok",
                "url": f"https://remoteok.com{job['url']}" if job.get("url") else f"https://remoteok.com/remote-jobs/{job['id']}",
                "remote_text": "remote",
                "description": f"{job.get('description', '')} {', '.join(job.get('tags', []))}".strip(),
                "salary_min": job.get("salary_min"),
                "posted_at": job.get("date"),
            }
        )
    return jobs


def fetch_weworkremotely_jobs() -> list[dict]:
    feed_url = "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss"
    try:
        feed = feedparser.parse(feed_url)
    except Exception as e:
        print(f"[weworkremotely] feed fetch failed: {e}")
        return []

    jobs = []
    for item in feed.entries:
        title_raw = item.get("title", "")
        if ":" in title_raw:
            company, title = title_raw.split(":", 1)
        else:
            company, title = "Unknown", title_raw

        description = strip_html(item.get("summary", ""))
        salary_min = None
        m = re.search(r"\$(\d{2,3}),?(\d{3})", description)
        if m:
            salary_min = int(m.group(1) + m.group(2))

        jobs.append(
            {
                "external_id": item.get("id") or item.get("link"),
                "title": title.strip() or title_raw,
                "company": company.strip() or "Unknown",
                "source": "weworkremotely",
                "url": item.get("link"),
                "remote_text": "remote",
                "description": description,
                "salary_min": salary_min,
                "posted_at": item.get("published"),
            }
        )
    return jobs


def fetch_all_jobs(greenhouse_tokens: list[str]) -> list[dict]:
    jobs = []
    jobs += fetch_remoteok_jobs()
    jobs += fetch_weworkremotely_jobs()
    for token in greenhouse_tokens:
        jobs += fetch_greenhouse_jobs(token)
    return jobs
