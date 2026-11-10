"""Call each source's job board and return what it sends back.

Every fetcher returns a dict holding the raw JSON pages the board returned.
That dict is what gets saved, compressed, to data/raw/<date>/<source>.json.gz.
Nothing here interprets the postings; normalize.py does that.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request

from .sources import Source

USER_AGENT = "job-watcher/1.0 (course project; daily read of public job boards)"
TIMEOUT = 45
RETRIES = 3

WORKDAY_PAGE = 20  # the most Workday returns per request
WORKDAY_MAX = 2000  # Workday stops paging past this offset
ORACLE_PAGE = 200
SMARTRECRUITERS_PAGE = 100
MAX_PAGES = 400  # safety stop for any one source


def _request(url: str, body: dict | None = None) -> dict:
    data = None
    headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    last = None
    for attempt in range(RETRIES):
        try:
            req = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001 - retried, then re-raised
            last = exc
            time.sleep(2 * (attempt + 1))
    raise last  # type: ignore[misc]


def fetch_workday(src: Source) -> dict:
    c = src.config
    url = f"https://{c['host']}/wday/cxs/{c['tenant']}/{c['site']}/jobs"
    pages, offset, total = [], 0, None
    while len(pages) < MAX_PAGES:
        page = _request(url, {"limit": WORKDAY_PAGE, "offset": offset,
                              "searchText": src.search, "appliedFacets": {}})
        if total is None:
            total = int(page.get("total") or 0)
        pages.append(page)
        offset += WORKDAY_PAGE
        if not page.get("jobPostings") or offset >= min(total, WORKDAY_MAX):
            break
        time.sleep(0.2)
    return {"url": url, "total": total, "pages": pages}


def fetch_oracle(src: Source) -> dict:
    c = src.config
    base = f"https://{c['host']}/hcmRestApi/resources/latest/recruitingCEJobRequisitions"
    pages, offset, total = [], 0, None
    while len(pages) < MAX_PAGES:
        finder = f"findReqs;siteNumber={c['site']},"
        if src.search:
            finder += f'keyword="{src.search}",'
        finder += f"limit={ORACLE_PAGE},offset={offset},sortBy=POSTING_DATES_DESC"
        url = (base + "?onlyData=true&expand=requisitionList.secondaryLocations&finder="
               + urllib.parse.quote(finder, safe=";=,"))
        page = _request(url)
        item = (page.get("items") or [{}])[0]
        if total is None:
            total = int(item.get("TotalJobsCount") or 0)
        pages.append(page)
        offset += ORACLE_PAGE
        if not item.get("requisitionList") or offset >= total:
            break
        time.sleep(0.2)
    return {"url": base, "site": c["site"], "total": total, "pages": pages}


def fetch_greenhouse(src: Source) -> dict:
    url = f"https://boards-api.greenhouse.io/v1/boards/{src.config['token']}/jobs"
    page = _request(url)
    return {"url": url, "total": len(page.get("jobs", [])), "pages": [page]}


def fetch_smartrecruiters(src: Source) -> dict:
    base = f"https://api.smartrecruiters.com/v1/companies/{src.config['company']}/postings"
    pages, offset, total = [], 0, None
    while len(pages) < MAX_PAGES:
        params = {"limit": SMARTRECRUITERS_PAGE, "offset": offset}
        if src.search:
            params["q"] = src.search
        page = _request(base + "?" + urllib.parse.urlencode(params))
        if total is None:
            total = int(page.get("totalFound") or 0)
        pages.append(page)
        offset += SMARTRECRUITERS_PAGE
        if not page.get("content") or offset >= total:
            break
    return {"url": base, "total": total, "pages": pages}


FETCHERS = {
    "workday": fetch_workday,
    "oracle": fetch_oracle,
    "greenhouse": fetch_greenhouse,
    "smartrecruiters": fetch_smartrecruiters,
}


def fetch(src: Source) -> dict:
    """Fetch one source. Raises on failure; the caller records the error."""
    result = FETCHERS[src.ats](src)
    return {"source": src.name, "employer": src.employer, "ats": src.ats,
            "search": src.search, **result}
