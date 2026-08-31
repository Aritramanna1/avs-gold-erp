/**
 * Order Delay Monitor & Automated Apology Email Engine
 *
 * Scans active customer orders against their promised `expectedDelivery` dates.
 * When an order is overdue (expectedDelivery < today and status not delivered/cancelled),
 * it triggers a sincere, professional apology email:
 * "We are sorry that your order is delayed, we will deliver you as soon as possible."
 */
import { useOrders, type Order } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { useEmailConfigStore } from "./email-config-store";
import { dispatchAutomaticBusinessEvent, type AutomaticDispatchResult } from "./automatic-communication-engine";

/** Check if an order is past its promised delivery date and still active */
export function isOrderDelayed(order: Order, nowIsoDate?: string): boolean {
  if (!order.expectedDelivery || !order.expectedDelivery.trim()) return false;
  if (order.status === "delivered" || order.status === "cancelled") return false;

  const today = nowIsoDate || new Date().toISOString().slice(0, 10);
  return order.expectedDelivery < today;
}

export interface SendDelayNotificationOptions {
  revisedDate?: string;
  reasonText?: string;
}

/**
 * Dispatch an apology email for a delayed order to the customer.
 * Appends an entry to the order's timeline so staff can verify it was communicated.
 */
export async function sendOrderDelayNotification(
  order: Order,
  options?: SendDelayNotificationOptions,
): Promise<AutomaticDispatchResult> {
  const people = usePeople.getState().people;
  const customer = people.find((p) => p.id === order.customerId);

  const recipientName = customer?.fullName || "Valued Customer";
  const recipientEmail = customer?.email || null;
  const recipientPhone = customer?.phone || null;

  const result = await dispatchAutomaticBusinessEvent({
    eventKey: "order_delayed",
    branchId: order.branchId,
    recipient: {
      name: recipientName,
      email: recipientEmail,
      phone: recipientPhone,
    },
    docType: "order_slip",
    recordId: order.id,
    documentNumber: order.orderNo,
    variables: {
      orderNo: order.orderNo,
      documentNumber: order.orderNo,
      dueDate: order.expectedDelivery || "",
      revisedDate: options?.revisedDate || "",
      reasonText: options?.reasonText || "",
    },
  });

  if (result.ok && !result.skipped) {
    const appendTimeline = useOrders.getState().appendTimeline;
    await appendTimeline(order.id, {
      ts: Date.now(),
      label: "Delay Apology Email Sent",
      note: `Customer apologized for order delay (Original Due: ${order.expectedDelivery || "—"}${
        options?.revisedDate ? `, Revised: ${options.revisedDate}` : ""
      })`,
    });
  }

  return result;
}

/**
 * Automatic sweep: Checks all orders in the system, identifies delayed ones,
 * and automatically dispatches the apology email.
 */
export async function checkAndNotifyDelayedOrders(): Promise<{
  checkedCount: number;
  delayedCount: number;
  notifiedCount: number;
}> {
  const config = useEmailConfigStore.getState();
  if (!config.autoEmailEnabled || !config.eventToggles.order_delayed) {
    return { checkedCount: 0, delayedCount: 0, notifiedCount: 0 };
  }

  const allOrders = useOrders.getState().orders;
  const today = new Date().toISOString().slice(0, 10);

  let delayedCount = 0;
  let notifiedCount = 0;

  for (const order of allOrders) {
    if (isOrderDelayed(order, today)) {
      delayedCount++;

      // Check if already notified for this expectedDelivery date
      const alreadyNotified = order.timeline?.some(
        (e) =>
          e.label === "Delay Apology Email Sent" &&
          e.note?.includes(`Original Due: ${order.expectedDelivery}`),
      );

      if (!alreadyNotified) {
        const res = await sendOrderDelayNotification(order);
        if (res.ok && !res.skipped) {
          notifiedCount++;
        }
      }
    }
  }

  return {
    checkedCount: allOrders.length,
    delayedCount,
    notifiedCount,
  };
}
