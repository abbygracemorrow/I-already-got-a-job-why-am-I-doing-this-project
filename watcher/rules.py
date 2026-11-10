"""The title rule (is a posting in my role?) and the Dallas-area location rule.

Role: credit analyst. A title is in the role when it names credit analysis or
credit underwriting work and is not a job that only mentions credit (card
sales, collections, customer service, software, internships, senior
leadership).

The rule, in words:
  IN  if the title contains "credit" together with one of
      analyst, analysis, analytics, underwriter, underwriting, risk, review,
      portfolio, officer, associate;
      or contains "underwriter" / "underwriting";
      or contains "loan review" or "credit review".
  OUT if the title also contains any of
      intern, internship, summer, co-op, teller, customer service,
      representative, sales, collector, collections, recovery, fraud,
      engineer, developer, software, data scientist, call center,
      managing director, head of, chief, director, insurance, card services,
      trader, trading, quantitative, data owner, business intelligence,
      reporting, operations.

The location rule marks postings in the Dallas area: Dallas and the cities
that touch it or sit in its core business corridors (Irving/Las Colinas,
Plano, Richardson, Addison, Frisco, Coppell, Carrollton, Farmers Branch,
Garland, Grand Prairie, Westlake, Southlake, Allen, McKinney, Lewisville,
Fort Worth, Arlington TX). A remote location is never in the Dallas area.

The remote rule marks a posting remote when its location says remote, virtual,
work from home, WFH, telecommute or teletravail, or its title says remote, work
from home, WFH or telecommute. Remote postings stay in the history (the board
returned them) but the site never lists them.
"""

from __future__ import annotations

import re

_CREDIT_WORK = re.compile(
    r"\bcredit\b.*\b(analysts?|analysis|analytics|underwriters?|underwriting|risk|review|"
    r"portfolio|officers?|associates?)\b"
    r"|\b(analysts?|analysis|analytics|underwriters?|underwriting|risk|review|portfolio|"
    r"officers?|associates?)\b.*\bcredit\b",
    re.I,
)
_UNDERWRITING = re.compile(r"\bunderwrit(er|ers|ing)\b", re.I)
_LOAN_REVIEW = re.compile(r"\b(loan|credit) review\b", re.I)
_EXCLUDE = re.compile(
    r"\b(intern|internship|summer|co-?op|teller|customer service|representative|sales|"
    r"collector|collections|recovery|fraud|engineer|engineering|developer|software|"
    r"data scientist|call center|managing director|head of|chief|director|insurance|"
    r"card services|trader|trading|quantitative|data owner|business intelligence|reporting|operations)\b",
    re.I,
)


def in_role(title: str) -> bool:
    """True when the title is a credit analyst / credit underwriting job."""
    t = title or ""
    if _EXCLUDE.search(t):
        return False
    return bool(_CREDIT_WORK.search(t) or _UNDERWRITING.search(t) or _LOAN_REVIEW.search(t))


_DFW_CITIES = (
    "dallas", "irving", "las colinas", "plano", "richardson", "addison", "frisco",
    "coppell", "carrollton", "farmers branch", "garland", "grand prairie", "westlake",
    "southlake", "allen", "mckinney", "lewisville", "fort worth", "ft worth",
    "ft. worth", "dfw",
)
_DFW = re.compile(r"\b(" + "|".join(re.escape(c) for c in _DFW_CITIES) + r")\b", re.I)
_ARLINGTON_TX = re.compile(r"\barlington\b[\s,\-]*(tx|texas)\b|\b(tx|texas)\b[\s,\-]*arlington\b", re.I)
_TEXAS = re.compile(r"\b(tx|texas)\b", re.I)
# States that share a city name with the list above (Dallas GA, Westlake OH/CA/LA, ...).
_NOT_TEXAS = re.compile(
    r"\b(ga|georgia|pa|pennsylvania|or|oregon|nc|north carolina|oh|ohio|la|louisiana|"
    r"ca|california|ky|kentucky|ia|iowa|mo|missouri|wi|wisconsin)\b",
    re.I,
)


_REMOTE_LOCATION = re.compile(r"\b(remote|work from home|wfh|telecommut\w*|teletravail|virtual)\b", re.I)
_REMOTE_TITLE = re.compile(r"\b(remote|work from home|wfh|telecommut\w*)\b", re.I)


def is_remote(title: str, location: str) -> bool:
    """True when the posting is remote: the location (or title) says remote, virtual,
    work from home or telecommute. Remote postings are kept in the history but never
    shown as options on the site."""
    return bool(_REMOTE_LOCATION.search(location or "") or _REMOTE_TITLE.search(title or ""))


def in_dallas(location: str) -> bool:
    """True when the location is in the Dallas area (and not remote)."""
    if _REMOTE_LOCATION.search(location or ""):
        return False
    loc = (location or "").replace("-", " ")
    if _ARLINGTON_TX.search(loc):
        return True
    m = _DFW.search(loc)
    if not m:
        return False
    # "Dallas, GA", "Allen, ..." etc.: when a non-Texas state is named and Texas is not, reject.
    if _NOT_TEXAS.search(loc) and not _TEXAS.search(loc):
        return False
    return True
