/**
 * Ornexa app-shell service worker — static assets only.
 * Does NOT cache Supabase API responses or business data.
 */
const CACHE = "ornexa-shell-v2";
const SHELL_ASSETS = ["/", "/index.html", "/site.webmanifest", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.origin !== self.location.origin) return;

  // Never intercept Supabase or authenticated API traffic
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("functions/v1")
  ) {
    return;
  }

  // Navigation: network-first (fresh HTML for deploys)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html").then((r) => r ?? fetch(request))),
    );
    return;
  }

  // Hashed build assets: cache-first
  if (/\.(js|css|woff2?|png|svg|ico|wasm)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            if (res.ok) {
              try {
                const clone = res.clone();
                caches
                  .open(CACHE)
                  .then((c) => c.put(request, clone).catch(() => undefined))
                  .catch(() => undefined);
              } catch {
                // Ignore clone/put issues
              }
            }
            return res;
          }),
      ),
    );
  }
});
