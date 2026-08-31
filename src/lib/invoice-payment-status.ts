import type { Invoice, InvoiceStatus } from "@/lib/billing-store";

export type JewelleryPaymentStatus = "unpaid" | "partial" | "paid" | "overdue" | "draft" | "cancelled";

export function jewelleryPaymentStatus(inv: Pick<Invoice, "status" | "balancePaise" | "paidPaise" | "dueAt" | "cancelledAt">): JewelleryPaymentStatus {
  if (inv.status === "cancelled" || inv.cancelledAt) return "cancelled";
  if (inv.status === "draft") return "draft";
  if (inv.balancePaise <= 0) return "paid";
  const overdue =
    typeof inv.dueAt === "number" && inv.dueAt > 0 && Date.now() > inv.dueAt && inv.balancePaise > 0;
  if (overdue) return "overdue";
  if (inv.paidPaise > 0) return "partial";
  return "unpaid";
}

export const JEWELLERY_PAYMENT_STATUS_LABELS: Record<JewelleryPaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  draft: "Draft",
  cancelled: "Cancelled",
};

export function paymentDueCaption(inv: Pick<Invoice, "dueAt" | "balancePaise" | "status">): string | null {
  if (inv.status === "cancelled" || inv.balancePaise <= 0) return null;
  if (!inv.dueAt) return inv.balancePaise > 0 ? "Payment pending" : null;
  const ms = inv.dueAt - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  if (days < 0) return `Payment overdue — ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Payment pending — due today";
  return `Payment pending — due in ${days} day${days === 1 ? "" : "s"}`;
}
