# 🎄 Dallas Credit Job Watcher

[![Tests](https://github.com/abbygracemorrow/I-already-got-a-job-why-am-I-doing-this-project/actions/workflows/tests.yml/badge.svg)](https://github.com/abbygracemorrow/I-already-got-a-job-why-am-I-doing-this-project/actions/workflows/tests.yml)
[![Daily run](https://github.com/abbygracemorrow/I-already-got-a-job-why-am-I-doing-this-project/actions/workflows/daily.yml/badge.svg)](https://github.com/abbygracemorrow/I-already-got-a-job-why-am-I-doing-this-project/actions/workflows/daily.yml)

**Live site:** https://abbygracemorrow.github.io/I-already-got-a-job-why-am-I-doing-this-project/

A tool that watches the job market for **credit analyst** roles in the **Dallas area**. Every
day, on its own, GitHub Actions pulls the open positions at 20 lenders from their applicant
tracking systems (plus LinkedIn, Glassdoor and other job sites through two job aggregators), compares them with the day before, records what is new and what is gone,
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
business intelligence, reporting, operations*. Matching ignores case and uses whole words.

**Dallas-area rule** (`dallas_area`, the `area` and `in_dallas` columns). Each posting gets the
Dallas-area city its location names, or none: Dallas (including neighborhoods such as Uptown,
Lakewood, Preston Hollow, Far North Dallas and the Park Cities), Irving / Las Colinas, Plano,
Richardson, Addison, Frisco, Coppell, Carrollton, Farmers Branch, Garland, Grand Prairie, Westlake,
Southlake, Allen, McKinney, Lewisville, Fort Worth, or Arlington (only when Texas is named). A location
that names another US state and not Texas (e.g. Dallas, AZ or Dallas, GA) is not in the Dallas area,
and neither is a remote one. `in_dallas` is true when `area` is not empty. The Browse page shows
Dallas-area credit roles by default, and its **Area** menu lists one entry per city with a count.

**Remote rule** (`is_remote`, the `remote` column). A posting is remote when its location says
*remote, virtual, work from home, WFH, telecommute* or *teletravail*, or its title says *remote,
work from home, WFH* or *telecommute*. Remote postings stay in `history.csv` (every posting the
board returns is kept) and in every count. The site keeps them out of the way: the Browse page
hides them unless **Include remote jobs** is checked, the Today page folds them under
**Show N remote postings** below the new and removed lists, and a remote posting is never "Dallas area".

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
| 21 | JSearch: postings from **LinkedIn, Glassdoor, Indeed, ZipRecruiter** and company sites (via Google for Jobs) | Job aggregator API (key) | `jsearch.p.rapidapi.com` | `credit analyst in Dallas, TX` |
| 22 | Adzuna: thousands of US job sites and recruiters | Job aggregator API (key) | `api.adzuna.com` | `credit analyst` near `Dallas, TX` (40 km) |

**Search terms.** JPMorgan Chase's board returns more than 5,000 postings (about 7,000), so it is
requested with the search term **`credit`**. Workday's public API stops paging at 2,000 results,
so the Workday boards at or above that limit (Capital One, Citi, PNC) are also requested with
**`credit`**. Every other board is read in full. If a Workday board without a search term ever
grows past 2,000 postings, the run still succeeds but records a note on that source (shown on the
Today page and in `data/status.json`) saying a search term is needed.

**Job aggregators (LinkedIn, Glassdoor and more).** LinkedIn and Glassdoor have no public job API,
and the project does not read web pages, so their postings come through two aggregators with an
API key. Each holds millions of jobs, so each is asked **one search a day** (terms in the table
above). For their rows, `employer` is the hiring company and `department` names the site the
posting came from (e.g. "via LinkedIn"). A search returns the top matches, so an aggregator posting
that drops out of the results is marked removed even if the job is still open somewhere.

The aggregators run only when their keys are set. Without a key they are left out of the run (not
counted as failed). To turn them on, save the keys as repository secrets
(**Settings → Secrets and variables → Actions → New repository secret**):

| Secret | Where to get it |
|--------|-----------------|
| `JSEARCH_API_KEY` | rapidapi.com → subscribe to the free plan of the JSearch API → copy the `X-RapidAPI-Key` |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | developer.adzuna.com → register → copy the Application ID and Key |

Keys are sent with each request but never written to the raw files, the data or the site.

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

Run the tests (GitHub Actions also runs them on every push, including each daily data commit,
which the daily workflow starts the Tests workflow for):

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
| `README.md` | This file: sources, title rule, commands and file list |
| `watcher/sources.py` | The watch list: every employer, its ATS, board and search term |
| `watcher/fetch.py` | Calls each board's JSON API (Workday, Oracle, Greenhouse, SmartRecruiters, JSearch, Adzuna) and returns the raw pages |
| `watcher/normalize.py` | Converts each source's raw file to the common columns |
| `watcher/rules.py` | The title rule (`in_role`) and the Dallas-area rule (`in_dallas`) |
| `watcher/build.py` | Builds `data/history.csv` from the raw files (first-seen / last-seen / removed logic) |
| `watcher/status.py` | Writes `data/status.json` |
| `watcher/issue.py` | Opens or updates the day's GitHub Issue and closes the previous one |
| `watcher/__main__.py` | Command line: `run`, `fetch`, `build` |
| `watcher/__init__.py` | Marks `watcher` as a Python package |
| `tests/test_normalize.py` | Tests the conversion of each source type to the common columns |
| `tests/test_rules.py` | Tests the title rule and the Dallas-area rule |
| `tests/test_build.py` | Tests first-seen, last-seen, removed, reopened, failed-source and rebuild logic |
| `.github/workflows/daily.yml` | Runs the pipeline every day at 12:00 UTC (6:00 am Dallas time) and commits the data |
| `.github/workflows/tests.yml` | Runs the tests on every push (and on each daily data commit, started by the daily run) |
| `data/raw/<date>/<source>.json.gz` | What each source returned that day, compressed |
| `data/runs/<date>.json` | The result of every source on that day's run |
| `data/history.csv` | One row per posting ever seen |
| `data/status.json` | Summary of the latest run |
| `index.html` | Today page: last run, source status, the counts (days with a successful run, open, new today, removed today, plus open credit jobs in Dallas), new and removed postings |
| `browse.html` | Browse page: open postings with role switch, filters, search, sort, apply links, shortlist |
| `market.html` | Market page: six findings computed in the browser from the history file |
| `assets/style.css` | Shared fonts, colors and layout (pink Christmas theme, plus its dark mode) |
| `assets/common.js` | Shared data loading, CSV parsing, date helpers, service-worker registration, and the bouncing candy cane in the top right (click it for Christmas mode: dark colors, Christmas lights down the sides and along the bottom of the window, snow, mistletoe with white fairy lights, a gingerbread village with Snoopy standing in the snow, Santa and his reindeer flying across the page, ornaments and a Santa hat on Snoopy; the site always opens in plain light mode with flowers and money) |
| `assets/charts.js` | Small SVG chart helpers with tooltips and table views |
| `assets/today.js` | Today page: counts, new and taken-down lists, countdown, days-of-history tracker, Dallas job picker, shortlist, Snoopy money rain |
| `assets/browse.js` | Browse page: role switch, filters (employer, area, days open), search, sort, shortlist |
| `assets/market.js` | Market page: the six findings and their charts |
| `assets/snoopy.png` | Snoopy mascot at the top of each page (click him on the Today page) |
| `manifest.webmanifest` | Web app manifest, so the site installs as an app |
| `sw.js` | Service worker: network first, cached copy when offline |
| `icons/icon-192.png`, `icons/icon-512.png` | Dollar-bill app icons used when the site is installed |
| `icons/favicon.svg`, `icons/favicon-32.png` | Dollar-bill tab icon (SVG, with a PNG fallback); also the days-of-history markers in light mode |
| `icons/ornament.svg` | Striped ornament: one per day in the days-of-history tracker in Christmas mode (dollar bills in light mode) |
| `icons/flower-garland.svg` | Flower garland at the top of the page banner (light mode) |
| `icons/garland.svg` | Mistletoe garland that replaces the flowers in Christmas mode |
| `icons/garland-lights.svg` | White fairy lights that twinkle on the mistletoe garland in Christmas mode |
| `icons/santa-hat.svg` | Santa hat Snoopy wears when the lights are on |
| `icons/gingerbread-village.svg` | Snowy gingerbread village along the bottom of the Today banner in Christmas mode |
| `icons/santa-sleigh.svg` | Santa, his sleigh and reindeer, who fly back and forth over the page in Christmas mode |
| `icons/candy-cane.svg` | The candy cane that turns dark mode and the lights on and off |
| `requirements-dev.txt` | Test dependency (pytest) |
| `.gitignore` | Keeps Python caches and half-written raw folders out of git |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

## Data columns

`data/history.csv`: `posting_id, source, source_id, employer, title, location, department,
posted_date, url, in_role, first_run, first_seen, last_seen, status, removed_date, in_dallas, remote, area`.
A column a source does not provide (for example `department` on Workday and Greenhouse) is left
empty. Workday shows relative posting dates ("Posted 3 Days Ago"); they are converted using the
date of the raw file, and "30+ Days Ago" is left empty. When a posting lists several locations
(Workday's "3 Locations", Oracle's secondary locations), `location` is its primary location.

`data/status.json`: `run_time, run_date, first_run_date, watching_since (UTC time of the first run), days_with_success, open, new_today,
removed_today, open_in_role, open_in_role_dallas, run_days (every date with a raw file), sources[] (name, employer, ats, ok, count, error, and a note when a Workday board is over its limit)`.
