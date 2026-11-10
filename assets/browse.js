// Browse page: open postings, role switch, filters, search, sort, apply links, shortlist.
(async function () {
  const $ = id => document.getElementById(id);
  const list = $("list");
  let rows;
  try { rows = await loadHistory(); } catch (e) { return showError(list.closest(".card"), e); }

  const last = lastRunDate(rows);
  // Remote postings are never offered as options.
  const open = rows.filter(r => r.status === "open" && !r.remote).map(r => ({ ...r, days: daysBetween(r.first_seen, last) }));
  const KEY = "jobwatch.shortlist";
  const stars = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  const save = () => localStorage.setItem(KEY, JSON.stringify([...stars]));
  let mode = "role", shown = 100;

  [...new Set(open.map(r => r.employer))].sort().forEach(e => $("f-emp").insertAdjacentHTML("beforeend", `<option>${esc(e)}</option>`));
  [...new Set(open.filter(r => r.in_dallas).map(r => r.location))].sort().slice(0, 300)
    .forEach(l => $("loc-list").insertAdjacentHTML("beforeend", `<option value="${esc(l)}">`));

  function filtered() {
    const q = $("f-q").value.trim().toLowerCase(), emp = $("f-emp").value, loc = $("f-loc").value.trim().toLowerCase();
    const [lo, hi] = ($("f-days").value || "0-99999").split("-").map(Number);
    const dallas = $("f-dallas").checked;
    let out = open.filter(r =>
      (mode === "all" || (mode === "role" && r.in_role) || (mode === "star" && stars.has(r.posting_id))) &&
      (!dallas || mode === "star" || r.in_dallas) &&
      (!q || r.title.toLowerCase().includes(q)) &&
      (!emp || r.employer === emp) &&
      (!loc || r.location.toLowerCase().includes(loc)) &&
      r.days >= lo && r.days <= hi);
    const dir = $("f-sort").value === "old" ? 1 : -1;
    out.sort((a, b) => dir * a.first_seen.localeCompare(b.first_seen) || a.employer.localeCompare(b.employer) || a.title.localeCompare(b.title));
    return out;
  }

  function draw() {
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
  ["f-q", "f-loc"].forEach(id => $(id).addEventListener("input", () => { shown = 100; draw(); }));
  ["f-emp", "f-days", "f-sort", "f-dallas"].forEach(id => $(id).addEventListener("change", () => { shown = 100; draw(); }));
  $("more").addEventListener("click", () => { shown += 100; draw(); });
  $("f-reset").addEventListener("click", () => {
    $("f-q").value = $("f-loc").value = $("f-emp").value = $("f-days").value = "";
    $("f-sort").value = "new"; $("f-dallas").checked = true; shown = 100;
    $("mode-role").click();
  });
  draw();
})();
