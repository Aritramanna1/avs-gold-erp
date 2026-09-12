/**
 * Ornexa app-shell service worker — static assets only.
 * Does NOT cache Supabase API responses or business data.
 */
const CACHE = "ornexa-shell-v3";
const SHELL_ASSETS = ["/site.webmanifest", "/favicon.ico"];

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
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
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

  // Never cache HTML / navigation requests — always fetch fresh HTML so updates are instant
  if (request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
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
