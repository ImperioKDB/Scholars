const CACHE_NAME = "scholars-static-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.add(OFFLINE_URL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("scholars-static-") && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        return (await caches.match(OFFLINE_URL)) || Response.error();
      }
    })());
    return;
  }

  const isStaticAsset = url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/logo.svg";
  if (!isStaticAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "You have a new Scholars update." };
  }
  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title.slice(0, 80)
    : "Scholars";
  const body = typeof payload.body === "string" && payload.body.trim()
    ? payload.body.slice(0, 180)
    : "You have a new update. Tap to see it in Scholars.";
  const rawUrl = typeof payload.data?.url === "string" ? payload.data.url : "/notifications";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/logo.svg",
    badge: "/logo.svg",
    data: { url: rawUrl },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = new URL("/notifications", self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url || "/notifications", self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  } catch {
    // Keep the safe in-app inbox URL.
  }
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ("focus" in client) {
        if ("navigate" in client) return client.navigate(target.href).then(() => client.focus());
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  }));
});
