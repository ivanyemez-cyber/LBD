// App-shell cache only; API calls always go to the network (no client data cached on the device).
const C = "blue-v2", SHELL = ["/", "/index.html", "/manifest.json", "/icon.svg"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL))));
self.addEventListener("fetch", (e) => {
  if (new URL(e.request.url).pathname.startsWith("/api/")) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : { title: "Blue", body: "Knock knock!" };
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: "/icon.svg", badge: "/icon.svg", data: { url: d.url || "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
