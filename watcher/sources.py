"""The watch list: every employer the tool reads, and how to reach its job board.

Each source is read through the applicant tracking system (ATS) that hosts the
employer's board. Every endpoint below returns JSON to a request made with no
login.

Search terms: Workday's public job API stops paging at 2,000 results, and the
course rubric asks for a search term on any board above 5,000 postings. The
boards that are larger than those limits are requested with the search term
"credit" (see ``search``); every other board is requested in full.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Source:
    name: str  # short id, used in file names and posting_id
    employer: str
    ats: str  # workday | oracle | greenhouse | smartrecruiters | jsearch | adzuna
    config: dict = field(default_factory=dict)
    search: str = ""  # search term sent to the board ("" = whole board)
    needs: tuple = ()  # environment variables (API keys) the source needs to run

    def enabled(self, env=None) -> bool:
        import os
        env = os.environ if env is None else env
        return all(env.get(k) for k in self.needs)


def _wd(name, employer, dc, tenant, site, search=""):
    return Source(name, employer, "workday",
                  {"host": f"{dc}.myworkdaysite.com", "tenant": tenant, "site": site},
                  search)


SOURCES: list[Source] = [
    # --- Workday (public "cxs" JSON API) ---
    _wd("bankofamerica", "Bank of America", "wd1", "ghr", "Lateral-US"),
    _wd("capitalone", "Capital One", "wd12", "capitalone", "Capital_One", search="credit"),
    _wd("citi", "Citi", "wd5", "citi", "2", search="credit"),
    _wd("wellsfargo", "Wells Fargo", "wd1", "wf", "WellsFargoJobs"),
    _wd("santander", "Santander US", "wd3", "santander", "SantanderCareers"),
    _wd("texascapital", "Texas Capital", "wd12", "texascapitalbank", "Careers"),
    _wd("frost", "Frost Bank", "wd5", "frostbank", "External"),
    _wd("pnc", "PNC", "wd5", "pnc", "External", search="credit"),
    _wd("truist", "Truist", "wd1", "truist", "Careers"),
    _wd("usbank", "U.S. Bank", "wd1", "usbank", "US_Bank_Careers"),
    _wd("fifththird", "Fifth Third Bank", "wd5", "fifththird", "53careers"),
    _wd("keybank", "KeyBank", "wd5", "keybank", "External_Career_Site"),
    _wd("regions", "Regions Bank", "wd5", "regions", "Regions_Careers"),
    _wd("bmo", "BMO", "wd3", "bmo", "External"),
    _wd("mufg", "MUFG", "wd3", "mufgub", "MUFG-Careers"),
    # --- Oracle Recruiting Cloud (hcmRestApi JSON) ---
    Source("jpmorgan", "JPMorgan Chase", "oracle",
           {"host": "jpmc.fa.oraclecloud.com", "site": "CX_1001"}, search="credit"),
    Source("goldmansachs", "Goldman Sachs", "oracle",
           {"host": "hdpc.fa.us2.oraclecloud.com", "site": "LateralHiring"}),
    # --- Greenhouse (boards-api JSON) ---
    Source("sofi", "SoFi", "greenhouse", {"token": "sofi"}),
    Source("carvana", "Carvana", "greenhouse", {"token": "carvana"}),
    # --- SmartRecruiters (public postings API) ---
    Source("experian", "Experian", "smartrecruiters", {"company": "Experian"}),
    # --- Job aggregators with an API key (off until the key is saved as a GitHub secret) ---
    # JSearch reads Google for Jobs, which lists postings from LinkedIn, Glassdoor, Indeed,
    # ZipRecruiter and company sites. One search a day keeps it inside the free plan.
    Source("jsearch", "JSearch (LinkedIn, Glassdoor, Indeed …)", "jsearch",
           {"query": "credit analyst in Dallas, TX", "num_pages": 3},
           search="credit analyst in Dallas, TX", needs=("JSEARCH_API_KEY",)),
    # Adzuna aggregates thousands of US job sites and recruiters.
    Source("adzuna", "Adzuna (job sites and recruiters)", "adzuna",
           {"what": "credit analyst", "where": "Dallas, TX", "distance_km": 40, "max_pages": 5},
           search="credit analyst / Dallas, TX", needs=("ADZUNA_APP_ID", "ADZUNA_APP_KEY")),
]

AGGREGATORS = {"jsearch", "adzuna"}

SOURCES_BY_NAME = {s.name: s for s in SOURCES}
