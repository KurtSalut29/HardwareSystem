/*
 * RM Hardware service worker.
 *
 * Kept deliberately small and safe for a store system:
 *  - Store data (anything under /api/) and pages always come from the network,
 *    so prices, stock and orders are never shown from an old copy.
 *  - Built app files (/_next/static/, hashed, never change) and the icons are
 *    cached so the app opens faster.
 *  - When a page can't load because the device is offline, a friendly
 *    "You're offline" page shows instead of the browser's error.
 *
 * Bump VERSION when this file or offline.html changes, so old caches are dropped.
 */
const VERSION = "v1";
const CACHE = `rm-hardware-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/logo.png", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("rm-hardware-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/logo.png";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // live data: network only

  // Pages: always fresh from the network; the offline page if there is none.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Hashed build files and icons: from the cache once fetched.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })),
    );
  }
});
