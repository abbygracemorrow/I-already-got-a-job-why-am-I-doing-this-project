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

The location rule gives each posting its Dallas-area city ("area"), or none: Dallas and the cities
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


# Dallas-area cities, each with the area name the site shows. Neighborhoods
# ("Dallas, TX - Uptown", "Far North Dallas", ...) fall under Dallas.
AREAS = [
    ("Dallas", ("dallas", "dfw", "park cities", "highland park", "university park")),
    ("Irving / Las Colinas", ("irving", "las colinas")),
    ("Plano", ("plano",)),
    ("Richardson", ("richardson",)),
    ("Addison", ("addison",)),
    ("Frisco", ("frisco",)),
    ("Coppell", ("coppell",)),
    ("Carrollton", ("carrollton",)),
    ("Farmers Branch", ("farmers branch",)),
    ("Garland", ("garland",)),
    ("Grand Prairie", ("grand prairie",)),
    ("Westlake", ("westlake",)),
    ("Southlake", ("southlake",)),
    ("Allen", ("allen",)),
    ("McKinney", ("mckinney",)),
    ("Lewisville", ("lewisville",)),
    ("Fort Worth", ("fort worth", "ft worth", "ft. worth")),
]
_AREA_PATTERNS = [(name, re.compile(r"\b(" + "|".join(re.escape(w) for w in words) + r")\b", re.I))
                  for name, words in AREAS]
_ARLINGTON_TX = re.compile(r"\barlington\b[\s,\-]*(tx|texas)\b|\b(tx|texas)\b[\s,\-]*arlington\b", re.I)
_TEXAS = re.compile(r"\b(TX|Texas)\b", re.I)
_STATE_CODES = set("""AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT
NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN UT VT VA WA WV WI WY""".split())
_STATE_NAMES = re.compile(
    r"\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|"
    r"hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|"
    r"michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|"
    r"new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|"
    r"rhode island|south carolina|south dakota|tennessee|utah|vermont|virginia|washington|"
    r"west virginia|wisconsin|wyoming)\b", re.I)


def _other_state_only(loc: str) -> bool:
    """True when the location names a US state other than Texas and does not name Texas
    ("Dallas, AZ", "Dallas, Georgia", "Westlake, OH")."""
    if _TEXAS.search(loc):
        return False
    codes = set(re.findall(r"\b[A-Z]{2}\b", loc))  # state codes are written in capitals
    return bool(codes & _STATE_CODES) or bool(_STATE_NAMES.search(loc))


_REMOTE_LOCATION = re.compile(r"\b(remote|work from home|wfh|telecommut\w*|teletravail|virtual)\b", re.I)
_REMOTE_TITLE = re.compile(r"\b(remote|work from home|wfh|telecommut\w*)\b", re.I)


def is_remote(title: str, location: str) -> bool:
    """True when the posting is remote: the location (or title) says remote, virtual,
    work from home or telecommute. Remote postings are kept in the history but never
    shown as options on the site."""
    return bool(_REMOTE_LOCATION.search(location or "") or _REMOTE_TITLE.search(title or ""))


def dallas_area(location: str) -> str:
    """The Dallas-area city a location is in ("Dallas", "Plano", "Irving / Las Colinas", ...),
    or "" when it is not in the Dallas area (or is remote). When a location names several
    cities, the one written first wins."""
    loc = (location or "").replace("-", " ")
    if _REMOTE_LOCATION.search(loc) or _other_state_only(loc):
        return ""
    if _ARLINGTON_TX.search(loc):
        return "Arlington"
    best, at = "", len(loc) + 1
    for name, pat in _AREA_PATTERNS:
        m = pat.search(loc)
        if m and m.start() < at:
            best, at = name, m.start()
    return best


def in_dallas(location: str) -> bool:
    """True when the location is in the Dallas area (and not remote)."""
    return dallas_area(location) != ""
