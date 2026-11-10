// Browse page: open postings, role switch, filters, search, sort, apply links, shortlist.
(async function () {
  const $ = id => document.getElementById(id);
  const list = $("list");
  let rows;
  try { rows = await loadHistory(); } catch (e) { return showError(list.closest(".card"), e); }

  const last = lastRunDate(rows);
  const open = rows.filter(r => r.status === "open").map(r => ({ ...r, days: daysBetween(r.first_seen, last) }));
  const KEY = "jobwatch.shortlist";
  const stars = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  const save = () => localStorage.setItem(KEY, JSON.stringify([...stars]));
  let mode = "role", shown = 100;

  [...new Set(open.map(r => r.employer))].sort().forEach(e => $("f-emp").insertAdjacentHTML("beforeend", `<option>${esc(e)}</option>`));
  const OUTSIDE = "__outside";

  // ignoreArea: used to count postings per area for the Area menu.
  function filtered(ignoreArea = false) {
    const q = $("f-q").value.trim().toLowerCase(), emp = $("f-emp").value, area = ignoreArea ? "" : $("f-area").value;
    const [lo, hi] = ($("f-days").value || "0-99999").split("-").map(Number);
    const dallas = $("f-dallas").checked;
    const remote = $("f-remote").checked; // remote jobs stay hidden unless asked for
    let out = open.filter(r =>
      (mode === "all" || (mode === "role" && r.in_role) || (mode === "star" && stars.has(r.posting_id))) &&
      (!dallas || mode === "star" || r.in_dallas) &&
      (remote || mode === "star" || !r.remote) &&
      (!q || r.title.toLowerCase().includes(q)) &&
      (!emp || r.employer === emp) &&
      (!area || (area === OUTSIDE ? !r.area : r.area === area)) &&
      r.days >= lo && r.days <= hi);
    const dir = $("f-sort").value === "old" ? 1 : -1;
    out.sort((a, b) => dir * a.first_seen.localeCompare(b.first_seen) || a.employer.localeCompare(b.employer) || a.title.localeCompare(b.title));
    return out;
  }

  // Area menu: one entry per Dallas-area city (neighborhoods count under their city),
  // with how many postings each has under the other filters.
  function drawAreas() {
    const sel = $("f-area"), keep = sel.value, counts = {};
    filtered(true).forEach(r => { const k = r.area || OUTSIDE; counts[k] = (counts[k] || 0) + 1; });
    const areas = Object.keys(counts).filter(k => k !== OUTSIDE)
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
    if (keep && keep !== OUTSIDE && !areas.includes(keep)) areas.push(keep);
    let html = '<option value="">All areas</option>' +
      areas.map(a => `<option value="${esc(a)}">${esc(a)} (${fmt(counts[a] || 0)})</option>`).join("");
    if (counts[OUTSIDE] || keep === OUTSIDE)
      html += `<option value="${OUTSIDE}">Outside the Dallas area (${fmt(counts[OUTSIDE] || 0)})</option>`;
    sel.innerHTML = html;
    sel.value = keep;
  }

  function draw() {
    drawAreas();
    const out = filtered();
    $("count").textContent = `${fmt(out.length)} open posting${out.length === 1 ? "" : "s"} · ${fmt(stars.size)} on your shortlist · data as of ${prettyDate(last)}`;
    list.innerHTML = out.length
      ? out.slice(0, shown).map(r => jobItem(r, {
          star: true, starred: stars.has(r.posting_id),
          side: `first seen ${esc(prettyDate(r.first_seen))}<br>${r.first_run ? "open when watching began" : `open ${r.days} day${r.days === 1 ? "" : "s"}`}`,
        })).join("")
      : `<li class="empty">${mode === "star" ? "Your shortlist is empty. Tap ☆ on a posting to save it." : "No postings match these filters."}</li>`;
    $("more").hidden = out.length <= shown;
  }

  list.addEventListener("click", e => {
    const b = e.target.closest(".star");
    if (!b) return;
    const id = b.dataset.id;
    stars.has(id) ? stars.delete(id) : stars.add(id);
    save();
    b.setAttribute("aria-pressed", String(stars.has(id)));
    b.textContent = stars.has(id) ? "★" : "☆";
    $("count").textContent = $("count").textContent.replace(/\d[\d,]* on your shortlist/, `${fmt(stars.size)} on your shortlist`);
  });
  ["role", "all", "star"].forEach(m => $("mode-" + m).addEventListener("click", () => {
    mode = m; shown = 100;
    ["role", "all", "star"].forEach(x => $("mode-" + x).setAttribute("aria-pressed", String(x === m)));
    draw();
  }));
  $("f-q").addEventListener("input", () => { shown = 100; draw(); });
  ["f-area", "f-emp", "f-days", "f-sort", "f-dallas", "f-remote"].forEach(id => $(id).addEventListener("change", () => { shown = 100; draw(); }));
  $("more").addEventListener("click", () => { shown += 100; draw(); });
  $("f-reset").addEventListener("click", () => {
    $("f-q").value = $("f-area").value = $("f-emp").value = $("f-days").value = "";
    $("f-sort").value = "new"; $("f-dallas").checked = true; $("f-remote").checked = false; shown = 100;
    $("mode-role").click();
  });
  draw();
})();
