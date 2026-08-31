/**
 * Resolves customer-ledger voucher rows to navigable ERP routes.
 */
import type { LedgerSource } from "@/lib/customer-account-ledger";
import type { MovementType } from "@/lib/ledger-store";

const KARIGAR_MOVEMENT_TYPES = new Set<MovementType>([
  "issue_to_karigar",
  "receive_from_karigar",
  "worker_gold_advance",
  "worker_wastage_gold_return",
  "finished_item_created",
  "dust_returned",
  "scrap_returned",
  "wastage",
  "overloss",
  "sent_to_polisher",
  "received_from_polisher",
  "workshop_process_gold_issued",
  "workshop_process_recovery_received",
  "workshop_process_loss",
]);

const CUSTOMER_MOVEMENT_TYPES = new Set<MovementType>([
  "customer_gold_received",
  "old_gold_received",
  "sale",
  "job_work_delivery",
  "customer_gold_credit_applied",
]);

export function resolveGoldLedgerEntryRoute(
  entry: {
    type: MovementType;
    karigarId?: string;
    customerId?: string;
    reference?: string;
  },
  ctx?: { jobByNo?: Map<string, { id: string }> },
): string | null {
  const ref = entry.reference?.trim();
  if (ref && ctx?.jobByNo) {
    const head = ref.split("·")[0]?.trim() ?? ref;
    const exact = ctx.jobByNo.get(head);
    if (exact) return `/workshop/job-card/${exact.id}`;
    for (const [jobNo, job] of ctx.jobByNo) {
      if (ref.includes(jobNo)) return `/workshop/job-card/${job.id}`;
    }
  }

  if (entry.karigarId && KARIGAR_MOVEMENT_TYPES.has(entry.type)) {
    return `/people/${entry.karigarId}`;
  }
  if (entry.customerId && CUSTOMER_MOVEMENT_TYPES.has(entry.type)) {
    return `/people/${entry.customerId}`;
  }
  if (entry.type === "conversion_deducted" || entry.type === "conversion_added") {
    return "/conversion";
  }
  if (entry.type === "ready_stock_purchase_received") {
    return "/stock";
  }
  if (entry.type.startsWith("melt_")) {
    return "/conversion";
  }
  return null;
}

export function resolveLedgerVoucherRoute(input: {
  source: LedgerSource;
  sourceEntityId?: string;
  voucherNo?: string;
  customerId?: string;
}): string | null {
  const { source, sourceEntityId, voucherNo, customerId } = input;
  if (!sourceEntityId && !voucherNo) return null;

  switch (source) {
    case "invoice":
      return sourceEntityId ? `/billing/${sourceEntityId}` : null;
    case "order":
      return sourceEntityId ? `/orders/${sourceEntityId}` : null;
    case "settlement":
      return sourceEntityId ? `/billing/gold-settlement-print/${sourceEntityId}` : null;
    case "manufacturing_bill":
      return sourceEntityId
        ? `/manufacturing/bill/${sourceEntityId.replace(/-(billed|delivered|charges)$/, "")}`
        : null;
    case "delivery_challan":
      return sourceEntityId ? `/billing/delivery-challans/${sourceEntityId}` : null;
    case "payment":
      return sourceEntityId ? `/billing/receipt/${sourceEntityId}` : null;
    case "opening_balance":
      return customerId ? `/people/${customerId}` : null;
    case "treasury":
      return "/treasury/vouchers";
    default:
      return null;
  }
}

/** Deep link for a universal money ledger row — matches recovered CVsE73i6 shop behaviour. */
export function resolveMoneyEntryRoute(entry: {
  metadata?: Record<string, unknown>;
  counterpartyId?: string | null;
}): string | null {
  const m = entry.metadata ?? {};
  const source = typeof m.source === "string" ? m.source : "";
  const sourceId = typeof m.sourceId === "string" ? m.sourceId : undefined;
  const invoiceId = typeof m.invoiceId === "string" ? m.invoiceId : undefined;
  if (typeof m.documentRoute === "string" && m.documentRoute.startsWith("/")) {
    return m.documentRoute;
  }
  switch (source) {
    case "billing_payment":
      return invoiceId ? `/billing/${invoiceId}` : sourceId ? `/billing/receipt/${sourceId}` : "/billing";
    case "party_ledger_cash_gold":
      return entry.counterpartyId ? `/people/${entry.counterpartyId}` : null;
    case "gold_settlement_cash":
      return sourceId
        ? `/billing/gold-settlement-print/${sourceId.replace(/_cash$/, "")}`
        : "/settlement/new";
    case "expense":
      return "/expenses";
    case "treasury_voucher":
    case "treasury_journal":
    case "treasury_contra":
      return "/treasury/vouchers";
    default:
      return "/treasury/vouchers";
  }
}
