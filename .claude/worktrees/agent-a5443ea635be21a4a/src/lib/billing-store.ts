/**
 * MTJ ERP — Billing store (Sprint 3)
 *
 * Invoices, payments, customer ledger.
 * Weights mg, money paise, purity per-mille.
 *
 * GST pilot rule: GST = 3% (CGST 1.5 + SGST 1.5) on (making + stone) only.
 * Toggle off via settings — invoice will show "GST not applied".
 *
 * Gold ledger interaction on sale:
 *   - Finished item already lives in the `finished` bucket (from Receive Work).
 *   - Confirming the invoice appends a `sale` movement with delta finished: -fineMg.
 *   - Net total under management decreases by fineMg (gold left the shop).
 *   - Old gold / advance gold applied at order time is NOT re-counted here.
 */

import { create } from "zustand";
import { saveDirect } from "./supabase-write";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "./settings-store";
import { useModuleStore } from "./module-store";
import { createRepository } from "./repositories/base-repository";

export type PaymentMode =
  | "cash"
  | "upi"
  | "bank"
  | "card"
  | "cheque"
  | "gold_exchange"
  | "customer_gold_credit"
  | "advance"
  | "outstanding";

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank Transfer",
  card: "Card",
  cheque: "Cheque",
  gold_exchange: "Gold Exchange",
  customer_gold_credit: "Customer Gold Credit",
  advance: "Advance Adjustment",
  outstanding: "Outstanding (Credit / Due)",
};

export interface InvoiceItem {
  id: string;
  stockItemId?: string;
  barcode?: string;
  itemName: string;
  category: string;
  purity: number;
  grossMg: number;
  netMg: number;
  fineMg: number;
  goldRatePerGramPaise: number; // ₹ per gram, in paise
  goldValuePaise: number; // computed
  makingChargesPaise: number;
  stoneChargesPaise: number;
  otherChargesPaise: number;
  discountPaise: number;
  lineTotalPaise: number; // gold + making + stone + other - discount (pre-GST)
  stoneWeightMg?: number;
  diamondWeightMg?: number;
  huid?: string;
}

export interface PaymentRecord {
  id: string;
  ts: number;
  mode: PaymentMode;
  amountPaise: number;
  reference?: string;
  notes?: string;
  // Optional gold-exchange detail
  goldGrossMg?: number;
  goldPurity?: number;
  goldFineMg?: number;
  goldRatePerGramPaise?: number;
}

export interface OrderAdjustment {
  /** Cash advance carried in from the order (already received). */
  cashAdvancePaise: number;
  cashAdvanceRef?: string;
  /** Old gold / customer gold received at order time, valued for this bill. */
  goldGrossMg: number;
  goldPurity: number;
  goldFineMg: number;
  goldRatePerGramPaise: number;
  goldValuePaise: number;
  goldKind?: "old_gold" | "advance";
}

export type InvoiceStatus = "draft" | "issued" | "paid" | "partial" | "cancelled";
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  partial: "Partially Paid",
  cancelled: "Cancelled",
};

export type GstKind = "none" | "gst3";

export interface Invoice {
  id: string;
  invoiceNo: string;
  createdAt: number;
  updatedAt: number;
  status: InvoiceStatus;

  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerGstin?: string;

  orderId?: string;
  orderNo?: string;
  jobId?: string;
  jobNo?: string;

  items: InvoiceItem[];

  // Adjustments from the linked order — shown so they are not double-billed.
  orderAdjustment?: OrderAdjustment;

  gst: GstKind;
  cgstPaise: number;
  sgstPaise: number;
  gstPaise: number;

  subtotalPaise: number; // sum of items pre-GST
  adjustmentPaise: number; // cashAdvance + oldGoldValue
  grandTotalPaise: number; // subtotal + gst - adjustment
  paidPaise: number; // sum of payments
  balancePaise: number; // grand - paid

  payments: PaymentRecord[];

  notes?: string;
  branchId?: string;
  saleLedgerEntryId?: string;
}

export interface CustomerLedgerLine {
  ts: number;
  kind: "invoice" | "payment" | "advance" | "old_gold" | "gold_credit";
  ref: string; // invoice no / payment id / order no
  refId: string;
  invoiceId?: string;
  orderId?: string;
  description: string;
  debitPaise: number; // customer owes
  creditPaise: number; // customer paid / credited
}

