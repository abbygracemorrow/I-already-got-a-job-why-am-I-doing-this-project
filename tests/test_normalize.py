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
    assert b["location"] == "Plano TX (+2 more)"
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
    assert r["location"] == "Plano, TX, United States (+1 more)"
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
