"""Build data/history.csv from the raw files alone.

The build reads every data/raw/<date>/<source>.json.gz in date order and
replays the days. Running it again on the same raw files gives the same file,
and a change to a rule (title rule, converter) applies to every day.

Per day, per source that has a raw file that day:
  * a posting seen for the first time gets first_seen = that day
    (first_run = true when that day is the source's first raw file);
  * every posting the source lists gets last_seen = that day;
  * a removed posting that is listed again becomes open again, removed_date
    is cleared and first_seen stays as it was;
  * an open posting of that source that is not listed is marked removed with
    removed_date = that day.
A source with no raw file on a day (it failed) changes nothing that day.
"""

from __future__ import annotations

import csv
import gzip
import io
import json
import re
from pathlib import Path

from .normalize import normalize
from .rules import dallas_area, in_role, is_remote

COLUMNS = ["posting_id", "source", "source_id", "employer", "title", "location",
           "department", "posted_date", "url", "in_role", "first_run", "first_seen",
           "last_seen", "status", "removed_date", "in_dallas", "remote", "area"]

_DATE_DIR = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def raw_days(raw_dir: Path) -> list[str]:
    if not raw_dir.exists():
        return []
    return sorted(p.name for p in raw_dir.iterdir()
                  if p.is_dir() and _DATE_DIR.match(p.name) and any(p.glob("*.json.gz")))


def read_raw(path: Path) -> dict:
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return json.load(f)


def apply_day(history: dict, day: str, source: str, rows: list[dict], first_file: bool) -> None:
    """Update ``history`` (posting_id -> row) with one source's postings for one day."""
    listed = set()
    for r in rows:
        pid = r["posting_id"]
        listed.add(pid)
        h = history.get(pid)
        if h is None:
            h = {**r, "first_run": first_file, "first_seen": day,
                 "status": "open", "removed_date": ""}
            history[pid] = h
        else:
            posted = h.get("posted_date") or r.get("posted_date", "")
            h.update({k: r[k] for k in ("employer", "title", "location", "department", "url")})
            h["posted_date"] = posted
            if h["status"] == "removed":
                h["status"] = "open"
                h["removed_date"] = ""
        h["last_seen"] = day
    for pid, h in history.items():
        if h["source"] == source and h["status"] == "open" and pid not in listed:
            h["status"] = "removed"
            h["removed_date"] = day


def build_history(raw_dir: Path) -> list[dict]:
    history: dict[str, dict] = {}
    started: set[str] = set()
    for day in raw_days(raw_dir):
        for path in sorted((raw_dir / day).glob("*.json.gz")):
            raw = read_raw(path)
            source = raw["source"]
            rows = normalize(raw, day)
            apply_day(history, day, source, rows, first_file=source not in started)
            started.add(source)
    out = []
    for pid in sorted(history):
        h = history[pid]
        area = dallas_area(h["location"])
        out.append({**h, "in_role": in_role(h["title"]), "in_dallas": area != "",
                    "remote": is_remote(h["title"], h["location"]), "area": area})
    return out


def _fmt(v) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    return "" if v is None else str(v)


def to_csv(rows: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(COLUMNS)
    for r in rows:
        w.writerow([_fmt(r.get(c)) for c in COLUMNS])
    return buf.getvalue()


def write_history(raw_dir: Path, out_path: Path) -> list[dict]:
    rows = build_history(raw_dir)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(to_csv(rows), encoding="utf-8")
    return rows
