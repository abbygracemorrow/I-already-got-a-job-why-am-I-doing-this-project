// Service worker: network first, cache as the fallback.
// Online, every page and data file comes from the network (and the copy is saved).
// Offline, the site still opens and shows the last data it loaded.
const CACHE = "job-watcher-v37";
const SHELL = [
  "./", "index.html", "browse.html", "market.html",
  "assets/style.css", "assets/common.js", "assets/charts.js",
  "assets/today.js", "assets/browse.js", "assets/market.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
  "icons/ornament.svg", "icons/garland.svg", "icons/flower-garland.svg", "icons/garland-lights.svg", "icons/favicon.svg", "icons/favicon-32.png", "icons/santa-hat.svg", "icons/candy-cane.svg", "icons/gingerbread-village.svg", "assets/snoopy.png",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return;
  event.respondWith(
    fetch(req).then(res => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(hit => hit ||
        (req.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
