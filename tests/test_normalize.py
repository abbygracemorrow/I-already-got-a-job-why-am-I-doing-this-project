"""Conversion of each source type to the common columns."""

from watcher.normalize import COMMON, normalize, workday_posted_date, workday_source_id

DAY = "2026-11-10"


def test_workday():
    raw = {
        "source": "frost", "employer": "Frost Bank", "ats": "workday",
        "url": "https://wd5.myworkdaysite.com/wday/cxs/frostbank/External/jobs",
        "pages": [{"total": 2, "jobPostings": [
            {"title": "Credit Analyst II", "externalPath": "/job/Dallas-TX/Credit-Analyst-II_R-1001",
             "locationsText": "Dallas, TX", "postedOn": "Posted 3 Days Ago", "bulletFields": ["R-1001"]},
            {"title": "Teller", "externalPath": "/job/Plano-TX/Teller_R-1002",
             "locationsText": "3 Locations", "postedOn": "Posted 30+ Days Ago"},
            {"title": "Duplicate", "externalPath": "/job/Dallas-TX/Credit-Analyst-II_R-1001"},
        ]}],
    }
    rows = normalize(raw, DAY)
    assert len(rows) == 2
    a, b = rows
    assert list(a) == COMMON
    assert a["posting_id"] == "frost:R-1001"
    assert a["source_id"] == "R-1001"
    assert a["employer"] == "Frost Bank"
    assert a["location"] == "Dallas, TX"
    assert a["posted_date"] == "2026-11-07"
    assert a["department"] == ""
    assert a["url"] == ("https://wd5.myworkdaysite.com/recruiting/frostbank/External"
                        "/job/Dallas-TX/Credit-Analyst-II_R-1001")
    assert b["location"] == "Plano TX"
    assert b["posted_date"] == ""


def test_workday_helpers():
    assert workday_posted_date("Posted Today", DAY) == DAY
    assert workday_posted_date("Posted Yesterday", DAY) == "2026-11-09"
    assert workday_posted_date("Posted 30+ Days Ago", DAY) == ""
    assert workday_source_id("/job/X/Some-Title_JR123") == "JR123"


def test_oracle():
    raw = {
        "source": "jpmorgan", "employer": "JPMorgan Chase", "ats": "oracle", "site": "CX_1001",
        "url": "https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions",
        "pages": [{"items": [{"TotalJobsCount": 1, "requisitionList": [
            {"Id": "210001", "Title": "Credit Risk Analyst", "PostedDate": "2026-11-08",
             "PrimaryLocation": "Plano, TX, United States", "JobFamily": "Credit",
             "secondaryLocations": [{"Name": "Dallas"}]},
        ]}]}],
    }
    (r,) = normalize(raw, DAY)
    assert r["posting_id"] == "jpmorgan:210001"
    assert r["title"] == "Credit Risk Analyst"
    assert r["location"] == "Plano, TX, United States"
    assert r["department"] == "Credit"
    assert r["posted_date"] == "2026-11-08"
    assert r["url"] == ("https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/"
                        "CX_1001/job/210001")


def test_greenhouse():
    raw = {
        "source": "sofi", "employer": "SoFi", "ats": "greenhouse",
        "url": "https://boards-api.greenhouse.io/v1/boards/sofi/jobs",
        "pages": [{"jobs": [
            {"id": 8004952003, "title": "  Credit  Analyst ", "location": {"name": "TX - Frisco"},
             "absolute_url": "https://sofi.com/careers/job/8004952003",
             "first_published": "2026-11-01T10:00:00-04:00"},
        ]}],
    }
    (r,) = normalize(raw, DAY)
    assert r["posting_id"] == "sofi:8004952003"
    assert r["title"] == "Credit Analyst"
    assert r["location"] == "TX - Frisco"
    assert r["posted_date"] == "2026-11-01"
    assert r["department"] == ""
    assert r["url"] == "https://sofi.com/careers/job/8004952003"


