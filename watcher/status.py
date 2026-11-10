"""Write data/status.json, the summary of the latest run."""

from __future__ import annotations

import json
from pathlib import Path

from .build import raw_days


def make_status(rows: list[dict], raw_dir: Path, run: dict) -> dict:
    """``run`` is the run log: {"date", "run_time", "sources": [{name, ok, count, error}]}."""
    day = run["date"]
    days = raw_days(raw_dir)
    return {
        "run_time": run["run_time"],
        "run_date": day,
        "first_run_date": days[0] if days else None,
        "days_with_success": len(days),
        "open": sum(1 for r in rows if r["status"] == "open"),
        "new_today": sum(1 for r in rows if r["first_seen"] == day and not r["first_run"]),
        "removed_today": sum(1 for r in rows if r["removed_date"] == day),
        "open_in_role": sum(1 for r in rows if r["status"] == "open" and r["in_role"]),
        "open_in_role_dallas": sum(1 for r in rows if r["status"] == "open"
                                   and r["in_role"] and r["in_dallas"]),
        "sources": [{k: s.get(k) for k in ("name", "employer", "ats", "ok", "count", "error")}
                    for s in run["sources"]],
    }


def write_status(status: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
