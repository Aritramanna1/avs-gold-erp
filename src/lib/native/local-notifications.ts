/**
 * Surface ephemeral in-app alerts as Android local OS notifications.
 * Skips inbox rows — FCM handles authoritative push delivery.
 */
import { isNativeApp } from "@/lib/native/platform";
import { getPushEnabledPreference } from "@/lib/native/push-notifications";
import type { AppNotification } from "@/lib/notifications-store";
import { normalizeNotificationHref, resolveNotificationNavigationTarget } from "@/lib/notifications/href-policy";

const POSTED_KEY = "ornexa.local-notif.posted.v1";
let tapHandlerReady = false;

function postedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(POSTED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function rememberPosted(id: string): void {
  const next = postedIds();
  next.add(id);
  sessionStorage.setItem(POSTED_KEY, JSON.stringify([...next].slice(-200)));
}

function numericId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2147483646) + 1;
}

function humanizeNotifKey(key: string): string {
  return key
    .replace(/^notifications\./, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export async function initLocalNotificationTapHandler(
  navigate: (href: string) => void,
): Promise<void> {
  if (!isNativeApp() || tapHandlerReady) return;
  tapHandlerReady = true;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      const href = (event.notification.extra as { href?: string } | undefined)?.href;
      const normalized = resolveNotificationNavigationTarget(href);
      if (normalized) navigate(normalized);
    });
  } catch (err) {
    console.warn("[OrnexaNotify] tap handler failed", err);
  }
}

export async function syncLocalNotifications(items: AppNotification[], readIds: string[]): Promise<void> {
  if (!isNativeApp()) return;
  const enabled = await getPushEnabledPreference();
  if (!enabled) return;

  const ephemeralOnly = items.filter((n) => n.source === "ephemeral");
  if (!ephemeralOnly.length) return;

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      const asked = await LocalNotifications.requestPermissions();
      if (asked.display !== "granted") return;
    }
    const already = postedIds();
    const unread = ephemeralOnly.filter((n) => !readIds.includes(n.id) && !already.has(n.id));
    if (!unread.length) return;
    const backgrounded =
      typeof document !== "undefined" ? document.visibilityState !== "visible" : true;
    const toPost = backgrounded ? unread : unread.filter((n) => n.severity !== "info");
    if (!toPost.length) return;

    await LocalNotifications.schedule({
      notifications: toPost.slice(0, 8).map((n) => ({
        id: numericId(n.id),
        title: n.titleText || humanizeNotifKey(n.titleKey),
        body: n.descriptionText || humanizeNotifKey(n.descriptionKey),
        extra: { href: n.href, id: n.id },
      })),
    });
    toPost.forEach((n) => rememberPosted(n.id));
  } catch (err) {
    console.warn("[OrnexaNotify] schedule failed", err);
  }
}