def test_smartrecruiters():
    raw = {
        "source": "experian", "employer": "Experian", "ats": "smartrecruiters",
        "url": "https://api.smartrecruiters.com/v1/companies/Experian/postings",
        "pages": [{"totalFound": 1, "content": [
            {"id": "744000160747449", "name": "Credit Analyst", "releasedDate": "2026-11-10T00:03:54.901Z",
             "location": {"city": "Allen", "region": "TX", "remote": False},
             "department": {"label": "Risk"}},
        ]}],
    }
    (r,) = normalize(raw, DAY)
    assert r["posting_id"] == "experian:744000160747449"
    assert r["location"] == "Allen, TX"
    assert r["department"] == "Risk"
    assert r["posted_date"] == "2026-11-10"
    assert r["url"] == "https://jobs.smartrecruiters.com/Experian/744000160747449"


def test_jsearch():
    raw = {
        "source": "jsearch", "employer": "JSearch", "ats": "jsearch",
        "url": "https://jsearch.p.rapidapi.com/search?query=credit+analyst",
        "pages": [{"status": "OK", "data": [
            {"job_id": "abc==", "job_title": "Credit Analyst", "employer_name": "Comerica Bank",
             "job_city": "Dallas", "job_state": "TX", "job_is_remote": False, "job_publisher": "LinkedIn",
             "job_apply_link": "https://www.linkedin.com/jobs/view/1", "job_posted_at_datetime_utc": "2026-11-08T14:00:00.000Z"},
            {"job_id": "def==", "job_title": "Credit Analyst", "employer_name": "Acme",
             "job_city": None, "job_state": None, "job_is_remote": True, "job_publisher": "Glassdoor",
             "job_apply_link": "https://www.glassdoor.com/job/2"},
        ]}],
    }
    a, b = normalize(raw, DAY)
    assert a["posting_id"] == "jsearch:abc=="
    assert a["employer"] == "Comerica Bank"
    assert a["location"] == "Dallas, TX"
    assert a["department"] == "via LinkedIn"
    assert a["posted_date"] == "2026-11-08"
    assert a["url"] == "https://www.linkedin.com/jobs/view/1"
    assert b["location"] == "Remote"
    assert b["department"] == "via Glassdoor"
    assert b["posted_date"] == ""


def test_adzuna():
    raw = {
        "source": "adzuna", "employer": "Adzuna", "ats": "adzuna",
        "url": "https://api.adzuna.com/v1/api/jobs/us/search/1?what=credit+analyst",
        "pages": [{"count": 1, "results": [
            {"id": "4412", "title": "Commercial Credit Analyst", "company": {"display_name": "Veritex Bank"},
             "location": {"display_name": "Dallas, Dallas County"}, "category": {"label": "Accounting & Finance Jobs"},
             "created": "2026-11-07T09:00:00Z", "redirect_url": "https://www.adzuna.com/details/4412"},
        ]}],
    }
    (r,) = normalize(raw, DAY)
    assert r["posting_id"] == "adzuna:4412"
    assert r["employer"] == "Veritex Bank"
    assert r["location"] == "Dallas, Dallas County"
    assert r["department"] == "Accounting & Finance Jobs"
    assert r["posted_date"] == "2026-11-07"
    assert r["url"] == "https://www.adzuna.com/details/4412"


def test_aggregators_need_keys():
    from watcher.sources import SOURCES_BY_NAME
    js, az = SOURCES_BY_NAME["jsearch"], SOURCES_BY_NAME["adzuna"]
    assert not js.enabled({}) and js.enabled({"JSEARCH_API_KEY": "x"})
    assert not az.enabled({"ADZUNA_APP_ID": "x"})
    assert az.enabled({"ADZUNA_APP_ID": "x", "ADZUNA_APP_KEY": "y"})
    assert SOURCES_BY_NAME["frost"].enabled({})


def test_saved_urls_hold_no_keys(monkeypatch):
    import watcher.fetch as f
    from watcher.sources import SOURCES_BY_NAME
    monkeypatch.setenv("ADZUNA_APP_ID", "SECRET_ID")
    monkeypatch.setenv("ADZUNA_APP_KEY", "SECRET_KEY")
    monkeypatch.setenv("JSEARCH_API_KEY", "SECRET_JS")
    seen = []
    monkeypatch.setattr(f, "_request", lambda url, body=None, extra_headers=None: seen.append(url) or
                        {"count": 0, "results": [], "status": "OK", "data": []})
    out = [f.fetch(SOURCES_BY_NAME["adzuna"]), f.fetch(SOURCES_BY_NAME["jsearch"])]
    text = str(out)
    assert "SECRET" not in text
    assert "SECRET_ID" in seen[0]  # the key is sent, just never saved
