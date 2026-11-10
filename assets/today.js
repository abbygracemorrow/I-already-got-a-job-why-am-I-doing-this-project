// Today page: last run, source status, the four counts, new and removed lists,
// plus the interactive extras: countdown to the next check, days of history, a filterable
// list of Dallas credit jobs with a "surprise me" pick, the shortlist, Snoopy's money
// rain (the lights-and-snow toggle lives in common.js).
(async function () {
  const app = document.getElementById("app");
  let status, rows;
  try { [status, rows] = await Promise.all([loadStatus(), loadHistory()]); }
  catch (e) { return showError(app, e); }

  const day = status.run_date;
  const order = (a, b) => (b.in_role && b.in_dallas) - (a.in_role && a.in_dallas) || b.in_role - a.in_role ||
    a.employer.localeCompare(b.employer) || a.title.localeCompare(b.title);
  const addedAll = rows.filter(r => r.first_seen === day && !r.first_run);
  const removedAll = rows.filter(r => r.removed_date === day);
  // Remote postings are counted in the tiles but never listed as options.
  const added = addedAll.filter(r => !r.remote).sort(order);
  const removed = removedAll.filter(r => !r.remote).sort(order);
  const addedRemote = addedAll.filter(r => r.remote).sort(order);
  const removedRemote = removedAll.filter(r => r.remote).sort(order);
  const hiddenNote = () => "";
  const okCount = status.sources.filter(s => s.ok).length;
  const runTime = new Date(status.run_time);
  const firstDay = status.days_with_success <= 1;
  const last = lastRunDate(rows);

  // Open credit jobs in the Dallas area (never remote), newest first.
  const dallas = rows.filter(r => r.status === "open" && r.in_role && r.in_dallas && !r.remote)
    .map(r => ({ ...r, days: daysBetween(r.first_seen, last) }))
    .sort((a, b) => b.first_seen.localeCompare(a.first_seen) || a.employer.localeCompare(b.employer) || a.title.localeCompare(b.title));
  const byEmp = {};
  dallas.forEach(r => { byEmp[r.employer] = (byEmp[r.employer] || 0) + 1; });
  const empChips = Object.entries(byEmp).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const KEY = "jobwatch.shortlist";
  const stars = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  const saveStars = () => localStorage.setItem(KEY, JSON.stringify([...stars]));
  const byId = new Map(rows.map(r => [r.posting_id, r]));

  // Days of history: one ornament per calendar day since watching began. A day counts
  // by its UTC date (course rule) and is lit when it has data; the popup shows it in
  // Dallas time. A faded ornament at the end is the next scheduled check (6:00 am Dallas).
  const runDays = (status.run_days && status.run_days.length ? status.run_days
    : [...new Set(rows.flatMap(r => [r.first_seen, r.last_seen, r.removed_date]).filter(Boolean))]).slice().sort();
  const haveData = new Set(runDays);
  const firstRunDay = runDays[0] || day;
  const lastDay = runDays.length ? [runDays[runDays.length - 1], day].sort().pop() : day;
  const dallasStamp = iso => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago",
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const shortDate = iso => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" });
  // Each ornament is labelled with its day; the popup gives the time of that day's check.
  const calendar = dayRange(firstRunDay, lastDay).map((d, i) => {
    const when = d === day ? status.run_time : d + "T12:00:00Z";
    const began = i === 0 && status.watching_since ? status.watching_since : "";
    return { d, n: i + 1, done: haveData.has(d), when, began };
  });
  const dayLabel = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  const nextCheck = (() => { // next 12:00 UTC (6:00 am Dallas)
    const now = new Date(), t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
    if (t <= now) t.setUTCDate(t.getUTCDate() + 1);
    return t.toISOString();
  })();
  const daysWithData = calendar.filter(c => c.done).length;
  const missed = calendar.length - daysWithData;

  app.innerHTML = `
    <div class="card run-card">
      <div>
        <h2>Last run</h2>
        <p class="lede" style="margin:0">${esc(dallasTime(runTime))} <b>Dallas time</b>
        <br><span style="color:var(--ink-3)">${esc(status.run_time)} (UTC) · ${okCount} of ${status.sources.length} sources OK</span></p>
      </div>
      <div class="countdown">
        <div class="cd-label">Next check in</div>
        <div class="cd-time" id="cd">--:--:--</div>
        <div class="cd-sub">every day at 6:00 am Dallas time</div>
      </div>
    </div>

    <div class="tiles">
      <a class="tile tile-link" href="#history"><div class="label">Days with a successful run</div><div class="value">${fmt(status.days_with_success)}</div><div class="sub">since ${esc(status.watching_since ? dallasDate(status.watching_since) : prettyDate(status.first_run_date))}</div></a>
      <a class="tile tile-link tile-feature" href="#dallas"><div class="label">Open credit jobs in Dallas</div><div class="value">${fmt(status.open_in_role_dallas)}</div><div class="sub">credit analyst roles, not remote</div></a>
      <a class="tile tile-link" href="browse.html"><div class="label">All open jobs</div><div class="value">${fmt(status.open)}</div><div class="sub">every role, every location, at the ${status.sources.length} companies I track</div></a>
      <a class="tile tile-link" href="#new-card"><div class="label">New today</div><div class="value">${fmt(status.new_today)}</div><div class="sub">first seen this run</div></a>
      <a class="tile tile-link" href="#gone-card"><div class="label">Removed today</div><div class="value">${fmt(status.removed_today)}</div><div class="sub">no longer listed</div></a>
    </div>

    <div class="card" id="history">
      <div class="goal-head">
        <h2>Days of history: ${fmt(daysWithData)}</h2>
      </div>
      <p class="lede">The tool has ${fmt(daysWithData)} day${daysWithData === 1 ? "" : "s"} of job data, starting ${esc(status.watching_since ? shortDate(status.watching_since) : dayLabel(firstRunDay))}${missed ? `, with ${missed} day${missed === 1 ? "" : "s"} missed` : ""}.
        Each ornament is one day: lit means that day's check worked${missed ? ", grey means it was missed" : ""}, and the faded one is the next check. Hover over or tap one to see its date. Times are Dallas time.</p>
      <div class="ornaments" id="orns">${calendar.map(c =>
        `<button type="button" class="orn ${c.done ? "lit" : "missed"}" aria-label="Day ${c.n}: ${esc(dallasStamp(c.when))}, ${c.done ? "data collected" : "missed"}">
          <img src="icons/ornament.svg" alt=""><small>${esc(shortDate(c.when))}</small>
          <span class="orn-tip" role="tooltip"><b>Day ${c.n}</b>${c.done ? "Checked" : "Check missed"} ${esc(dallasStamp(c.when))}${c.began && c.began !== c.when ? `<span>Watching began ${esc(dallasStamp(c.began))}</span>` : ""}<em class="${c.done ? "ok" : ""}">${c.done ? "✓ Data collected" : "✗ No data this day"}</em></span>
        </button>`).join("")}
        <button type="button" class="orn next" aria-label="Next check: ${esc(dallasStamp(nextCheck))}">
          <img src="icons/ornament.svg" alt=""><small>Next</small>
          <span class="orn-tip" role="tooltip"><b>Next check</b>${esc(dallasStamp(nextCheck))}<em>Coming up</em></span>
        </button></div>
    </div>

    <div class="card" id="dallas">
      <h2>Credit jobs in Dallas right now</h2>
      <p class="lede">Tap an employer to narrow the list, ★ a job to save it, or let Snoopy pick one for you.</p>
      <div class="chips" id="chips">
        <button class="chip" aria-pressed="true" data-emp="">All <b>${fmt(dallas.length)}</b></button>
        ${empChips.map(([e, n]) => `<button class="chip" aria-pressed="false" data-emp="${esc(e)}">${esc(e)} <b>${n}</b></button>`).join("")}
      </div>
      <div class="controls">
        <label>Search titles<input id="dq" type="search" placeholder="e.g. underwriter"></label>
        <button class="btn" id="surprise" type="button">🎁 Surprise me</button>
      </div>
      <p class="count" id="dcount"></p>
      <ul class="jobs" id="dlist"></ul>
      <p style="text-align:center"><button class="btn ghost" id="dmore" type="button" hidden>Show all</button></p>
    </div>

    <div class="card" id="shortlist-card">
      <h2>★ Your shortlist</h2>
      <p class="lede">Jobs you've starred here or on the Browse page. Saved in this browser.</p>
      <ul class="jobs" id="slist"></ul>
    </div>

    <div class="card" id="new-card">
      <div class="controls" style="margin-bottom:6px">
        <div class="seg" role="group" aria-label="Which postings">
          <button data-f="all" aria-pressed="true">All postings</button>
          <button data-f="role" aria-pressed="false">Credit roles</button>
          <button data-f="focus" aria-pressed="false">Credit roles in Dallas</button>
        </div></div>
      <h2>New jobs</h2><p class="lede">${firstDay
        ? "This was the first check, so every job it found was already posted. Starting with the next check, jobs that are new since the day before will show up here."
        : "Jobs that showed up since the last check. Credit roles in Dallas are at the top."}${hiddenNote(addedAll, added)}</p>
      <div class="scroll"><ul class="jobs" id="new"></ul></div>
      <div id="new-remote"></div>
    </div>
    <div class="card" id="gone-card"><h2>Jobs taken down</h2><p class="lede">${firstDay
        ? "Nothing can be taken down yet. Starting with the next check, jobs that were posted before and are now gone will show up here."
        : "Jobs that were posted at the last check and are now gone."}${hiddenNote(removedAll, removed)}</p>
      <div class="scroll"><ul class="jobs" id="gone"></ul></div>
      <div id="gone-remote"></div></div>
    <div class="card"><h2>Sources</h2><p class="lede">Each employer's board, read through its applicant tracking system. A source that fails is skipped for the day; the others still run.</p>
      <div class="scroll"><table><thead><tr><th>Employer</th><th>System</th><th>Status</th><th class="num">Postings</th></tr></thead><tbody>
      ${status.sources.map(s => `<tr><td>${esc(s.employer || s.name)}</td><td>${esc(s.ats || "")}</td>
        <td>${s.ok ? '<span class="pill ok">✓ OK</span>' : `<span class="pill fail" title="${esc(s.error || "")}">✗ Failed</span>`}${s.note ? `<div class="src-note">${esc(s.note)}</div>` : ""}</td>
        <td class="num">${s.ok ? fmt(s.count) : "—"}</td></tr>`).join("")}
      </tbody></table></div></div>`;

  const $ = id => document.getElementById(id);

  // ---------- ornaments: tap to open a popup (hover and keyboard focus open it too)
  $("orns").addEventListener("click", e => {
    const o = e.target.closest(".orn"); if (!o) return;
    const open = !o.classList.contains("open");
    $("orns").querySelectorAll(".orn").forEach(x => x.classList.remove("open"));
    o.classList.toggle("open", open);
  });
  document.addEventListener("click", e => { if (!e.target.closest(".orn")) $("orns").querySelectorAll(".orn").forEach(x => x.classList.remove("open")); });

  // ---------- new / removed lists
  const filters = { all: () => true, role: r => r.in_role, focus: r => r.in_role && r.in_dallas };
  function drawChanges(f) {
    const keep = filters[f];
    const a = added.filter(keep), g = removed.filter(keep);
    $("new").innerHTML = a.length ? a.map(r => jobItem(r, { side: esc(prettyDate(r.posted_date)) })).join("") : '<li class="empty">No new jobs.</li>';
    $("gone").innerHTML = g.length ? g.map(r => jobItem(r, { side: "open since " + esc(prettyDate(r.first_seen)) })).join("") : '<li class="empty">No jobs taken down.</li>';
    // Remote postings are kept out of the main lists but can be opened here.
    const fold = (rs, side) => rs.length ? `<details class="remote-more"><summary>Show ${rs.length} remote posting${rs.length === 1 ? "" : "s"}</summary>
      <ul class="jobs">${rs.map(r => jobItem(r, { side: side(r) })).join("")}</ul></details>` : "";
    $("new-remote").innerHTML = fold(addedRemote.filter(keep), r => esc(prettyDate(r.posted_date)));
    $("gone-remote").innerHTML = fold(removedRemote.filter(keep), r => "open since " + esc(prettyDate(r.first_seen)));
  }
  $("new-card").querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => {
    $("new-card").querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    drawChanges(b.dataset.f);
  }));
  drawChanges("all");

  // ---------- Dallas credit jobs: chips, search, stars, surprise
  let emp = "", showAll = false;
  const PAGE = 8;
  const dallasFiltered = () => {
    const q = $("dq").value.trim().toLowerCase();
    return dallas.filter(r => (!emp || r.employer === emp) && (!q || r.title.toLowerCase().includes(q)));
  };
  const sideFor = r => r.first_run ? "open when watching began" : `open ${r.days} day${r.days === 1 ? "" : "s"}`;
  function drawDallas() {
    const list = dallasFiltered();
    const shown = showAll ? list : list.slice(0, PAGE);
    $("dcount").textContent = `${fmt(list.length)} job${list.length === 1 ? "" : "s"}${emp ? " at " + emp : ""}`;
    $("dlist").innerHTML = shown.length
      ? shown.map(r => jobItem(r, { star: true, starred: stars.has(r.posting_id), side: sideFor(r) })
          .replace("<li>", `<li data-pid="${esc(r.posting_id)}">`)).join("")
      : '<li class="empty">No jobs match.</li>';
    $("dmore").hidden = list.length <= PAGE;
    $("dmore").textContent = showAll ? "Show fewer" : `Show all ${list.length}`;
  }
  $("chips").addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    emp = c.dataset.emp; showAll = false;
    $("chips").querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", String(x === c)));
    drawDallas();
  });
  $("dq").addEventListener("input", () => { showAll = false; drawDallas(); });
  $("dmore").addEventListener("click", () => { showAll = !showAll; drawDallas(); });
  $("surprise").addEventListener("click", () => {
    const list = dallasFiltered();
    if (!list.length) return;
    const pick = list[Math.floor(Math.random() * list.length)];
    showAll = true; drawDallas();
    const li = $("dlist").querySelector(`li[data-pid="${CSS.escape(pick.posting_id)}"]`);
    if (li) {
      li.classList.add("picked");
      li.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => li.classList.remove("picked"), 4000);
    }
    moneyRain(10);
  });

  // ---------- shortlist preview (shared with the Browse page)
  function drawShortlist() {
    const saved = [...stars].map(id => byId.get(id)).filter(Boolean);
    $("slist").innerHTML = saved.length
      ? saved.map(r => jobItem(r, { star: true, starred: true,
          side: r.status === "open" ? "still open" : `<span class="pill fail">taken down ${esc(prettyDate(r.removed_date))}</span>` })).join("")
      : '<li class="empty">Nothing saved yet. Tap ☆ on a job above to save it here.</li>';
  }
  document.addEventListener("click", e => {
    const b = e.target.closest(".star"); if (!b) return;
    const id = b.dataset.id;
    stars.has(id) ? stars.delete(id) : stars.add(id);
    saveStars();
    document.querySelectorAll(`.star[data-id="${CSS.escape(id)}"]`).forEach(s => {
      s.setAttribute("aria-pressed", String(stars.has(id))); s.textContent = stars.has(id) ? "★" : "☆";
    });
    drawShortlist();
  });
  drawDallas();
  drawShortlist();

  // ---------- countdown to the next scheduled check (12:00 UTC daily)
  function nextRun(now) {
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
    if (t <= now) t.setUTCDate(t.getUTCDate() + 1);
    return t;
  }
  const pad = n => String(n).padStart(2, "0");
  function tick() {
    const now = new Date(), s = Math.floor((nextRun(now) - now) / 1000);
    $("cd").textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }
  tick(); setInterval(tick, 1000);

  // ---------- Snoopy: click for a money rain
  const snoopy = document.querySelector(".mascot");
  if (snoopy) {
    snoopy.classList.add("clickable");
    snoopy.title = "Click me!";
    snoopy.setAttribute("role", "button");
    snoopy.setAttribute("aria-label", "Make it rain");
    snoopy.tabIndex = 0;
    const hopper = snoopy.closest(".mascot-wrap") || snoopy; // the Santa hat hops along
    const go = () => { hopper.classList.remove("hop"); void hopper.offsetWidth; hopper.classList.add("hop"); moneyRain(24); };
    snoopy.addEventListener("click", go);
    snoopy.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  }
})();

function moneyRain(n) {
  if (calm()) return;
  for (let i = 0; i < n; i++) {
    const b = document.createElement("span");
    b.className = "bill";
    b.textContent = "💵";
    b.style.left = Math.random() * 100 + "vw";
    b.style.animationDelay = Math.random() * 0.8 + "s";
    b.style.animationDuration = 2.2 + Math.random() * 1.6 + "s";
    b.style.setProperty("--spin", (Math.random() * 720 - 360) + "deg");
    b.style.fontSize = 22 + Math.random() * 18 + "px";
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 5000);
  }
}