interface BillingState {
  invoices: Invoice[];
  gstDefault: GstKind;
  setGstDefault: (g: GstKind) => void;
  refresh: () => Promise<void>;
  add: (
    i: Omit<Invoice, "id" | "createdAt" | "updatedAt" | "payments"> & {
      invoiceNo?: string;
      payments?: PaymentRecord[];
    },
  ) => Promise<Invoice>;
  update: (id: string, patch: Partial<Invoice>) => Promise<void>;
  addPayment: (
    invoiceId: string,
    p: Omit<PaymentRecord, "id" | "ts"> & { id?: string; ts?: number },
  ) => Promise<PaymentRecord | null>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

function makeId(prefix = "inv"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeInvoiceNo(existing: Invoice[]): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const prefix = `INV-${ymd}-`;
  const today = existing.filter((x) => x.invoiceNo.startsWith(prefix));
  const seq = String(today.length + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

export function computeItemTotals(
  it: Omit<InvoiceItem, "id" | "goldValuePaise" | "lineTotalPaise">,
): { goldValuePaise: number; lineTotalPaise: number } {
  // Gold value uses NET weight (gross - less) × purity / 1000 = fine × rate / 1000
  // We use fineMg × rate(₹/g in paise) / 1000 to get paise.
  const goldValuePaise = Math.round((it.fineMg * it.goldRatePerGramPaise) / 1000);
  const lineTotalPaise =
    goldValuePaise +
    it.makingChargesPaise +
    it.stoneChargesPaise +
    it.otherChargesPaise -
    it.discountPaise;
  return { goldValuePaise, lineTotalPaise };
}

export function computeInvoiceTotals(
  items: InvoiceItem[],
  gst: GstKind,
  adjustment?: OrderAdjustment,
  payments: PaymentRecord[] = [],
): Pick<
  Invoice,
  | "subtotalPaise"
  | "cgstPaise"
  | "sgstPaise"
  | "gstPaise"
  | "adjustmentPaise"
  | "grandTotalPaise"
  | "paidPaise"
  | "balancePaise"
> {
  const subtotalPaise = items.reduce((s, i) => s + i.lineTotalPaise, 0);
  let cgstPaise = 0;
  let sgstPaise = 0;

  if (gst === "gst3" && useModuleStore.getState().isModuleEnabled("gst")) {
    // Dynamic GST parameters configured by the Chartered Accountant (CA)
    const gstConfig = useSettings.getState().gst;

    const ratePct = gstConfig.gstRatePct ?? 3;
    const applyOnMakingAndStoneOnly = gstConfig.applyOnMakingAndStoneOnly ?? true;

    const taxableBase = applyOnMakingAndStoneOnly
      ? items.reduce((s, i) => s + i.makingChargesPaise + i.stoneChargesPaise, 0)
      : subtotalPaise;

    if (gstConfig.splitMode === "igst") {
      cgstPaise = 0;
      sgstPaise = Math.round((taxableBase * ratePct) / 100); // Represent as single pool
    } else {
      // Standard intra-state split (CGST + SGST)
      const halfRate = ratePct / 2;
      cgstPaise = Math.round((taxableBase * halfRate) / 100);
      sgstPaise = Math.round((taxableBase * halfRate) / 100);
    }
  }

  const gstPaise = cgstPaise + sgstPaise;
  const adjustmentPaise = (adjustment?.cashAdvancePaise ?? 0) + (adjustment?.goldValuePaise ?? 0);
  const grandTotalPaise = subtotalPaise + gstPaise - adjustmentPaise;
  const paidPaise = payments
    .filter((p) => p.mode !== "outstanding")
    .reduce((s, p) => s + p.amountPaise, 0);
  const balancePaise = grandTotalPaise - paidPaise;

  return {
    subtotalPaise,
    cgstPaise,
    sgstPaise,
    gstPaise,
    adjustmentPaise,
    grandTotalPaise,
    paidPaise,
    balancePaise,
  };
}

const invoiceRepository = createRepository<Invoice>("invoices");
const paymentRepository = createRepository<PaymentRecord>("payments");

export const useBilling = create<BillingState>()((set, get) => ({
  invoices: [],
  gstDefault: "gst3",
  setGstDefault: (g) => {
    set({ gstDefault: g });
    void saveDirect("app_settings", "billing_prefs", { id: "billing_prefs", gstDefault: g });
  },
  refresh: async () => {
    const { currentUserRole, selectedBranchId } = useSettings.getState();
    const GLOBAL_ROLES = ["Super Owner", "Administrator", "CEO (View Only)"];
    const bid =
      !currentUserRole || GLOBAL_ROLES.includes(currentUserRole)
        ? null
        : selectedBranchId || "MAIN";
    let invoiceQ = supabase.from("invoices").select("data").limit(10000);
    if (bid) invoiceQ = invoiceQ.filter("data->>branchId", "eq", bid) as typeof invoiceQ;
    const [invoiceRes, prefsRes] = await Promise.all([
      invoiceQ,
      supabase.from("app_settings").select("data").eq("id", "billing_prefs").maybeSingle(),
    ]);
    if (!invoiceRes.error) {
      const rows = (invoiceRes.data ?? [])
        .map((r) => r.data as Invoice | null)
        .filter((i): i is Invoice => !!i && !!i.id && !!i.invoiceNo);
      set({ invoices: rows });
    }
    if (!prefsRes.error && prefsRes.data?.data) {
      const prefs = prefsRes.data.data as any;
      if (prefs.gstDefault) set({ gstDefault: prefs.gstDefault });
    }
  },
  add: async (input) => {
    const now = Date.now();
    const inv: Invoice = {
      branchId: (input as any).branchId ?? useSettings.getState().selectedBranchId ?? undefined,
      id: makeId("inv"),
      createdAt: now,
      updatedAt: now,
      payments: input.payments ?? [],
      ...input,
      invoiceNo: input.invoiceNo ?? makeInvoiceNo(get().invoices),
    };
    await invoiceRepository.save(inv);
    // Optimistic local update — realtime will confirm from DB
    set((s) => ({ invoices: [inv, ...s.invoices] }));

    // Event-driven communication automation (Plan 1 Step 9) — no-op unless
    // the "invoice_created" rule is enabled in Communication Automation
    // Settings; never blocks or can fail the invoice creation itself.
    import("@/lib/people-store")
      .then(({ usePeople }) => {
        const person = usePeople.getState().people.find((p) => p.id === (inv as any).customerId);
        return import("@/lib/comm/comm-automation").then(({ emitBusinessEvent }) =>
          emitBusinessEvent("invoice_created", {
            branchId: inv.branchId ?? "default",
            recipient: {
              name: inv.customerName,
              phone: inv.customerPhone,
              email: person?.email,
            },
            linkedId: inv.id,
            linkedType: "invoice",
          }),
        );
      })
      .catch((err) => console.error("[Billing] invoice_created automation failed:", err));

    return inv;
  },
  update: async (id, patch) => {
    const inv = get().invoices.find((i) => i.id === id);
    if (!inv) return;
    const updated = { ...inv, ...patch, updatedAt: Date.now() };
    await invoiceRepository.save(updated);
    set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? updated : i)) }));
  },
  addPayment: async (invoiceId, p) => {
    const inv = get().invoices.find((x) => x.id === invoiceId);
    if (!inv) return null;
    const pay: PaymentRecord = {
      id: p.id ?? makeId("pay"),
      ts: p.ts ?? Date.now(),
      mode: p.mode,
      amountPaise: p.amountPaise,
      reference: p.reference,
      notes: p.notes,
      goldGrossMg: p.goldGrossMg,
      goldPurity: p.goldPurity,
      goldFineMg: p.goldFineMg,
      goldRatePerGramPaise: p.goldRatePerGramPaise,
    };
    const payments = [...inv.payments, pay];
    const totals = computeInvoiceTotals(inv.items, inv.gst, inv.orderAdjustment, payments);
    const status: InvoiceStatus =
      totals.balancePaise <= 0
        ? "paid"
        : totals.paidPaise > 0
          ? "partial"
          : inv.status === "draft"
            ? "draft"
            : "issued";
    const updatedInv = { ...inv, payments, ...totals, status, updatedAt: Date.now() };

    // Save the payment item itself for audit trailing
    await saveDirect("payments", pay.id, { ...pay, invoiceId });
    // Update the invoice (which contains nested payments array)
    await invoiceRepository.save(updatedInv);
    set((s) => ({ invoices: s.invoices.map((i) => (i.id === invoiceId ? updatedInv : i)) }));

    // Event-driven communication automation (Plan 1 Step 9) — no-op unless
    // the relevant rule is enabled; never blocks or can fail payment recording.
    import("@/lib/people-store")
      .then(({ usePeople }) => {
        const person = usePeople.getState().people.find((pr) => pr.id === (updatedInv as any).customerId);
        const recipient = {
          name: updatedInv.customerName,
          phone: updatedInv.customerPhone,
          email: person?.email,
        };
        return import("@/lib/comm/comm-automation").then(({ emitBusinessEvent }) =>
          Promise.all([
            emitBusinessEvent("payment_received", {
              branchId: updatedInv.branchId ?? "default",
              recipient,
              linkedId: updatedInv.id,
              linkedType: "invoice",
            }),
            status === "paid"
              ? emitBusinessEvent("invoice_paid", {
                  branchId: updatedInv.branchId ?? "default",
                  recipient,
                  linkedId: updatedInv.id,
                  linkedType: "invoice",
                })
              : Promise.resolve(),
          ]),
        );
      })
      .catch((err) => console.error("[Billing] payment automation failed:", err));

    return pay;
  },
  remove: async (id) => {
    const inv = get().invoices.find((i) => i.id === id);
    if (inv) {
      // Remove linked payments too
      for (const p of inv.payments) {
        await paymentRepository.delete(p.id);
      }
    }
    await invoiceRepository.delete(id);
    set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) }));
  },
  reset: () => set({ invoices: [] }),
}));

