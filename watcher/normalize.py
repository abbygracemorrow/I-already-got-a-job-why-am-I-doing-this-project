"""Convert one raw file (one source, one day) to the common set of columns.

Common columns: posting_id, source, source_id, employer, title, location,
department, posted_date, url. A column a source does not provide is "".
Every posting the board returned is kept, not only the ones in the role.
"""

from __future__ import annotations

import re
from datetime import date, timedelta

COMMON = ["posting_id", "source", "source_id", "employer", "title", "location",
          "department", "posted_date", "url"]


def _clean(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def _row(raw: dict, source_id, title, location="", department="", posted_date="", url=""):
    sid = _clean(source_id)
    return {
        "posting_id": f"{raw['source']}:{sid}",
        "source": raw["source"],
        "source_id": sid,
        "employer": raw["employer"],
        "title": _clean(title),
        "location": _clean(location),
        "department": _clean(department),
        "posted_date": posted_date or "",
        "url": url or "",
    }


# ---------------------------------------------------------------- Workday
_POSTED = re.compile(r"posted\s+(today|yesterday|(\d+)\+?\s+days?\s+ago)", re.I)
_N_LOCATIONS = re.compile(r"^\d+\s+locations?$", re.I)


def workday_posted_date(text: str, day: str) -> str:
    """Workday gives relative dates ("Posted 3 Days Ago"). Turn them into a date
    using the date of the raw file. "30+ Days Ago" is open-ended, so it is left empty."""
    m = _POSTED.search(text or "")
    if not m or "+" in (text or ""):
        return ""
    d = date.fromisoformat(day)
    word = m.group(1).lower()
    if word == "today":
        return d.isoformat()
    if word == "yesterday":
        return (d - timedelta(days=1)).isoformat()
    return (d - timedelta(days=int(m.group(2)))).isoformat()


def workday_source_id(path: str) -> str:
    # /job/Dallas-TX/Credit-Analyst-II_R-12345  ->  R-12345
    last = (path or "").rstrip("/").split("/")[-1]
    return last.rsplit("_", 1)[-1] if "_" in last else (path or "")


def workday_location(job: dict) -> str:
    text = _clean(job.get("locationsText"))
    if _N_LOCATIONS.match(text):
        parts = (job.get("externalPath") or "").split("/")
        primary = parts[2].replace("-", " ") if len(parts) > 2 else ""
        # Several locations: keep the first one, the job's primary location.
        return _clean(primary) if primary else text
    return text


def from_workday(raw: dict, day: str) -> list[dict]:
    host, tenant, site = _workday_parts(raw["url"])
    rows = []
    for page in raw.get("pages", []):
        for job in page.get("jobPostings") or []:
            path = job.get("externalPath") or ""
            if not path:
                continue
            rows.append(_row(
                raw, workday_source_id(path), job.get("title"),
                location=workday_location(job),
                posted_date=workday_posted_date(job.get("postedOn", ""), day),
                url=f"https://{host}/recruiting/{tenant}/{site}{path}",
            ))
    return rows


def _workday_parts(url: str):
    # https://wd5.myworkdaysite.com/wday/cxs/<tenant>/<site>/jobs
    m = re.match(r"https://([^/]+)/wday/cxs/([^/]+)/([^/]+)/jobs", url)
    return m.groups() if m else ("", "", "")


# ---------------------------------------------------------------- Oracle
def from_oracle(raw: dict, day: str) -> list[dict]:
    m = re.match(r"https://([^/]+)/", raw["url"])
    host = m.group(1) if m else ""
    site = raw.get("site") or ""
    rows = []
    for page in raw.get("pages", []):
        for item in page.get("items") or []:
            for job in item.get("requisitionList") or []:
                if not job.get("Id"):
                    continue
                loc = _clean(job.get("PrimaryLocation"))  # the primary location
                rows.append(_row(
                    raw, job["Id"], job.get("Title"), location=loc,
                    department=job.get("JobFamily") or "",
                    posted_date=(job.get("PostedDate") or "")[:10],
                    url=f"https://{host}/hcmUI/CandidateExperience/en/sites/{site}/job/{job['Id']}",
                ))
    return rows


# ---------------------------------------------------------------- Greenhouse
def from_greenhouse(raw: dict, day: str) -> list[dict]:
    rows = []
    for page in raw.get("pages", []):
        for job in page.get("jobs") or []:
            if job.get("id") is None:
                continue
            rows.append(_row(
                raw, job["id"], job.get("title"),
                location=(job.get("location") or {}).get("name", ""),
                posted_date=(job.get("first_published") or "")[:10],
                url=job.get("absolute_url", ""),
            ))
    return rows


# ---------------------------------------------------------------- SmartRecruiters
def from_smartrecruiters(raw: dict, day: str) -> list[dict]:
    company = raw["url"].rstrip("/").split("/")[-2]
    rows = []
    for page in raw.get("pages", []):
        for job in page.get("content") or []:
            if not job.get("id"):
                continue
            loc = job.get("location") or {}
            location = ", ".join(x for x in [loc.get("city"), loc.get("region")] if x)
            if loc.get("remote"):
                location = f"{location} (Remote)" if location else "Remote"
            rows.append(_row(
                raw, job["id"], job.get("name"), location=location,
                department=(job.get("department") or {}).get("label", ""),
                posted_date=(job.get("releasedDate") or "")[:10],
                url=f"https://jobs.smartrecruiters.com/{company}/{job['id']}",
            ))
    return rows


# ---------------------------------------------------------------- Aggregators
# For aggregator rows, employer is the hiring company and department shows the site
# the posting came from (e.g. "via LinkedIn").
def from_jsearch(raw: dict, day: str) -> list[dict]:
    rows = []
    for page in raw.get("pages", []):
        for job in page.get("data") or []:
            if not job.get("job_id"):
                continue
            place = ", ".join(x for x in [job.get("job_city"), job.get("job_state")] if x)
            if job.get("job_is_remote"):
                place = f"{place} (Remote)" if place else "Remote"
            r = _row(raw, job["job_id"], job.get("job_title"), location=place,
                     department=f"via {job['job_publisher']}" if job.get("job_publisher") else "",
                     posted_date=(job.get("job_posted_at_datetime_utc") or "")[:10],
                     url=job.get("job_apply_link") or job.get("job_google_link") or "")
            r["employer"] = _clean(job.get("employer_name")) or raw["employer"]
            rows.append(r)
    return rows


def from_adzuna(raw: dict, day: str) -> list[dict]:
    rows = []
    for page in raw.get("pages", []):
        for job in page.get("results") or []:
            if not job.get("id"):
                continue
            r = _row(raw, job["id"], job.get("title"),
                     location=(job.get("location") or {}).get("display_name", ""),
                     department=(job.get("category") or {}).get("label", ""),
                     posted_date=(job.get("created") or "")[:10],
                     url=job.get("redirect_url", ""))
            r["employer"] = _clean((job.get("company") or {}).get("display_name")) or raw["employer"]
            rows.append(r)
    return rows


CONVERTERS = {
    "jsearch": from_jsearch,
    "adzuna": from_adzuna,
    "workday": from_workday,
    "oracle": from_oracle,
    "greenhouse": from_greenhouse,
    "smartrecruiters": from_smartrecruiters,
}


def normalize(raw: dict, day: str) -> list[dict]:
    """All postings in one raw file, in the common columns, one row per posting_id."""
    rows = CONVERTERS[raw["ats"]](raw, day)
    seen, out = set(), []
    for r in rows:
        if r["posting_id"] not in seen and r["source_id"]:
            seen.add(r["posting_id"])
            out.append(r)
    return out
