// Minimal offline shell, not an offline data story: campaign data is
// inherently live and server-backed, so /api/* requests are always left to
// the network untouched — caching them would risk showing a DM stale or
// wrong state mid-session, which is worse than a clear network error. This
// only keeps the app shell (HTML/JS/CSS) available after a bad-wifi drop,
// via a network-first-with-cache-fallback strategy that fills the cache as
// pages are actually visited (no build-time precache list to keep in sync).
const CACHE_NAME = "spark-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});
