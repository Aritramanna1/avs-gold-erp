/**
 * Auth-aware deep link resume for push notification taps.
 */
import { router } from "@/router";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { markNotificationReadRpc } from "@/lib/notifications/enqueue-client";
import {
  parseNotificationNavigateTarget,
  resolveNotificationNavigationTarget,
} from "@/lib/notifications/href-policy";

const PENDING_KEY = "ornexa.push.pending_route.v1";

export function savePendingPushRoute(href: string): void {
  const normalized = resolveNotificationNavigationTarget(href);
  if (!normalized) return;
  try {
    sessionStorage.setItem(PENDING_KEY, normalized);
  } catch {
    /* ignore */
  }
}

export function peekPendingPushRoute(): string | null {
  try {
    const href = sessionStorage.getItem(PENDING_KEY);
    return href ? resolveNotificationNavigationTarget(href) : null;
  } catch {
    return null;
  }
}

export function clearPendingPushRoute(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export async function resumePendingPushRoute(): Promise<boolean> {
  const href = peekPendingPushRoute();
  if (!href) return false;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;
  clearPendingPushRoute();
  const target = parseNotificationNavigateTarget(href);
  if (!target) return false;
  void router.navigate({
    to: target.to as never,
    search: target.search as never,
    hash: target.hash,
  });
  return true;
}

export async function handlePushDeepLink(
  href: string | undefined,
  notificationId?: string,
): Promise<void> {
  const normalized = resolveNotificationNavigationTarget(href);
  if (!normalized) return;
  if (notificationId) {
    void markNotificationReadRpc(
      notificationId.startsWith("inbox-") ? notificationId : `inbox-${notificationId}`,
    );
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    savePendingPushRoute(normalized);
    void router.navigate({ to: "/login" as never });
    return;
  }
  const target = parseNotificationNavigateTarget(normalized);
  if (!target) return;
  void router.navigate({
    to: target.to as never,
    search: target.search as never,
    hash: target.hash,
  });
}

/** Web SW posts this message on notificationclick */
export function installPushMessageListener(): void {
  if (typeof window === "undefined") return;
  navigator.serviceWorker?.addEventListener("message", (event) => {
    const data = event.data as { type?: string; href?: string; notificationId?: string } | undefined;
    if (data?.type === "push-navigate" && data.href) {
      void handlePushDeepLink(data.href, data.notificationId);
    }
  });
}
