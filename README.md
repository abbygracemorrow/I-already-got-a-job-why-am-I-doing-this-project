# 🎄 Dallas Credit Job Watcher

[![Tests](https://github.com/abbygracemorrow/I-already-got-a-job-why-am-I-doing-this-project/actions/workflows/tests.yml/badge.svg)](https://github.com/abbygracemorrow/I-already-got-a-job-why-am-I-doing-this-project/actions/workflows/tests.yml)
[![Daily run](https://github.com/abbygracemorrow/I-already-got-a-job-why-am-I-doing-this-project/actions/workflows/daily.yml/badge.svg)](https://github.com/abbygracemorrow/I-already-got-a-job-why-am-I-doing-this-project/actions/workflows/daily.yml)

**Live site:** https://abbygracemorrow.github.io/I-already-got-a-job-why-am-I-doing-this-project/

A tool that watches the job market for **credit analyst** roles in the **Dallas area**. Every
day, on its own, GitHub Actions pulls the open positions at 20 lenders from their applicant
tracking systems, compares them with the day before, records what is new and what is gone,
opens a GitHub Issue with the changes, and publishes the result to the site.

## Role and title rule

**Role:** credit analyst (credit analysis, credit risk and credit underwriting work).

**Title rule** (`watcher/rules.py`, `in_role`). A posting is in the role when its title:

- contains **"credit"** together with one of *analyst, analysis, analytics, underwriter,
  underwriting, risk, review, portfolio, officer, associate*; **or**
- contains **"underwriter"** or **"underwriting"**; **or**
- contains **"loan review"** or **"credit review"**;

**and** the title does **not** contain any of *intern, internship, summer, co-op, teller,
customer service, representative, sales, collector, collections, recovery, fraud, engineer,
engineering, developer, software, data scientist, call center, managing director, head of,
chief, director, insurance, card services, trader, trading, quantitative, data owner,
business intelligence*. Matching ignores case and uses whole words.

**Dallas-area rule** (`in_dallas`, an extra column). The location names Dallas, Irving / Las
Colinas, Plano, Richardson, Addison, Frisco, Coppell, Carrollton, Farmers Branch, Garland, Grand
Prairie, Westlake, Southlake, Allen, McKinney, Lewisville, Fort Worth or DFW, or "Arlington, TX".
A location that names another state sharing a city name (e.g. Dallas, GA) is left out. The
Browse page shows Dallas-area credit roles by default.

## Sources

Every source returns JSON to a request made with no login.

| # | Employer | Applicant tracking system | Board | Search term |
|---|----------|---------------------------|-------|-------------|
| 1 | Bank of America | Workday | `ghr` / `Lateral-US` | — |
| 2 | Capital One | Workday | `capitalone` / `Capital_One` | `credit` |
| 3 | Citi | Workday | `citi` / `2` | `credit` |
| 4 | Wells Fargo | Workday | `wf` / `WellsFargoJobs` | — |
| 5 | Santander US | Workday | `santander` / `SantanderCareers` | — |
| 6 | Texas Capital | Workday | `texascapitalbank` / `Careers` | — |
| 7 | Frost Bank | Workday | `frostbank` / `External` | — |
| 8 | PNC | Workday | `pnc` / `External` | `credit` |
| 9 | Truist | Workday | `truist` / `Careers` | — |
| 10 | U.S. Bank | Workday | `usbank` / `US_Bank_Careers` | — |
| 11 | Fifth Third Bank | Workday | `fifththird` / `53careers` | — |
| 12 | KeyBank | Workday | `keybank` / `External_Career_Site` | — |
| 13 | Regions Bank | Workday | `regions` / `Regions_Careers` | — |
| 14 | BMO | Workday | `bmo` / `External` | — |
| 15 | MUFG | Workday | `mufgub` / `MUFG-Careers` | — |
| 16 | JPMorgan Chase | Oracle Recruiting Cloud | `jpmc` / `CX_1001` | `credit` |
| 17 | Goldman Sachs | Oracle Recruiting Cloud | `hdpc` / `LateralHiring` | — |
| 18 | SoFi | Greenhouse | `sofi` | — |
| 19 | Carvana | Greenhouse | `carvana` | — |
| 20 | Experian | SmartRecruiters | `Experian` | — |

**Search terms.** JPMorgan Chase's board returns more than 5,000 postings (about 7,000), so it is
requested with the search term **`credit`**. Workday's public API stops paging at 2,000 results,
so the Workday boards at or above that limit (Capital One, Citi, PNC) are also requested with
**`credit`**. Every other board is read in full.

## Commands

Install the test dependency (the pipeline itself uses only the Python standard library):

```bash
pip install -r requirements-dev.txt
```

Build the history file from the raw files (no network needed):

```bash
python -m watcher build
```

Run the whole daily pipeline (fetch every source, build, write status, open the issue):

```bash
python -m watcher run
```

Run the tests:

```bash
python -m pytest
```

## How a daily run works

1. Every source is called; what it returns is saved, compressed, to
   `data/raw/<date>/<source>.json.gz`. A source that fails writes no raw file that day; the
   result of every source (ok, count, error) is saved to `data/runs/<date>.json` and
   `data/status.json`. One failing source does not stop the run.
2. `data/history.csv` is rebuilt from **all** raw files, day by day, so it depends on the raw
   files alone and a rule change applies to the whole history.
3. `data/status.json` is written.
4. A GitHub Issue titled with the date lists the new and removed postings (each with a link), and
   the previous day's issue is closed. It is opened every day, even with no changes.
5. The raw files, history and status are committed.

A second run on the same day replaces that day's raw files, rebuilds the history and updates
that day's issue, so each day counts once. Dates are UTC.

**History rules.** A posting seen for the first time gets that day as `first_seen` (`first_run`
is true when that day is its source's first raw file). Every posting its source lists that day
gets `last_seen` = that day. An open posting is marked `removed` with `removed_date` = that day
when its source has a raw file that day and no longer lists it. A removed posting that is listed
again becomes `open`, its `removed_date` is cleared and `first_seen` is unchanged. Rows are sorted
by `posting_id` (`<source>:<source's own id>`).

## Files

| Path | What it does |
|------|--------------|
| `watcher/sources.py` | The watch list: every employer, its ATS, board and search term |
| `watcher/fetch.py` | Calls each board's JSON API (Workday, Oracle, Greenhouse, SmartRecruiters) and returns the raw pages |
| `watcher/normalize.py` | Converts each source's raw file to the common columns |
| `watcher/rules.py` | The title rule (`in_role`) and the Dallas-area rule (`in_dallas`) |
| `watcher/build.py` | Builds `data/history.csv` from the raw files (first-seen / last-seen / removed logic) |
| `watcher/status.py` | Writes `data/status.json` |
| `watcher/issue.py` | Opens or updates the day's GitHub Issue and closes the previous one |
| `watcher/__main__.py` | Command line: `run`, `fetch`, `build` |
| `tests/test_normalize.py` | Tests the conversion of each source type to the common columns |
| `tests/test_rules.py` | Tests the title rule and the Dallas-area rule |
| `tests/test_build.py` | Tests first-seen, last-seen, removed, reopened, failed-source and rebuild logic |
| `.github/workflows/daily.yml` | Runs the pipeline every day at 12:23 UTC and commits the data |
| `.github/workflows/tests.yml` | Runs the tests on every push |
| `data/raw/<date>/<source>.json.gz` | What each source returned that day, compressed |
| `data/runs/<date>.json` | The result of every source on that day's run |
| `data/history.csv` | One row per posting ever seen |
| `data/status.json` | Summary of the latest run |
| `index.html` | Today page: last run, source status, the four counts, new and removed postings |
| `browse.html` | Browse page: open postings with role switch, filters, search, sort, apply links, shortlist |
| `market.html` | Market page: six findings computed in the browser from the history file |
| `assets/style.css` | Shared fonts, colors and layout (pink Christmas theme) |
| `assets/common.js` | Shared data loading, CSV parsing, date helpers, service-worker registration |
| `assets/charts.js` | Small SVG chart helpers with tooltips and table views |
| `assets/today.js`, `assets/browse.js`, `assets/market.js` | Code for each page |
| `assets/snoopy.png` | Optional mascot image at the top of each page (add your own; an ornament shows until then) |
| `manifest.webmanifest` | Web app manifest, so the site installs as an app |
| `sw.js` | Service worker: network first, cached copy when offline |
| `icons/` | App icons and the theme's tree, garland and ornament art |
| `requirements-dev.txt` | Test dependency (pytest) |
| `.gitignore` | Keeps Python caches and half-written raw folders out of git |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

## Data columns

`data/history.csv`: `posting_id, source, source_id, employer, title, location, department,
posted_date, url, in_role, first_run, first_seen, last_seen, status, removed_date, in_dallas`.
A column a source does not provide (for example `department` on Workday and Greenhouse) is left
empty. Workday shows relative posting dates ("Posted 3 Days Ago"); they are converted using the
date of the raw file, and "30+ Days Ago" is left empty.

`data/status.json`: `run_time, run_date, first_run_date, days_with_success, open, new_today,
removed_today, open_in_role, open_in_role_dallas, sources[] (name, employer, ats, ok, count, error)`.
