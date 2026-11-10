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
    o.area = o.area || "";
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
    r.in_dallas ? '<span class="pill dfw"><span class="plain-only">📍</span><span class="xmas-only">🎄</span> Dallas area</span>' : "",
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

// ---------- Festive mode: a bouncing candy cane in the top-right of the nav bar.
// Click it for Christmas mode: lights frame the window, the garland lights up, snow falls, and
// Snoopy gets a Santa hat. The site always opens in light mode; the choice only carries
// between pages during the same visit.
const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FESTIVE_KEY = "jobwatch.festive";

function setSnow(on) {
  let layer = document.getElementById("snow");
  if (!on || calm()) { if (layer) layer.remove(); return; }
  if (layer) return;
  layer = document.createElement("div");
  layer.id = "snow";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 60; i++) {
    const f = document.createElement("i");
    const size = 3 + Math.random() * 6;
    f.style.left = Math.random() * 100 + "vw";
    f.style.width = f.style.height = size + "px";
    f.style.animationDuration = 6 + Math.random() * 8 + "s";
    f.style.animationDelay = -Math.random() * 14 + "s";
    f.style.setProperty("--drift", (Math.random() * 80 - 40) + "px");
    layer.appendChild(f);
  }
  document.body.appendChild(layer);
}

// Strings of lights down the sides and along the bottom of the window in Christmas mode.
function buildLightFrame() {
  let frame = document.getElementById("light-frame");
  if (frame) frame.remove();
  if (!document.body.classList.contains("festive")) return;
  frame = document.createElement("div");
  frame.id = "light-frame";
  frame.setAttribute("aria-hidden", "true");
  const gap = window.innerWidth < 720 ? 30 : 36; // space between bulbs, in pixels
  // No string along the top: it would cover the nav bar, and the garland already lights up there.
  const navH = (document.querySelector(".nav") || { offsetHeight: 0 }).offsetHeight;
  frame.style.setProperty("--nav-h", navH + "px");
  const sides = { bottom: window.innerWidth, left: window.innerHeight - navH, right: window.innerHeight - navH };
  for (const [side, length] of Object.entries(sides)) {
    const string = document.createElement("div");
    string.className = "lf lf-" + side;
    const n = Math.max(4, Math.floor(length / gap));
    for (let i = 0; i < n; i++) {
      const b = document.createElement("i");
      b.style.animationDelay = ((i * 3 + side.length) % 7) * 0.23 + "s";
      string.appendChild(b);
    }
    frame.appendChild(string);
  }
  document.body.appendChild(frame);
}
let frameTimer;
window.addEventListener("resize", () => { clearTimeout(frameTimer); frameTimer = setTimeout(buildLightFrame, 150); });

// Fit the village to the banner's slanted bottom edge (light mode's skyline): tilt the
// ground by the edge's angle and lift Snoopy by the slope's height where he stands.
function fitVillage() {
  const band = document.querySelector(".hero-band"), village = band && band.querySelector(".village");
  if (!village) return;
  const w = band.offsetWidth, h = band.offsetHeight, phone = window.innerWidth <= 720;
  // The banner has the same shape in both modes: its bottom edge slants up by 22% (12% on
  // phones) of its height. Tilt the village ground to that slant (houses stay upright).
  const drop = (phone ? 0.12 : 0.22) * h;
  band.style.setProperty("--slope", (-Math.atan(drop / w) * 180 / Math.PI) + "deg");
  // Snoopy never moves: shift the village up or down so its snow surface meets his feet.
  // In the drawing the snow surface is 144/380 of its height above its bottom edge.
  const depth = w * 380 / 1600 * 144 / 380;
  const snoopy = band.querySelector(".mascot"), box = band.getBoundingClientRect();
  band.style.setProperty("--shift", "0px");
  if (snoopy && !phone) {
    const s = snoopy.getBoundingClientRect(), pad = parseFloat(getComputedStyle(snoopy).paddingBottom) || 0;
    const x = s.left + s.width / 2 - box.left, ground = h - drop * x / w - depth;
    band.style.setProperty("--shift", Math.round((s.bottom - box.top - pad - 6) - ground) + "px");
  }
}
window.addEventListener("resize", () => requestAnimationFrame(fitVillage));

