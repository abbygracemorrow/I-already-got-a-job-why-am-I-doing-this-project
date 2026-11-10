"""Open (or update) the daily GitHub Issue and close the previous one.

The issue is titled with the run date (YYYY-MM-DD) and lists every new and
every removed posting, each with a link. Credit roles in the Dallas area are
listed first. When the lists do not fit in one issue body, the rest goes into
comments. A second run on the same day rewrites that day's issue.
"""

from __future__ import annotations

import json
import os
import urllib.request

LABEL = "daily-report"
API = "https://api.github.com"
BODY_LIMIT = 60000


def _line(r: dict) -> str:
    title = r["title"].replace("[", "(").replace("]", ")")
    loc = f" · {r['location']}" if r.get("location") else ""
    return f"- [{title}]({r['url']}) — {r['employer']}{loc}"


def _section(heading: str, rows: list[dict]) -> list[str]:
    if not rows:
        return [f"### {heading} (0)", "", "_None._", ""]
    return [f"### {heading} ({len(rows)})", "", *[_line(r) for r in rows], ""]


def compose(rows: list[dict], status: dict, site_url: str) -> tuple[str, list[str]]:
    """Return (body, extra comments) for the day's issue."""
    day = status["run_date"]
    new = [r for r in rows if r["first_seen"] == day and not r["first_run"]]
    gone = [r for r in rows if r["removed_date"] == day]
    key = lambda r: (r["employer"], r["title"])  # noqa: E731
    new.sort(key=key)
    gone.sort(key=key)
    focus = lambda rs: [r for r in rs if r["in_role"] and r["in_dallas"] and not r["remote"]]  # noqa: E731

    failed = [s["name"] for s in status["sources"] if not s["ok"]]
    head = [
        f"**Run:** {status['run_time']}  ",
        f"**New:** {status['new_today']} · **Removed:** {status['removed_today']} · "
        f"**Open:** {status['open']} · **Days with a successful run:** {status['days_with_success']}  ",
        f"**Sources OK:** {len(status['sources']) - len(failed)}/{len(status['sources'])}"
        + (f" (failed: {', '.join(failed)})" if failed else ""),
        "",
        f"Site: {site_url}" if site_url else "",
        "",
    ]
    lines = head
    lines += _section("New credit roles in the Dallas area", focus(new))
    lines += _section("Removed credit roles in the Dallas area", focus(gone))
    full = _section("All new postings", new) + _section("All removed postings", gone)

    body = "\n".join(lines + full)
    if len(body) <= BODY_LIMIT:
        return body, []
    body = "\n".join(lines + ["_The full lists of new and removed postings are in the comments below._"])
    comments, chunk = [], []
    for line in full:
        if sum(len(x) + 1 for x in chunk) + len(line) > BODY_LIMIT:
            comments.append("\n".join(chunk))
            chunk = []
        chunk.append(line)
    if chunk:
        comments.append("\n".join(chunk))
    return body, comments


class GitHub:
    def __init__(self, repo: str, token: str):
        self.repo, self.token = repo, token

    def call(self, method: str, path: str, data: dict | None = None):
        req = urllib.request.Request(
            API + path, method=method,
            data=json.dumps(data).encode() if data is not None else None,
            headers={"Authorization": f"Bearer {self.token}",
                     "Accept": "application/vnd.github+json",
                     "X-GitHub-Api-Version": "2022-11-28",
                     "User-Agent": "job-watcher"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode()
            return json.loads(text) if text else None


def publish(rows: list[dict], status: dict) -> str:
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    token = os.environ.get("GITHUB_TOKEN", "")
    if not repo or not token:
        return "skipped (GITHUB_REPOSITORY / GITHUB_TOKEN not set)"
    owner, name = repo.split("/", 1)
    site_url = f"https://{owner.lower()}.github.io/{name}/"
    body, comments = compose(rows, status, site_url)
    gh = GitHub(repo, token)
    title = status["run_date"]

    try:
        gh.call("POST", f"/repos/{repo}/labels", {"name": LABEL, "color": "0e8a16"})
    except Exception:  # noqa: BLE001 - label already exists
        pass

    issues = gh.call("GET", f"/repos/{repo}/issues?labels={LABEL}&state=all&per_page=100") or []
    today = next((i for i in issues if i["title"] == title and "pull_request" not in i), None)
    if today:
        number = today["number"]
        gh.call("PATCH", f"/repos/{repo}/issues/{number}", {"body": body, "state": "open"})
        for c in gh.call("GET", f"/repos/{repo}/issues/{number}/comments?per_page=100") or []:
            gh.call("DELETE", f"/repos/{repo}/issues/comments/{c['id']}")
    else:
        number = gh.call("POST", f"/repos/{repo}/issues",
                         {"title": title, "body": body, "labels": [LABEL]})["number"]
    for text in comments:
        gh.call("POST", f"/repos/{repo}/issues/{number}/comments", {"body": text})

    for i in issues:
        if i["state"] == "open" and i["number"] != number and "pull_request" not in i:
            gh.call("PATCH", f"/repos/{repo}/issues/{i['number']}",
                    {"state": "closed", "state_reason": "completed"})
    return f"issue #{number}"
