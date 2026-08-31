import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type {
  CreditNote,
  DebitNote,
  DeliveryChallan,
  Estimate,
} from "@/lib/billing-documents-store";
import type { Invoice } from "@/lib/billing-store";
import type { Order } from "@/lib/orders-store";
import { normalizeOrder } from "@/lib/orders-store";
import type { Person } from "@/lib/people-store";

const REGISTER_LIMIT = 200;
const SELECTOR_LIMIT = 100;

type DataRow<T> = {
  data: T | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PeopleSelectorRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  type: string | null;
  active: boolean | null;
  data: Partial<Person> | null;
};

type InvoiceSelectorRow = {
  id: string;
  invoice_no: string | null;
  customer_id: string | null;
  data: Partial<Invoice> | null;
};

function byNewest<T extends { createdAt?: number; updatedAt?: number }>(a: T, b: T): number {
  return (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0);
}

function pickData<T extends { id?: string }>(row: DataRow<Partial<T>>): T | null {
  const data = row.data;
  if (!data?.id) return null;
  return data as T;
}

function remoteLike(value: string): string {
  const cleaned = value.trim().replace(/[,%]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  return `%${cleaned}%`;
}

function filterDocumentQuery(query: any, search?: string) {
  const q = search?.trim();
  if (!q) return query;
  const like = remoteLike(q);
  return query.or(
    `data->>customerName.ilike.${like},data->>invoiceNo.ilike.${like},data->>creditNoteNo.ilike.${like},data->>debitNoteNo.ilike.${like},data->>estimateNo.ilike.${like},data->>challanNo.ilike.${like}`,
  );
}

async function fetchDocumentRows<T extends { id?: string; createdAt?: number; updatedAt?: number }>(
  table: string,
  search?: string,
): Promise<T[]> {
  let request = (supabase as any)
    .from(table)
    .select("data,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(REGISTER_LIMIT);
  request = filterDocumentQuery(request, search);
  const { data, error } = await request;
  if (error) throw new Error(error.message ?? `Could not load ${table}.`);
  return ((data ?? []) as DataRow<Partial<T>>[])
    .map(pickData<T>)
    .filter((row): row is T => !!row)
    .sort(byNewest);
}

export async function fetchBillingDocumentById<
  T extends { id?: string; createdAt?: number; updatedAt?: number },
>(
  table: "credit_notes" | "debit_notes" | "estimates" | "delivery_challans",
  id: string,
): Promise<T | null> {
  const { data, error } = await (supabase as any)
    .from(table)
    .select("data,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message ?? `Could not load ${table}.`);
  return data ? pickData<T>(data as DataRow<Partial<T>>) : null;
}

export function fetchCreditNotes(search?: string): Promise<CreditNote[]> {
  return fetchDocumentRows<CreditNote>("credit_notes", search);
}

export function fetchDebitNotes(search?: string): Promise<DebitNote[]> {
  return fetchDocumentRows<DebitNote>("debit_notes", search);
}

export function fetchEstimates(search?: string): Promise<Estimate[]> {
  return fetchDocumentRows<Estimate>("estimates", search);
}

export function fetchDeliveryChallans(search?: string): Promise<DeliveryChallan[]> {
  return fetchDocumentRows<DeliveryChallan>("delivery_challans", search);
}

export async function fetchActiveCustomerOptions(): Promise<Person[]> {
  const { data, error } = await (supabase as any)
    .from("people")
    .select("id,full_name,phone,email,type,active,data")
    .eq("active", true)
    .in("type", ["customer", "firm_customer"])
    .order("updated_at", { ascending: false })
    .limit(SELECTOR_LIMIT);
  if (error) throw new Error(error.message ?? "Could not load customers.");

  return ((data ?? []) as PeopleSelectorRow[])
    .map((row) => {
      const record = row.data ?? {};
      const id = record.id ?? row.id;
      const fullName = record.fullName ?? row.full_name ?? "";
      if (!id || !fullName) return null;
      return {
        id,
        fullName,
        phone: record.phone ?? row.phone ?? "",
        email: record.email ?? row.email ?? undefined,
        type: (record.type ?? row.type ?? "customer") as Person["type"],
        active: record.active ?? row.active ?? true,
        createdAt: record.createdAt ?? Date.now(),
        updatedAt: record.updatedAt ?? Date.now(),
      } as Person;
    })
    .filter((person): person is Person => !!person);
}

export async function fetchRecentInvoiceOptions(): Promise<Invoice[]> {
  const { data, error } = await (supabase as any)
    .from("invoices")
    .select("id,invoice_no,customer_id,data")
    .neq("status", "cancelled")
    .order("updated_at", { ascending: false })
    .limit(SELECTOR_LIMIT);
  if (error) throw new Error(error.message ?? "Could not load invoice options.");

  return ((data ?? []) as InvoiceSelectorRow[])
    .map((row) => {
      const record = row.data ?? {};
      const id = record.id ?? row.id;
      const invoiceNo = record.invoiceNo ?? row.invoice_no ?? "";
      if (!id || !invoiceNo) return null;
      return {
        ...record,
        id,
        invoiceNo,
        customerId: record.customerId ?? row.customer_id ?? "",
        customerName: record.customerName ?? "",
      } as Invoice;
    })
    .filter((invoice): invoice is Invoice => !!invoice);
}

export async function fetchOpenOrderOptions(): Promise<Order[]> {
  const { data, error } = await (supabase as any)
    .from("orders")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(SELECTOR_LIMIT);
  if (error) throw new Error(error.message ?? "Could not load order options.");

  return ((data ?? []) as Array<{ data: Order | null }>)
    .map((row) => row.data)
    .filter((order): order is Order => !!order?.id && !!order?.orderNo)
    .map(normalizeOrder)
    .filter((order) => order.status === "in_production" || order.status === "ready_for_delivery");
}
