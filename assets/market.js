// Market page: six findings, every number computed here from data/history.csv.
(async function () {
  const app = document.getElementById("app");
  let rows;
  try { rows = await loadHistory(); } catch (e) { return showError(app, e); }

  const last = lastRunDate(rows);
  const first = rows.reduce((m, r) => (!m || r.first_seen < m ? r.first_seen : m), "");
  const days = first ? dayRange(first, last) : [];
  const short = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const notFirst = rows.filter(r => !r.first_run);
  const open = rows.filter(r => r.status === "open");
  const sum = a => a.reduce((x, y) => x + y, 0);
  const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? "" : "s"}`;

  // 1. New postings per day (first-run postings left out), all and in role.
  const newAll = days.map(d => notFirst.filter(r => r.first_seen === d).length);
  const newRole = days.map(d => notFirst.filter(r => r.first_seen === d && r.in_role).length);
  const tracked = days.slice(1); // the first day is all first-run postings
  const avgNew = tracked.length ? sum(newAll.slice(1)) / tracked.length : 0;
  const avgRole = tracked.length ? sum(newRole.slice(1)) / tracked.length : 0;

  // 2. Removed postings per day.
  const removedPerDay = days.map(d => rows.filter(r => r.removed_date === d).length);
  const totalRemoved = sum(removedPerDay);

  // 3. Open postings per employer as of the last run.
  const byEmp = {};
  open.forEach(r => { byEmp[r.employer] = (byEmp[r.employer] || 0) + 1; });
  const empItems = Object.entries(byEmp).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  // 4. Days open: removed, not first-run: removed_date - first_seen. Median.
  const durations = notFirst.filter(r => r.status === "removed" && r.removed_date).map(r => daysBetween(r.first_seen, r.removed_date));
  const med = median(durations);
  const maxDur = durations.length ? Math.max(...durations) : 0;
  const durBins = Array.from({ length: maxDur + 1 }, (_, i) => i);
  const durCounts = durBins.map(b => durations.filter(x => x === b).length);

  // 5. Share removed within seven days: not first-run, first seen >= 7 days before the last run.
  const cutoff = last ? dayStr(dayNum(last) - 7) : "";
  const cohort = notFirst.filter(r => r.first_seen <= cutoff);
  const quick = cohort.filter(r => r.removed_date && daysBetween(r.first_seen, r.removed_date) <= 7).length;
  const share = cohort.length ? quick / cohort.length : null;

  // 6. Top locations among open postings.
  const byLoc = {};
  open.forEach(r => { const l = r.location || "(not given)"; byLoc[l] = (byLoc[l] || 0) + 1; });
  const locItems = Object.entries(byLoc).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, 15);
  const dallasOpen = open.filter(r => r.in_dallas).length;

  const pct = x => (Math.round(x * 1000) / 10).toFixed(1) + "%";
  const one = v => (Math.round(v * 10) / 10).toLocaleString("en-US");
  const head = {
    s1: tracked.length
      ? `About ${one(avgNew)} new postings a day, ${one(avgRole)} of them credit roles`
      : "New postings start counting after the first day",
    s2: totalRemoved ? `${plural(totalRemoved, "posting")} taken down since watching began` : "No postings have been taken down yet",
    s3: empItems.length ? `${empItems[0].label} has the most open postings (${fmt(empItems[0].value)})` : "No open postings yet",
    s4: med == null ? "No tracked posting has closed yet" : `A posting stays up a median of ${one(med)} day${med === 1 ? "" : "s"}`,
    s5: share == null ? "Not enough history yet to measure quick removals" : `${pct(share)} of postings come down within a week`,
    s6: locItems.length ? `${locItems[0].label} leads open postings; ${fmt(dallasOpen)} are in the Dallas area` : "No open postings yet",
  };

  app.innerHTML = `
    <div class="card"><h2>1 · ${esc(head.s1)}</h2><p class="lede">Postings first seen each day, for all postings and for credit roles. Postings that were already open when a board was first watched are left out, because their start date is unknown, so the first day shows zero.
      Over ${plural(tracked.length, "day")} of tracking, ${fmt(sum(newAll))} new postings appeared, ${fmt(sum(newRole))} of them credit roles.</p><div id="c1"></div></div>
    <div class="card"><h2>2 · ${esc(head.s2)}</h2><p class="lede">Postings with a removed date on each day, meaning their board stopped listing them. A posting that comes back is reopened and drops out of this count.</p><div id="c2"></div></div>
    <div class="card"><h2>3 · ${esc(head.s3)}</h2><p class="lede">Open postings per employer as of the last run (${esc(prettyDate(last))}), ${fmt(open.length)} in all. Boards requested with the search term "credit" (JPMorgan Chase, Capital One, Citi, PNC) show only matching postings.</p><div id="c3"></div></div>
    <div class="card"><h2>4 · ${esc(head.s4)}</h2><p class="lede">For removed postings that were not already open on the first day, days open is the removed date minus the first-seen date. ${durations.length ? `Based on ${plural(durations.length, "removed posting")}; the median is ${one(med)} days.` : "This fills in as tracked postings close."}</p><div id="c4"></div></div>
    <div class="card"><h2>5 · ${esc(head.s5)}</h2><p class="lede">Among postings that were not already open on the first day and were first seen at least seven days before the last run (on or before ${esc(prettyDate(cutoff))}), the share whose removed date minus first-seen date is seven days or less.
      ${cohort.length ? `${fmt(quick)} of ${fmt(cohort.length)} qualify.` : "No posting is old enough yet."}</p><div id="c5"></div></div>
    <div class="card"><h2>6 · ${esc(head.s6)}</h2><p class="lede">The 15 most common locations among open postings, as each board writes them. Workday postings with several locations show the first one and a count of the rest.</p><div id="c6"></div></div>`;

  columnChart(document.getElementById("c1"), { labels: days, xLabel: short, tipLabel: prettyDate, series: [
    { name: "All postings", color: SERIES.all, values: newAll },
    { name: "Credit roles", color: SERIES.role, values: newRole }] });
  columnChart(document.getElementById("c2"), { labels: days, xLabel: short, tipLabel: prettyDate, series: [
    { name: "Removed postings", color: SERIES.role, values: removedPerDay }] });
  barChart(document.getElementById("c3"), { items: empItems, name: "Open postings" });
  if (durations.length) {
    columnChart(document.getElementById("c4"), { labels: durBins, xLabel: d => d, tipLabel: d => `${d} day${d === 1 ? "" : "s"} open`, unit: "Days open",
      series: [{ name: "Removed postings", color: SERIES.all, values: durCounts }] });
  } else document.getElementById("c4").innerHTML = '<p class="empty">No data yet.</p>';
  splitBar(document.getElementById("c5"), { a: quick, b: cohort.length - quick, aName: "Removed within 7 days", bName: "Still open or open longer" });
  barChart(document.getElementById("c6"), { items: locItems, name: "Open postings", color: SERIES.role });
})();
