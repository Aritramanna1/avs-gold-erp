import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { Invoice } from "@/lib/billing-store";
import type { Settlement } from "@/lib/settlement-store";

const DELIVERY_SUMMARY_LIMIT = 1000;

function readJsonRow<T>(row: unknown): T | null {
  if (!row || typeof row !== "object") return null;
  const raw = (row as { data?: unknown }).data;
  if (raw && typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return row as T;
}

function dayBoundsMs(date: string): { start: number; end: number } {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  return { start: start.getTime(), end: end.getTime() };
}

export interface DeliverySummaryData {
  settlements: Settlement[];
  invoices: Invoice[];
  capped: boolean;
}

export interface SettlementReportData {
  settlements: Settlement[];
  invoices: Invoice[];
  capped: boolean;
}

async function fetchLinkedInvoices(settlements: Settlement[]): Promise<Invoice[]> {
  const invoiceIds = Array.from(
    new Set(settlements.map((settlement) => settlement.linkedInvoiceId).filter(Boolean)),
  ) as string[];

  if (invoiceIds.length === 0) return [];

  const { data: invoiceRows, error: invoiceError } = await supabase
    .from("invoices")
    .select("data")
    .in("id", invoiceIds)
    .limit(DELIVERY_SUMMARY_LIMIT);

  if (invoiceError) {
    throw new Error(`Could not load linked invoices: ${invoiceError.message}`);
  }

  return ((invoiceRows ?? []) as unknown[])
    .map((row) => readJsonRow<Invoice>(row))
    .filter((row): row is Invoice => !!row?.id);
}

export async function fetchSettlementReportData(options?: {
  status?: string;
  finalisedOnly?: boolean;
}): Promise<SettlementReportData> {
  let query = supabase
    .from("customer_settlements")
    .select("data")
    .order("created_at", { ascending: false })
    .limit(DELIVERY_SUMMARY_LIMIT);

  if (options?.status && options.status !== "all") {
    query = query.eq("data->>financialStatus", options.status);
  }

  const { data: settlementRows, error: settlementError } = await query;
  if (settlementError) {
    throw new Error(`Could not load customer settlements: ${settlementError.message}`);
  }

  const settlements = ((settlementRows ?? []) as unknown[])
    .map((row) => readJsonRow<Settlement>(row))
    .filter((row): row is Settlement => {
      if (!row?.id) return false;
      if (options?.finalisedOnly) return !!row.finalisedAt && !!row.linkedInvoiceId;
      return true;
    });

  const invoices = await fetchLinkedInvoices(settlements);

  return {
    settlements,
    invoices,
    capped:
      (settlementRows?.length ?? 0) >= DELIVERY_SUMMARY_LIMIT ||
      invoices.length >= DELIVERY_SUMMARY_LIMIT,
  };
}

export async function fetchDeliverySummaryData(date: string): Promise<DeliverySummaryData> {
  const { start, end } = dayBoundsMs(date);

  const { data: settlementRows, error: settlementError } = await supabase
    .from("customer_settlements")
    .select("data")
    .gte("data->>deliveredAt", String(start))
    .lte("data->>deliveredAt", String(end))
    .order("updated_at", { ascending: false })
    .limit(DELIVERY_SUMMARY_LIMIT);

  if (settlementError) {
    throw new Error(`Could not load delivery settlements: ${settlementError.message}`);
  }

  const settlements = ((settlementRows ?? []) as unknown[])
    .map((row) => readJsonRow<Settlement>(row))
    .filter((row): row is Settlement => !!row?.id);

  const invoices = await fetchLinkedInvoices(settlements);

  return {
    settlements,
    invoices,
    capped:
      settlements.length >= DELIVERY_SUMMARY_LIMIT || invoices.length >= DELIVERY_SUMMARY_LIMIT,
  };
}
