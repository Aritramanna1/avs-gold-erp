import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useBilling, type Invoice } from "@/lib/billing-store";
import { useOrders, type Order } from "@/lib/orders-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import type { GoldSettlementRecord } from "@/lib/supabase-services";
import { useJobCards, type JobCard } from "@/lib/jobcards-store";
import { useDeliveryChallans, type DeliveryChallan } from "@/lib/billing-documents-store";
import { resolveFirmIdForQuery, withFirmScope } from "@/lib/firm-scoped-query";

/** Per-table cap — customer ledger context is a merge helper, not a full history export. */
const CUSTOMER_CONTEXT_ROW_LIMIT = 120;

export interface CustomerLedgerContextResult {
  invoices: number;
  orders: number;
  settlements: number;
  jobCards: number;
  deliveryChallans: number;
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

function jsonRows<T>(rows: Array<{ data: T | null }> | null | undefined): T[] {
  return (rows ?? []).map((row) => row.data).filter((row): row is T => !!row);
}

export async function hydrateCustomerLedgerContext(
  customerId: string,
): Promise<CustomerLedgerContextResult> {
  if (!customerId) {
    return { invoices: 0, orders: 0, settlements: 0, jobCards: 0, deliveryChallans: 0 };
  }

  const firmId = await resolveFirmIdForQuery();
  if (!firmId) {
    return { invoices: 0, orders: 0, settlements: 0, jobCards: 0, deliveryChallans: 0 };
  }

  const db = supabase as any;
  const scope = <T extends { eq: (col: string, val: string) => T }>(q: T) =>
    withFirmScope(q, firmId);
  const [invoiceRes, orderRes, settlementRes, jobRes, challanRes] = await Promise.all([
    scope(db.from("invoices").select("data").eq("customer_id", customerId).limit(CUSTOMER_CONTEXT_ROW_LIMIT)),
    scope(db.from("orders").select("data").eq("customer_id", customerId).limit(CUSTOMER_CONTEXT_ROW_LIMIT)),
    scope(
      db
        .from("gold_settlements")
        .select("data")
        .eq("party_type", "customer")
        .eq("party_id", customerId)
        .limit(CUSTOMER_CONTEXT_ROW_LIMIT),
    ),
    scope(db.from("job_cards").select("data").eq("customer_id", customerId).limit(CUSTOMER_CONTEXT_ROW_LIMIT)),
    scope(
      db
        .from("delivery_challans")
        .select("data")
        .eq("customer_id", customerId)
        .limit(CUSTOMER_CONTEXT_ROW_LIMIT),
    ),
  ]);

  const firstError = [invoiceRes, orderRes, settlementRes, jobRes, challanRes].find(
    (result) => result.error,
  )?.error;
  if (firstError) {
    throw new Error(firstError.message ?? "Could not load customer ledger context.");
  }

  const invoices = jsonRows<Invoice>(invoiceRes.data).filter((row) => row.id && row.invoiceNo);
  const orders = jsonRows<Order>(orderRes.data).filter((row) => row.id && row.orderNo);
  const settlements = jsonRows<GoldSettlementRecord>(settlementRes.data).filter((row) => row.id);
  const jobCards = jsonRows<JobCard>(jobRes.data).filter((row) => row.id && row.jobNo);
  const challans = jsonRows<DeliveryChallan>(challanRes.data).filter(
    (row) => row.id && row.challanNo,
  );

  useBilling.setState((state) => ({ invoices: mergeById(state.invoices, invoices) }));
  useOrders.setState((state) => ({ orders: mergeById(state.orders, orders) }));
  useGoldSettlement.setState((state) => ({
    settlements: mergeById(state.settlements, settlements),
  }));
  useJobCards.setState((state) => ({ jobs: mergeById(state.jobs, jobCards) }));
  useDeliveryChallans.setState((state) => ({
    challans: mergeById(state.challans, challans),
  }));

  return {
    invoices: invoices.length,
    orders: orders.length,
    settlements: settlements.length,
    jobCards: jobCards.length,
    deliveryChallans: challans.length,
  };
}