// Hang the photo ornament on the left of the page, between the side lights and the text.
function placeOrnament() {
  const orn = document.getElementById("photo-ornament"), band = document.querySelector(".hero-band");
  const text = band && band.querySelector(".hero-text");
  if (!orn || !text) return;
  if (orn.parentNode !== band) band.appendChild(orn);
  orn.classList.add("in-band");
  const box = band.getBoundingClientRect(), t = text.getBoundingClientRect();
  const frame = 24;                                    // width of the string of side lights
  const gap = t.left - box.left - frame;               // room between the lights and the words
  const ball = Math.max(44, Math.min(108, gap - 10));
  orn.style.setProperty("--ball", ball + "px");
  orn.style.setProperty("--orn-x", Math.round(frame + Math.max(gap, ball + 4) / 2) + "px");
  // too narrow to fit beside the words: hang it below them instead
  const len = gap >= ball + 4 ? 150 : Math.round(t.bottom - box.top + 10);
  orn.style.setProperty("--len", len + "px");
}
window.addEventListener("resize", () => requestAnimationFrame(placeOrnament));

function setFestive(on) {
  document.body.classList.toggle("festive", on);
  buildLightFrame();
  const btn = document.getElementById("festive-toggle");
  if (btn) {
    btn.setAttribute("aria-pressed", String(on));
    btn.title = on ? "Back to light mode" : "Christmas mode";
  }
  setSnow(on);
  requestAnimationFrame(fitVillage);
  requestAnimationFrame(placeOrnament);
}

document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector(".nav"), inner = document.querySelector(".nav-inner");
  if (!nav || !inner) return;
  // the toggle
  const btn = document.createElement("button");
  btn.id = "festive-toggle";
  btn.type = "button";
  btn.className = "festive-toggle";
  btn.setAttribute("aria-label", "Christmas mode");
  btn.innerHTML = '<img class="cane" src="icons/candy-cane.svg" alt="">';
  inner.appendChild(btn);
  // A Christmas ornament with a photo inside, hanging from the top-left corner and
  // slowly spinning (Christmas mode). Clicks pass through it.
  // only on the Today page (the page with Snoopy)
  if (document.querySelector(".mascot")) {
  const orn = document.createElement("div");
  orn.id = "photo-ornament";
  orn.setAttribute("aria-hidden", "true");
  orn.innerHTML = '<span class="po-swing"><span class="po-string"></span><span class="po-cap"></span>' +
    '<span class="po-ball"><img src="assets/ornament-photo.jpg" alt=""><span class="po-shine"></span></span></span>';
  document.body.appendChild(orn);
  }
  // Santa hat for Snoopy (only on pages that show him)
  const snoopy = document.querySelector(".mascot");
  if (snoopy) {
    const wrap = document.createElement("span");
    wrap.className = "mascot-wrap";
    snoopy.parentNode.insertBefore(wrap, snoopy);
    wrap.appendChild(snoopy);
    const hat = document.createElement("img");
    hat.className = "santa-hat";
    hat.src = "icons/santa-hat.svg";
    hat.alt = "";
    wrap.appendChild(hat);
  }
  localStorage.removeItem(FESTIVE_KEY); localStorage.removeItem("jobwatch.snow"); // old settings
  setFestive(sessionStorage.getItem(FESTIVE_KEY) === "on");
  btn.addEventListener("click", () => {
    const next = !document.body.classList.contains("festive");
    sessionStorage.setItem(FESTIVE_KEY, next ? "on" : "off");
    setFestive(next);
    btn.classList.remove("boing"); void btn.offsetWidth; btn.classList.add("boing");
  });
});
