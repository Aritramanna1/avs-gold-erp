/**
 * Client-side enqueue helper for unified user_notifications inbox.
 * Authorization: RPC only permits enqueue for self (see migration).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { CommunicationEventKey } from "@/lib/comm/platform/communication-events";
import { sanitizeNotificationHref } from "@/lib/notifications/href-policy";

export type NotificationCategory =
  | "billing"
  | "payments"
  | "manufacturing"
  | "gold_stock"
  | "portal"
  | "approvals"
  | "system";

export interface EnqueueUserNotificationInput {
  recipientId?: string;
  category?: NotificationCategory;
  title: string;
  message?: string;
  href?: string;
  eventKey?: CommunicationEventKey | string;
  referenceType?: string;
  referenceId?: string;
  priority?: "low" | "normal" | "high" | "critical";
  idempotencyKey?: string;
  mandatory?: boolean;
  firmId?: string;
}

export {
  isAllowedNotificationHref,
  normalizeNotificationHref,
  sanitizeNotificationHref,
  resolveNotificationNavigationTarget,
  canNavigateNotification,
  parseNotificationNavigateTarget,
  navigateFromNotificationHref,
} from "@/lib/notifications/href-policy";

export async function enqueueUserNotification(
  input: EnqueueUserNotificationInput,
): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    const recipientId = input.recipientId ?? user?.id;
    if (!recipientId) return null;
    if (user && recipientId !== user.id) {
      console.warn("[Notifications] cross-user enqueue blocked client-side");
      return null;
    }

    const { data, error } = await (supabase as any).rpc("enqueue_user_notification", {
      p_recipient_id: recipientId,
      p_category: input.category ?? "system",
      p_title: input.title,
      p_message: input.message,
      p_href: sanitizeNotificationHref(input.href),
      p_event_key: input.eventKey,
      p_reference_type: input.referenceType,
      p_reference_id: input.referenceId,
      p_priority: input.priority ?? "normal",
      p_idempotency_key: input.idempotencyKey,
      p_payload_min: {},
      p_mandatory: input.mandatory ?? false,
      p_firm_id: input.firmId,
    });
    if (error) {
      console.warn("[Notifications] enqueue failed:", error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (err) {
    console.warn("[Notifications] enqueue error:", err);
    return null;
  }
}

export async function enqueueForCurrentUser(
  input: Omit<EnqueueUserNotificationInput, "recipientId">,
): Promise<string | null> {
  return enqueueUserNotification(input);
}

export async function markNotificationReadRpc(notificationId: string): Promise<void> {
  const id = notificationId.replace(/^inbox-/, "");
  await (supabase as any).rpc("mark_notification_read", { p_notification_id: id });
}

export async function markAllNotificationsReadRpc(): Promise<void> {
  await (supabase as any).rpc("mark_all_notifications_read");
}
