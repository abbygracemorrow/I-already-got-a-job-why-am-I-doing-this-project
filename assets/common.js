// Shared by every page: data loading, CSV parsing, date helpers, service worker.

const DATA = { status: "data/status.json", history: "data/history.csv" };

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", i = 0, q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        q = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter(r => r.length === head.length).map(r => {
    const o = {};
    head.forEach((h, k) => { o[h] = r[k]; });
    o.in_role = o.in_role === "true";
    o.first_run = o.first_run === "true";
    o.in_dallas = o.in_dallas === "true";
    o.remote = o.remote === "true";
    return o;
  });
}

async function loadStatus() {
  const r = await fetch(DATA.status, { cache: "no-cache" });
  if (!r.ok) throw new Error("status.json " + r.status);
  return r.json();
}

async function loadHistory() {
  const r = await fetch(DATA.history, { cache: "no-cache" });
  if (!r.ok) throw new Error("history.csv " + r.status);
  return parseCSV(await r.text());
}

// Dates are YYYY-MM-DD strings in UTC. Day arithmetic in UTC avoids DST surprises.
function dayNum(s) { return Math.round(Date.parse(s + "T00:00:00Z") / 86400000); }
function dayStr(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
function daysBetween(a, b) { return dayNum(b) - dayNum(a); }
function dayRange(a, b) { const out = []; for (let n = dayNum(a); n <= dayNum(b); n++) out.push(dayStr(n)); return out; }
function lastRunDate(rows) { let m = ""; for (const r of rows) if (r.last_seen > m) m = r.last_seen; return m; }
function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const fmt = n => (n == null ? "—" : Number(n).toLocaleString("en-US"));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function prettyDate(s) {
  if (!s) return "";
  return new Date(s + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// The pipeline records dates in UTC (course rule); show run times in Dallas time for reading.
function dallasTime(d) {
  return new Date(d).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "short",
    day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function dallasDate(d) {
  return new Date(d).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" });
}

function jobItem(r, opts = {}) {
  const badges = [
    r.in_role ? '<span class="pill role">credit role</span>' : "",
    r.in_dallas ? '<span class="pill dfw">🎄 Dallas area</span>' : "",
  ].join(" ");
  const star = opts.star
    ? `<button class="star" data-id="${esc(r.posting_id)}" aria-pressed="${opts.starred ? "true" : "false"}" title="Save to shortlist" aria-label="Save to shortlist">${opts.starred ? "★" : "☆"}</button>`
    : "<span></span>";
  return `<li>${star}
    <div><a class="title" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
      <div class="meta">${esc(r.employer)}${r.location ? " · " + esc(r.location) : ""}${r.department ? " · " + esc(r.department) : ""}</div>
      <div>${badges}</div></div>
    <div class="side">${opts.side || ""}<br><a class="apply" href="${esc(r.url)}" target="_blank" rel="noopener">Apply ↗</a></div></li>`;
}

function showError(el, err) {
  el.innerHTML = `<div class="card"><h2>Couldn't load the data</h2><p class="lede">${esc(err.message)}. If you're offline, open the page once while online so it can be saved for offline use.</p></div>`;
}

// Offline banner + service worker (makes the site installable and usable offline).
function setOffline() { document.body.classList.toggle("offline", !navigator.onLine); }
window.addEventListener("online", setOffline);
window.addEventListener("offline", setOffline);
document.addEventListener("DOMContentLoaded", setOffline);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
