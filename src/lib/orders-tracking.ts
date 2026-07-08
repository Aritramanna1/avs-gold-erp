/**
 * MTJ ERP — Order tracking helpers (Sprint Final)
 * Pure helpers, no UI. Used by Home dashboard and Orders list to surface
 * Today's Deliveries / Due Tomorrow / Delayed / pending-step buckets.
 */
import type { Order } from "@/lib/orders-store";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayYmd(): string {
  return ymd(new Date());
}
export function tomorrowYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return ymd(d);
}

export type DeliveryBucket = "today" | "tomorrow" | "delayed" | "future" | "none";

export function deliveryBucket(o: Pick<Order, "expectedDelivery" | "status">): DeliveryBucket {
  if (!o.expectedDelivery) return "none";
  if (o.status === "delivered" || o.status === "cancelled") return "none";
  const today = todayYmd();
  if (o.expectedDelivery < today) return "delayed";
  if (o.expectedDelivery === today) return "today";
  if (o.expectedDelivery === tomorrowYmd()) return "tomorrow";
  return "future";
}

export interface OrdersBuckets {
  today: Order[];
  tomorrow: Order[];
  delayed: Order[];
  pendingJobCard: Order[]; // confirmed/awaiting_job_card and no job linked
  readyBilling: Order[]; // status === ready_billing
}

export function computeOrderBuckets(
  orders: Order[],
  linkedJobOrderIds: Set<string>,
): OrdersBuckets {
  const today: Order[] = [];
  const tomorrow: Order[] = [];
  const delayed: Order[] = [];
  const pendingJobCard: Order[] = [];
  const readyBilling: Order[] = [];
  for (const o of orders) {
    const b = deliveryBucket(o);
    if (b === "today") today.push(o);
    else if (b === "tomorrow") tomorrow.push(o);
    else if (b === "delayed") delayed.push(o);
    if (
      (o.status === "confirmed" || o.status === "awaiting_job_card" || o.status === "draft") &&
      !linkedJobOrderIds.has(o.id) &&
      o.type === "custom"
    ) {
      pendingJobCard.push(o);
    }
    if (o.status === "ready_billing") readyBilling.push(o);
  }
  return { today, tomorrow, delayed, pendingJobCard, readyBilling };
}

export function customerReminderMessage(args: {
  customerName: string;
  orderNo: string;
  itemName: string;
  shopName?: string;
}): string {
  return `Dear ${args.customerName}, your order ${args.orderNo} for ${args.itemName} is currently in progress. We will update you shortly. Thank you — ${args.shopName ?? "our store"}.`;
}

export function karigarReminderMessage(args: {
  karigarName: string;
  orderNo: string;
  itemName: string;
  deliveryDate?: string;
}): string {
  return `${args.karigarName} ji, order ${args.orderNo} / ${args.itemName} is due on ${args.deliveryDate ?? "the agreed date"}. Please update work status.`;
}
