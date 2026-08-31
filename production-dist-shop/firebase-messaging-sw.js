/* eslint-disable no-undef */
/**
 * FCM background handler for web push.
 */
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js");

const ALLOWED_PREFIXES = [
  "/app",
  "/billing",
  "/orders",
  "/manufacturing",
  "/communications",
  "/settings",
  "/notifications",
  "/reports",
  "/portal",
  "/platform",
  "/treasury",
  "/stock",
  "/repair",
  "/people",
  "/conversion",
  "/invite",
  "/karigar-portal",
  "/customer-portal",
  "/supplier-portal",
];

function isAllowedHref(href) {
  if (!href || typeof href !== "string") return false;
  const path = href.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (/^https?:\/\//i.test(path)) return false;
  return ALLOWED_PREFIXES.some(
    (prefix) =>
      path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
  );
}

let messaging = null;

function initFirebase(config) {
  if (!config || messaging) return;
  firebase.initializeApp(config);
  messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const href = isAllowedHref(data.href) ? data.href : "/notifications";
    const title = data.title || payload.notification?.title || "AVS ERP";
    const body = data.body || payload.notification?.body || "You have a new notification";
    self.registration.showNotification(title, {
      body,
      data: { ...data, href },
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    });
  });
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data?.type === "firebase-config" && data.config) {
    initFirebase(data.config);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const href = isAllowedHref(data.href) ? data.href : "/notifications";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.postMessage({ type: "push-navigate", href, notificationId: data.notificationId });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(`${self.location.origin}${href}`);
      }
    }),
  );
});
