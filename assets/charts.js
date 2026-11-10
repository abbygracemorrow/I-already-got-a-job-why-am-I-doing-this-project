// Small SVG chart helpers (no library, so the site works offline).
// Thin marks, rounded data-ends on the baseline, recessive grid, hover tooltips,
// and a table view under every chart.

const SERIES = { all: "#2e7a4c", role: "#e3628f" };
const NS = "http://www.w3.org/2000/svg";

function niceMax(v) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function tipFor(host) {
  let t = host.querySelector(".tip");
  if (!t) { t = document.createElement("div"); t.className = "tip"; host.appendChild(t); }
  return {
    show(html, x, y) { t.innerHTML = html; t.style.left = x + "px"; t.style.top = y + "px"; t.classList.add("on"); },
    hide() { t.classList.remove("on"); },
  };
}

// Rounded top (or right) end, square at the baseline.
function barPath(x, y, w, h, horizontal) {
  const r = Math.min(4, horizontal ? h / 2 : w / 2, horizontal ? w : h);
  if (h <= 0 || w <= 0) return "";
  if (horizontal) return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function tableView(headers, rows) {
  return `<details class="table-view"><summary>Show as table</summary><div class="scroll"><table><thead><tr>${headers
    .map((h, i) => `<th${i ? ' class="num"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ""}>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
}

// Vertical bars over days (or bins). series: [{key, name, color, values[]}] — grouped when >1.
function columnChart(host, { labels, series, xLabel = d => d, tipLabel = d => d, height = 260, unit = "" }) {
  const W = 900, H = height, m = { t: 14, r: 10, b: 34, l: 44 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = niceMax(Math.max(1, ...series.flatMap(s => s.values)));
  const band = iw / Math.max(1, labels.length), gap = 2;
  const bw = Math.max(1.5, Math.min(28, (band - 4) / series.length - gap));
  const y = v => m.t + ih - (v / max) * ih;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img"><g class="grid">`;
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k;
    svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="lbl" x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
  }
  svg += "</g><g>";
  const step = Math.ceil(labels.length / 10);
  labels.forEach((d, i) => {
    const x0 = m.l + i * band + (band - (bw + gap) * series.length + gap) / 2;
    series.forEach((s, k) => {
      const v = s.values[i];
      svg += `<path d="${barPath(x0 + k * (bw + gap), y(v), bw, m.t + ih - y(v))}" fill="${s.color}"/>`;
    });
    if (i % step === 0) svg += `<text class="lbl" x="${m.l + i * band + band / 2}" y="${H - 12}" text-anchor="middle">${esc(xLabel(d))}</text>`;
    svg += `<rect class="hit" data-i="${i}" x="${m.l + i * band}" y="${m.t}" width="${band}" height="${ih}"/>`;
  });
  svg += `</g><line x1="${m.l}" x2="${W - m.r}" y1="${m.t + ih}" y2="${m.t + ih}" stroke="#d9bfca"/></svg>`;
  const legend = series.length > 1
    ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>` : "";
  host.innerHTML = legend + `<div class="chart">${svg}</div>` +
    tableView([unit || "Day", ...series.map(s => s.name)], labels.map((d, i) => [tipLabel(d), ...series.map(s => fmt(s.values[i]))]));
  const chart = host.querySelector(".chart"), tip = tipFor(chart);
  chart.querySelectorAll(".hit").forEach(el => {
    el.addEventListener("mousemove", ev => {
      const i = +el.dataset.i, box = chart.getBoundingClientRect();
      tip.show(`<b>${esc(tipLabel(labels[i]))}</b><br>` + series.map(s => `${esc(s.name)}: ${fmt(s.values[i])}`).join("<br>"),
        ev.clientX - box.left, ev.clientY - box.top);
    });
    el.addEventListener("mouseleave", tip.hide);
  });
}

// Horizontal bars, one series, sorted by the caller.
function barChart(host, { items, color = SERIES.all, name = "Postings" }) {
  const rowH = 26, W = 900, m = { t: 6, r: 60, b: 6, l: 250 };
  const H = m.t + m.b + rowH * items.length, iw = W - m.l - m.r;
  const max = Math.max(1, ...items.map(d => d.value));
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
  items.forEach((d, i) => {
    const yy = m.t + i * rowH, w = (d.value / max) * iw;
    const label = d.label.length > 34 ? d.label.slice(0, 33) + "…" : d.label;
    svg += `<text class="lbl" x="${m.l - 8}" y="${yy + rowH / 2 + 4}" text-anchor="end">${esc(label)}</text>`;
    svg += `<path d="${barPath(m.l, yy + 5, Math.max(w, 1.5), rowH - 10, true)}" fill="${color}"/>`;
    svg += `<text class="val" x="${m.l + w + 6}" y="${yy + rowH / 2 + 4}">${fmt(d.value)}</text>`;
    svg += `<rect class="hit" data-i="${i}" x="0" y="${yy}" width="${W}" height="${rowH}"/>`;
  });
  svg += `<line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H - m.b}" stroke="#d9bfca"/></svg>`;
  host.innerHTML = `<div class="chart">${svg}</div>` + tableView(["", name], items.map(d => [d.label, fmt(d.value)]));
  const chart = host.querySelector(".chart"), tip = tipFor(chart);
  chart.querySelectorAll(".hit").forEach(el => {
    el.addEventListener("mousemove", ev => {
      const d = items[+el.dataset.i], box = chart.getBoundingClientRect();
      tip.show(`<b>${esc(d.label)}</b><br>${esc(name)}: ${fmt(d.value)}`, ev.clientX - box.left, ev.clientY - box.top);
    });
    el.addEventListener("mouseleave", tip.hide);
  });
}

// One 100% bar split into two parts (share charts).
function splitBar(host, { a, b, aName, bName }) {
  const total = a + b, W = 900, H = 60, wA = total ? (a / total) * W : 0;
  const pct = v => (total ? Math.round((v / total) * 1000) / 10 : 0) + "%";
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
  if (total) {
    svg += `<rect x="0" y="8" width="${Math.max(0, wA - 1)}" height="34" rx="4" fill="${SERIES.role}"/>`;
    svg += `<rect x="${wA + 1}" y="8" width="${Math.max(0, W - wA - 1)}" height="34" rx="4" fill="${SERIES.all}"/>`;
  } else {
    svg += `<rect x="0" y="8" width="${W}" height="34" rx="4" fill="#f0dfe6"/>`;
  }
  svg += "</svg>";
  host.innerHTML = `<div class="legend"><span><i style="background:${SERIES.role}"></i>${esc(aName)}: ${fmt(a)} (${pct(a)})</span>` +
    `<span><i style="background:${SERIES.all}"></i>${esc(bName)}: ${fmt(b)} (${pct(b)})</span></div><div class="chart">${svg}</div>` +
    tableView(["Group", "Postings"], [[aName, fmt(a)], [bName, fmt(b)]]);
}
