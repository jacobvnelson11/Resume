"""Job connectors -- official, documented APIs/feeds only (PRD section 9), no scraping."""
import json
import re

import feedparser
import ftfy
import requests


def _json(resp: requests.Response):
    """requests' r.json() can mis-detect encoding and mangle non-ASCII characters
    (curly quotes, accents, em dashes) when a server doesn't send a charset header.
    Decoding the raw bytes as UTF-8 explicitly avoids garbled titles/descriptions."""
    return json.loads(resp.content.decode("utf-8", errors="replace"))


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

    data = _json(resp)
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

    data = _json(resp)
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
                # RemoteOK returns 0 (not null) for "salary not disclosed" -- treat that as unknown,
                # not as a literal $0 salary that would otherwise fail every floor check.
                "salary_min": job.get("salary_min") or None,
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


def fetch_remotive_jobs() -> list[dict]:
    """Remotive's free API has dedicated marketing/sales categories (unlike RemoteOK's
    all-categories firehose), which is where most of our real match volume comes from."""
    jobs = []
    for category in ["marketing", "sales-business"]:
        try:
            resp = requests.get(
                f"https://remotive.com/api/remote-jobs?category={category}",
                timeout=15,
            )
            resp.raise_for_status()
        except Exception as e:
            print(f"[remotive] category '{category}' fetch failed: {e}")
            continue

        data = _json(resp)
        for job in data.get("jobs", []):
            salary_min = None
            salary_text = job.get("salary") or ""
            m = re.search(r"\$(\d{2,3}),?(\d{3})", salary_text)
            if m:
                salary_min = int(m.group(1) + m.group(2))

            jobs.append(
                {
                    "external_id": str(job["id"]),
                    "title": job["title"],
                    "company": job.get("company_name", "Unknown"),
                    "source": "remotive",
                    "url": job.get("url"),
                    "remote_text": "remote",
                    "description": strip_html(job.get("description", "")),
                    "salary_min": salary_min,
                    "posted_at": job.get("publication_date"),
                }
            )
    return jobs


def fetch_all_jobs(greenhouse_tokens: list[str]) -> list[dict]:
    jobs = []
    jobs += fetch_remoteok_jobs()
    # We Work Remotely dropped out per Jacob's report: several of its listings
    # require a paid WWR subscription just to reach the apply step, which
    # defeats the point. fetch_weworkremotely_jobs() is left in place below in
    # case that changes, but it's not called here.
    jobs += fetch_remotive_jobs()
    for token in greenhouse_tokens:
        jobs += fetch_greenhouse_jobs(token)

    # Belt-and-suspenders text cleanup: some feeds/APIs mangle encoding in ways
    # that survive per-source fixes (curly quotes/dashes becoming "â€™" etc.).
    for job in jobs:
        job["title"] = ftfy.fix_text(job["title"])
        job["company"] = ftfy.fix_text(job["company"])
        job["description"] = ftfy.fix_text(job["description"])

    return jobs