/** Build a per-customer ledger from invoices. */
export function customerLedger(
  customerId: string,
  invoices: Invoice[],
): {
  lines: CustomerLedgerLine[];
  totalDebit: number;
  totalCredit: number;
  outstanding: number;
} {
  const lines: CustomerLedgerLine[] = [];
  if (!customerId || !Array.isArray(invoices)) {
    return { lines, totalDebit: 0, totalCredit: 0, outstanding: 0 };
  }
  for (const inv of invoices) {
    if (!inv || inv.customerId !== customerId) continue;
    // Adjustments first (chronologically before invoice)
    if (inv.orderAdjustment?.cashAdvancePaise) {
      lines.push({
        ts: inv.createdAt - 1,
        kind: "advance",
        ref: inv.orderNo ?? inv.invoiceNo,
        refId: inv.orderId ?? inv.id,
        orderId: inv.orderId,
        invoiceId: inv.id,
        description: `Cash advance for ${inv.orderNo ?? inv.invoiceNo}`,
        debitPaise: 0,
        creditPaise: inv.orderAdjustment.cashAdvancePaise,
      });
    }
    if (inv.orderAdjustment?.goldValuePaise) {
      lines.push({
        ts: inv.createdAt - 1,
        kind: "old_gold",
        ref: inv.orderNo ?? inv.invoiceNo,
        refId: inv.orderId ?? inv.id,
        orderId: inv.orderId,
        invoiceId: inv.id,
        description: `Old gold applied (${(inv.orderAdjustment.goldFineMg / 1000).toFixed(3)} g fine)`,
        debitPaise: 0,
        creditPaise: inv.orderAdjustment.goldValuePaise,
      });
    }
    lines.push({
      ts: inv.createdAt,
      kind: "invoice",
      ref: inv.invoiceNo,
      refId: inv.id,
      invoiceId: inv.id,
      orderId: inv.orderId,
      description: `Invoice ${inv.invoiceNo}${inv.items[0] ? ` · ${inv.items[0].itemName}` : ""}`,
      debitPaise: inv.subtotalPaise + inv.gstPaise,
      creditPaise: 0,
    });
    for (const p of inv.payments) {
      lines.push({
        ts: p.ts,
        kind: "payment",
        ref: `${inv.invoiceNo} · ${PAYMENT_MODE_LABELS[p.mode]}`,
        refId: p.id,
        invoiceId: inv.id,
        orderId: inv.orderId,
        description:
          p.notes ?? PAYMENT_MODE_LABELS[p.mode] + (p.reference ? ` · ${p.reference}` : ""),
        debitPaise: p.mode === "outstanding" ? 0 : 0,
        creditPaise: p.mode === "outstanding" ? 0 : p.amountPaise,
      });
    }
  }
  lines.sort((a, b) => a.ts - b.ts);
  const totalDebit = lines.reduce((s, l) => s + l.debitPaise, 0);
  const totalCredit = lines.reduce((s, l) => s + l.creditPaise, 0);
  return { lines, totalDebit, totalCredit, outstanding: totalDebit - totalCredit };
}

export function paiseToRupees(p: number): string {
  const abs = Math.abs(p);
  const r = Math.floor(abs / 100);
  const c = String(abs % 100).padStart(2, "0");
  return `${p < 0 ? "-" : ""}${r.toLocaleString("en-IN")}.${c}`;
}

export function rupeesToPaise(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  const s = String(input).trim();
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
