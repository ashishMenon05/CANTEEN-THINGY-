const CACHE_NAME = "qpass-v1";
const ASSETS_TO_CACHE = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // We do NOT cache dynamic inventory, payment, or scanner verification API requests
  // Server-authoritative operations must remain live
  if (
    event.request.url.includes("/api/payment") ||
    event.request.url.includes("/api/staff/scanner") ||
    event.request.url.includes("/api/hold")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).catch(() => {
          // If offline and request is for page, return cached root if available
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
        })
      );
    })
  );
});
