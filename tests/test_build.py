"""First-seen, last-seen, removed and reopened logic, built from raw files."""

import gzip
import json

from watcher.build import COLUMNS, build_history, to_csv, write_history


def gh_raw(source, jobs):
    return {"source": source, "employer": source.title(), "ats": "greenhouse",
            "url": f"https://boards-api.greenhouse.io/v1/boards/{source}/jobs",
            "pages": [{"jobs": [{"id": i, "title": t, "location": {"name": "Dallas, TX"},
                                 "absolute_url": f"https://x/{i}"} for i, t in jobs]}]}


def put(raw_dir, day, raw):
    d = raw_dir / day
    d.mkdir(parents=True, exist_ok=True)
    with gzip.open(d / f"{raw['source']}.json.gz", "wt") as f:
        json.dump(raw, f)


def by_id(rows):
    return {r["posting_id"]: r for r in rows}


def test_first_seen_last_seen_removed_reopened(tmp_path):
    raw = tmp_path / "raw"
    put(raw, "2026-11-01", gh_raw("a", [(1, "Credit Analyst"), (2, "Teller")]))
    put(raw, "2026-11-02", gh_raw("a", [(1, "Credit Analyst"), (3, "Credit Underwriter")]))
    put(raw, "2026-11-03", gh_raw("a", [(1, "Credit Analyst")]))
    put(raw, "2026-11-04", gh_raw("a", [(1, "Credit Analyst"), (2, "Teller")]))
    h = by_id(build_history(raw))

    one, two, three = h["a:1"], h["a:2"], h["a:3"]
    assert (one["first_seen"], one["last_seen"], one["status"], one["first_run"]) == \
        ("2026-11-01", "2026-11-04", "open", True)
    assert one["in_role"] is True and two["in_role"] is False

    # 2 removed on 11-02, reopened on 11-04 with first_seen unchanged
    assert (two["first_seen"], two["last_seen"], two["status"], two["removed_date"]) == \
        ("2026-11-01", "2026-11-04", "open", "")

    # 3 is new on 11-02 (not first run), removed on 11-03
    assert three["first_run"] is False
    assert (three["first_seen"], three["last_seen"], three["status"], three["removed_date"]) == \
        ("2026-11-02", "2026-11-02", "removed", "2026-11-03")


def test_failed_source_day_changes_nothing(tmp_path):
    raw = tmp_path / "raw"
    put(raw, "2026-11-01", gh_raw("a", [(1, "X")]))
    put(raw, "2026-11-01", gh_raw("b", [(9, "Y")]))
    put(raw, "2026-11-02", gh_raw("a", [(1, "X")]))  # b failed: no raw file
    h = by_id(build_history(raw))
    assert h["b:9"]["status"] == "open"
    assert h["b:9"]["last_seen"] == "2026-11-01"
    assert h["a:1"]["last_seen"] == "2026-11-02"


def test_first_run_is_per_source(tmp_path):
    raw = tmp_path / "raw"
    put(raw, "2026-11-01", gh_raw("a", [(1, "X")]))
    put(raw, "2026-11-03", gh_raw("a", [(1, "X")]))
    put(raw, "2026-11-03", gh_raw("b", [(5, "Y")]))  # b starts later
    put(raw, "2026-11-04", gh_raw("b", [(5, "Y"), (6, "Z")]))
    h = by_id(build_history(raw))
    assert h["b:5"]["first_run"] is True
    assert h["b:6"]["first_run"] is False


def test_rebuild_is_identical_and_sorted(tmp_path):
    raw = tmp_path / "raw"
    put(raw, "2026-11-01", gh_raw("b", [(2, "X"), (10, "Y")]))
    put(raw, "2026-11-01", gh_raw("a", [(7, "Z")]))
    out = tmp_path / "history.csv"
    write_history(raw, out)
    first = out.read_text()
    write_history(raw, out)
    assert out.read_text() == first
    lines = first.splitlines()
    assert lines[0].split(",") == COLUMNS
    ids = [line.split(",")[0] for line in lines[1:]]
    assert ids == sorted(ids)
    assert to_csv([]) == ",".join(COLUMNS) + "\n"


def test_second_run_same_day_keeps_first_run_time(tmp_path, monkeypatch):
    from datetime import datetime, timezone
    import watcher.__main__ as cli

    monkeypatch.setattr(cli, "SOURCES", [])
    data = tmp_path / "data"
    put(data / "raw", "2026-11-10", gh_raw("a", [(1, "X")]))
    cli.do_fetch(data, datetime(2026, 11, 10, 0, 39, tzinfo=timezone.utc))
    run = cli.do_fetch(data, datetime(2026, 11, 10, 12, 23, tzinfo=timezone.utc))
    assert run["run_time"] == "2026-11-10T12:23:00Z"
    assert run["first_run_time"] == "2026-11-10T00:39:00Z"
