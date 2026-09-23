self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Keep this worker intentionally network-pass-through. Scholars should always
// show current eligibility and deadline data rather than serving stale caches.
self.addEventListener("fetch", () => {});
