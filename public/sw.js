self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Keep this worker network-pass-through. Scholars should always show current
// eligibility and deadline data rather than serving stale caches.
self.addEventListener("fetch", () => {});

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
