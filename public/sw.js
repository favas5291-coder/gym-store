/* Only the offline document and its static assets are cached. Never cache
   storefront HTML, API responses, credentials, orders, prices or payments. */
const CACHE_NAME = "gymdrobe-offline-__GYMDROBE_PWA_VERSION__";
const OFFLINE_FILES = ["/offline.html", "/offline.js", "/icons/gymdrobe-maskable-512.png?v=1"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_FILES)));
  // Updates wait for tabs to close or an explicit update from /install.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("gymdrobe-offline-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || /^\/api(?:\/|$)/.test(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match("/offline.html")) || Response.error();
    }));
  } else if (OFFLINE_FILES.includes(url.pathname + url.search)) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) => (await cache.match(request)) || fetch(request)));
  }
});
