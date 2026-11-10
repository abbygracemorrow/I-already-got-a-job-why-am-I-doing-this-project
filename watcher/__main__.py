"""Command line.

    python -m watcher run       # fetch every source, build, write status, open the issue
    python -m watcher build     # rebuild data/history.csv from data/raw only
    python -m watcher fetch     # fetch only (writes data/raw/<today>/ and data/runs/<today>.json)

Options: --data DIR (default: data), --only NAME[,NAME] (fetch a subset; for testing).
"""

from __future__ import annotations

import argparse
import gzip
import json
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from . import issue
from .build import write_history
from .fetch import fetch
from .normalize import normalize
from .sources import SOURCES
from .status import make_status, write_status


WORKERS = 6  # sources fetched at the same time (each source's pages stay sequential)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def do_fetch(data: Path, now: datetime, only: set[str] | None = None) -> dict:
    """Fetch every source into data/raw/<date>/. One failing source does not stop the run.
    A second run on the same day replaces that day's raw files."""
    day = now.strftime("%Y-%m-%d")
    tmp = data / "raw" / f".{day}.tmp"
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    chosen = [s for s in SOURCES if not only or s.name in only]
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(lambda s: _fetch_one(s, tmp, day), chosen))
    for entry in results:
        print(f"  {entry['name']:<14} {'ok' if entry['ok'] else 'FAILED':<6} "
              f"{entry['count']:>5}  {entry['seconds']:>6}s  {entry['error']}", flush=True)

    final = data / "raw" / day
    shutil.rmtree(final, ignore_errors=True)
    if any(tmp.iterdir()):
        tmp.rename(final)
    else:
        shutil.rmtree(tmp)
    run_time = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    run = {"date": day, "run_time": run_time, "first_run_time": run_time, "sources": results}
    log = data / "runs" / f"{day}.json"
    if log.exists():  # a second run the same day keeps the time of that day's first run
        earlier = json.loads(log.read_text())
        run["first_run_time"] = min(run_time, earlier.get("first_run_time") or earlier["run_time"])
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(json.dumps(run, indent=2) + "\n")
    return run


def _fetch_one(src, tmp: Path, day: str) -> dict:
    """Fetch one source and write its raw file. Never raises: errors are recorded."""
    t0 = time.time()
    entry = {"name": src.name, "employer": src.employer, "ats": src.ats,
             "search": src.search, "ok": False, "count": 0, "error": ""}
    try:
        raw = fetch(src)
        raw["fetched_at"] = utc_now().isoformat(timespec="seconds")
        count = len(normalize(raw, day))
        if count == 0:
            raise RuntimeError("board returned no postings")
        with gzip.open(tmp / f"{src.name}.json.gz", "wt", encoding="utf-8") as f:
            json.dump(raw, f, separators=(",", ":"), sort_keys=True)
        entry.update(ok=True, count=count)
    except Exception as exc:  # noqa: BLE001 - record and keep going
        entry["error"] = f"{type(exc).__name__}: {exc}"[:300]
    entry["seconds"] = round(time.time() - t0, 1)
    return entry


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="watcher")
    p.add_argument("command", choices=["run", "fetch", "build"])
    p.add_argument("--data", default="data")
    p.add_argument("--only", default="")
    a = p.parse_args(argv)
    data = Path(a.data)
    only = set(filter(None, a.only.split(","))) or None

    if a.command == "build":
        rows = write_history(data / "raw", data / "history.csv")
        print(f"history.csv: {len(rows)} postings")
        return 0

    now = utc_now()
    print(f"Fetching {len(SOURCES)} sources ({now:%Y-%m-%d %H:%M} UTC)")
    run = do_fetch(data, now, only)
    if a.command == "fetch":
        return 0

    rows = write_history(data / "raw", data / "history.csv")
    status = make_status(rows, data / "raw", run)
    write_status(status, data / "status.json")
    print(f"history.csv: {len(rows)} postings; open {status['open']}, "
          f"new {status['new_today']}, removed {status['removed_today']}")
    try:
        print("Issue:", issue.publish(rows, status))
    except Exception as exc:  # noqa: BLE001 - the commit should still happen
        print(f"Issue: FAILED {type(exc).__name__}: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
