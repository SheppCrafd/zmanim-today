/* Zmanim Today service worker — handles Web Push delivery.
   Registered from usePushReminders. Receives push payloads (JSON) from the
   sendZmanimReminders backend function and displays them as notifications. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Zmanim Reminder";
  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    data: { url: data.url || "/" },
    vibrate: [60, 30, 60],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(targetUrl); } catch {}
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});
