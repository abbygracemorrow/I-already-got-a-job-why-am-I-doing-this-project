// Today page: last run, source status, the four counts, new and removed lists.
(async function () {
  const app = document.getElementById("app");
  let status, rows;
  try { [status, rows] = await Promise.all([loadStatus(), loadHistory()]); }
  catch (e) { return showError(app, e); }

  const day = status.run_date;
  const order = (a, b) => (b.in_role && b.in_dallas) - (a.in_role && a.in_dallas) || b.in_role - a.in_role ||
    a.employer.localeCompare(b.employer) || a.title.localeCompare(b.title);
  const added = rows.filter(r => r.first_seen === day && !r.first_run).sort(order);
  const removed = rows.filter(r => r.removed_date === day).sort(order);
  const okCount = status.sources.filter(s => s.ok).length;
  const runTime = new Date(status.run_time);

  app.innerHTML = `
    <div class="card"><h2>Last run <span class="bow">🎀</span></h2>
      <p class="lede" style="margin:0">${esc(runTime.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }))}
      <br><span style="color:var(--ink-3)">${esc(status.run_time)} (UTC) · ${okCount} of ${status.sources.length} sources OK</span></p></div>
    <div class="tiles">
      <div class="tile"><div class="label">Days with a successful run</div><div class="value">${fmt(status.days_with_success)}</div><div class="sub">since ${esc(prettyDate(status.first_run_date))}</div></div>
      <div class="tile"><div class="label">Open postings</div><div class="value">${fmt(status.open)}</div><div class="sub">${fmt(status.open_in_role_dallas)} credit roles in the Dallas area</div></div>
      <div class="tile"><div class="label">New today</div><div class="value">${fmt(status.new_today)}</div><div class="sub">first seen this run</div></div>
      <div class="tile"><div class="label">Removed today</div><div class="value">${fmt(status.removed_today)}</div><div class="sub">no longer listed</div></div>
    </div>
    <div class="card">
      <div class="controls" style="margin-bottom:6px">
        <div class="seg" role="group" aria-label="Which postings">
          <button data-f="all" aria-pressed="true">All postings</button>
          <button data-f="role" aria-pressed="false">Credit roles</button>
          <button data-f="focus" aria-pressed="false">Credit roles in Dallas</button>
        </div></div>
      <h2>New in the latest run</h2><p class="lede">Postings first seen on ${esc(prettyDate(day))}. Postings that were already open when a board was first watched are not counted as new. Dallas credit roles are listed first.</p>
      <div class="scroll"><ul class="jobs" id="new"></ul></div>
    </div>
    <div class="card"><h2>Removed in the latest run</h2><p class="lede">Postings that were open before and are no longer listed on ${esc(prettyDate(day))}.</p>
      <div class="scroll"><ul class="jobs" id="gone"></ul></div></div>
    <div class="card"><h2>Sources</h2><p class="lede">Each employer's board, read through its applicant tracking system. A source that fails is skipped for the day; the others still run.</p>
      <div class="scroll"><table><thead><tr><th>Employer</th><th>System</th><th>Status</th><th class="num">Postings</th></tr></thead><tbody>
      ${status.sources.map(s => `<tr><td>${esc(s.employer || s.name)}</td><td>${esc(s.ats || "")}</td>
        <td>${s.ok ? '<span class="pill ok">✓ OK</span>' : `<span class="pill fail" title="${esc(s.error || "")}">✗ Failed</span>`}</td>
        <td class="num">${s.ok ? fmt(s.count) : "—"}</td></tr>`).join("")}
      </tbody></table></div></div>`;

  const filters = { all: () => true, role: r => r.in_role, focus: r => r.in_role && r.in_dallas };
  function draw(f) {
    const keep = filters[f];
    const a = added.filter(keep), g = removed.filter(keep);
    document.getElementById("new").innerHTML = a.length ? a.map(r => jobItem(r, { side: esc(prettyDate(r.posted_date)) })).join("") : '<li class="empty">No new postings.</li>';
    document.getElementById("gone").innerHTML = g.length ? g.map(r => jobItem(r, { side: "open since " + esc(prettyDate(r.first_seen)) })).join("") : '<li class="empty">No removed postings.</li>';
  }
  app.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => {
    app.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    draw(b.dataset.f);
  }));
  draw("all");
})();
