/**
 * Push-notification deep-link resume (CVsE73i6 shop parity).
 * Recovered from production-dist-shop/assets/deep-link-*.js
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  normalizeNotificationHref,
  parseNotificationNavigateTarget,
} from "@/lib/notifications/href-policy";
import { router } from "@/router";

const PENDING_KEY = "ornexa.push.pending_route.v1";

/** Optional inbox highlight helper — shop calls a store action when notificationId present. */
type InboxHighlight = (id: string) => void;

let inboxHighlight: InboxHighlight | null = null;

/** Wire from app boot if an inbox highlight store is available. */
export function setPushInboxHighlightHandler(handler: InboxHighlight | null): void {
  inboxHighlight = handler;
}

export function savePendingPushRoute(href: string): void {
  const normalized = normalizeNotificationHref(href);
  if (!normalized) return;
  try {
    sessionStorage.setItem(PENDING_KEY, normalized);
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekPendingPushRoute(): string | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? normalizeNotificationHref(raw) : null;
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
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  clearPendingPushRoute();
  const target = parseNotificationNavigateTarget(href);
  if (!target) return false;
  await router.navigate({
    to: target.to as never,
    search: (target.search ?? {}) as never,
    hash: target.hash,
  });
  return true;
}

export async function handlePushDeepLink(
  href: string,
  notificationId?: string | null,
): Promise<void> {
  const normalized = normalizeNotificationHref(href);
  if (!normalized) return;

  if (notificationId) {
    const id = notificationId.startsWith("inbox-") ? notificationId : `inbox-${notificationId}`;
    inboxHighlight?.(id);
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    savePendingPushRoute(normalized);
    await router.navigate({ to: "/login", search: {} as never });
    return;
  }

  const target = parseNotificationNavigateTarget(normalized);
  if (target) {
    await router.navigate({
      to: target.to as never,
      search: (target.search ?? {}) as never,
      hash: target.hash,
    });
  }
}

export function installPushMessageListener(): void {
  if (typeof window === "undefined") return;
  navigator.serviceWorker?.addEventListener("message", (event) => {
    const data = event.data as { type?: string; href?: string; notificationId?: string } | undefined;
    if (data?.type === "push-navigate" && data.href) {
      void handlePushDeepLink(data.href, data.notificationId);
    }
  });
}
